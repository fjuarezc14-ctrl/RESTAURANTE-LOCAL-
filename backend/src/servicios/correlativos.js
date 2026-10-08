// @ts-check
// Correlativos de boletas y facturas (sin uso: hoy solo se emiten tickets)
const { prisma } = require('../db');

// HELPERS E INTEGRACIÓN APISUNAT.PE (SUNAT PSE)
// ============================================================

async function obtenerSiguienteSerieYNumero(tipoComprobante, txPrisma = prisma) {
  if (tipoComprobante !== 'Boleta' && tipoComprobante !== 'Factura') {
    return { serie: null, numero: null };
  }

  const isFactura = tipoComprobante === 'Factura';
  const serieDefault = isFactura ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001');
  const minCorrelativo = isFactura
    ? parseInt(process.env.ULTIMO_CORRELATIVO_FACTURA || '2')
    : parseInt(process.env.ULTIMO_CORRELATIVO_BOLETA || '0');

  // Bloqueo por serie hasta el fin de la transacción: evita correlativos duplicados en cobros simultáneos
  if (txPrisma !== prisma) {
    await txPrisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serieDefault}))`;
  }

  const ultimaVenta = await txPrisma.venta.findFirst({
    where: { tipoComprobante, serie: serieDefault, numero: { not: null } },
    orderBy: { numero: 'desc' }
  });

  const siguienteNumero = ultimaVenta
    ? Math.max(ultimaVenta.numero + 1, minCorrelativo + 1)
    : (minCorrelativo + 1);

  return {
    serie: serieDefault,
    numero: siguienteNumero
  };
}

module.exports = { obtenerSiguienteSerieYNumero };
