// Administración de equipos y sesiones (tarea 10, ACUERDOS §2)
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PIN_CAJERO, api, app, crearBase, esperarError, limpiarBD, prisma } from './helpers.mjs';

const CONTRASENA = 'clave-segura-1';
let admin;
let cajero;

const navegador = () => request.agent(app);
const activar = (nav, nombreDispositivo = 'Tablet caja') =>
  nav.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo });

// Equipo activado por el administrador y luego usado por el cajero con su PIN
async function equipoDelCajero(nombre) {
  const nav = navegador();
  await activar(nav, nombre);
  await nav.post('/api/auth/login').send({ pin: PIN_CAJERO });
  return nav;
}

beforeEach(async () => {
  delete process.env.AUTH_OBLIGATORIA;
  await limpiarBD();
  await crearBase();
  admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador' } });
  cajero = await prisma.usuario.findFirst({ where: { rol: 'Cajero' } });
  await api().put(`/api/usuarios/${admin.id}`).send({ usuario: 'admin', contrasena: CONTRASENA });
});

afterEach(() => {
  delete process.env.AUTH_OBLIGATORIA;
});

describe('quién puede usarlas', () => {
  it('sin sesión → NO_AUTENTICADO, aunque AUTH_OBLIGATORIA esté apagada', async () => {
    esperarError(await api().get('/api/dispositivos'), 401, 'NO_AUTENTICADO');
    esperarError(await api().delete('/api/dispositivos/1'), 401, 'NO_AUTENTICADO');
    esperarError(await api().get(`/api/usuarios/${cajero.id}/sesiones`), 401, 'NO_AUTENTICADO');
    esperarError(await api().post(`/api/usuarios/${cajero.id}/cerrar-sesiones`), 401, 'NO_AUTENTICADO');
  });

  it('un Cajero con sesión → SIN_PERMISO', async () => {
    const nav = await equipoDelCajero('Caja 1');
    esperarError(await nav.get('/api/dispositivos'), 403, 'SIN_PERMISO');
    esperarError(await nav.post(`/api/usuarios/${admin.id}/cerrar-sesiones`), 403, 'SIN_PERMISO');
  });
});

describe('equipos', () => {
  it('lista los equipos con quién los activó y sin datos secretos', async () => {
    const nav = navegador();
    await activar(nav, 'Caja principal');
    await activar(navegador(), 'Tablet mozo');

    const res = await nav.get('/api/dispositivos');
    expect(res.status).toBe(200);
    expect(res.body.map((d) => d.nombre).sort()).toEqual(['Caja principal', 'Tablet mozo']);
    expect(res.body[0]).toMatchObject({ activadoPor: { id: admin.id, nombre: 'Admin' }, revocadoEn: null });
    expect(res.body[0]).not.toHaveProperty('tokenHash');
    expect(res.body[0]).not.toHaveProperty('fallosPin');
  });

  it('revocar un equipo cierra sus sesiones y obliga a activarlo de nuevo', async () => {
    const nav = navegador();
    await activar(nav, 'Caja principal');
    const tablet = await equipoDelCajero('Tablet caja');
    const disp = await prisma.dispositivo.findFirst({ where: { nombre: 'Tablet caja' } });

    expect((await nav.delete(`/api/dispositivos/${disp.id}`)).status).toBe(204);

    // Ninguna sesión abierta; la del cajero se cerró por la revocación (la del admin ya se había
    // cerrado como OTRA_SESION cuando el cajero entró con su PIN en el mismo equipo)
    expect(await prisma.sesion.count({ where: { dispositivoId: disp.id, cerradaEn: null } })).toBe(0);
    const delCajero = await prisma.sesion.findFirst({ where: { dispositivoId: disp.id, usuarioId: cajero.id } });
    expect(delCajero.motivoCierre).toBe('REVOCADA');
    esperarError(await tablet.post('/api/auth/login').send({ pin: PIN_CAJERO }), 401, 'DISPOSITIVO_NO_ACTIVADO');
    // El equipo del administrador sigue funcionando
    expect((await nav.get('/api/auth/yo')).status).toBe(200);
  });

  it('revocar dos veces no falla; un id inexistente → NO_ENCONTRADO; un id inválido → VALIDACION', async () => {
    const nav = navegador();
    await activar(nav);
    const otro = navegador();
    await activar(otro, 'Otro');
    const disp = await prisma.dispositivo.findFirst({ where: { nombre: 'Otro' } });
    expect((await nav.delete(`/api/dispositivos/${disp.id}`)).status).toBe(204);
    expect((await nav.delete(`/api/dispositivos/${disp.id}`)).status).toBe(204);
    esperarError(await nav.delete('/api/dispositivos/9999'), 404, 'NO_ENCONTRADO');
    esperarError(await nav.delete('/api/dispositivos/abc'), 400, 'VALIDACION');
  });
});

describe('sesiones de un usuario', () => {
  it('lista solo las sesiones abiertas, con su equipo', async () => {
    const nav = navegador();
    await activar(nav, 'Caja principal');
    await equipoDelCajero('Caja 1');
    await equipoDelCajero('Caja 2');

    const res = await nav.get(`/api/usuarios/${cajero.id}/sesiones`);
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.dispositivo.nombre).sort()).toEqual(['Caja 1', 'Caja 2']);
    expect(res.body[0]).toEqual({
      id: expect.any(Number), creadaEn: expect.any(String), ultimaActividad: expect.any(String),
      dispositivo: { id: expect.any(Number), nombre: expect.any(String) },
    });
  });

  it('cerrar sesiones en todos los equipos: el usuario vuelve a entrar con su PIN sin activar de nuevo', async () => {
    process.env.AUTH_OBLIGATORIA = 'true';
    const nav = navegador();
    await activar(nav, 'Caja principal');
    const caja1 = await equipoDelCajero('Caja 1');
    expect((await caja1.get('/api/auth/yo')).status).toBe(200);

    expect((await nav.post(`/api/usuarios/${cajero.id}/cerrar-sesiones`)).status).toBe(204);

    esperarError(await caja1.get('/api/mesas'), 401, 'SESION_EXPIRADA');
    expect((await nav.get(`/api/usuarios/${cajero.id}/sesiones`)).body).toEqual([]);
    expect((await caja1.post('/api/auth/login').send({ pin: PIN_CAJERO })).status).toBe(200);
  });

  it('usuario inexistente → NO_ENCONTRADO', async () => {
    const nav = navegador();
    await activar(nav);
    esperarError(await nav.get('/api/usuarios/9999/sesiones'), 404, 'NO_ENCONTRADO');
    esperarError(await nav.post('/api/usuarios/9999/cerrar-sesiones'), 404, 'NO_ENCONTRADO');
  });
});

describe('inactividad por usuario', () => {
  it('solo el administrador la configura', async () => {
    const caja = await equipoDelCajero('Caja 1');
    esperarError(await caja.put(`/api/usuarios/${cajero.id}`).send({ inactividadMin: 5 }), 403, 'SIN_PERMISO');

    const nav = navegador();
    await activar(nav);
    const res = await nav.put(`/api/usuarios/${cajero.id}`).send({ inactividadMin: 5 });
    expect(res.status).toBe(200);
    expect(res.body.inactividadMin).toBe(5);
  });
});
