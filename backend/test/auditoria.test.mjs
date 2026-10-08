// Registro de auditoría (tarea 11)
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PIN_CAJERO, api, app, crearBase, esperarError, limpiarBD, prisma } from './helpers.mjs';

const CONTRASENA = 'clave-segura-1';
let admin;
let cajero;
let nav; // navegador con la sesión del administrador

async function sesionAdmin() {
  const n = request.agent(app);
  await n.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'Caja principal' });
  return n;
}
const registros = (where = {}) => prisma.auditoria.findMany({ where, orderBy: { id: 'asc' } });

beforeEach(async () => {
  delete process.env.AUTH_OBLIGATORIA;
  await limpiarBD();
  await crearBase();
  admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador' } });
  cajero = await prisma.usuario.findFirst({ where: { rol: 'Cajero' } });
  await api().put(`/api/usuarios/${admin.id}`).send({ usuario: 'admin', contrasena: CONTRASENA });
  await prisma.auditoria.deleteMany();
  nav = await sesionAdmin();
});

afterEach(() => {
  delete process.env.AUTH_OBLIGATORIA;
});

describe('usuarios', () => {
  it('crear un usuario queda con quién lo hizo y desde qué equipo', async () => {
    const res = await nav.post('/api/usuarios').send({ nombre: 'Mario Mozo', rol: 'Mozo', pin: '3333', permisos: ['Salon'] });
    const [r] = await registros({ accion: 'USUARIO_CREADO' });
    expect(r).toMatchObject({
      usuarioId: admin.id, usuarioNombre: 'Admin', dispositivoNombre: 'Caja principal',
      entidad: 'Usuario', entidadId: String(res.body.id),
      despues: { nombre: 'Mario Mozo', rol: 'Mozo', permisos: ['Salon'] },
    });
  });

  it('editar guarda solo lo que cambió; el PIN y la contraseña nunca quedan escritos', async () => {
    await nav.put(`/api/usuarios/${cajero.id}`).send({ nombre: 'Carla C.', pin: '7777', contrasena: 'otra-clave-123', permisos: ['Caja', 'Reportes'] });
    const editado = (await registros({ accion: 'USUARIO_EDITADO' }))[0];
    expect(editado.antes).toEqual({ nombre: 'Carla Caja', permisos: ['Caja'] });
    expect(editado.despues).toEqual({ nombre: 'Carla C.', permisos: ['Caja', 'Reportes'], contrasena: 'cambiada' });
    expect((await registros({ accion: 'PIN_CAMBIADO' }))).toHaveLength(1);
    const todo = JSON.stringify(await registros());
    expect(todo).not.toContain('7777');
    expect(todo).not.toContain('otra-clave-123');
  });

  it('desactivar (PUT activo:false o DELETE) queda como USUARIO_DESACTIVADO', async () => {
    await nav.put(`/api/usuarios/${cajero.id}`).send({ activo: false });
    const otro = await prisma.usuario.create({ data: { nombre: 'Temporal', rol: 'Mozo', permisos: [] } });
    await nav.delete(`/api/usuarios/${otro.id}`);
    expect((await registros({ accion: 'USUARIO_DESACTIVADO' })).map((r) => r.entidadId)).toEqual([String(cajero.id), String(otro.id)]);
  });

  it('sin sesión (transición) queda como "Sin sesión"', async () => {
    await api().post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: '4444', permisos: ['Salon'] });
    const [r] = await registros({ accion: 'USUARIO_CREADO' });
    expect(r).toMatchObject({ usuarioId: null, usuarioNombre: 'Sin sesión', dispositivoId: null });
  });
});

describe('equipos y sesiones', () => {
  it('revocar un equipo y cerrar sesiones quedan registrados', async () => {
    const caja = request.agent(app);
    await caja.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'Tablet' });
    await caja.post('/api/auth/login').send({ pin: PIN_CAJERO });
    const tablet = await prisma.dispositivo.findFirst({ where: { nombre: 'Tablet' } });

    await nav.post(`/api/usuarios/${cajero.id}/cerrar-sesiones`);
    await nav.delete(`/api/dispositivos/${tablet.id}`);

    expect((await registros({ accion: 'SESIONES_CERRADAS' }))[0].despues).toEqual({ nombre: 'Carla Caja', sesionesCerradas: 1 });
    expect((await registros({ accion: 'DISPOSITIVO_REVOCADO' }))[0]).toMatchObject({ entidadId: String(tablet.id), antes: { nombre: 'Tablet' } });
  });
});

describe('consulta GET /api/auditoria', () => {
  it('solo el administrador con sesión', async () => {
    esperarError(await api().get('/api/auditoria'), 401, 'NO_AUTENTICADO');
    const caja = request.agent(app);
    await caja.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'Caja 2' });
    await caja.post('/api/auth/login').send({ pin: PIN_CAJERO });
    esperarError(await caja.get('/api/auditoria'), 403, 'SIN_PERMISO');
  });

  it('de lo más reciente a lo más antiguo, con filtros por acción, usuario y fecha, y paginado', async () => {
    await nav.post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: '4444', permisos: ['Salon'] });
    await nav.put(`/api/usuarios/${cajero.id}`).send({ pin: '8888' });
    await nav.put(`/api/usuarios/${cajero.id}`).send({ nombre: 'Carla Cajera' });

    const todo = await nav.get('/api/auditoria');
    // Cambiar solo el PIN registra PIN_CAMBIADO, no USUARIO_EDITADO
    expect(todo.body.total).toBe(3);
    expect(todo.body.registros.map((r) => r.accion)).toEqual(['USUARIO_EDITADO', 'PIN_CAMBIADO', 'USUARIO_CREADO']);
    expect(todo.body.registros[0].despues).toEqual({ nombre: 'Carla Cajera' });

    expect((await nav.get('/api/auditoria?accion=PIN_CAMBIADO')).body.total).toBe(1);
    const porUsuario = await nav.get(`/api/auditoria?usuarioId=${admin.id}`);
    expect(porUsuario.body.total).toBe(3);
    expect((await nav.get('/api/auditoria?usuarioId=9999')).body.total).toBe(0);

    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    expect((await nav.get(`/api/auditoria?desde=${hoy}&hasta=${hoy}`)).body.total).toBe(3);
    expect((await nav.get('/api/auditoria?desde=2020-01-01&hasta=2020-01-02')).body.total).toBe(0);

    const pagina = await nav.get('/api/auditoria?limit=2&page=2');
    expect(pagina.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(pagina.body.registros.map((r) => r.accion)).toEqual(['USUARIO_CREADO']);

    esperarError(await nav.get('/api/auditoria?accion=INVENTADA'), 400, 'VALIDACION');
  });

  it('la lista de acciones para el filtro', async () => {
    const res = await nav.get('/api/auditoria/acciones');
    expect(res.body).toContainEqual({ codigo: 'VENTA_ANULADA', nombre: 'Venta anulada' });
  });
});
