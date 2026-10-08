// ============================================================
// INICIO DEL SERVIDOR (la app vive en src/app.js para poder probarla)
// ============================================================
const { app, prisma } = require('./src/app');
const { cerrarTodas: cerrarConexionesEnVivo } = require('./src/servicios/eventos');
const company = require('./config/company');

const { asegurarAccesoAdministrador, migrarPinesAHash } = require('./src/servicios/auth');

const PORT = process.env.PORT || 3003;
let server;

async function iniciar() {
  // Los PIN en texto plano (BD antiguas, seeds, instalador) se guardan como hash antes de atender
  const convertidos = await migrarPinesAHash();
  if (convertidos > 0) console.log(`🔐 ${convertidos} PIN(s) convertidos a hash`);

  const acceso = await asegurarAccesoAdministrador();
  if (acceso) {
    console.log(`🔑 Acceso para activar dispositivos: usuario "${acceso.usuario}"` +
      (acceso.generada ? ` / contraseña "${acceso.contrasena}" (cámbiala después de entrar)` : ' / contraseña de INITIAL_ADMIN_PASSWORD'));
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 Backend ${company.COMPANY_NAME} corriendo en http://localhost:${PORT}`);
    console.log(`ℹ️ Para ejecutar tareas de mantenimiento/reparación de datos: npm run db:repair`);
  });
}

iniciar().catch((err) => {
  console.error('❌ No se pudo iniciar el servidor:', err);
  process.exit(1);
});

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor y pool de conexiones...`);
  if (!server) process.exit(0);
  cerrarConexionesEnVivo(); // las conexiones de /api/eventos no se cierran solas
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
