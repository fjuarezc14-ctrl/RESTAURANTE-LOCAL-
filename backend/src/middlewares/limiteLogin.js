// @ts-check
// Límite de intentos fallidos (login, activación, autorizaciones): 5 fallos en 1 minuto bloquean 30 s
const { ErrorApp } = require('./errores');

const VENTANA_MS = 60 * 1000;
const FALLOS_PARA_BLOQUEAR = 5;
const BLOQUEO_MS = 30 * 1000;

const limitadores = []; // para reiniciarlos todos (pruebas)

const ipDe = (req) => req.ip || req.connection?.remoteAddress || 'local';

// Cada limitador lleva su propio contador. `clave(req)` decide qué se cuenta: por defecto, la IP.
function crearLimitador(clave = ipDe) {
  const intentos = new Map(); // clave -> { count, firstAttempt, blockedUntil }

  // El error a devolver si esta clave está bloqueada, o null
  function bloqueo(req) {
    const intento = intentos.get(clave(req));
    const ahora = Date.now();
    if (intento && intento.blockedUntil && ahora < intento.blockedUntil) {
      const segundos = Math.ceil((intento.blockedUntil - ahora) / 1000);
      return new ErrorApp('DEMASIADOS_INTENTOS', `Demasiados intentos fallidos. Acceso temporalmente bloqueado por ${segundos} segundos.`, { datos: { reintentarEnSeg: segundos } });
    }
    return null;
  }

  function middleware(req, res, next) {
    next(bloqueo(req) || undefined);
  }

  function fallo(req) {
    const k = clave(req);
    const ahora = Date.now();
    const intento = intentos.get(k) || { count: 0, firstAttempt: ahora, blockedUntil: 0 };
    if (ahora - intento.firstAttempt > VENTANA_MS) {
      intento.count = 1;
      intento.firstAttempt = ahora;
      intento.blockedUntil = 0;
    } else {
      intento.count += 1;
    }
    if (intento.count >= FALLOS_PARA_BLOQUEAR) intento.blockedUntil = ahora + BLOQUEO_MS;
    intentos.set(k, intento);
  }

  const exito = (req) => intentos.delete(clave(req));

  // Limpiar periódicamente las claves antiguas cada 10 minutos
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, intento] of intentos.entries()) {
      if (ahora - intento.firstAttempt > 10 * VENTANA_MS && (!intento.blockedUntil || ahora > intento.blockedUntil)) intentos.delete(k);
    }
  }, 10 * VENTANA_MS).unref();

  const limitador = { middleware, bloqueo, fallo, exito, reiniciar: () => intentos.clear() };
  limitadores.push(limitador);
  return limitador;
}

const reiniciarLimitadores = () => limitadores.forEach((l) => l.reiniciar());

module.exports = {
  crearLimitador,
  reiniciarLimitadores,
  ipDe,
};
