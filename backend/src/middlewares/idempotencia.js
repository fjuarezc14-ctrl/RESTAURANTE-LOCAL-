// ============================================================
// IDEMPOTENCIA (ACUERDOS §4): header Idempotency-Key en operaciones que mueven dinero.
// - Sin el header: no hace nada (todo sigue como siempre).
// - Primera vez: marca la clave EN_CURSO, deja pasar y, ANTES de responder, guarda la respuesta;
//   así un reintento inmediato ya la encuentra.
// - Clave repetida: devuelve la misma respuesta; si la primera sigue en curso → OPERACION_EN_CURSO.
// - Si la operación falló (status ≥ 400) la clave se borra: el reintento se vuelve a intentar.
// - Las claves duran 24 h; una EN_CURSO de más de 2 min se da por abandonada (se cayó el proceso).
// ============================================================
const { prisma } = require('../db');
const { ErrorApp } = require('./errores');

const HORAS_VIGENCIA = 24;
const MS_ABANDONADA = 2 * 60 * 1000;

async function reservar(clave, ruta) {
  try {
    await prisma.idempotenciaClave.create({ data: { clave, ruta, estado: 'EN_CURSO' } });
    return { reservada: true };
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    const previa = await prisma.idempotenciaClave.findUnique({ where: { clave_ruta: { clave, ruta } } });
    if (!previa) return reservar(clave, ruta); // se borró entre medio: se vuelve a intentar
    if (previa.estado === 'EN_CURSO' && Date.now() - previa.creadoEn.getTime() > MS_ABANDONADA) {
      await prisma.idempotenciaClave.deleteMany({ where: { id: previa.id, estado: 'EN_CURSO' } });
      return reservar(clave, ruta);
    }
    return { reservada: false, previa };
  }
}

function idempotente(req, res, next) {
  const clave = req.get('Idempotency-Key');
  if (!clave) return next();
  if (clave.length > 100) return next(new ErrorApp('VALIDACION', 'La clave de idempotencia es demasiado larga.'));
  const ruta = `${req.method} ${req.originalUrl.split('?')[0]}`;

  (async () => {
    // Limpieza de claves vencidas (barata: hay índice por fecha)
    await prisma.idempotenciaClave.deleteMany({ where: { creadoEn: { lt: new Date(Date.now() - HORAS_VIGENCIA * 3600 * 1000) } } });

    const { reservada, previa } = await reservar(clave, ruta);
    if (!reservada) {
      if (previa.estado === 'HECHA') return res.status(previa.status).json(previa.respuesta);
      return next(new ErrorApp('OPERACION_EN_CURSO', 'Esta operación ya se está procesando. Espera un momento.'));
    }

    const jsonOriginal = res.json.bind(res);
    res.json = (cuerpo) => {
      const status = res.statusCode;
      const donde = { clave_ruta: { clave, ruta } };
      const guardar = status < 400
        ? prisma.idempotenciaClave.update({ where: donde, data: { estado: 'HECHA', status, respuesta: cuerpo ?? null } })
        : prisma.idempotenciaClave.delete({ where: donde });
      guardar.catch((err) => console.error('[idempotencia] no se pudo guardar la clave:', err.message))
        .finally(() => jsonOriginal(cuerpo));
      return res;
    };
    next();
  })().catch(next);
}

module.exports = { idempotente };
