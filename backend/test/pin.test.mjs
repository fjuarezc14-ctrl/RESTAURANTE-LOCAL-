// PIN guardado como hash (tarea 8): nunca en texto plano en la BD ni en la API
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, api, crearBase, esperarError, limpiarBD, prisma } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { migrarPinesAHash, hashPin } = require('../src/servicios/auth.js');

const SECRETOS = ['pin', 'pinHash', 'contrasenaHash'];

beforeEach(async () => {
  await limpiarBD();
  await crearBase();
});

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
    expect((await api().post('/api/usuarios/login').send({ pin: '4321' })).status).toBe(200);
  });

  it('la API nunca devuelve el PIN ni los hashes', async () => {
    const lista = (await api().get('/api/usuarios')).body;
    const creado = (await api().post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: '5555', permisos: ['Salon'] })).body;
    const editado = (await api().put(`/api/usuarios/${creado.id}`).send({ nombre: 'Ana María' })).body;
    const login = (await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN })).body.user;
    for (const u of [...lista, creado, editado, login]) {
      for (const campo of SECRETOS) expect(u).not.toHaveProperty(campo);
    }
  });

  it('el login funciona con el PIN y el PIN repetido se rechaza', async () => {
    expect((await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN })).body.user.rol).toBe('Administrador');
    esperarError(await api().post('/api/usuarios').send({ nombre: 'Ana', rol: 'Mozo', pin: PIN_ADMIN }), 409, 'YA_EXISTE', 'pin');
  });

  it('cambiar el PIN: el nuevo funciona, el anterior no, y la firma de sesión cambia', async () => {
    const { user } = (await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN })).body;
    await api().put(`/api/usuarios/${user.id}`).send({ pin: '9876' });
    esperarError(await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN }), 401, 'PIN_INCORRECTO');
    const nuevo = (await api().post('/api/usuarios/login').send({ pin: '9876' })).body.user;
    expect(nuevo.pinSignature).not.toBe(user.pinSignature);
  });

  it('editar sin enviar el PIN no lo cambia', async () => {
    const { user } = (await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN })).body;
    await api().put(`/api/usuarios/${user.id}`).send({ nombre: 'Admin', pin: '' });
    expect((await api().post('/api/usuarios/login').send({ pin: PIN_ADMIN })).status).toBe(200);
  });
});
