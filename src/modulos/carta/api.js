// API de Carta: productos, categorías y ofertas
import { apiRequest } from '../../apiCliente';

export const apiCarta = {
  getProductos: () => apiRequest('/api/productos'),
  crearProducto: (body) => apiRequest('/api/productos', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarProducto: (id, body) => apiRequest(`/api/productos/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarProducto: (id) => apiRequest(`/api/productos/${id}`, { method: 'DELETE' }),
  getCategorias: () => apiRequest('/api/categorias'),
  crearCategoria: (body) => apiRequest('/api/categorias', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarCategoria: (id, body) => apiRequest(`/api/categorias/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarCategoria: (id, moverA) => apiRequest(`/api/categorias/${id}${moverA ? `?moverA=${encodeURIComponent(moverA)}` : ''}`, { method: 'DELETE' }),
  getOfertas: () => apiRequest('/api/ofertas'),
  crearOferta: (body) => apiRequest('/api/ofertas', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarOferta: (id, body) => apiRequest(`/api/ofertas/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  activarOferta: (id, activa) => apiRequest(`/api/ofertas/${id}/activar`, {
    method: 'PATCH', body: JSON.stringify({ activa })
  }),
  eliminarOferta: (id) => apiRequest(`/api/ofertas/${id}`, { method: 'DELETE' }),
};
