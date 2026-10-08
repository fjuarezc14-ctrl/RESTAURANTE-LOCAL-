// @ts-check
// ============================================================
// AVISOS EN VIVO (SSE, tarea 16): en vez de que cada pantalla consulte cada pocos segundos,
// el servidor avisa "cambió X" y la pantalla recarga solo lo suyo.
// - Cada aviso lleva temas: mesas, pedidos, cancelaciones, caja, ventas, carta, usuarios, compras, clientes.
// - Se emite al terminar una petición que cambia datos (después del commit: la respuesta sale al final).
// ============================================================
/** @typedef {import('express').Response} Response */

const LATIDO_MS = 25 * 1000; // por debajo de los 60 s que cortan los proxies sin tráfico

/** @type {Set<Response>} */
const clientes = new Set();
/** @type {NodeJS.Timeout | null} */
let latido = null;

// Qué temas cambian según la ruta (el primer tramo después de /api/)
const TEMAS_POR_RUTA = {
  mesas: ['mesas', 'pedidos'],
  pedidos: ['pedidos', 'mesas', 'cancelaciones'],
  cocina: ['cancelaciones'],
  barra: ['cancelaciones'],
  ventas: ['ventas', 'mesas', 'pedidos', 'caja'],
  caja: ['caja', 'ventas'],
  productos: ['carta'],
  categorias: ['carta'],
  ofertas: ['carta'],
  usuarios: ['usuarios'],
  dispositivos: ['usuarios'],
  compras: ['compras', 'caja'],
  clientes: ['clientes', 'caja'],
  abonos: ['clientes', 'caja'],
  empresa: ['configuracion'],
};

/** @param {string} ruta ej. "/api/pedidos/12/cancelar" @returns {string[]} */
function temasDeRuta(ruta) {
  const tramo = (ruta.split('?')[0].split('/')[2] || '').toLowerCase();
  return TEMAS_POR_RUTA[tramo] || [];
}

/** @param {Response} res */
function escribir(res, texto) {
  try {
    res.write(texto);
  } catch {
    clientes.delete(res);
  }
}

/** @param {string[]} temas */
function emitir(temas) {
  if (temas.length === 0 || clientes.size === 0) return;
  const mensaje = `event: cambio\ndata: ${JSON.stringify({ temas })}\n\n`;
  for (const res of clientes) escribir(res, mensaje);
}

/** Deja la respuesta abierta como flujo de eventos hasta que el cliente se desconecte */
function suscribir(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: no guardar en buffer
  });
  res.write('retry: 3000\n: conectado\n\n');
  clientes.add(res);
  if (!latido) {
    latido = setInterval(() => { for (const r of clientes) escribir(r, ': latido\n\n'); }, LATIDO_MS);
    latido.unref();
  }
  req.on('close', () => {
    clientes.delete(res);
    if (clientes.size === 0 && latido) {
      clearInterval(latido);
      latido = null;
    }
  });
}

/** Middleware: al terminar bien una petición que cambia datos, avisa a las pantallas conectadas */
function avisarCambios(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => {
      if (res.statusCode < 400) emitir(temasDeRuta(req.originalUrl));
    });
  }
  next();
}

/** Al apagar el servidor: si no, server.close() esperaría para siempre a estas conexiones */
function cerrarTodas() {
  for (const res of clientes) res.end();
  clientes.clear();
}

const conectados = () => clientes.size;

module.exports = { avisarCambios, suscribir, emitir, temasDeRuta, cerrarTodas, conectados };
