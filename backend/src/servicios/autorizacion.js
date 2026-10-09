// @ts-check
// ============================================================
// PIN DE AUTORIZACIÓN (anular, corregir una venta, cortesías, cierre forzado)
// Todas las comprobaciones comparten un límite de intentos: 5 fallos en 1 minuto bloquean 30 s
// por sesión (o por IP sin sesión). Sin él, 10.000 PINs posibles se prueban en segundos.
// ============================================================
const { crearLimitador, ipDe } = require('../middlewares/limiteLogin');
const { buscarUsuarioPorPin } = require('./auth');

const limitadorPinAutorizacion = crearLimitador((req) => (req.sesion ? `sesion:${req.sesion.id}` : `ip:${ipDe(req)}`));

/**
 * Usuario activo con ese PIN (y los filtros, ej. { rol: 'Administrador' }), o null.
 * Lanza DEMASIADOS_INTENTOS si esta sesión falló demasiadas veces.
 */
async function usuarioPorPinAutorizado(req, pin, filtros = {}) {
  const bloqueo = limitadorPinAutorizacion.bloqueo(req);
  if (bloqueo) throw bloqueo;
  const usuario = await buscarUsuarioPorPin(pin, filtros);
  if (usuario) limitadorPinAutorizacion.exito(req);
  else limitadorPinAutorizacion.fallo(req);
  return usuario;
}

module.exports = { limitadorPinAutorizacion, usuarioPorPinAutorizado };
