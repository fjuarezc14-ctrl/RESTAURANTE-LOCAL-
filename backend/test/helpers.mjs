// ============================================================
// HELPERS DE PRUEBAS: app, BD limpia y flujos comunes (abrir caja, mesa lista para cobrar)
// ============================================================
import { createRequire } from 'node:module';
import request from 'supertest';
import { expect } from 'vitest';
import { prepararEntorno } from './entorno.mjs';

prepararEntorno();

// La app es CommonJS: se carga con require nativo, sin pasar por Vite
const require = createRequire(import.meta.url);
export const { app, prisma } = require('../src/app.js');

export const api = () => request(app);

export const PIN_ADMIN = '1234';
export const PIN_CAJERO = '2222';

export async function limpiarBD() {
  const tablas = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

// Usuarios, carta y mesas mínimos para los flujos de dinero
export async function crearBase() {
  await prisma.usuario.createMany({
    data: [
      { nombre: 'Admin', rol: 'Administrador', pin: PIN_ADMIN, permisos: [] },
      { nombre: 'Carla Caja', rol: 'Cajero', pin: PIN_CAJERO, permisos: ['Caja'] },
    ],
  });
  const [lomo, gaseosa, postre] = await Promise.all([
    prisma.producto.create({ data: { nombre: 'Lomo Saltado', categoria: 'Platos de Fondo', precio: 25.5 } }),
    prisma.producto.create({ data: { nombre: 'Inca Kola', categoria: 'Bebidas', precio: 3.5 } }),
    prisma.producto.create({ data: { nombre: 'Tres Leches', categoria: 'Postres', precio: 8, tipoStock: 'limitado', stock: 5 } }),
  ]);
  await prisma.mesa.createMany({ data: [1, 2, 3, 4].map((numero) => ({ numero })) });
  return { lomo, gaseosa, postre };
}

export const item = (producto, cantidad) => ({
  productoId: producto.id,
  nombre: producto.nombre,
  precio: producto.precio,
  cantidad,
});

export async function abrirCaja(montoInicial = 100) {
  const res = await api().post('/api/caja/apertura').send({ cajeroNombre: 'Carla Caja', montoInicial });
  expect(res.status).toBe(200);
  return res.body.turno;
}

export async function enviarPedido(mesa, items) {
  const res = await api().post(`/api/mesas/${mesa}/pedido`).send({ mesero: 'Mozo', items, total: 0 });
  expect(res.status).toBe(200);
  return res.body.pedidoId;
}

// Pedido enviado, preparado por cocina y llevado a la mesa por el mozo
export async function mesaListaParaCobrar(mesa, items) {
  const pedidoId = await enviarPedido(mesa, items);
  expect((await api().patch(`/api/pedidos/${pedidoId}/servir`)).status).toBe(200);
  expect((await api().patch(`/api/pedidos/${pedidoId}/entregar-todo`)).status).toBe(200);
  return pedidoId;
}

export function cobrar(pedidoId, datos = {}) {
  return api().post('/api/ventas').send({ pedidoId, metodoPago: 'Efectivo', cajeroNombre: 'Carla Caja', ...datos });
}

export async function crearCliente(nombre) {
  return prisma.cliente.create({ data: { nombre, tieneCredito: true } });
}
