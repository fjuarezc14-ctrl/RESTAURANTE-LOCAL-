// ============================================================
// PERMISOS POR MÓDULO (compartido backend / frontend)
// Usuarios, Dispositivos, Auditoría, Configuración y Respaldo son solo del Administrador.
// ============================================================

export const ROL_ADMIN = 'Administrador';

export const PERMISOS = [
  'Dashboard',
  'Salon',
  'Cocina',
  'Barra',
  'Caja',
  'Creditos',
  'Compras',
  'Reportes',
  'Carta',
  'Categorias',
];

// Un permiso que da acceso a otro (lo que antes vivía en App.jsx)
const EQUIVALENCIAS = {
  Carta: ['Dashboard'],
  Categorias: ['Dashboard'],
  Creditos: ['Caja'],
};

export function esAdmin(usuario) {
  return usuario?.rol === ROL_ADMIN;
}

export function tienePermiso(usuario, permiso) {
  if (!usuario) return false;
  if (esAdmin(usuario)) return true;
  const propios = usuario.permisos || [];
  if (propios.includes(permiso)) return true;
  return (EQUIVALENCIAS[permiso] || []).some((p) => propios.includes(p));
}
