// API de Cocina y barra: comandas y avisos de cancelación
import { apiRequest } from '../../apiCliente';

export const apiCocina = {
  getPedidosCocina: () => apiRequest('/api/pedidos/cocina'),
  getPedidosBarra: () => apiRequest('/api/pedidos/barra'),
  prepararPedido: (id, seccion) => apiRequest(`/api/pedidos/${id}/preparar`, {
    method: 'PATCH', body: JSON.stringify({ seccion })
  }),
  servirPedido: (id) => apiRequest(`/api/pedidos/${id}/servir`, { method: 'PATCH' }),
  updateItemNotas: (itemId, notas) => apiRequest(`/api/pedidos/items/${itemId}/notas`, {
    method: 'PATCH', body: JSON.stringify({ notas })
  }),
  prepararItem: (itemId) => apiRequest(`/api/pedidos/items/${itemId}/preparar`, { method: 'PATCH' }),
  getCancelacionesCocina: () => apiRequest('/api/cocina/cancelaciones'),
  dismissCancelacionCocina: (id) => apiRequest(`/api/cocina/cancelaciones/${id}`, { method: 'DELETE' }),
  getCancelacionesBarra: () => apiRequest('/api/barra/cancelaciones'),
  dismissCancelacionBarra: (id) => apiRequest(`/api/barra/cancelaciones/${id}`, { method: 'DELETE' }),
};
