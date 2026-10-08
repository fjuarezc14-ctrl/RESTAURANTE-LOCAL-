// API de Compras y gastos
import { apiRequest } from '../../apiCliente';

export const apiCompras = {
  getCompras: (desde, hasta, extraParams = {}) => {
    let params = {};
    if (typeof desde === 'object' && desde !== null) {
      params = desde;
    } else {
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (extraParams) params = { ...params, ...extraParams };
    }
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/compras${qs}`);
  },
  crearCompra: (body) => apiRequest('/api/compras', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarCompra: (id, body) => apiRequest(`/api/compras/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarCompra: (id) => apiRequest(`/api/compras/${id}`, {
    method: 'DELETE'
  }),
  getComprasStats: () => apiRequest('/api/compras/stats'),
  sincronizarSunat: (body) => apiRequest('/api/compras/sincronizar-sunat', {
    method: 'POST', body: JSON.stringify(body)
  }),
  actualizarCategoriaCompra: (id, categoria) => apiRequest(`/api/compras/${id}/categoria`, {
    method: 'PATCH', body: JSON.stringify({ categoria })
  }),
};
