// Respaldo descargable de la base (tarea 20), con un pg_dump simulado (test/falsos/pg_dump.sh)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PIN_ADMIN, PIN_CAJERO, api, app, crearBase, esperarError, limpiarBD, prisma } from './helpers.mjs';

const PG_DUMP_FALSO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'falsos', 'pg_dump.sh');
const CONTRASENA = 'clave-segura-1';
// Por si el sistema de archivos o git no guardó el permiso de ejecución
fs.chmodSync(PG_DUMP_FALSO, 0o755);

async function sesion(pin) {
  const nav = request.agent(app);
  await nav.post('/api/auth/activar').send({ usuario: 'admin', contrasena: CONTRASENA, nombreDispositivo: 'PC administración' });
  await nav.post('/api/auth/login').send({ pin });
  return nav;
}
const binario = (res, cb) => {
  res.setEncoding('binary');
  let datos = '';
  res.on('data', (t) => { datos += t; });
  res.on('end', () => cb(null, datos));
};

beforeEach(async () => {
  process.env.PG_DUMP = PG_DUMP_FALSO;
  delete process.env.PG_DUMP_FALLAR;
  await limpiarBD();
  await crearBase();
  const admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador' } });
  await api().put(`/api/usuarios/${admin.id}`).send({ usuario: 'admin', contrasena: CONTRASENA });
});
afterEach(() => {
  delete process.env.PG_DUMP;
  delete process.env.PG_DUMP_FALLAR;
});

describe('GET /api/respaldo', () => {
  it('solo el Administrador con sesión', async () => {
    esperarError(await api().get('/api/respaldo'), 401, 'NO_AUTENTICADO');
    esperarError(await (await sesion(PIN_CAJERO)).get('/api/respaldo'), 403, 'SIN_PERMISO');
  });

  it('descarga el .dump, sin los parámetros de Prisma en la conexión, y queda en la auditoría', async () => {
    const res = await (await sesion(PIN_ADMIN)).get('/api/respaldo').buffer(true).parse(binario);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="respaldo-.+\.dump"$/);
    expect(res.body).toContain('PGDMP-respaldo-falso -Fc --no-owner -d postgresql://');
    expect(res.body).not.toContain('connection_limit');
    const registro = await prisma.auditoria.findFirst({ where: { accion: 'RESPALDO_DESCARGADO' } });
    expect(registro).toMatchObject({ usuarioNombre: 'Admin', entidad: 'BaseDeDatos' });
    expect(registro.despues.bytes).toBeGreaterThan(0);
  });

  it('si pg_dump falla o no existe → SERVICIO_NO_DISPONIBLE, sin registrar nada', async () => {
    const nav = await sesion(PIN_ADMIN);
    process.env.PG_DUMP_FALLAR = '1';
    esperarError(await nav.get('/api/respaldo'), 503, 'SERVICIO_NO_DISPONIBLE');
    delete process.env.PG_DUMP_FALLAR;
    process.env.PG_DUMP = '/no/existe/pg_dump';
    esperarError(await nav.get('/api/respaldo'), 503, 'SERVICIO_NO_DISPONIBLE');
    expect(await prisma.auditoria.count({ where: { accion: 'RESPALDO_DESCARGADO' } })).toBe(0);
  });
});
