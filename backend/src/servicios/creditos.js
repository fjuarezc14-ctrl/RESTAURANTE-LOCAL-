// @ts-check
// ============================================================
// CRÉDITO DE UNA VENTA (tabla VentaCredito)
// La parte a crédito de una venta se reparte entre uno o varios clientes. Antes el reparto iba como texto
// "[CREDITO_SPLIT:[…]]" dentro de Venta.ofertaDescripcion, que llegaba desde la pantalla: alterando ese texto
// se podía cargar una deuda a cualquier cliente. Ahora lo arma el servidor y queda en su propia tabla.
// ============================================================
const { prisma } = require('../db');
const { parsearCreditoSplit } = require('./dinero');
const { ErrorApp } = require('../middlewares/errores');

const redondear = (n) => Math.round(n * 100) / 100;

// Para cargar el reparto junto con la venta: prisma.venta.findMany({ include: INCLUIR_CREDITOS })
const INCLUIR_CREDITOS = { creditos: { include: { cliente: { select: { nombre: true } } } } };

/** Reparto de una venta cargada con INCLUIR_CREDITOS: [{ clienteId, nombre, monto }] */
function creditosDeVenta(venta) {
  return (venta.creditos || []).map((c) => ({ clienteId: c.clienteId, nombre: c.cliente?.nombre || '', monto: Number(c.monto) }));
}

/**
 * Guarda el reparto de una venta (reemplaza el anterior). partes: [{ clienteId, monto }]
 * Sin reparto pero con un cliente y monto a crédito, se guarda una sola parte.
 */
async function guardarCreditosVenta(tx, ventaId, { partes = [], clienteCreditoId = null, montoCredito = 0 }) {
  let lista = partes
    .map((p) => ({ clienteId: parseInt(p.clienteId), monto: redondear(Number(p.monto) || 0) }))
    .filter((p) => !Number.isNaN(p.clienteId) && p.monto > 0);
  if (lista.length === 0 && clienteCreditoId && Number(montoCredito) > 0) {
    lista = [{ clienteId: parseInt(clienteCreditoId), monto: redondear(Number(montoCredito)) }];
  }
  const ids = [...new Set(lista.map((p) => p.clienteId))];
  if (ids.length > 0 && await tx.cliente.count({ where: { id: { in: ids }, activo: true } }) !== ids.length) {
    throw new ErrorApp('VALIDACION', 'Uno de los clientes del crédito no existe o está inactivo.', { campo: 'clienteCreditoId' });
  }
  await tx.ventaCredito.deleteMany({ where: { ventaId } });
  if (lista.length > 0) await tx.ventaCredito.createMany({ data: lista.map((p) => ({ ventaId, ...p })) });
}

/** Deuda total (lo cargado a crédito en ventas no anuladas) por cliente: { [clienteId]: monto } */
async function consumidoPorCliente(clienteIds) {
  const filas = await prisma.ventaCredito.groupBy({
    by: ['clienteId'],
    where: { venta: { anulado: false }, ...(clienteIds ? { clienteId: { in: clienteIds } } : {}) },
    _sum: { monto: true },
  });
  return Object.fromEntries(filas.map((f) => [f.clienteId, Number(f._sum.monto) || 0]));
}

// El texto antiguo dentro de ofertaDescripcion (con o sin corchetes del arreglo)
const ETIQUETA_ANTIGUA = /\s*\[CREDITO_SPLIT:(\[.*?\])\]|\s*\[CREDITO_SPLIT:.*?\]/g;

/** Descripción de oferta/descuento que llega de la pantalla, sin el texto antiguo del reparto de crédito */
function limpiarDescripcion(texto) {
  if (texto === null || texto === undefined) return texto;
  return String(texto).replace(ETIQUETA_ANTIGUA, '').trim() || null;
}

const MIGRACION_TABLA = '20261009020000_venta_credito';

/**
 * Pasa las ventas a crédito antiguas a la tabla VentaCredito y quita el texto [CREDITO_SPLIT:…] de la descripción.
 * Usa la misma lectura que antes (parsearCreditoSplit), así los saldos no cambian. Se ejecuta al arrancar.
 */
async function migrarCreditosAntiguos() {
  // Solo ventas anteriores a la tabla: las nuevas guardan su reparto al cobrar (y la descripción llega limpia)
  const [migracion] = await prisma.$queryRaw`SELECT finished_at FROM "_prisma_migrations" WHERE migration_name = ${MIGRACION_TABLA}`;
  const antesDe = migracion?.finished_at || new Date();
  const ventas = await prisma.venta.findMany({
    where: {
      createdAt: { lt: antesDe },
      creditos: { none: {} },
      OR: [
        { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } },
        { montoCredito: { gt: 0 } },
        { metodoPago: 'Crédito', total: { gt: 0 } },
      ],
    },
    select: { id: true, ofertaDescripcion: true, clienteCreditoId: true, montoCredito: true, metodoPago: true, total: true },
  });
  if (ventas.length === 0) return 0;

  const existentes = new Set((await prisma.cliente.findMany({ select: { id: true } })).map((c) => c.id));
  let migradas = 0;
  for (const v of ventas) {
    const montoPorDefecto = Number(v.montoCredito) > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0);
    const partes = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, montoPorDefecto)
      .filter((p) => existentes.has(p.clienteId));
    const tieneEtiqueta = (v.ofertaDescripcion || '').includes('[CREDITO_SPLIT:');
    if (partes.length === 0 && !tieneEtiqueta) continue;
    await prisma.$transaction(async (tx) => {
      await guardarCreditosVenta(tx, v.id, { partes });
      if (tieneEtiqueta) {
        const descripcion = (v.ofertaDescripcion || '').replace(ETIQUETA_ANTIGUA, '').trim();
        await tx.venta.update({ where: { id: v.id }, data: { ofertaDescripcion: descripcion || null } });
      }
    });
    migradas += 1;
  }
  return migradas;
}

module.exports = { INCLUIR_CREDITOS, consumidoPorCliente, creditosDeVenta, guardarCreditosVenta, limpiarDescripcion, migrarCreditosAntiguos };
