// ============================================================
// INICIO DEL SERVIDOR (la app vive en src/app.js para poder probarla)
// ============================================================
const { app, prisma } = require('./src/app');
const company = require('./config/company');

const PORT = process.env.PORT || 3003;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend ${company.COMPANY_NAME} corriendo en http://localhost:${PORT}`);
  console.log(`ℹ️ Para ejecutar tareas de mantenimiento/reparación de datos: npm run db:repair`);
});

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor y pool de conexiones...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Pool de conexiones PostgreSQL liberado con éxito.');
    } catch (err) {
      console.error('Error al desconectar Prisma:', err);
    } finally {
      process.exit(0);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
