// @ts-check
// ============================================================
// ARQUEO DEL TURNO DE CAJA
// Los totales del turno salen SIEMPRE de la base de datos: el arqueo en vivo (/api/caja/estado)
// y el cierre usan el mismo cálculo. La pantalla solo aporta lo que cuenta el cajero.
// ============================================================
const { prisma } = require('../db');
const { obtenerMontosVenta } = require('./dinero');

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Totales del turno desde su apertura hasta `hasta` (por defecto, ahora).
 * `cliente` permite calcularlo dentro de un $transaction.
 */
async function resumenDelTurno(turnoAbierto, { hasta = new Date(), cliente = prisma } = {}) {
  const desde = turnoAbierto.fechaApertura;
  const [ventas, movimientos, abonos] = await Promise.all([
    cliente.venta.findMany({
      where: {
        createdAt: { gte: desde, lte: hasta },
        anulado: false,
        pedido: { estado: { not: 'Cancelado' } },
      },
      select: {
        total: true,
        montoEfectivo: true,
        montoTarjeta: true,
        montoYape: true,
        montoCredito: true,
        metodoPago: true,
        anulado: true,
        pedido: { select: { estado: true } }
      },
    }),
    cliente.movimientoCaja.findMany({
      where: {
        OR: [
          { turnoId: turnoAbierto.id },
          { creadoEn: { gte: desde, lte: hasta } },
        ],
      },
      orderBy: { creadoEn: 'desc' },
    }),
    cliente.abonoCredito.findMany({
      where: {
        creadoEn: { gte: desde, lte: hasta },
      },
      select: { montoEfectivo: true, montoTarjeta: true, montoYape: true, monto: true, metodoPago: true },
    }),
  ]);

  let ventasEfectivo = 0;
  let ventasTarjeta = 0;
  let ventasYape = 0;
  let ventasPedidosYa = 0;
  let ventasConsumo = 0;
  let totalVentas = 0;

  for (const v of ventas) {
    totalVentas += Number(v.total) || 0;
    const { efec, tarj, yape } = obtenerMontosVenta(v);
    ventasEfectivo += efec;
    ventasTarjeta += tarj;
    ventasYape += yape;
    if (v.metodoPago === 'PedidosYa') ventasPedidosYa += Number(v.total) || 0;
    if (v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía') ventasConsumo += Number(v.total) || 0;
  }

  const retirosCaja = movimientos.filter(m => m.tipo === 'RETIRO').reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const ingresosExtra = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (Number(m.monto) || 0), 0);

  // Sumar abonos a todos los métodos para coincidencia exacta con el arqueo
  const abonosEfectivo = abonos.reduce((s, a) => s + (Number(a.montoEfectivo) || (a.metodoPago === 'Efectivo' ? Number(a.monto) : 0)), 0);
  const abonosTarjeta = abonos.reduce((s, a) => s + (Number(a.montoTarjeta) || (a.metodoPago === 'Tarjeta' ? Number(a.monto) : 0)), 0);
  const abonosYape = abonos.reduce((s, a) => s + (Number(a.montoYape) || (a.metodoPago === 'Yape' ? Number(a.monto) : 0)), 0);

  ventasTarjeta += abonosTarjeta;
  ventasYape += abonosYape;

  const fondoInicial = Number(turnoAbierto.montoInicial) || 0;
  const efectivoEsperadoEnGaveta = Math.max(0, redondear(fondoInicial + ventasEfectivo + abonosEfectivo + ingresosExtra - retirosCaja));

  return {
    montoInicial: fondoInicial,
    cajeroNombre: turnoAbierto.cajeroNombre,
    fechaApertura: turnoAbierto.fechaApertura,
    ventasEfectivo,
    ventasTarjeta,
    ventasYape,
    ventasPedidosYa,
    ventasConsumo,
    totalVentas,
    cantidadVentas: ventas.length,
    egresosEfectivo: retirosCaja,
    retirosCaja,
    ingresosExtra,
    movimientos,
    abonosEfectivo,
    abonosTarjeta,
    abonosYape,
    efectivoEsperadoEnGaveta,
  };
}

module.exports = { resumenDelTurno, redondear };
