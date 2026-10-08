// @ts-check
// Cálculos de dinero: IGV, montos por medio de pago y créditos repartidos
const { configEnCache } = require('./empresa');
const { ErrorApp } = require('../middlewares/errores');

// Helper para parsear la distribución de crédito en ventas con múltiples clientes
function parsearCreditoSplit(ofertaDescripcion, defaultClienteId, defaultMonto) {
  if (ofertaDescripcion && typeof ofertaDescripcion === 'string') {
    const match = ofertaDescripcion.match(/\[CREDITO_SPLIT:(\[.*?\])\]/) || ofertaDescripcion.match(/\[CREDITO_SPLIT:(.*?)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            clienteId: parseInt(item.clienteId || item.id),
            nombre: item.nombre || '',
            monto: parseFloat(item.monto || 0)
          })).filter(item => !isNaN(item.clienteId) && item.monto > 0);
        }
      } catch (e) {
        console.error('Error parseando CREDITO_SPLIT:', e);
      }
    }
  }
  const defId = parseInt(defaultClienteId);
  const defM = parseFloat(defaultMonto || 0);
  if (!isNaN(defId) && defId > 0 && defM > 0) {
    return [{ clienteId: defId, monto: defM, nombre: '' }];
  }
  return [];
}

// Helper financiero dinámico para IGV y Subtotal (adaptable a régimen 10% / 10.5% o 18%)
function getIgvDivisor() {
  const conf = configEnCache();
  const tasa = (conf && conf.igvRate !== undefined)
    ? parseFloat(conf.igvRate)
    : (parseFloat(process.env.IGV_RATE || '0.105'));
  return 1 + tasa;
}

function calcularSubtotalEIgv(montoTotal) {
  const total = parseFloat(montoTotal || 0);
  const divisor = getIgvDivisor();
  const subtotal = parseFloat((total / divisor).toFixed(2));
  const igv = parseFloat((total - subtotal).toFixed(2));
  return { subtotal, igv };
}

// Helper universal para desglosar y asegurar que el 100% de la venta real en Caja sume correctamente
function obtenerMontosVenta(v) {
  if (!v || v.anulado || v.pedido?.estado === 'Cancelado') {
    return { efec: 0, tarj: 0, yape: 0 };
  }
  if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') {
    return { efec: 0, tarj: 0, yape: 0 };
  }

  let efec = parseFloat(v.montoEfectivo || 0);
  let tarj = parseFloat(v.montoTarjeta || 0);
  let yape = parseFloat(v.montoYape || 0);
  const total = parseFloat(v.total || 0);

  if (total <= 0) {
    return { efec: 0, tarj: 0, yape: 0 };
  }

  if (v.metodoPago === 'Efectivo') {
    return { efec: total, tarj: 0, yape: 0 };
  }
  if (v.metodoPago === 'Tarjeta') {
    return { efec: 0, tarj: total, yape: 0 };
  }
  if (v.metodoPago === 'Yape') {
    return { efec: 0, tarj: 0, yape: total };
  }

  // Para 'Mixto' u otros: si la suma difiere del total físico (restando la parte a crédito) o está incompleta
  const totalFisico = total - parseFloat(v.montoCredito || 0);
  const suma = efec + tarj + yape;
  if (Math.abs(suma - totalFisico) > 0.01) {
    if (suma === 0) {
      efec = totalFisico; // Fallback seguro
    } else if (totalFisico > suma) {
      efec += (totalFisico - suma); // Cubrir remanente en efectivo para no perder recaudación
    }
  }

  return { efec, tarj, yape };
}

// ============================================================
// DELIVERY / PEDIDOS YA
// ============================================================

// Código de operación de Yape/Plin o voucher de tarjeta: solo se guarda si el cobro usa esos medios
const limpiarCodigoPago = (codigoPago, metodoPago, montoTarjeta, montoYape) => {
  const usaDigital = metodoPago === 'Tarjeta' || metodoPago === 'Yape'
    || (metodoPago === 'Mixto' && ((parseFloat(montoTarjeta) || 0) > 0 || (parseFloat(montoYape) || 0) > 0));
  const codigo = codigoPago ? String(codigoPago).trim().slice(0, 60) : '';
  return usaDigital && codigo ? codigo : null;
};

// En un pago mixto las partes tienen que sumar el total cobrado (el vuelto no se envía)
function verificarPagoMixto({ efectivo = 0, tarjeta = 0, yape = 0, credito = 0 }, total) {
  const suma = efectivo + tarjeta + yape + credito;
  if (Math.abs(suma - total) > 0.05) {
    throw new ErrorApp('PAGO_NO_CUADRA', `La suma de los medios de pago (S/ ${suma.toFixed(2)}) no coincide con el total (S/ ${total.toFixed(2)}).`, { campo: 'montoEfectivo' });
  }
}

module.exports = { parsearCreditoSplit, getIgvDivisor, calcularSubtotalEIgv, obtenerMontosVenta, limpiarCodigoPago, verificarPagoMixto };
