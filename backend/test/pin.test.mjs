// PIN guardado como hash (tarea 8): nunca en texto plano en la BD ni en la API
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, api, crearBase, esperarError, limpiarBD, navegadorConSesion, prisma } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { migrarPinesAHash, hashPin } = require('../src/servicios/auth.js');

const SECRETOS = ['pin', 'pinHash', 'contrasenaHash'];
let nav;

beforeEach(async () => {
  await limpiarBD();
  await crearBase();
  nav = await navegadorConSesion();
});

const loginPin = (pin) => nav.post('/api/auth/login').send({ pin });

describe('PIN con hash', () => {
  it('la BD no guarda ningún PIN en texto plano', async () => {
    const usuarios = await prisma.usuario.findMany();
    expect(usuarios.every((u) => u.pin === null && /^[0-9a-f]{64}$/.test(u.pinHash))).toBe(true);
  });

  it('al arrancar convierte los PIN que quedaron en texto plano (BD antiguas, seeds, instalador)', async () => {
    await prisma.usuario.create({ data: { nombre: 'Viejo', rol: 'Mozo', pin: '4321', permisos: [] } });
    expect(await migrarPinesAHash()).toBe(1);
    const viejo = await prisma.usuario.findFirst({ where: { nombre: 'Viejo' } });
    expect(viejo).toMatchObject({ pin: null, pinHash: hashPin('4321') });
    expect((await loginPin('4321')).status).toBe(200);
  });

  it('la API nunca devuelve el PIN ni los hashes', async () => {
    const lista = (await nav.get('/api/usuarios')).body;
    const creado = (await api().post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: '5555', permisos: ['Salon'] })).body;
    const editado = (await api().put(`/api/usuarios/${creado.id}`).send({ nombre: 'Ana María' })).body;
    const login = (await loginPin(PIN_ADMIN)).body.usuario;
    for (const u of [...lista, creado, editado, login]) {
      for (const campo of SECRETOS) expect(u).not.toHaveProperty(campo);
    }
  });

  it('el login funciona con el PIN y el PIN repetido se rechaza', async () => {
    expect((await loginPin(PIN_ADMIN)).body.usuario.rol).toBe('Administrador');
    esperarError(await api().post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: PIN_ADMIN }), 409, 'YA_EXISTE', 'pin');
  });

  it('cambiar el PIN: el nuevo funciona, el anterior no, y la sesión abierta se cierra avisando el motivo', async () => {
    const { usuario } = (await loginPin(PIN_ADMIN)).body;
    await api().put(`/api/usuarios/${usuario.id}`).send({ pin: '9876' });
    const yo = await nav.get('/api/auth/yo');
    esperarError(yo, 401, 'SESION_EXPIRADA');
    expect(yo.body.error.mensaje).toMatch(/cambió tu PIN/);
    esperarError(await loginPin(PIN_ADMIN), 401, 'PIN_INCORRECTO');
    expect((await loginPin('9876')).status).toBe(200);
  });

  it('editar sin enviar el PIN no lo cambia', async () => {
    const { usuario } = (await loginPin(PIN_ADMIN)).body;
    await api().put(`/api/usuarios/${usuario.id}`).send({ nombre: 'Admin', pin: '' });
    expect((await loginPin(PIN_ADMIN)).status).toBe(200);
  });
});

describe('rutas antiguas del login por PIN', () => {
  it.each([
    ['post', '/api/usuarios/login'],
    ['post', '/api/usuarios/validate-auth'],
    ['get', '/api/usuarios/check/1'],
  ])('%s %s ya no existe', async (metodo, ruta) => {
    expect((await nav[metodo](ruta).send({ pin: PIN_ADMIN })).status).toBe(404);
  });

  it('la lista de usuarios pide sesión y solo muestra usuario y correo a quien administra el personal', async () => {
    esperarError(await api().get('/api/usuarios'), 401, 'NO_AUTENTICADO');
    expect((await nav.get('/api/usuarios')).body.find((u) => u.rol === 'Administrador')).toHaveProperty('usuario', 'admin');

    await api().post('/api/usuarios').send({ nombre: 'Mario Mozo', rol: 'Mozo', pin: '3333', permisos: ['Salon'] });
    await loginPin('3333');
    const vistaMozo = (await nav.get('/api/usuarios')).body;
    expect(vistaMozo.length).toBeGreaterThan(0);
    for (const u of vistaMozo) {
      expect(u).not.toHaveProperty('usuario');
      expect(u).not.toHaveProperty('correo');
    }
  });
});
