// Montos en Decimal(10,2) (tarea 6): exactos en la BD y como número en la API
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirCaja, api, cobrar, crearBase, item, limpiarBD, mesaListaParaCobrar, prisma } from './helpers.mjs';

beforeEach(async () => {
  await limpiarBD();
  await crearBase();
});

describe('Decimal(10,2)', () => {
  it('0.10 + 0.20 da exactamente 0.30 (con Float quedaba 0.30000000000000004)', async () => {
    const [diez, veinte] = await Promise.all([
      prisma.producto.create({ data: { nombre: 'Caramelo', categoria: 'Postres', precio: 0.1 } }),
      prisma.producto.create({ data: { nombre: 'Chicle', categoria: 'Postres', precio: 0.2 } }),
    ]);
    await abrirCaja();
    const pedidoId = await mesaListaParaCobrar(1, [item(diez, 1), item(veinte, 1)]);
    const { body } = await cobrar(pedidoId);
    expect((await prisma.pedido.findUnique({ where: { id: pedidoId } })).total).toBe(0.3);
    expect((await prisma.venta.findUnique({ where: { id: body.ventaId } })).total).toBe(0.3);
  });

  it('la BD redondea a 2 decimales lo que se guarda directo', async () => {
    const p = await prisma.producto.create({ data: { nombre: 'Raro', categoria: 'Otros', precio: 1.005 } });
    expect(p.precio).toBe(1.01);
  });

  it('la API responde números (no texto), también en relaciones anidadas', async () => {
    await abrirCaja();
    const { lomo } = await prisma.producto.findMany().then((ps) => ({ lomo: ps.find((p) => p.nombre === 'Lomo Saltado') }));
    await cobrar(await mesaListaParaCobrar(1, [item(lomo, 2)]));

    const productos = (await api().get('/api/productos')).body;
    expect(typeof productos[0].precio).toBe('number');

    const venta = await prisma.venta.findFirst({ include: { pedido: { include: { items: true } } } });
    expect(typeof venta.total).toBe('number');
    expect(typeof venta.pedido.total).toBe('number');
    expect(typeof venta.pedido.items[0].precio).toBe('number');

    const { resumenEnVivo } = (await api().get('/api/caja/estado')).body;
    expect(resumenEnVivo).toMatchObject({ ventasEfectivo: 51, efectivoEsperadoEnGaveta: 151 });
  });
});
