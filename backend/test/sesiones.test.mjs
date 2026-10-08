// Sesiones en el servidor y activación de dispositivos (tareas 7 y 8, ACUERDOS §2)
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, PIN_CAJERO, api, app, crearBase, esperarError, limpiarBD, prisma } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { asegurarAccesoAdministrador } = require('../src/servicios/auth.js');

const CONTRASENA = 'clave-segura-1';
const PIN_MOZO = '3333';
let admin;

// Un "navegador": guarda las cookies entre peticiones
const navegador = () => request.agent(app);

async function activar(nav, datos = {}) {
  return nav.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'Tablet caja', ...datos });
}

const cookies = (res) => res.headers['set-cookie'] || [];

beforeEach(async () => {
  delete process.env.AUTH_OBLIGATORIA;
  await limpiarBD();
  await crearBase();
  admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador' } });
  await api().put(`/api/usuarios/${admin.id}`).send({ usuario: 'admin', correo: 'admin@restaurante.pe', contrasena: CONTRASENA });
  await api().post('/api/usuarios').send({ nombre: 'Mario Mozo', rol: 'Mozo', pin: PIN_MOZO, permisos: ['Salon'] });
});

afterEach(() => {
  delete process.env.AUTH_OBLIGATORIA;
});

describe('activación del dispositivo', () => {
  it('con usuario y contraseña deja dos cookies httpOnly y abre la sesión', async () => {
    const nav = navegador();
    const res = await activar(nav);
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ id: admin.id, rol: 'Administrador' });
    expect(res.body.usuario).not.toHaveProperty('contrasenaHash');

    const [disp, sesion] = ['valetec_disp', 'valetec_sesion'].map((n) => cookies(res).find((c) => c.startsWith(`${n}=`)));
    expect(disp).toMatch(/HttpOnly/);
    expect(disp).toMatch(/SameSite=Lax/);
    expect(disp).toMatch(/Max-Age=15552000/); // 180 días
    expect(sesion).toMatch(/HttpOnly/);
    expect(sesion).not.toMatch(/Secure/); // en la red local es HTTP

    expect((await nav.get('/api/auth/yo')).body).toMatchObject({ usuario: { id: admin.id }, dispositivo: { nombre: 'Tablet caja' } });
  });

  it('también acepta el correo, sin importar mayúsculas', async () => {
    expect((await activar(navegador(), { usuario: 'ADMIN@Restaurante.pe' })).status).toBe(200);
  });

  it('en la BD se guarda el hash del token, nunca el token', async () => {
    const res = await activar(navegador());
    const token = cookies(res).find((c) => c.startsWith('valetec_sesion=')).split(';')[0].split('=')[1];
    const sesion = await prisma.sesion.findFirst();
    expect(sesion.tokenHash).toBe(createHash('sha256').update(decodeURIComponent(token)).digest('hex'));
    expect(sesion.tokenHash).not.toContain(token);
  });

  it('contraseña incorrecta → CREDENCIALES_INCORRECTAS; con 5 fallos → bloqueo', async () => {
    const nav = navegador();
    for (let i = 0; i < 5; i += 1) esperarError(await activar(nav, { contrasena: 'otra-clave' }), 401, 'CREDENCIALES_INCORRECTAS');
    esperarError(await activar(nav), 429, 'DEMASIADOS_INTENTOS');
  });

  it('exige el nombre del dispositivo', async () => {
    esperarError(await activar(navegador(), { nombreDispositivo: '' }), 400, 'VALIDACION', 'nombreDispositivo');
  });
});

describe('login por PIN', () => {
  it('sin dispositivo activado → DISPOSITIVO_NO_ACTIVADO', async () => {
    esperarError(await navegador().post('/api/auth/login').send({ pin: PIN_ADMIN }), 401, 'DISPOSITIVO_NO_ACTIVADO');
  });

  it('en un dispositivo activado entra cualquier usuario con su PIN', async () => {
    const nav = navegador();
    await activar(nav);
    await nav.post('/api/auth/logout');
    esperarError(await nav.get('/api/auth/yo'), 401, 'NO_AUTENTICADO');

    const res = await nav.post('/api/auth/login').send({ pin: PIN_MOZO });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ nombre: 'Mario Mozo', rol: 'Mozo' });
    expect((await nav.get('/api/auth/yo')).body.usuario.nombre).toBe('Mario Mozo');
  });

  it('en un dispositivo compartido, el login de otro usuario cierra la sesión anterior', async () => {
    const nav = navegador();
    await activar(nav);
    await nav.post('/api/auth/login').send({ pin: PIN_MOZO });
    const sesiones = await prisma.sesion.findMany({ orderBy: { id: 'asc' } });
    expect(sesiones.map((s) => s.motivoCierre)).toEqual(['OTRA_SESION', null]);
  });

  it('PIN incorrecto → PIN_INCORRECTO; el décimo seguido desactiva el dispositivo', async () => {
    const nav = navegador();
    await activar(nav);
    esperarError(await nav.post('/api/auth/login').send({ pin: '0000' }), 401, 'PIN_INCORRECTO', 'pin');
    await prisma.dispositivo.updateMany({ data: { fallosPin: 9 } }); // como si ya hubiera 9 fallos seguidos
    esperarError(await nav.post('/api/auth/login').send({ pin: '0000' }), 401, 'DISPOSITIVO_NO_ACTIVADO');
    expect((await prisma.dispositivo.findFirst()).revocadoEn).not.toBeNull();
    esperarError(await nav.post('/api/auth/login').send({ pin: PIN_ADMIN }), 401, 'DISPOSITIVO_NO_ACTIVADO');
  });

  it('un PIN correcto reinicia el contador de fallos', async () => {
    const nav = navegador();
    await activar(nav);
    await nav.post('/api/auth/login').send({ pin: '0000' });
    await nav.post('/api/auth/login').send({ pin: PIN_ADMIN });
    expect((await prisma.dispositivo.findFirst()).fallosPin).toBe(0);
  });
});

describe('con AUTH_OBLIGATORIA=true', () => {
  beforeEach(() => {
    process.env.AUTH_OBLIGATORIA = 'true';
  });

  it('sin sesión → NO_AUTENTICADO; las rutas públicas siguen abiertas', async () => {
    esperarError(await api().get('/api/mesas'), 401, 'NO_AUTENTICADO');
    expect((await api().get('/api/auth/marca')).status).toBe(200);
    // El instalador de Windows espera a que /api/status responda: tiene que hacerlo sin sesión
    expect((await api().get('/api/status')).status).toBe(200);
    const nav = navegador();
    expect((await activar(nav)).status).toBe(200);
    expect((await nav.get('/api/mesas')).status).toBe(200);
  });

  it('cambiar el PIN del usuario cierra su sesión', async () => {
    const nav = navegador();
    await activar(nav);
    expect((await nav.put(`/api/usuarios/${admin.id}`).send({ pin: '7777' })).status).toBe(200);
    esperarError(await nav.get('/api/mesas'), 401, 'SESION_EXPIRADA');
  });

  it('desactivar al usuario cierra su sesión', async () => {
    const nav = navegador();
    await activar(nav);
    await nav.post('/api/auth/login').send({ pin: PIN_MOZO });
    const mozo = await prisma.usuario.findFirst({ where: { rol: 'Mozo' } });
    const otro = navegador();
    await activar(otro);
    await otro.delete(`/api/usuarios/${mozo.id}`);
    esperarError(await nav.get('/api/mesas'), 401, 'SESION_EXPIRADA');
  });

  it('cierra la sesión por inactividad según el tiempo del usuario', async () => {
    const nav = navegador();
    await activar(nav);
    await prisma.usuario.update({ where: { id: admin.id }, data: { inactividadMin: 15 } });
    await prisma.sesion.updateMany({ data: { ultimaActividad: new Date(Date.now() - 16 * 60 * 1000) } });
    esperarError(await nav.get('/api/mesas'), 401, 'SESION_EXPIRADA');
    expect((await prisma.sesion.findFirst()).motivoCierre).toBe('INACTIVIDAD');
  });

  it('un dispositivo revocado → DISPOSITIVO_NO_ACTIVADO', async () => {
    const nav = navegador();
    await activar(nav);
    await prisma.dispositivo.updateMany({ data: { revocadoEn: new Date() } });
    esperarError(await nav.get('/api/mesas'), 401, 'DISPOSITIVO_NO_ACTIVADO');
  });
});

describe('autorizar y contraseña', () => {
  it('autorizar acepta el PIN de un Cajero y rechaza el de un Mozo', async () => {
    const nav = navegador();
    await activar(nav);
    expect((await nav.post('/api/auth/autorizar').send({ pin: PIN_CAJERO })).body.autorizadoPor).toMatchObject({ rol: 'Cajero' });
    esperarError(await nav.post('/api/auth/autorizar').send({ pin: PIN_MOZO }), 403, 'SIN_PERMISO', 'pin');
    esperarError(await api().post('/api/auth/autorizar').send({ pin: PIN_CAJERO }), 401, 'NO_AUTENTICADO');
  });

  it('cambiar la contraseña exige la actual', async () => {
    const nav = navegador();
    await activar(nav);
    esperarError(await nav.put('/api/auth/contrasena').send({ actual: 'no-es', nueva: 'nueva-clave-1' }), 401, 'CREDENCIALES_INCORRECTAS');
    expect((await nav.put('/api/auth/contrasena').send({ actual: CONTRASENA, nueva: 'nueva-clave-1' })).status).toBe(204);
    expect((await activar(navegador(), { contrasena: 'nueva-clave-1' })).status).toBe(200);
  });
});

describe('acceso inicial del administrador', () => {
  it('si ningún administrador tiene contraseña, el primero recibe el usuario "admin" y una contraseña', async () => {
    await prisma.usuario.updateMany({ data: { usuario: null, correo: null, contrasenaHash: null } });
    const acceso = await asegurarAccesoAdministrador();
    expect(acceso).toMatchObject({ usuario: 'admin', generada: true });
    expect((await activar(navegador(), { contrasena: acceso.contrasena })).status).toBe(200);
    expect(await asegurarAccesoAdministrador()).toBeNull(); // no vuelve a cambiarla
  });
});

describe('rescate de soporte: restablecer la contraseña de un administrador', () => {
  const { restablecerContrasenaAdmin } = require('../src/servicios/auth.js');

  it('solo cambia la del administrador elegido y la nueva sirve para activar', async () => {
    const otro = await prisma.usuario.create({ data: { nombre: 'Dueño', rol: 'Administrador', permisos: [], usuario: 'dueno' } });
    await api().put(`/api/usuarios/${otro.id}`).send({ contrasena: 'clave-del-dueno' });
    const nav = navegador();
    await activar(nav);

    const r = await restablecerContrasenaAdmin('admin');
    expect(r).toMatchObject({ id: admin.id, usuario: 'admin' });
    esperarError(await activar(navegador()), 401, 'CREDENCIALES_INCORRECTAS'); // la anterior ya no sirve
    expect((await activar(navegador(), { contrasena: r.contrasena })).status).toBe(200);
    expect((await activar(navegador(), { usuario: 'dueno', contrasena: 'clave-del-dueno' })).status).toBe(200); // el otro no cambió
    expect((await nav.get('/api/auth/yo')).status).toBe(200); // las sesiones abiertas siguen
  });

  it('acepta el ID y una contraseña elegida; no toca a quien no es administrador', async () => {
    expect((await restablecerContrasenaAdmin(String(admin.id), 'elegida-123')).contrasena).toBe('elegida-123');
    const cajero = await prisma.usuario.findFirst({ where: { rol: 'Cajero' } });
    expect(await restablecerContrasenaAdmin(String(cajero.id))).toBeNull();
    expect(await restablecerContrasenaAdmin('no-existe')).toBeNull();
  });
});
