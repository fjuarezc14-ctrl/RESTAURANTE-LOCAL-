// @ts-check
// ============================================================
// SESIÓN EN TODO /api/* (scratch/ACUERDOS.md §2)
// Con AUTH_OBLIGATORIA=false (transición) carga req.usuario si hay cookie, pero no rechaza a nadie:
// el frontend actual sigue funcionando hasta que use el login nuevo. Con true, exige la sesión.
// ============================================================
const { ErrorApp } = require('./errores');
const { borrarCookieSesion, registrarActividad, validarSesion } = require('../servicios/sesiones');

// /api/status: el instalador y los chequeos de salud preguntan si el servidor responde, sin sesión
const RUTAS_PUBLICAS = ['/api/auth/marca', '/api/auth/activar', '/api/auth/login', '/api/status'];
const authObligatoria = () => process.env.AUTH_OBLIGATORIA === 'true';

// motivoCierre: por qué se cerró la sesión (ver servicios/sesiones.js), para avisarle al usuario
const MENSAJES_CIERRE = {
  PIN_CAMBIADO: 'El administrador cambió tu PIN. Ingresa con tu PIN nuevo.',
  USUARIO_DESACTIVADO: 'Tu usuario fue desactivado. Habla con el administrador.',
  INACTIVIDAD: 'Tu sesión se cerró por inactividad. Ingresa tu PIN.',
};

function errorDeSesion(motivo, motivoCierre) {
  if (motivo === 'DISPOSITIVO_REVOCADO') {
    return new ErrorApp('DISPOSITIVO_NO_ACTIVADO', 'Este dispositivo fue desactivado. Actívalo de nuevo con tu usuario y contraseña.');
  }
  if (motivo === 'CERRADA') return new ErrorApp('SESION_EXPIRADA', MENSAJES_CIERRE[motivoCierre] || 'Tu sesión terminó. Ingresa tu PIN de nuevo.');
  return new ErrorApp('NO_AUTENTICADO', 'Ingresa tu PIN para continuar.');
}

async function cargarSesion(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  try {
    const { sesion, motivo, motivoCierre } = await validarSesion(req);
    if (sesion) {
      req.sesion = sesion;
      req.usuario = sesion.usuario;
      req.dispositivo = sesion.dispositivo;
      // La conexión de avisos en vivo no cuenta como actividad del usuario
      if (!req.path.startsWith('/api/eventos')) await registrarActividad(sesion);
      return next();
    }
    req.motivoSesion = motivo;
    req.motivoCierre = motivoCierre;
    if (motivo !== 'SIN_COOKIE') borrarCookieSesion(res);
    if (!authObligatoria() || RUTAS_PUBLICAS.includes(req.path)) return next();
    return next(errorDeSesion(motivo, motivoCierre));
  } catch (err) {
    return next(err);
  }
}

// Para rutas que siempre necesitan sesión, aunque AUTH_OBLIGATORIA esté apagada (ej. /api/auth/yo)
function requiereSesion(req, res, next) {
  if (req.usuario) return next();
  return next(errorDeSesion(req.motivoSesion, req.motivoCierre));
}

module.exports = { cargarSesion, requiereSesion };
