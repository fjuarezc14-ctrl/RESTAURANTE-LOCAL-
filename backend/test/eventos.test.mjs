// Avisos en vivo (SSE, tarea 16)
import http from 'node:http';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, app, crearBase, limpiarBD } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { temasDeRuta, conectados } = require('../src/servicios/eventos.js');

let servidor;
let puerto;
beforeAll(async () => {
  servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, r));
  puerto = servidor.address().port;
});
afterAll(() => new Promise((r) => { servidor.closeAllConnections(); servidor.close(r); }));
beforeEach(async () => {
  await limpiarBD();
  await crearBase();
});

// Se conecta a /api/eventos y junta lo que llega
function conectar() {
  return new Promise((resolve, reject) => {
    const recibido = { texto: '', status: 0, headers: {} };
    const req = http.get({ port: puerto, path: '/api/eventos' }, (res) => {
      recibido.status = res.statusCode;
      recibido.headers = res.headers;
      res.setEncoding('utf8');
      res.on('data', (t) => { recibido.texto += t; });
      // Listo cuando llega el saludo
      const esperar = () => (recibido.texto.includes(': conectado') ? resolve({ recibido, cerrar: () => req.destroy() }) : setTimeout(esperar, 10));
      esperar();
    });
    req.on('error', reject);
  });
}
const esperarQue = async (condicion, ms = 2000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (condicion()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
};

describe('temas por ruta', () => {
  it('cada ruta avisa lo que cambia', () => {
    expect(temasDeRuta('/api/mesas/3/pedido')).toEqual(['mesas', 'pedidos']);
    expect(temasDeRuta('/api/ventas?x=1')).toEqual(['ventas', 'mesas', 'pedidos', 'caja']);
    expect(temasDeRuta('/api/cocina/cancelaciones/4')).toEqual(['cancelaciones']);
    expect(temasDeRuta('/api/desconocida')).toEqual([]);
  });
});

describe('GET /api/eventos', () => {
  it('abre un flujo de eventos y avisa después de un cambio exitoso', async () => {
    const { recibido, cerrar } = await conectar();
    try {
      expect(recibido.status).toBe(200);
      expect(recibido.headers['content-type']).toContain('text/event-stream');
      expect((await api().post('/api/mesas').send({ numero: 20 })).status).toBeLessThan(400);
      expect(await esperarQue(() => recibido.texto.includes('event: cambio'))).toBe(true);
      expect(recibido.texto).toContain('"temas":["mesas","pedidos"]');
    } finally {
      cerrar();
    }
  });

  it('una petición rechazada no avisa nada', async () => {
    const { recibido, cerrar } = await conectar();
    try {
      expect((await api().post('/api/mesas').send({ numero: 'abc' })).status).toBe(400);
      expect(await esperarQue(() => recibido.texto.includes('event: cambio'), 300)).toBe(false);
    } finally {
      cerrar();
    }
  });

  it('al desconectarse se quita de la lista', async () => {
    const { cerrar } = await conectar();
    expect(conectados()).toBeGreaterThan(0);
    cerrar();
    expect(await esperarQue(() => conectados() === 0)).toBe(true);
  });

  it('con AUTH_OBLIGATORIA=true pide sesión', async () => {
    process.env.AUTH_OBLIGATORIA = 'true';
    try {
      const res = await api().get('/api/eventos');
      expect(res.status).toBe(401);
      expect(res.body.error.codigo).toBe('NO_AUTENTICADO');
    } finally {
      delete process.env.AUTH_OBLIGATORIA;
    }
  });
});
