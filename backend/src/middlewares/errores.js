// @ts-check
// ============================================================
// ERRORES CON FORMATO ÚNICO (scratch/ACUERDOS.md §1)
// Respuesta: { error: { codigo, mensaje, campo?, datos? } }. El detalle técnico solo va al log.
// ============================================================
const { CODIGOS, MENSAJE_ERROR_INTERNO, statusDe } = require('../../shared/errores.js');

class ErrorApp extends Error {
  /**
   * @param {string} codigo  uno de shared/errores.js (define el status HTTP)
   * @param {string} mensaje texto para el usuario
   * @param {{ campo?: string, datos?: any, status?: number }} [opciones] campo del formulario y datos extra
   */
  constructor(codigo, mensaje, { campo, datos } = {}) {
    super(mensaje);
    if (!CODIGOS[codigo]) throw new Error(`Código de error desconocido: ${codigo}`);
    this.name = 'ErrorApp';
    this.codigo = codigo;
    this.campo = campo;
    this.datos = datos;
  }
}

// Convierte cualquier error en un ErrorApp con un mensaje apto para el usuario
function traducirError(err) {
  if (err instanceof ErrorApp) return err;
  if (err.type === 'entity.parse.failed') return new ErrorApp('JSON_INVALIDO', 'Los datos enviados no tienen un formato válido.');
  if (err.type === 'entity.too.large') return new ErrorApp('CUERPO_DEMASIADO_GRANDE', 'Los datos enviados son demasiado grandes.');
  if (err.code === 'P2002') {
    const campo = Array.isArray(err.meta?.target) ? err.meta.target[0] : undefined;
    return new ErrorApp('YA_EXISTE', 'Ya existe un registro con ese valor.', { campo });
  }
  if (err.code === 'P2025') return new ErrorApp('NO_ENCONTRADO', 'No se encontró el registro.');
  if (err.name === 'PrismaClientInitializationError' || ['P1001', 'P1002', 'P2024'].includes(err.code)) {
    return new ErrorApp('SERVICIO_NO_DISPONIBLE', 'La base de datos no responde. Inténtalo en unos segundos.');
  }
  return new ErrorApp('ERROR_INTERNO', MENSAJE_ERROR_INTERNO);
}

function cuerpoDeError({ codigo, message, campo, datos }) {
  return { error: { codigo, mensaje: message, ...(campo ? { campo } : {}), ...(datos ? { datos } : {}) } };
}

// Va al final de Express: todas las rutas llaman a next(err)
function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);
  const error = traducirError(err);
  if (!(err instanceof ErrorApp)) console.error(`[${req.method} ${req.originalUrl}] ${error.codigo}:`, err);
  res.status(statusDe(error.codigo)).json(cuerpoDeError(error));
}

// Rutas /api/* que no existen: 404 en JSON en lugar de la página HTML de Express
function rutaNoEncontrada(req, res, next) {
  next(new ErrorApp('NO_ENCONTRADO', `La ruta ${req.method} ${req.originalUrl} no existe.`));
}

module.exports = { ErrorApp, traducirError, manejarErrores, rutaNoEncontrada };
