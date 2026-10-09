// API de Carta: productos, categorías y ofertas
import { apiRequest } from '../../apiCliente';
import { conMemoria, yLuegoInvalidar } from '../../utils/cacheApi';

// La carta se comparte entre Salón, Caja y Carta. Las ventas y pedidos cambian el stock: también la renuevan
const productos = conMemoria(() => apiRequest('/api/productos'), ['carta', 'mesas', 'pedidos', 'ventas']);

export const apiCarta = {
  getProductos: productos,
  crearProducto: yLuegoInvalidar(productos, (body) => apiRequest('/api/productos', {
    method: 'POST', body: JSON.stringify(body)
  })),
  editarProducto: yLuegoInvalidar(productos, (id, body) => apiRequest(`/api/productos/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  })),
  eliminarProducto: yLuegoInvalidar(productos, (id) => apiRequest(`/api/productos/${id}`, { method: 'DELETE' })),
  getCategorias: () => apiRequest('/api/categorias'),
  crearCategoria: (body) => apiRequest('/api/categorias', {
    method: 'POST', body: JSON.stringify(body)
  }),
  // Renombrar o borrar una categoría cambia la categoría de sus productos
  editarCategoria: yLuegoInvalidar(productos, (id, body) => apiRequest(`/api/categorias/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  })),
  eliminarCategoria: yLuegoInvalidar(productos, (id, moverA) => apiRequest(`/api/categorias/${id}${moverA ? `?moverA=${encodeURIComponent(moverA)}` : ''}`, { method: 'DELETE' })),
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
