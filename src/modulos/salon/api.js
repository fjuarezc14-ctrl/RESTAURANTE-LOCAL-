// API de Salón: mesas, pedidos de mesa, cancelaciones y entregas
import { apiRequest, conClave } from '../../apiCliente';

export const apiSalon = {
  getMesas: () => apiRequest('/api/mesas'),
  // claveIdempotencia: la misma en los reintentos del mismo envío (un WiFi inestable no duplica la comanda)
  enviarACocina: (num, body, claveIdempotencia) => apiRequest(`/api/mesas/${num}/pedido`, {
    method: 'POST', body: JSON.stringify(body), ...conClave(claveIdempotencia)
  }),
  unirMesa: (num, numeroMesaAUnir) => apiRequest(`/api/mesas/${num}/unir`, {
    method: 'POST', body: JSON.stringify({ numeroMesaAUnir })
  }),
  separarMesas: (num, numeroMesa = null) => apiRequest(`/api/mesas/${num}/separar`, {
    method: 'POST', body: JSON.stringify(numeroMesa != null ? { numeroMesa } : {})
  }),
  crearMesa: (body) => apiRequest('/api/mesas', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarMesa: (numero, body) => apiRequest(`/api/mesas/${numero}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarMesa: (numero) => apiRequest(`/api/mesas/${numero}`, { method: 'DELETE' }),
  cancelarPedido: (id, body) => apiRequest(`/api/pedidos/${id}/cancelar`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  cancelarItemPedido: (id, body) => apiRequest(`/api/pedidos/${id}/cancelar-item`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  entregarItem: (itemId) => apiRequest(`/api/pedidos/items/${itemId}/entregar`, { method: 'PATCH' }),
  entregarTodoPedido: (pedidoId) => apiRequest(`/api/pedidos/${pedidoId}/entregar-todo`, { method: 'PATCH' }),
};
