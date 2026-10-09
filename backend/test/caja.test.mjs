// Caja: apertura, movimientos, arqueo en vivo, cierre y anulación de ventas
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PIN_ADMIN, PIN_CAJERO, abrirCaja, api, cobrar, crearBase, crearCliente, esperarError, item, limpiarBD, mesaListaParaCobrar, prisma,
} from './helpers.mjs';

let carta;
const pedidoDeMesa = (mesa = 1) => mesaListaParaCobrar(mesa, [item(carta.lomo, 2), item(carta.gaseosa, 1)]); // S/ 54.50
const estado = async () => (await api().get('/api/caja/estado')).body;
const movimiento = (datos) => api().post('/api/caja/movimientos').send({ cajeroNombre: 'Carla Caja', ...datos });
const anular = (ventaId, pin = PIN_ADMIN) => api().patch(`/api/ventas/${ventaId}/anular`).send({ pin, motivo: 'Cliente devolvió' });

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
});

describe('apertura', () => {
  it('abre la caja con el fondo inicial', async () => {
    const turno = await abrirCaja(150);
    expect(turno).toMatchObject({ estado: 'ABIERTO', montoInicial: 150, cajeroNombre: 'Carla Caja' });
    expect((await estado()).abierto).toBe(true);
  });

  it('exige el nombre del cajero', async () => {
    esperarError(await api().post('/api/caja/apertura').send({ montoInicial: 100 }), 400, 'VALIDACION', 'cajeroNombre');
  });

  it('no permite dos cajas abiertas a la vez', async () => {
    await abrirCaja();
    esperarError(await api().post('/api/caja/apertura').send({ cajeroNombre: 'Otro', montoInicial: 50 }), 409, 'CAJA_YA_ABIERTA');
    expect(await prisma.cierreCaja.count()).toBe(1);
  });

  it('rechaza un fondo negativo', async () => {
    const res = await api().post('/api/caja/apertura').send({ cajeroNombre: 'Carla', montoInicial: -20 });
    esperarError(res, 400, 'VALIDACION', 'montoInicial');
  });
});

describe('movimientos', () => {
  it('no registra movimientos con la caja cerrada', async () => {
    esperarError(await movimiento({ monto: 10, motivo: 'Gas' }), 409, 'CAJA_CERRADA');
  });

  it.each([
    ['monto 0', { monto: 0, motivo: 'Gas' }, 'monto'],
    ['monto negativo', { monto: -5, motivo: 'Gas' }, 'monto'],
    ['sin motivo', { monto: 10, motivo: '  ' }, 'motivo'],
  ])('rechaza %s', async (_caso, datos, campo) => {
    await abrirCaja();
    esperarError(await movimiento(datos), 400, 'VALIDACION', campo);
    expect(await prisma.movimientoCaja.count()).toBe(0);
  });

  it('un tipo desconocido se guarda como retiro', async () => {
    await abrirCaja();
    const res = await movimiento({ monto: 10, motivo: 'Gas', tipo: 'OTRO' });
    expect(res.body.movimiento).toMatchObject({ tipo: 'RETIRO', monto: 10 });
  });
});

describe('arqueo en vivo', () => {
  it('suma ventas, abonos e ingresos y resta retiros para el efectivo esperado', async () => {
    await abrirCaja(100);
    await cobrar(await pedidoDeMesa(1)); // efectivo 54.50
    await cobrar(await pedidoDeMesa(2), { metodoPago: 'Tarjeta' }); // tarjeta 54.50
    const cliente = await crearCliente('Juan');
    await cobrar(await pedidoDeMesa(3), { metodoPago: 'Crédito', clienteCreditoId: cliente.id }); // crédito 54.50
    await api().post(`/api/clientes/${cliente.id}/abonar`).send({ monto: 10, metodoPago: 'Efectivo' });
    await api().post(`/api/clientes/${cliente.id}/abonar`).send({ monto: 5, metodoPago: 'Yape' });
    await movimiento({ monto: 5, motivo: 'Sencillo', tipo: 'INGRESO' });
    await movimiento({ monto: 20, motivo: 'Compra de hielo' });

    const { resumenEnVivo } = await estado();
    expect(resumenEnVivo).toMatchObject({
      montoInicial: 100,
      ventasEfectivo: 54.5,
      ventasTarjeta: 54.5,
      ventasYape: 5, // incluye el abono por Yape
      totalVentas: 163.5,
      cantidadVentas: 3,
      abonosEfectivo: 10,
      ingresosExtra: 5,
      retirosCaja: 20,
      efectivoEsperadoEnGaveta: 149.5, // 100 + 54.50 + 10 + 5 - 20
    });
  });

  it('la parte en efectivo de un pago mixto entra al efectivo esperado', async () => {
    await abrirCaja(0);
    await cobrar(await pedidoDeMesa(), { metodoPago: 'Mixto', montoEfectivo: 30, montoTarjeta: 24.5 });
    const { resumenEnVivo } = await estado();
    expect(resumenEnVivo).toMatchObject({ ventasEfectivo: 30, ventasTarjeta: 24.5, efectivoEsperadoEnGaveta: 30 });
  });
});

describe('cierre', () => {
  it('cierra el turno con la diferencia entre lo contado y lo esperado (calculado por el servidor)', async () => {
    await abrirCaja(100);
    await cobrar(await pedidoDeMesa()); // S/ 54.50 en efectivo
    const res = await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla Caja', efectivoContado: 150 });
    expect(res.status).toBe(200);
    expect(res.body.cierre).toMatchObject({ estado: 'CERRADO', efectivoVentas: 54.5, efectivoEsperado: 154.5, efectivoContado: 150, diferencia: -4.5 });
    expect((await estado()).abierto).toBe(false);
  });

  it('una diferencia negativa (faltante) se guarda negativa', async () => {
    await abrirCaja(100);
    const res = await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoEsperado: 100, efectivoContado: 87.3 });
    expect(res.body.cierre.diferencia).toBe(-12.7);
  });

  it('ignora el esperado y los totales que mande la pantalla: usa los del arqueo en vivo', async () => {
    await abrirCaja(100);
    const enVivo = (await estado()).resumenEnVivo.efectivoEsperadoEnGaveta;
    const res = await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoEsperado: 999, totalTarjeta: 500, efectivoContado: 100 });
    expect(res.body.cierre).toMatchObject({ efectivoEsperado: enVivo, totalTarjeta: 0, diferencia: 0 });
  });

  it('sin conteo físico no queda diferencia', async () => {
    await abrirCaja(100);
    const res = await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla' });
    expect(res.body.cierre).toMatchObject({ efectivoEsperado: 100, efectivoContado: 100, diferencia: 0 });
  });

  it('rechaza montos negativos', async () => {
    await abrirCaja();
    esperarError(await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoContado: -1 }), 400, 'VALIDACION');
    expect((await estado()).abierto).toBe(true);
  });

  it('no cierra si no hay caja abierta', async () => {
    esperarError(await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoContado: 0 }), 409, 'CAJA_CERRADA');
  });

  it('después del cierre no se puede cobrar', async () => {
    await abrirCaja();
    const pedidoId = await pedidoDeMesa();
    await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoContado: 100, efectivoEsperado: 100 });
    esperarError(await cobrar(pedidoId), 409, 'CAJA_CERRADA');
  });

  it('cierre forzado: solo con el PIN de un administrador', async () => {
    await abrirCaja();
    esperarError(await api().post('/api/caja/cierre-forzado').send({ adminPin: PIN_CAJERO }), 403, 'SIN_PERMISO');

    const conAdmin = await api().post('/api/caja/cierre-forzado').send({ adminPin: PIN_ADMIN, motivo: 'Fin de día' });
    expect(conAdmin.status).toBe(200);
    expect(conAdmin.body.cierre).toMatchObject({ estado: 'CERRADO', cerradoPorAdmin: true });
  });
});

describe('anulación de ventas', () => {
  it('solo el administrador puede anular', async () => {
    await abrirCaja();
    const { body } = await cobrar(await pedidoDeMesa());
    esperarError(await anular(body.ventaId, '9999'), 401, 'PIN_INCORRECTO', 'pin');
    esperarError(await anular(body.ventaId, PIN_CAJERO), 403, 'SIN_PERMISO');
    expect((await prisma.venta.findUnique({ where: { id: body.ventaId } })).anulado).toBe(false);
  });

  it('deja la venta en 0, guarda el monto original y la saca del arqueo', async () => {
    await abrirCaja(100);
    const pedidoId = await pedidoDeMesa();
    const { body } = await cobrar(pedidoId);
    const res = await anular(body.ventaId);
    expect(res.status).toBe(200);

    const venta = await prisma.venta.findUnique({ where: { id: body.ventaId } });
    expect(venta).toMatchObject({ anulado: true, total: 0, montoEfectivo: 0, montoOriginal: 54.5, anuladoPor: 'Admin' });
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Cancelado');
    expect((await estado()).resumenEnVivo).toMatchObject({ totalVentas: 0, ventasEfectivo: 0, efectivoEsperadoEnGaveta: 100 });
  });

  it('no anula dos veces', async () => {
    await abrirCaja();
    const { body } = await cobrar(await pedidoDeMesa());
    await anular(body.ventaId);
    esperarError(await anular(body.ventaId), 409, 'CONFLICTO');
  });

  it('devuelve el stock de los productos limitados', async () => {
    await abrirCaja();
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.postre, 2)]);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(3);
    const { body } = await cobrar(pedidoId);
    await anular(body.ventaId);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(5);
  });

  it('anular una venta en efectivo de un turno anterior registra el retiro en el turno actual', async () => {
    await abrirCaja(100);
    const { body } = await cobrar(await pedidoDeMesa());
    await api().post('/api/caja/cierre').send({ cajeroNombre: 'Carla', efectivoEsperado: 154.5, efectivoContado: 154.5 });
    const turnoNuevo = await abrirCaja(100);

    await anular(body.ventaId);
    const retiro = await prisma.movimientoCaja.findFirst({ where: { turnoId: turnoNuevo.id } });
    expect(retiro).toMatchObject({ tipo: 'RETIRO', monto: 54.5 });
    expect((await estado()).resumenEnVivo.efectivoEsperadoEnGaveta).toBe(45.5);
  });
});

describe('stock', () => {
  it('no envía un pedido si no alcanza el stock y no descuenta nada', async () => {
    const res = await api().post('/api/mesas/1/pedido').send({ mesero: 'Mozo', items: [item(carta.postre, 6)] });
    esperarError(res, 409, 'STOCK_INSUFICIENTE');
    expect(res.body.error.datos).toEqual({ disponible: 5 });
    expect(await prisma.pedido.count()).toBe(0);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(5);
  });

  it('dos pedidos simultáneos por el último stock: solo uno se lleva las unidades', async () => {
    const pedir = (mesa) => api().post(`/api/mesas/${mesa}/pedido`).send({ mesero: 'Mozo', items: [item(carta.postre, 3)] });
    const respuestas = await Promise.all([pedir(1), pedir(2)]);
    expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(2);
  });
});
