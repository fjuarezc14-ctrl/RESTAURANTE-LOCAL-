// ============================================================
// VALIDACIÓN DE ENTRADA CON ZOD (esquemas en shared/esquemas/)
// Un error responde VALIDACION con el campo exacto: { error: { codigo, mensaje, campo } }
// ============================================================
const { id } = require('../../shared/esquemas/comunes.js');
const { ErrorApp } = require('./errores');

function errorDeZod(error, prefijo) {
  const issue = error.issues[0];
  const ruta = issue.path.join('.');
  return new ErrorApp('VALIDACION', issue.message, { campo: ruta || prefijo });
}

// validar({ body, params, query }): cada parte con su esquema; el resultado (ya convertido) reemplaza la entrada
function validar(esquemas) {
  return (req, res, next) => {
    for (const parte of ['params', 'query', 'body']) {
      if (!esquemas[parte]) continue;
      const resultado = esquemas[parte].safeParse(req[parte] ?? {});
      if (!resultado.success) return next(errorDeZod(resultado.error, parte));
      req[parte] = resultado.data;
    }
    next();
  };
}

// IDs numéricos en la URL (:id, :ventaId…): se validan en todos los routers
const PARAMS_ID = ['id', 'ventaId', 'itemId', 'num', 'numero'];
function validarIdsEnUrl(router) {
  for (const nombre of PARAMS_ID) {
    router.param(nombre, (req, res, next, valor) => {
      const resultado = id.safeParse(valor);
      if (!resultado.success) return next(new ErrorApp('VALIDACION', 'El ID no es válido.', { campo: nombre }));
      next();
    });
  }
}

module.exports = { validar, validarIdsEnUrl };
