// Anulación de pedidos e ítems (tarea 24)
import { beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, PIN_CAJERO, api, crearBase, enviarPedido, esperarError, item, limpiarBD, prisma } from './helpers.mjs';

const PIN_MOZO = '3333';
let carta;

const cancelar = (pedidoId, datos = {}) => api().patch(`/api/pedidos/${pedidoId}/cancelar`).send({ canceladoPor: 'Mozo', motivo: 'Se equivocó de plato', ...datos });
const cancelarItem = (pedidoId, datos) => api().patch(`/api/pedidos/${pedidoId}/cancelar-item`).send({ canceladoPor: 'Mozo', ...datos });
const itemsDe = (pedidoId) => prisma.itemPedido.findMany({ where: { pedidoId }, orderBy: { id: 'asc' } });
// El pedido se creó hace `min` minutos
const envejecer = (pedidoId, min) => prisma.pedido.update({ where: { id: pedidoId }, data: { createdAt: new Date(Date.now() - min * 60000) } });

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
  await api().post('/api/usuarios').send({ nombre: 'Mario Mozo', rol: 'Mozo', pin: PIN_MOZO, permisos: ['Salon'] });
});

describe('quién puede cancelar y cuándo', () => {
  it('dentro de los 5 minutos y en cocina, el mozo cancela sin PIN', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    const res = await cancelar(pedidoId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, mesaLiberada: true });
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Cancelado');
  });

  it('pasados los 5 minutos → LIMITE_ANULACION_VENCIDO; con el PIN de un Cajero sí se cancela', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    await envejecer(pedidoId, 6);
    esperarError(await cancelar(pedidoId), 409, 'LIMITE_ANULACION_VENCIDO');
    const res = await cancelar(pedidoId, { autorizacion: { pin: PIN_CAJERO } });
    expect(res.status).toBe(200);
    expect((await prisma.cancelacion.findFirst({ where: { pedidoId } })).autorizadoPor).toBe('Carla Caja');
  });

  it('"force" ya no basta: sin PIN → AUTORIZACION_REQUERIDA (antes cancelaba y anulaba la venta sin verificar nada)', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    esperarError(await cancelar(pedidoId, { force: true }), 403, 'AUTORIZACION_REQUERIDA');
    esperarError(await cancelar(pedidoId, { force: true, autorizacion: { pin: PIN_MOZO } }), 403, 'SIN_PERMISO');
    esperarError(await cancelar(pedidoId, { force: true, autorizacion: { pin: '9999' } }), 401, 'PIN_INCORRECTO');
    expect((await cancelar(pedidoId, { force: true, autorizacion: { pin: PIN_ADMIN } })).status).toBe(200);
  });

  it('un plato ya listo (historial) solo se anula con PIN', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1), item(carta.gaseosa, 1)]);
    const [lomo] = await itemsDe(pedidoId);
    await api().patch(`/api/pedidos/items/${lomo.id}/preparar`);
    esperarError(await cancelarItem(pedidoId, { itemId: lomo.id }), 403, 'AUTORIZACION_REQUERIDA');
    expect((await cancelarItem(pedidoId, { itemId: lomo.id, autorizacion: { pin: PIN_CAJERO } })).status).toBe(200);
  });

  it('un pedido ya cancelado no se cancela dos veces', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 1)]);
    await cancelar(pedidoId);
    esperarError(await cancelar(pedidoId), 409, 'CONFLICTO');
  });
});

describe('cancelar ítems', () => {
  it('cancelación parcial: baja la cantidad, recalcula el total y devuelve el stock', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 2), item(carta.postre, 3)]);
    const [, postre] = await itemsDe(pedidoId);
    const res = await cancelarItem(pedidoId, { itemId: postre.id, cantidadACancelar: 2, motivo: 'Ya no quiere' });
    expect(res.body).toMatchObject({ ok: true, pedidoVacio: false });

    expect((await itemsDe(pedidoId))[1].cantidad).toBe(1);
    expect(Number((await prisma.pedido.findUnique({ where: { id: pedidoId } })).total)).toBe(25.5 * 2 + 8);
    expect((await prisma.producto.findUnique({ where: { id: carta.postre.id } })).stock).toBe(5 - 3 + 2);
  });

  it('sin cantidad se cancela el ítem completo', async () => {
    const pedidoId = await enviarPedido(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]);
    const [, gaseosa] = await itemsDe(pedidoId);
    expect((await cancelarItem(pedidoId, { itemId: gaseosa.id })).status).toBe(200);
    expect(await itemsDe(pedidoId)).toHaveLength(1);
  });

  it('el último ítem cancela el pedido SIN borrar sus ítems: el reporte conserva el detalle', async () => {
    const pedidoId = await enviarPedido(2, [item(carta.lomo, 1)]);
    const [lomo] = await itemsDe(pedidoId);
    const res = await cancelarItem(pedidoId, { itemId: lomo.id, motivo: 'Cliente se fue' });
    expect(res.body).toMatchObject({ ok: true, pedidoVacio: true, mesaLiberada: true });

    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).estado).toBe('Cancelado');
    expect(await itemsDe(pedidoId)).toHaveLength(1);
    const reporte = await api().get('/api/reportes/cancelaciones');
    expect(JSON.stringify(reporte.body)).toContain('Lomo Saltado');
  });
});

describe('avisos para cocina y barra', () => {
  it('se separan por estación, quedan en la BD y desaparecen al confirmar', async () => {
    const pedidoId = await enviarPedido(3, [item(carta.lomo, 1), item(carta.gaseosa, 2)]);
    await cancelar(pedidoId);

    const cocina = (await api().get('/api/cocina/cancelaciones')).body;
    const barra = (await api().get('/api/barra/cancelaciones')).body;
    expect(cocina).toHaveLength(1);
    expect(cocina[0]).toMatchObject({ pedidoId, mesaInfo: 'Mesa 3', canceladoPor: 'Mozo', items: [{ nombre: 'Lomo Saltado', cantidad: 1 }] });
    expect(barra[0].items).toEqual([expect.objectContaining({ nombre: 'Inca Kola', cantidad: 2 })]);

    // Siguen ahí aunque el backend se reinicie: están en la tabla Cancelacion
    expect(await prisma.cancelacion.count({ where: { pedidoId } })).toBe(2);

    await api().delete(`/api/cocina/cancelaciones/${cocina[0].id}`);
    expect((await api().get('/api/cocina/cancelaciones')).body).toHaveLength(0);
    expect((await api().get('/api/barra/cancelaciones')).body).toHaveLength(1);
  });

  it('un aviso de hace más de 2 horas ya no se muestra', async () => {
    const pedidoId = await enviarPedido(3, [item(carta.lomo, 1)]);
    await cancelar(pedidoId);
    await prisma.cancelacion.updateMany({ data: { creadoEn: new Date(Date.now() - 3 * 3600000) } });
    expect((await api().get('/api/cocina/cancelaciones')).body).toHaveLength(0);
  });
});

describe('auditoría', () => {
  it('cancelar un pedido y un ítem quedan registrados con quién autorizó', async () => {
    const p1 = await enviarPedido(1, [item(carta.lomo, 1)]);
    await envejecer(p1, 10);
    await cancelar(p1, { autorizacion: { pin: PIN_ADMIN } });
    const p2 = await enviarPedido(2, [item(carta.lomo, 1), item(carta.gaseosa, 1)]);
    const [, gaseosa] = await itemsDe(p2);
    await cancelarItem(p2, { itemId: gaseosa.id, motivo: 'Sin stock' });

    const pedido = await prisma.auditoria.findFirst({ where: { accion: 'PEDIDO_CANCELADO' } });
    expect(pedido).toMatchObject({ entidadId: String(p1), autorizadoPor: 'Admin', motivo: 'Se equivocó de plato' });
    const it2 = await prisma.auditoria.findFirst({ where: { accion: 'ITEM_CANCELADO' } });
    expect(it2).toMatchObject({ entidadId: String(p2), motivo: 'Sin stock', antes: { item: 'Inca Kola', cantidad: 1 }, despues: { cantidad: 0 } });
  });
});
