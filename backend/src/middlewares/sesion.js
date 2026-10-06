// ============================================================
// SESIÓN EN TODO /api/* (scratch/ACUERDOS.md §2)
// Con AUTH_OBLIGATORIA=false (transición) carga req.usuario si hay cookie, pero no rechaza a nadie:
// el frontend actual sigue funcionando hasta que use el login nuevo. Con true, exige la sesión.
// ============================================================
const { ErrorApp } = require('./errores');
const { borrarCookieSesion, registrarActividad, validarSesion } = require('../servicios/sesiones');

const RUTAS_PUBLICAS = ['/api/auth/marca', '/api/auth/activar', '/api/auth/login'];
const authObligatoria = () => process.env.AUTH_OBLIGATORIA === 'true';

function errorDeSesion(motivo) {
  if (motivo === 'DISPOSITIVO_REVOCADO') {
    return new ErrorApp('DISPOSITIVO_NO_ACTIVADO', 'Este dispositivo fue desactivado. Actívalo de nuevo con tu usuario y contraseña.');
  }
  if (motivo === 'CERRADA') return new ErrorApp('SESION_EXPIRADA', 'Tu sesión terminó. Ingresa tu PIN de nuevo.');
  return new ErrorApp('NO_AUTENTICADO', 'Ingresa tu PIN para continuar.');
}

async function cargarSesion(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  try {
    const { sesion, motivo } = await validarSesion(req);
    if (sesion) {
      req.sesion = sesion;
      req.usuario = sesion.usuario;
      req.dispositivo = sesion.dispositivo;
      // La conexión de avisos en vivo no cuenta como actividad del usuario
      if (!req.path.startsWith('/api/eventos')) await registrarActividad(sesion);
      return next();
    }
    req.motivoSesion = motivo;
    if (motivo !== 'SIN_COOKIE') borrarCookieSesion(res);
    if (!authObligatoria() || RUTAS_PUBLICAS.includes(req.path)) return next();
    return next(errorDeSesion(motivo));
  } catch (err) {
    return next(err);
  }
}

// Para rutas que siempre necesitan sesión, aunque AUTH_OBLIGATORIA esté apagada (ej. /api/auth/yo)
function requiereSesion(req, res, next) {
  if (req.usuario) return next();
  return next(errorDeSesion(req.motivoSesion));
}

module.exports = { cargarSesion, requiereSesion };
