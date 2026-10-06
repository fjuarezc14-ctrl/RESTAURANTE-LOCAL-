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

describe('pedidos: precio contra la carta', () => {
  const pedir = (items) => api().post('/api/mesas/1/pedido').send({ mesero: 'Mozo', items });

  it('acepta el precio de la carta', async () => {
    expect((await pedir([item(carta.lomo, 1)])).status).toBe(200);
  });

  it('rechaza un precio menor al de la carta y no crea el pedido', async () => {
    const res = await pedir([{ ...item(carta.lomo, 1), precio: 1 }]);
    esperarError(res, 400, 'VALIDACION', 'items');
    expect(res.body.error.datos).toMatchObject({ productoId: carta.lomo.id, precioCarta: 25.5 });
    expect(await prisma.pedido.count()).toBe(0);
  });

  it('rechaza un producto que no está en la carta (antes se cobraba como el primero de la carta)', async () => {
    esperarError(await pedir([{ nombre: 'Plato inventado', precio: 0.5, cant: 1 }]), 400, 'VALIDACION', 'items');
    expect(await prisma.pedido.count()).toBe(0);
  });

  it('acepta los extras que el producto permite y rechaza pasarse de ellos', async () => {
    const parrilla = await prisma.producto.create({
      data: {
        nombre: 'Parrilla', categoria: 'Platos de Fondo', precio: 40,
        opcionesConfig: JSON.stringify([{ name: 'Término', options: ['Jugoso', { label: 'Con chorizo', precioExtra: 6 }] }]),
        complementos: JSON.stringify([{ nombre: 'Huevo', incluido: false, precio: 2 }]),
      },
    });
    expect((await pedir([{ ...item(parrilla, 1), precio: 48 }])).status).toBe(200); // 40 + 6 + 2
    esperarError(await pedir([{ ...item(parrilla, 1), precio: 48.5 }]), 400, 'VALIDACION', 'items');
  });

  it('valida cantidad y precio de cada ítem', async () => {
    esperarError(await pedir([{ ...item(carta.lomo, 1), cantidad: 0 }]), 400, 'VALIDACION', 'items.0.cantidad');
    esperarError(await pedir([{ ...item(carta.lomo, 1), precio: 'gratis' }]), 400, 'VALIDACION', 'items.0.precio');
  });
});

describe('delivery', () => {
  const llevar = (datos) => api().post('/api/pedidos/llevar').send({ tipoDelivery: 'ParaLlevar', cajero: 'Carla', ...datos });
  const itemsDelivery = () => [{ nombre: 'Lomo Saltado', precio: 25.5, cant: 2 }]; // S/ 51

  it('acepta una cortesía (precio 0 con la marca) y rechaza un precio 0 sin ella', async () => {
    await abrirCaja();
    const cortesia = await llevar({ metodoPago: 'Efectivo', items: [...itemsDelivery(), { nombre: 'Inca Kola', precio: 0, cant: 1, notas: '[CORTESÍA]' }] });
    expect(cortesia.status).toBe(200);
    esperarError(await llevar({ metodoPago: 'Efectivo', items: [{ nombre: 'Inca Kola', precio: 0, cant: 1 }] }), 400, 'VALIDACION', 'items');
  });

  it('mixto: las partes tienen que sumar el total (con el costo de envío)', async () => {
    await abrirCaja();
    esperarError(await llevar({ metodoPago: 'Mixto', items: itemsDelivery(), montoDelivery: 5, montoEfectivo: 20, montoYape: 20 }), 400, 'PAGO_NO_CUADRA');
    const ok = await llevar({ metodoPago: 'Mixto', items: itemsDelivery(), montoDelivery: 5, montoEfectivo: 26, montoYape: 30 });
    expect(ok.status).toBe(200);
  });

  it('rechaza un descuento de más de 100%', async () => {
    await abrirCaja();
    esperarError(await llevar({ metodoPago: 'Efectivo', items: itemsDelivery(), descuentoPorcentaje: 150 }), 400, 'VALIDACION', 'descuentoPorcentaje');
  });
});
