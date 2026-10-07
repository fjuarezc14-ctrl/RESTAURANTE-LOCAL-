// ================================================================
// ESTADO DE UNA MESA EN CAJA: qué falta para poder cobrarla
// (platos en cocina o barra, platos listos que el mozo aún no sirvió)
// ================================================================

export const platosEnPreparacion = (m) => (m.pedidoData?.items || []).filter(i => i && !i.historial).reduce((s, i) => s + (i.cant || 0), 0);
export const itemsSinServir = (m) => (m.pedidoData?.items || []).filter(i => i && i.historial && !i.entregado);
export const platosSinServir = (m) => itemsSinServir(m).reduce((s, i) => s + (i.cant || 0), 0);
export const mesaEnPreparacion = (m) => m.estado === 'Cocina';
export const mesaCobrable = (m) => !mesaEnPreparacion(m) && platosSinServir(m) === 0;
export const textoBloqueoMesa = (m) => mesaEnPreparacion(m)
  ? (platosEnPreparacion(m) > 0 ? `${platosEnPreparacion(m)} en preparación` : 'En cocina')
  : `${platosSinServir(m)} por servir`;
