// API de administración (solo Administrador): equipos activados, sesiones abiertas y auditoría
import { apiRequest } from '../../apiCliente';

export const apiAdmin = {
  getDispositivos: () => apiRequest('/api/dispositivos'),
  revocarDispositivo: (id) => apiRequest(`/api/dispositivos/${id}`, { method: 'DELETE' }),
  getSesionesUsuario: (usuarioId) => apiRequest(`/api/usuarios/${usuarioId}/sesiones`),
  cerrarSesionesUsuario: (usuarioId) => apiRequest(`/api/usuarios/${usuarioId}/cerrar-sesiones`, { method: 'POST' }),
  getAccionesAuditoria: () => apiRequest('/api/auditoria/acciones'),
  // filtros: { desde, hasta, usuarioId, accion, page, limit } (los vacíos no se envían)
  getAuditoria: (filtros = {}) => {
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null)).toString();
    return apiRequest(`/api/auditoria${qs ? `?${qs}` : ''}`);
  },
};
