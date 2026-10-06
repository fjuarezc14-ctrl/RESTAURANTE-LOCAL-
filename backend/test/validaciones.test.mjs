// Validación de entrada (tarea 5): esquemas zod, límites y reglas de dinero
import { beforeEach, describe, expect, it } from 'vitest';
import {
  abrirCaja, api, cobrar, crearBase, crearCliente, esperarError, item, limpiarBD, mesaListaParaCobrar, prisma,
} from './helpers.mjs';

let carta;

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
});

describe('base', () => {
  it.each([
    ['get', '/api/clientes/abc', 'id'],
    ['patch', '/api/ventas/-3/anular', 'ventaId'],
    ['patch', '/api/pedidos/items/1.5/entregar', 'itemId'],
    ['post', '/api/mesas/cero/pedido', 'num'],
  ])('%s %s: un ID no numérico en la URL → VALIDACION', async (metodo, url, campo) => {
    esperarError(await api()[metodo](url).send({}), 400, 'VALIDACION', campo);
  });

  it('un cuerpo de más de 100 KB → 413', async () => {
    const res = await api().post('/api/caja/apertura').send({ cajeroNombre: 'x', nota: 'a'.repeat(110 * 1024) });
    esperarError(res, 413, 'CUERPO_DEMASIADO_GRANDE');
  });

});

describe('cobro', () => {
  const pedidoDeMesa = (mesa = 1) => mesaListaParaCobrar(mesa, [item(carta.lomo, 2), item(carta.gaseosa, 1)]); // S/ 54.50

  it('rechaza un método de pago que no existe', async () => {
    await abrirCaja();
    esperarError(await cobrar(await pedidoDeMesa(), { metodoPago: 'Bitcoin' }), 400, 'VALIDACION', 'metodoPago');
  });

  it('rechaza montos negativos o con más de 2 decimales', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    esperarError(await cobrar(pedidoId, { descuentoAplicado: -10 }), 400, 'VALIDACION', 'descuentoAplicado');
    esperarError(await cobrar(pedidoId, { metodoPago: 'Mixto', montoEfectivo: 54.555 }), 400, 'VALIDACION', 'montoEfectivo');
    expect(await prisma.venta.count()).toBe(0);
  });

  it('mixto: las partes tienen que sumar el total', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    const res = await cobrar(pedidoId, { metodoPago: 'Mixto', montoEfectivo: 10, montoTarjeta: 20 });
    esperarError(res, 400, 'PAGO_NO_CUADRA', 'montoEfectivo');
    expect(await prisma.venta.count()).toBe(0);
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Servido');
  });

  it('crédito repartido: los montos de los clientes tienen que sumar el total', async () => {
    await abrirCaja();
    const [ana, beto] = await Promise.all([crearCliente('Ana'), crearCliente('Beto')]);
    const res = await cobrar(await pedidoDeMesa(), {
      metodoPago: 'Crédito',
      creditosDetalle: [{ clienteId: ana.id, monto: 10 }, { clienteId: beto.id, monto: 10 }],
    });
    esperarError(res, 400, 'PAGO_NO_CUADRA', 'creditosDetalle');
  });

  it('una cortesía no puede tocar un ítem de otra mesa', async () => {
    await abrirCaja();
    const mesa1 = await pedidoDeMesa(1);
    const mesa2 = await pedidoDeMesa(2);
    const platoAjeno = await prisma.itemPedido.findFirst({ where: { pedidoId: mesa2, productoId: carta.lomo.id } });
    const res = await cobrar(mesa1, { cortesiaItemIds: [platoAjeno.id] });
    expect(res.status).toBe(200);
    expect((await prisma.venta.findUnique({ where: { id: res.body.ventaId } })).total).toBe(54.5);
    expect((await prisma.itemPedido.findUnique({ where: { id: platoAjeno.id } })).precio).toBe(25.5);
  });
});

describe('caja', () => {
  it('acepta montos como texto y rechaza texto que no es número', async () => {
    await abrirCaja();
    const ok = await api().post('/api/caja/movimientos').send({ monto: '12.50', motivo: 'Gas' });
    expect(ok.body.movimiento.monto).toBe(12.5);
    esperarError(await api().post('/api/caja/movimientos').send({ monto: 'doce', motivo: 'Gas' }), 400, 'VALIDACION', 'monto');
  });

  it('rechaza textos demasiado largos', async () => {
    await abrirCaja();
    esperarError(await api().post('/api/caja/movimientos').send({ monto: 5, motivo: 'x'.repeat(301) }), 400, 'VALIDACION', 'motivo');
  });

  it('rechaza un rango de fechas al revés', async () => {
    const res = await api().get('/api/caja/movimientos?desde=2026-10-05&hasta=2026-10-01');
    esperarError(res, 400, 'VALIDACION', 'hasta');
  });
});
