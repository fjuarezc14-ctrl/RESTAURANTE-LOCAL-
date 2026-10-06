// Cliente de Prisma compartido (pool ajustado para concurrencia)

const { PrismaClient } = require('@prisma/client');

// Optimización de Conexiones Prisma (Pool size y timeout para concurrencia)
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=20&pool_timeout=20';
  process.env.DATABASE_URL = dbUrl;
}

// Montos guardados como Decimal(10,2): la BD los guarda exactos, pero Prisma los devuelve como objetos
// Decimal. Se convierten a número al leer para que el código (total + monto) y la API sigan con números.
const CAMPOS_DECIMALES = {
  abonoCredito: ['monto', 'montoEfectivo', 'montoTarjeta', 'montoYape'],
  producto: ['precio'],
  pedido: ['total'],
  itemPedido: ['precio'],
  venta: ['total', 'igv', 'subtotal', 'montoEfectivo', 'montoTarjeta', 'montoYape', 'montoCredito', 'descuentoAplicado', 'montoOriginal'],
  compra: ['baseImponible', 'igv', 'total'],
  oferta: ['valorDescuento'],
  cierreCaja: [
    'montoInicial', 'efectivoVentas', 'efectivoEsperado', 'efectivoContado', 'diferencia', 'totalTarjeta',
    'totalYape', 'totalConsumo', 'totalPedidosYa', 'egresosEfectivo', 'abonosEfectivo',
  ],
  movimientoCaja: ['monto'],
};

const decimalesANumero = Object.fromEntries(Object.entries(CAMPOS_DECIMALES).map(([modelo, campos]) => [
  modelo,
  Object.fromEntries(campos.map((campo) => [campo, {
    needs: { [campo]: true },
    compute: (fila) => (fila[campo] === null ? null : Number(fila[campo])),
  }])),
]));

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
}).$extends({ result: decimalesANumero });

module.exports = { prisma, CAMPOS_DECIMALES };
