// Permisos por rol en el backend, CORS y cabeceras de seguridad (tarea 9)
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, PIN_CAJERO, abrirCaja, api, app, crearBase, esperarError, item, limpiarBD, prisma } from './helpers.mjs';

const CONTRASENA = 'clave-segura-1';
const PIN_MOZO = '3333';
const PIN_COCINERO = '4444';
let carta;

// Navegador con el dispositivo activado por el admin y la sesión del PIN indicado
async function sesionDe(pin) {
  const nav = request.agent(app);
  await nav.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'Tablet' });
  const res = await nav.post('/api/auth/login').send({ pin });
  expect(res.status).toBe(200);
  return nav;
}

beforeEach(async () => {
  delete process.env.AUTH_OBLIGATORIA;
  await limpiarBD();
  carta = await crearBase();
  const admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador' } });
  await api().put(`/api/usuarios/${admin.id}`).send({ usuario: 'admin', contrasena: CONTRASENA });
  await api().post('/api/usuarios').send({ nombre: 'Mario Mozo', rol: 'Mozo', pin: PIN_MOZO, permisos: ['Salon'] });
  await api().post('/api/usuarios').send({ nombre: 'Coco Cocina', rol: 'Cocinero', pin: PIN_COCINERO, permisos: ['Cocina'] });
});

afterEach(() => {
  delete process.env.AUTH_OBLIGATORIA;
  delete process.env.CORS_ORIGIN;
});

describe('permisos por rol (con sesión)', () => {
  it('mozo: toma pedidos, pero no cobra ni ve reportes ni la caja', async () => {
    const mozo = await sesionDe(PIN_MOZO);
    expect((await mozo.post('/api/mesas/1/pedido').send({ mesero: 'Mario', items: [item(carta.lomo, 1)] })).status).toBe(200);
    expect((await mozo.get('/api/productos')).status).toBe(200); // la carta la ven todos
    esperarError(await mozo.post('/api/ventas').send({ pedidoId: 1, metodoPago: 'Efectivo' }), 403, 'SIN_PERMISO');
    esperarError(await mozo.get('/api/reportes/mozos'), 403, 'SIN_PERMISO');
    esperarError(await mozo.post('/api/caja/apertura').send({ cajeroNombre: 'Mario', montoInicial: 0 }), 403, 'SIN_PERMISO');
  });

  it('cajero: cobra y entra a Créditos (Caja incluye Créditos), pero no edita usuarios ni la empresa', async () => {
    const cajero = await sesionDe(PIN_CAJERO);
    expect((await cajero.post('/api/caja/apertura').send({ cajeroNombre: 'Carla', montoInicial: 50 })).status).toBe(200);
    expect((await cajero.get('/api/clientes/directorio')).status).toBe(200);
    esperarError(await cajero.post('/api/usuarios').send({ nombre: 'X', rol: 'Mozo', pin: '8888' }), 403, 'SIN_PERMISO');
    esperarError(await cajero.put('/api/empresa').send({ name: 'Otro' }), 403, 'SIN_PERMISO');
    esperarError(await cajero.post('/api/productos').send({ nombre: 'X', categoria: 'Y', precio: 1 }), 403, 'SIN_PERMISO');
  });

  it('cocinero: ve su monitor, pero no el de barra ni la caja', async () => {
    const cocinero = await sesionDe(PIN_COCINERO);
    expect((await cocinero.get('/api/pedidos/cocina')).status).toBe(200);
    esperarError(await cocinero.get('/api/pedidos/barra'), 403, 'SIN_PERMISO');
    esperarError(await cocinero.get('/api/caja/estado'), 403, 'SIN_PERMISO');
  });

  it('administrador: puede todo, aunque su lista de permisos esté vacía', async () => {
    const admin = await sesionDe(PIN_ADMIN);
    expect((await admin.get('/api/reportes/mozos')).status).toBe(200);
    expect((await admin.put('/api/empresa').send({ tagline: 'Hecho en casa' })).status).toBe(200);
    expect((await admin.post('/api/usuarios').send({ nombre: 'Nuevo', rol: 'Mozo', pin: '8888', permisos: ['Salon'] })).status).toBe(200);
  });

  it('los permisos también aplican en transición si la petición trae sesión', async () => {
    const mozo = await sesionDe(PIN_MOZO);
    esperarError(await mozo.get('/api/reportes/mozos'), 403, 'SIN_PERMISO');
  });
});

describe('transición y AUTH_OBLIGATORIA', () => {
  it('sin sesión y AUTH_OBLIGATORIA=false: la pantalla actual sigue funcionando', async () => {
    await abrirCaja();
    expect((await api().get('/api/reportes/mozos')).status).toBe(200);
  });

  it('sin sesión y AUTH_OBLIGATORIA=true: NO_AUTENTICADO', async () => {
    process.env.AUTH_OBLIGATORIA = 'true';
    esperarError(await api().get('/api/reportes/mozos'), 401, 'NO_AUTENTICADO');
  });
});

describe('CORS y cabeceras', () => {
  it('sin CORS_ORIGIN no se envían cabeceras CORS (mismo origen)', async () => {
    const res = await api().get('/api/status').set('Origin', 'https://sitio-ajeno.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('helmet: oculta X-Powered-By y agrega cabeceras de seguridad', async () => {
    const res = await api().get('/api/status');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeUndefined(); // HSTS solo en modo web
  });
});
