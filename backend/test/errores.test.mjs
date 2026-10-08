// Formato único de errores (ACUERDOS §1): { error: { codigo, mensaje, campo?, datos? } }
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, api, crearBase, esperarError, limpiarBD } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { ErrorApp, traducirError } = require('../src/middlewares/errores.js');
const { CODIGOS, MENSAJE_ERROR_INTERNO } = require('../shared/errores.js');

// Texto que delata detalles internos si llega al usuario
const DETALLE_INTERNO = /prisma|invalid `|select |insert |update "|stack|node_modules|\/app\/|\.js:\d+|undefined|TypeError|ReferenceError/i;

beforeEach(async () => {
  await limpiarBD();
  await crearBase();
});

describe('ErrorApp y traducción de errores', () => {
  it('no acepta códigos que no están en la lista', () => {
    expect(() => new ErrorApp('INVENTADO', 'x')).toThrow(/desconocido/);
  });

  it.each([
    ['duplicado de Prisma (P2002)', Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['numero'] } }), 'YA_EXISTE', 'numero'],
    ['registro inexistente de Prisma (P2025)', Object.assign(new Error('Record to update not found'), { code: 'P2025' }), 'NO_ENCONTRADO'],
    ['BD caída', Object.assign(new Error("Can't reach database server"), { name: 'PrismaClientInitializationError' }), 'SERVICIO_NO_DISPONIBLE'],
    ['JSON inválido', Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }), 'JSON_INVALIDO'],
    ['cuerpo demasiado grande', Object.assign(new Error('request entity too large'), { type: 'entity.too.large' }), 'CUERPO_DEMASIADO_GRANDE'],
  ])('%s → %s', (_caso, err, codigo, campo) => {
    const traducido = traducirError(err);
    expect(traducido.codigo).toBe(codigo);
    if (campo) expect(traducido.campo).toBe(campo);
    expect(traducido.message).not.toMatch(DETALLE_INTERNO);
  });

  it('un error no previsto sale como ERROR_INTERNO con mensaje genérico', () => {
    const traducido = traducirError(new TypeError('Cannot read properties of undefined (reading \'id\') at /app/src/rutas/caja.js:12'));
    expect(traducido.codigo).toBe('ERROR_INTERNO');
    expect(traducido.message).toBe(MENSAJE_ERROR_INTERNO);
  });
});

describe('respuestas de la API', () => {
  it('JSON inválido en el cuerpo → 400 JSON_INVALIDO', async () => {
    const res = await api().post('/api/caja/apertura').set('Content-Type', 'application/json').send('{"cajeroNombre": ');
    esperarError(res, 400, 'JSON_INVALIDO');
  });

  it('una ruta /api que no existe → 404 en JSON', async () => {
    esperarError(await api().get('/api/no-existe'), 404, 'NO_ENCONTRADO');
  });

  it('Prisma sin registro (P2025) → 404 NO_ENCONTRADO', async () => {
    esperarError(await api().patch('/api/pedidos/99999/servir'), 404, 'NO_ENCONTRADO');
  });

  it('número de mesa repetido → 409 YA_EXISTE con el campo', async () => {
    esperarError(await api().post('/api/mesas').send({ numero: 1 }), 409, 'YA_EXISTE', 'numero');
  });

  it('PIN incorrecto → 401 PIN_INCORRECTO; tras 5 fallos → 429 con los segundos de espera', async () => {
    for (let i = 0; i < 5; i += 1) {
      esperarError(await api().post('/api/usuarios/login').send({ pin: '0000' }), 401, 'PIN_INCORRECTO', 'pin');
    }
    const bloqueado = await api().post('/api/usuarios/login').send({ pin: '0000' });
    esperarError(bloqueado, 429, 'DEMASIADOS_INTENTOS');
    expect(bloqueado.body.error.datos.reintentarEnSeg).toBeGreaterThan(0);
  });
});

// Recorre todas las rutas con cuerpo vacío e IDs inexistentes: ningún error puede salir con otro formato
describe('barrido de todas las rutas', () => {
  const rutas = [];
  const recorrer = (stack) => {
    for (const capa of stack) {
      if (capa.route && typeof capa.route.path === 'string' && capa.route.path.startsWith('/api/')) {
        for (const metodo of Object.keys(capa.route.methods)) rutas.push([metodo, capa.route.path]);
      } else if (capa.name === 'router' && capa.handle.stack) recorrer(capa.handle.stack);
    }
  };
  recorrer(app._router.stack);
  // Consulta un servicio externo (RENIEC/SUNAT): no se llama en las pruebas.
  // /api/eventos deja la conexión abierta a propósito (tiene sus pruebas en eventos.test.mjs)
  const probables = rutas.filter(([, ruta]) => !ruta.startsWith('/api/clientes/consulta/') && ruta !== '/api/eventos');

  it('encuentra todas las rutas de la API', () => {
    expect(probables.length).toBeGreaterThan(80);
  });

  it.each(probables)('%s %s', async (metodo, ruta) => {
    const url = ruta.replace(/:[a-zA-Z]+/g, '99999');
    const res = await api()[metodo](url).send({});
    if (res.status < 400) return;
    expect(res.body.error, `${metodo} ${url} → ${res.status} ${JSON.stringify(res.body)}`).toMatchObject({
      codigo: expect.any(String), mensaje: expect.any(String),
    });
    expect(Object.keys(CODIGOS)).toContain(res.body.error.codigo);
    expect(res.status).toBe(CODIGOS[res.body.error.codigo].status);
    expect(res.body.error.mensaje).not.toMatch(DETALLE_INTERNO);
  });
});
