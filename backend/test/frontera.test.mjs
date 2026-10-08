// Casos frontera (tarea 12): carreras entre dispositivos, doble clic y turnos que cruzan la medianoche
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirCaja, api, cobrar, crearBase, esperarError, item, limpiarBD, mesaListaParaCobrar, prisma } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { obtenerSiguienteSerieYNumero } = require('../src/servicios/correlativos.js');

let carta;
const contar = (modelo, where = {}) => prisma[modelo].count({ where });

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
});

describe('dos dispositivos a la vez', () => {
  it('dos cajeros cobran la misma mesa al mismo tiempo: una sola venta y todos ven esa misma', async () => {
    await abrirCaja();
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 2)]);
    const respuestas = await Promise.all([cobrar(pedidoId), cobrar(pedidoId), cobrar(pedidoId)]);
    // Venta.pedidoId es único: el primero gana y los demás reciben la venta que ya existe
    expect(await contar('venta')).toBe(1);
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    expect(new Set(respuestas.map((r) => r.body.ventaId)).size).toBe(1);
    expect(Number((await prisma.venta.findFirst()).total)).toBe(51);
  });

  it('dos cajeros abren caja a la vez: un solo turno abierto', async () => {
    const abrir = () => api().post('/api/caja/apertura').send({ cajeroNombre: 'Carla Caja', montoInicial: 50 });
    const respuestas = await Promise.all([abrir(), abrir(), abrir()]);
    expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await contar('cierreCaja', { estado: 'ABIERTO' })).toBe(1);
  });

  it('el último producto en stock pedido desde dos mesas: solo una lo obtiene y el stock no queda negativo', async () => {
    await prisma.producto.update({ where: { id: carta.postre.id }, data: { stock: 1 } });
    const pedir = (mesa) => api().post(`/api/mesas/${mesa}/pedido`).send({ mesero: 'Mozo', items: [item(carta.postre, 1)], total: 0 });
    const respuestas = await Promise.all([pedir(1), pedir(2), pedir(3)]);
    expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
    expect(respuestas.filter((r) => r.body?.error?.codigo === 'STOCK_INSUFICIENTE')).toHaveLength(2);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(0);
  });

  it('correlativos de boletas con cobros simultáneos: sin repetidos', async () => {
    const pedidos = await Promise.all(Array.from({ length: 6 }, () => prisma.pedido.create({ data: { mesero: 'Caja', total: 10, estado: 'Cobrado' } })));
    const numeros = await Promise.all(pedidos.map((p) => prisma.$transaction(async (tx) => {
      const { serie, numero } = await obtenerSiguienteSerieYNumero('Boleta', tx);
      await tx.venta.create({ data: { pedidoId: p.id, tipoComprobante: 'Boleta', serie, numero, total: 10, subtotal: 9.05, igv: 0.95, metodoPago: 'Efectivo' } });
      return numero;
    })));
    expect(new Set(numeros).size).toBe(6);
  });
});

describe('doble clic y reintentos (Idempotency-Key)', () => {
  it('la misma clave devuelve la misma respuesta y no cobra dos veces', async () => {
    await abrirCaja();
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const enviar = () => api().post('/api/ventas').set('Idempotency-Key', 'clave-cobro-1')
      .send({ pedidoId, metodoPago: 'Efectivo', cajeroNombre: 'Carla Caja' });
    const primera = await enviar();
    const reintento = await enviar();
    expect(primera.status).toBe(200);
    expect(reintento.status).toBe(200);
    expect(reintento.body).toEqual(primera.body);
    expect(await contar('venta')).toBe(1);
  });

  it('doble clic simultáneo con la misma clave: una venta; la otra respuesta es la misma o OPERACION_EN_CURSO', async () => {
    await abrirCaja();
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const enviar = () => api().post('/api/ventas').set('Idempotency-Key', 'clave-cobro-2')
      .send({ pedidoId, metodoPago: 'Efectivo', cajeroNombre: 'Carla Caja' });
    const respuestas = await Promise.all([enviar(), enviar()]);
    expect(await contar('venta')).toBe(1);
    for (const r of respuestas) {
      expect(r.status === 200 || r.body?.error?.codigo === 'OPERACION_EN_CURSO').toBe(true);
    }
  });

  it('claves distintas son operaciones distintas; sin clave funciona como siempre', async () => {
    await abrirCaja();
    const p1 = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const p2 = await mesaListaParaCobrar(2, [item(carta.lomo, 1)]);
    expect((await api().post('/api/ventas').set('Idempotency-Key', 'a').send({ pedidoId: p1, metodoPago: 'Efectivo' })).status).toBe(200);
    expect((await api().post('/api/ventas').set('Idempotency-Key', 'b').send({ pedidoId: p2, metodoPago: 'Efectivo' })).status).toBe(200);
    expect(await contar('venta')).toBe(2);
  });

  it('si la operación falló, el reintento con la misma clave se vuelve a intentar', async () => {
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const enviar = () => api().post('/api/ventas').set('Idempotency-Key', 'clave-falla').send({ pedidoId, metodoPago: 'Efectivo' });
    const sinCaja = await enviar();
    expect(sinCaja.status).toBeGreaterThanOrEqual(400); // caja cerrada
    await abrirCaja();
    expect((await enviar()).status).toBe(200);
  });
});

describe('turno que cruza la medianoche (hora de Lima)', () => {
  it('una venta a las 00:10 entra en el turno abierto a las 23:50 del día anterior', async () => {
    const turno = await abrirCaja(100);
    // Apertura: 23:50 de Lima (04:50 UTC del día siguiente)
    const apertura = new Date('2026-10-05T23:50:00-05:00');
    await prisma.cierreCaja.update({ where: { id: turno.id }, data: { fechaApertura: apertura } });
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 2)]);
    const res = await cobrar(pedidoId);
    // La venta: 00:10 de Lima del día siguiente
    await prisma.venta.update({ where: { id: res.body.ventaId }, data: { createdAt: new Date('2026-10-06T00:10:00-05:00') } });

    const estado = (await api().get('/api/caja/estado')).body;
    expect(estado.resumenEnVivo.ventasEfectivo).toBe(51);
  });

  // La jornada del restaurante va de 03:00 a 03:00 (hora de Lima): lo vendido en la madrugada cuenta
  // para la noche anterior. Así lo calculan /api/ventas y los reportes.
  it('la jornada va de 03:00 a 03:00 de Lima: 23:59 y 00:01 cuentan para el mismo día, 03:01 para el siguiente', async () => {
    await abrirCaja();
    const p1 = await mesaListaParaCobrar(1, [item(carta.lomo, 1)]);
    const p2 = await mesaListaParaCobrar(2, [item(carta.gaseosa, 1)]);
    const p3 = await mesaListaParaCobrar(3, [item(carta.gaseosa, 1)]);
    const v1 = (await cobrar(p1)).body.ventaId;
    const v2 = (await cobrar(p2)).body.ventaId;
    const v3 = (await cobrar(p3)).body.ventaId;
    await prisma.venta.update({ where: { id: v1 }, data: { createdAt: new Date('2026-10-05T23:59:00-05:00') } });
    await prisma.venta.update({ where: { id: v2 }, data: { createdAt: new Date('2026-10-06T00:01:00-05:00') } });
    await prisma.venta.update({ where: { id: v3 }, data: { createdAt: new Date('2026-10-06T03:01:00-05:00') } });

    const dia5 = (await api().get('/api/ventas?desde=2026-10-05&hasta=2026-10-05')).body.map((v) => v.id);
    const dia6 = (await api().get('/api/ventas?desde=2026-10-06&hasta=2026-10-06')).body.map((v) => v.id);
    expect(dia5.sort()).toEqual([v1, v2].sort());
    expect(dia6).toEqual([v3]);
  });
});

describe('reportes de ventas por fecha de cobro', () => {
  it('una mesa abierta ayer y cobrada hoy cuenta hoy en "Carta y platos", también los adicionales', async () => {
    await abrirCaja();
    const p1 = await mesaListaParaCobrar(1, [item(carta.lomo, 2)]);
    const p2 = await mesaListaParaCobrar(1, [item(carta.gaseosa, 1)]); // pedido adicional de la misma mesa
    await prisma.pedido.updateMany({ where: { id: { in: [p1, p2] } }, data: { createdAt: new Date('2026-10-05T20:00:00-05:00') } });
    const res = await api().post('/api/ventas').send({ pedidoIds: [p1, p2], metodoPago: 'Efectivo' });
    expect(res.status).toBe(200);
    const hoy = new Date(Date.now() - 3 * 3600000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const rot = (await api().get(`/api/reportes/rotacion?desde=${hoy}&hasta=${hoy}`)).body;
    expect(rot.map((r) => [r.nombre, r.cantidad]).sort()).toEqual([['Inca Kola', 1], ['Lomo Saltado', 2]]);
    const ayer = (await api().get('/api/reportes/rotacion?desde=2026-10-05&hasta=2026-10-05')).body;
    expect(ayer).toEqual([]);
  });
});

describe('editar un delivery', () => {
  it('si el stock no alcanza → STOCK_INSUFICIENTE y el stock queda como estaba (antes podía quedar negativo)', async () => {
    await abrirCaja();
    const llevar = (datos) => ({ tipoDelivery: 'ParaLlevar', cajero: 'Carla', metodoPago: 'Efectivo', ...datos });
    const creado = await api().post('/api/pedidos/llevar').send(llevar({ items: [item(carta.postre, 2)] }));
    expect(creado.status).toBe(200);
    const pedido = await prisma.pedido.findFirst({ orderBy: { id: 'desc' } });
    const stock = async () => (await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock;
    expect(await stock()).toBe(3);

    const editar = (cantidad) => api().put(`/api/pedidos/llevar/${pedido.id}`).send(llevar({ items: [item(carta.postre, cantidad)] }));
    esperarError(await editar(7), 409, 'STOCK_INSUFICIENTE');
    expect(await stock()).toBe(3);
    expect((await editar(4)).status).toBe(200);
    expect(await stock()).toBe(1);
  });
});
