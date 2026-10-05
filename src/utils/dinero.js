// ================================================================
// UTILIDADES PURAS DE DINERO, CÁLCULOS CONTABLES Y FORMATOS
// VT VALETEC — Sistema de Precisión y Reglas de Negocio Contables
// ================================================================

/**
 * Redondea un número a la cantidad de decimales especificada (por defecto 2).
 * Evita anomalías de punto flotante de JavaScript (ej. 0.1 + 0.2).
 */
export function redondear(monto, decimales = 2) {
  const num = Number(monto);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimales;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Formatea un número como moneda peruana: "S/ 15.00" o "S/ 1,250.50".
 */
export function formatearMoneda(monto, incluirSimbolo = true) {
  const num = redondear(monto);
  const formatted = num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return incluirSimbolo ? `S/ ${formatted}` : formatted;
}

/**
 * Calcula el subtotal, IGV y total a partir de un monto con IGV incluido (Perú 18%).
 * En el restaurante los precios de la carta SIEMPRE incluyen IGV.
 */
export function desglosarIGV(totalConIGV, tasa = 0.18) {
  const total = Math.max(0, redondear(totalConIGV));
  const subtotal = redondear(total / (1 + tasa));
  const igv = redondear(total - subtotal);
  return { subtotal, igv, total };
}

/**
 * Calcula el vuelto a entregar al cliente.
 */
export function calcularVuelto(totalCobrar, efectivoEntregado) {
  const total = redondear(totalCobrar);
  const entregado = redondear(efectivoEntregado);
  if (entregado < total) return 0;
  return redondear(entregado - total);
}

/**
 * Calcula el monto final con descuento aplicado (por porcentaje o monto fijo).
 * Garantiza que el descuento nunca sea negativo ni supere el total.
 */
export function aplicarDescuento(totalOriginal, tipoDescuento, valorDescuento) {
  const total = Math.max(0, redondear(totalOriginal));
  const valor = Math.max(0, Number(valorDescuento) || 0);

  let montoDescuento = 0;
  if (tipoDescuento === 'porcentaje') {
    const pct = Math.min(100, valor);
    montoDescuento = redondear((total * pct) / 100);
  } else if (tipoDescuento === 'monto') {
    montoDescuento = Math.min(total, redondear(valor));
  }

  const totalFinal = redondear(total - montoDescuento);
  return {
    totalOriginal: total,
    descuento: montoDescuento,
    totalFinal,
  };
}

/**
 * Valida si la suma de los métodos de pago coincide con el total esperado.
 * Tolerancia: 0.01 para absorber redondeos de céntimos.
 */
export function validarCuadrePagos(totalEsperado, pagos = {}) {
  const total = redondear(totalEsperado);
  const efectivo = Math.max(0, redondear(pagos.efectivo || 0));
  const tarjeta = Math.max(0, redondear(pagos.tarjeta || 0));
  const yape = Math.max(0, redondear(pagos.yape || 0));
  const credito = Math.max(0, redondear(pagos.credito || 0));

  const suma = redondear(efectivo + tarjeta + yape + credito);
  const diferencia = redondear(suma - total);
  const cuadra = Math.abs(diferencia) <= 0.01;

  return {
    cuadra,
    suma,
    totalEsperado: total,
    diferencia,
    faltante: diferencia < -0.01 ? Math.abs(diferencia) : 0,
    sobrante: diferencia > 0.01 ? diferencia : 0,
  };
}

/**
 * Calcula el total consolidado de una lista de ítems de pedido.
 * Excluye componentes de combo (esComponente: true) que ya están pagados en el plato principal.
 */
export function calcularTotalItems(items = []) {
  if (!Array.isArray(items)) return 0;
  const suma = items.reduce((acc, item) => {
    if (item.esComponente) return acc;
    const precio = Number(item.precio || item.precioUnitario || 0);
    const cant = Number(item.cantidad || 1);
    return acc + precio * cant;
  }, 0);
  return redondear(suma);
}
