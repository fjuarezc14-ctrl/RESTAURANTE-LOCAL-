// Alertas de cancelación para cocina y barra (en memoria; se pierden al reiniciar)

// ============================================================
// STORE EN MEMORIA: ALERTAS DE CANCELACIÓN PARA COCINA Y BARRA
// Se limpia automáticamente cada 2 horas (ítems > 2h se descartan).
// ============================================================
// cocina / barra: [{ id, pedidoId, items, mesaInfo, canceladoEn, codigoPedidosYa }]
const alertasCancelacion = { cocina: [], barra: [] };

setInterval(() => {
  const dosHorasAtras = Date.now() - 2 * 60 * 60 * 1000;
  alertasCancelacion.cocina = alertasCancelacion.cocina.filter(c => new Date(c.canceladoEn).getTime() > dosHorasAtras);
  alertasCancelacion.barra = alertasCancelacion.barra.filter(c => new Date(c.canceladoEn).getTime() > dosHorasAtras);
}, 30 * 60 * 1000).unref(); // limpiar cada 30 min

module.exports = { alertasCancelacion };
