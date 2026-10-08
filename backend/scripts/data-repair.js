// ================================================================
// SCRIPT DE MIGRACIÓN Y REPARACIÓN DE DATOS — VT VALETEC
// Ejecutar de forma independiente: npm run db:repair
// ================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SIDE_DISH_CATEGORIES = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];

/**
 * Repara montos de pagos históricos cuando los desgloses específicos se guardaron en 0.
 */
async function repairPaymentAmounts() {
  console.log('⚡ [1/2] Iniciando auto-reparación de montos de pago históricos...');
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoEfectivo" = "total" 
      WHERE "metodoPago" = 'Efectivo' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoTarjeta" = "total" 
      WHERE "metodoPago" = 'Tarjeta' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoYape" = "total" 
      WHERE "metodoPago" = 'Yape' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoEfectivo" = "total" 
      WHERE "metodoPago" = 'Mixto' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    console.log('✅ [1/2] Reparación de montos históricos completada exitosamente.');
  } catch (err) {
    console.error('❌ [1/2] Error en reparación de montos históricos:', err.message);
  }
}

/**
 * Sincroniza el flag requiereGuarnicion para la carta de productos.
 */
async function syncSideDishRequirement() {
  console.log('⚡ [2/2] Sincronizando propiedad requiereGuarnicion en productos...');
  try {
    const updatedCount = await prisma.producto.updateMany({
      where: {
        categoria: { in: SIDE_DISH_CATEGORIES }
      },
      data: { requiereGuarnicion: true }
    });
    console.log(`✅ [2/2] Sincronizado requiereGuarnicion para ${updatedCount.count} productos.`);
  } catch (err) {
    console.error('❌ [2/2] Error en sincronización de requiereGuarnicion:', err.message);
  }
}

async function runAllDataRepairs() {
  console.log('🚀 Iniciando proceso CLI de mantenimiento y reparación de datos...');
  await repairPaymentAmounts();
  await syncSideDishRequirement();
  console.log('🎉 Proceso de mantenimiento finalizado.');
}

// Ejecutar si es llamado directamente por CLI
if (require.main === module) {
  runAllDataRepairs()
    .catch((err) => {
      console.error('❌ Error crítico en ejecución de mantenimiento:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  repairPaymentAmounts,
  syncSideDishRequirement,
  runAllDataRepairs
};
