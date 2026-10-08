// API de Caja: cobros, delivery, turnos y correcciones de ventas
import { apiRequest, conClave } from '../../apiCliente';

export const apiCaja = {
  // claveIdempotencia: la misma en los reintentos del mismo intento (ACUERDOS §4)
  crearPedidoLlevar: (body, claveIdempotencia) => apiRequest('/api/pedidos/llevar', {
    method: 'POST', body: JSON.stringify(body), ...conClave(claveIdempotencia)
  }),
  getPedidosLlevar: () => apiRequest('/api/pedidos/llevar'),
  confirmarEntrega: (id) => apiRequest(`/api/pedidos/${id}/entregar`, { method: 'PATCH' }),
  cobrar: (body, claveIdempotencia) => apiRequest('/api/ventas', {
    method: 'POST', body: JSON.stringify(body), ...conClave(claveIdempotencia)
  }),
  getResumenVentas: (desde = null) => {
    const qs = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    return apiRequest(`/api/ventas/resumen${qs}`);
  },
  getHistorialVentas: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/ventas${qs}`);
  },
  getEstadoCaja: () => apiRequest('/api/caja/estado'),
  abrirCaja: (body) => apiRequest('/api/caja/apertura', {
    method: 'POST', body: JSON.stringify(body)
  }),
  getUltimoCierre: () => apiRequest('/api/caja/ultimo-cierre'),
  registrarCierre: (body) => apiRequest('/api/caja/cierre', {
    method: 'POST', body: JSON.stringify(body)
  }),
  cerrarCajaForzado: (body) => apiRequest('/api/caja/cierre-forzado', {
    method: 'POST', body: JSON.stringify(body)
  }),
  getHistorialCierres: (limit = 30) => apiRequest(`/api/caja/cierres?limit=${limit}`),
  registrarMovimientoCaja: (body) => apiRequest('/api/caja/movimientos', {
    method: 'POST', body: JSON.stringify(body)
  }),
  getMovimientosCaja: (desde, hasta) => {
    const qs = desde && hasta ? `?${new URLSearchParams({ desde, hasta })}` : '';
    return apiRequest(`/api/caja/movimientos${qs}`);
  },
  cambiarMetodoPago: (ventaId, metodoPago, pin, montos = {}) => apiRequest(`/api/ventas/${ventaId}/metodo-pago`, {
    method: 'PATCH', body: JSON.stringify({ metodoPago, pin, ...montos })
  }),
  cambiarTipoEntrega: (ventaId, body) => apiRequest(`/api/ventas/${ventaId}/tipo-entrega`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  consultarCliente: (doc) => apiRequest(`/api/clientes/consulta/${encodeURIComponent(doc)}`),
  actualizarDelivery: (id, body) => apiRequest(`/api/pedidos/llevar/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  actualizarClienteVenta: (ventaId, body) => apiRequest(`/api/ventas/${ventaId}/datos-cliente`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  anularVenta: (ventaId, pin, motivo) => apiRequest(`/api/ventas/${ventaId}/anular`, {
    method: 'PATCH', body: JSON.stringify({ pin, motivo })
  }),
};
