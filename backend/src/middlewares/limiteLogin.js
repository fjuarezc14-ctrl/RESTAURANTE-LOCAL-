// Límite de intentos fallidos de login por IP
const { ErrorApp } = require('./errores');

// ============================================================
// SEGURIDAD: RATE LIMITER CONTRA FUERZA BRUTA EN LOGIN POR PIN
// ============================================================
const loginAttempts = new Map(); // ip -> { count, firstAttempt, blockedUntil }

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'local';
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (attempt && attempt.blockedUntil && now < attempt.blockedUntil) {
    const remainingSeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return next(new ErrorApp('DEMASIADOS_INTENTOS', `Demasiados intentos fallidos. Acceso temporalmente bloqueado por ${remainingSeconds} segundos.`, { datos: { reintentarEnSeg: remainingSeconds } }));
  }
  next();
}

function registerLoginFailure(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'local';
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };

  // Si pasaron más de 60 segundos desde el primer intento fallido, resetear ventana
  if (now - attempt.firstAttempt > 60 * 1000) {
    attempt.count = 1;
    attempt.firstAttempt = now;
    attempt.blockedUntil = 0;
  } else {
    attempt.count += 1;
  }

  // Si supera 5 intentos fallidos consecutivos en menos de 1 minuto, bloquear por 30 segundos
  if (attempt.count >= 5) {
    attempt.blockedUntil = now + 30 * 1000;
  }

  loginAttempts.set(ip, attempt);
}

function registerLoginSuccess(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'local';
  loginAttempts.delete(ip);
}

// Limpiar periódicamente IPs antiguas cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of loginAttempts.entries()) {
    if (now - attempt.firstAttempt > 10 * 60 * 1000 && (!attempt.blockedUntil || now > attempt.blockedUntil)) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = { loginRateLimiter, registerLoginFailure, registerLoginSuccess };
