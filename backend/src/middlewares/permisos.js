// ============================================================
// PERMISOS POR ROL EN EL BACKEND (scratch/ACUERDOS.md §2)
// Cada ruta declara qué permisos pueden usarla (cualquiera de ellos basta). El Administrador siempre pasa
// y se respetan las equivalencias de shared/permisos.js (Caja → Créditos, Dashboard → Carta y Categorías).
// Transición: sin sesión y con AUTH_OBLIGATORIA=false no se exige nada (el frontend aún usa el login antiguo).
// ============================================================
const { esAdmin, tienePermiso } = require('../../shared/permisos.js');
const { ErrorApp } = require('./errores');

const authObligatoria = () => process.env.AUTH_OBLIGATORIA === 'true';

function sinUsuario(req, next) {
  if (!authObligatoria()) return next();
  return next(new ErrorApp('NO_AUTENTICADO', 'Ingresa tu PIN para continuar.'));
}

function requierePermiso(...permisos) {
  return (req, res, next) => {
    if (!req.usuario) return sinUsuario(req, next);
    if (permisos.some((p) => tienePermiso(req.usuario, p))) return next();
    return next(new ErrorApp('SIN_PERMISO', 'No tienes permiso para esta acción.'));
  };
}

function soloAdmin(req, res, next) {
  if (!req.usuario) return sinUsuario(req, next);
  if (esAdmin(req.usuario)) return next();
  return next(new ErrorApp('SIN_PERMISO', 'Solo el Administrador puede hacer esto.'));
}

module.exports = { requierePermiso, soloAdmin };
