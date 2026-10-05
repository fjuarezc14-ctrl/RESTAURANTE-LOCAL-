// Cobro de mesas: POST /api/ventas
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirCaja, api, cobrar, crearBase, crearCliente, enviarPedido, item, limpiarBD, mesaListaParaCobrar, prisma,
} from './helpers.mjs';

let carta;
const pedidoDeMesa = (mesa = 1) => mesaListaParaCobrar(mesa, [item(carta.lomo, 2), item(carta.gaseosa, 1)]); // S/ 54.50

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
});

describe('requisitos para cobrar', () => {
  it('no cobra con la caja cerrada', async () => {
    const pedidoId = await pedidoDeMesa();
    const res = await cobrar(pedidoId);
    expect(res.status).toBe(400);
    expect(res.body.cajaCerrada).toBe(true);
    expect(await prisma.venta.count()).toBe(0);
  });

  it('no cobra una mesa con platos en preparación', async () => {
    await abrirCaja();
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    const res = await cobrar(pedidoId);
    expect(res.status).toBe(409);
    expect(res.body.enPreparacion).toBe(true);
    expect(await prisma.venta.count()).toBe(0);
  });

  it('no cobra una mesa con platos listos que el mozo no ha servido', async () => {
    await abrirCaja();
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    await api().patch(`/api/pedidos/${pedidoId}/servir`);
    const res = await cobrar(pedidoId);
    expect(res.status).toBe(409);
    expect(res.body.porServir).toBe(true);
  });
});

describe('totales e IGV', () => {
  it('cobra en efectivo con IGV incluido, cierra el pedido y libera la mesa', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa(1);
    const res = await cobrar(pedidoId);
    expect(res.status).toBe(200);

    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({
      total: 54.5, subtotal: 49.32, igv: 5.18, metodoPago: 'Efectivo',
      montoEfectivo: 54.5, montoTarjeta: 0, montoYape: 0, montoCredito: 0, tipoComprobante: 'Ticket',
    });
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Cobrado');
    expect((await prisma.mesa.findUnique({ where: { numero: 1 } })).estado).toBe('Libre');
  });

  it('resta el descuento del total y recalcula el IGV', async () => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { descuentoAplicado: 4.5, ofertaDescripcion: 'Promo' });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ total: 50, subtotal: 45.25, igv: 4.75, descuentoAplicado: 4.5, montoEfectivo: 50 });
  });

  it('un descuento mayor que el total deja la venta en 0', async () => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { descuentoAplicado: 80 });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ total: 0, subtotal: 0, igv: 0 });
  });

  it('el total sale de los ítems guardados, no del total que envía la pantalla', async () => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { total: 1 });
    expect((await prisma.venta.findUnique({ where: { id: res.body.ventaId } })).total).toBe(54.5);
  });

  it('consolida varios pedidos de la misma mesa en una sola venta', async () => {
    await abrirCaja();
    const p1 = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const p2 = await mesaListaParaCobrar(1, [item(carta.gaseosa, 2)]);
    const res = await cobrar(null, { pedidoIds: [p1, p2] });
    expect(res.status).toBe(200);
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ pedidoId: p2, total: 32.5 });
    expect(await prisma.itemPedido.count({ where: { pedidoId: p2 } })).toBe(2);
    expect((await prisma.pedido.findUnique({ where: { id: p1 } })).estado).toBe('Cobrado');
  });
});

describe('medios de pago', () => {
  it.each([
    ['Tarjeta', { montoTarjeta: 54.5 }],
    ['Yape', { montoYape: 54.5 }],
  ])('%s: todo el total va a ese medio', async (metodoPago, esperado) => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { metodoPago, codigoPago: 'OP-123' });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ montoEfectivo: 0, montoCredito: 0, codigoPago: 'OP-123', ...esperado });
  });

  it('efectivo: ignora el código de operación', async () => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { codigoPago: 'OP-123' });
    expect((await prisma.venta.findUnique({ where: { id: res.body.ventaId } })).codigoPago).toBeNull();
  });

  it('mixto: guarda cada parte tal como llega, incluido el crédito', async () => {
    await abrirCaja();
    const cliente = await crearCliente('Juan Pérez');
    const res = await cobrar(await pedidoDeMesa(), {
      metodoPago: 'Mixto', montoEfectivo: 20, montoYape: 14.5, montoCredito: 20, clienteCreditoId: cliente.id,
    });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({
      total: 54.5, montoEfectivo: 20, montoTarjeta: 0, montoYape: 14.5, montoCredito: 20, clienteCreditoId: cliente.id,
    });
  });

  it('crédito: todo el total queda como deuda del cliente', async () => {
    await abrirCaja();
    const cliente = await crearCliente('Juan Pérez');
    const res = await cobrar(await pedidoDeMesa(), { metodoPago: 'Crédito', clienteCreditoId: cliente.id });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ montoCredito: 54.5, montoEfectivo: 0, clienteCreditoId: cliente.id });
  });

  it('crédito sin cliente: no registra la venta', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    const res = await cobrar(pedidoId, { metodoPago: 'Crédito' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.venta.count()).toBe(0);
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Servido');
  });

  it('crédito repartido entre dos clientes: cada uno debe su parte', async () => {
    await abrirCaja();
    const [ana, beto] = await Promise.all([crearCliente('Ana'), crearCliente('Beto')]);
    const res = await cobrar(await pedidoDeMesa(), {
      metodoPago: 'Crédito',
      creditosDetalle: [{ clienteId: ana.id, nombre: 'Ana', monto: 30 }, { clienteId: beto.id, nombre: 'Beto', monto: 24.5 }],
    });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ montoCredito: 54.5, clienteCreditoId: ana.id, nombreCliente: 'Ana, Beto' });

    const saldoAna = (await api().get(`/api/clientes/${ana.id}`)).body.saldo;
    const saldoBeto = (await api().get(`/api/clientes/${beto.id}`)).body.saldo;
    expect([saldoAna, saldoBeto]).toEqual([30, 24.5]);
  });
});

describe('cortesías', () => {
  it('cortesía total: la venta queda en 0 y el descuento es el total del pedido', async () => {
    await abrirCaja();
    const res = await cobrar(await pedidoDeMesa(), { metodoPago: 'Cortesía', motivoCortesia: 'Cumpleaños' });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ total: 0, montoEfectivo: 0, descuentoAplicado: 54.5 });
    expect(venta.ofertaDescripcion).toBe('Cortesía total del pedido (Cumpleaños)');
  });

  it('cortesía de un ítem: ese ítem pasa a 0 y se descuenta del total', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    const gaseosa = await prisma.itemPedido.findFirst({ where: { pedidoId, productoId: carta.gaseosa.id } });
    const res = await cobrar(pedidoId, { cortesiaItemIds: [gaseosa.id] });
    const venta = await prisma.venta.findUnique({ where: { id: res.body.ventaId } });
    expect(venta).toMatchObject({ total: 51, montoEfectivo: 51, descuentoAplicado: 3.5 });
    expect((await prisma.itemPedido.findUnique({ where: { id: gaseosa.id } })).precio).toBe(0);
  });
});

describe('doble cobro', () => {
  it('cobrar dos veces el mismo pedido devuelve la misma venta', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    const primera = await cobrar(pedidoId);
    const segunda = await cobrar(pedidoId);
    expect(segunda.status).toBe(200);
    expect(segunda.body).toMatchObject({ yaCobrado: true, ventaId: primera.body.ventaId });
    expect(await prisma.venta.count()).toBe(1);
  });

  it('dos cobros simultáneos del mismo pedido registran una sola venta', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    const respuestas = await Promise.all([cobrar(pedidoId), cobrar(pedidoId), cobrar(pedidoId)]);
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    expect(new Set(respuestas.map((r) => r.body.ventaId)).size).toBe(1);
    expect(await prisma.venta.count()).toBe(1);
  });
});
