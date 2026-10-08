// API de Créditos y clientes
import { apiRequest } from '../../apiCliente';

export const apiCreditos = {
  getDirectorioClientes: (page = 1, limit = 15, search = '') => 
    apiRequest(`/api/clientes/directorio?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
  getClientes: () => apiRequest('/api/clientes'),
  crearCliente: (body) => apiRequest('/api/clientes', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarCliente: (id, body) => apiRequest(`/api/clientes/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarCliente: (id) => apiRequest(`/api/clientes/${id}`, { method: 'DELETE' }),
  getClienteDetalle: (id) => apiRequest(`/api/clientes/${id}`),
  abonarCredito: (id, body) => apiRequest(`/api/clientes/${id}/abonar`, {
    method: 'POST', body: JSON.stringify(body)
  }),
  getVentasCredito: () => apiRequest('/api/clientes/ventas/credito'),
  getAbonos: (desde) => {
    const qs = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    return apiRequest(`/api/abonos${qs}`);
  },
};
