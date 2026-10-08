// API de Empresa y estado del servidor
import { apiRequest, descargarArchivo } from '../../apiCliente';

export const apiConfiguracion = {
  getDireccionesRed: () => apiRequest('/api/red/direcciones'),
  getStatus: () => apiRequest('/api/status'),
  getEmpresa: () => apiRequest('/api/empresa'),
  updateEmpresa: (body) => apiRequest('/api/empresa', {
    method: 'PUT', body: JSON.stringify(body)
  }),
  // Respaldo completo de la base (.dump, solo Administrador)
  descargarRespaldo: () => descargarArchivo('/api/respaldo', 'respaldo.dump'),
};
