// @ts-check
// ============================================================
// PIN DE AUTORIZACIÓN (anular, corregir una venta, cortesías, cierre forzado)
// Todas las comprobaciones comparten un límite de intentos: 5 fallos en 1 minuto bloquean 30 s
// por sesión (o por IP sin sesión). Sin él, 10.000 PINs posibles se prueban en segundos.
// ============================================================
const { crearLimitador, ipDe } = require('../middlewares/limiteLogin');
const { ErrorApp } = require('../middlewares/errores');
const { buscarUsuarioPorPin } = require('./auth');

const ROLES_QUE_AUTORIZAN = ['Administrador', 'Cajero'];

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

/**
 * Nombre de quien autorizó con su PIN (Administrador o Cajero), ej. una cortesía o un consumo de personal.
 * `que` completa el mensaje: "Hace falta el PIN de un Administrador o Cajero para {que}."
 */
async function autorizarConPin(req, pin, que) {
  if (!pin) {
    throw new ErrorApp('AUTORIZACION_REQUERIDA', `Hace falta el PIN de un Administrador o Cajero para ${que}.`, { campo: 'pin' });
  }
  const usuario = await usuarioPorPinAutorizado(req, String(pin).trim());
  if (!usuario) throw new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' });
  if (!ROLES_QUE_AUTORIZAN.includes(usuario.rol)) {
    limitadorPinAutorizacion.fallo(req);
    throw new ErrorApp('SIN_PERMISO', 'Se requiere el PIN de un Administrador o Cajero.', { campo: 'pin' });
  }
  return usuario.nombre;
}

module.exports = { ROLES_QUE_AUTORIZAN, autorizarConPin, limitadorPinAutorizacion, usuarioPorPinAutorizado };
