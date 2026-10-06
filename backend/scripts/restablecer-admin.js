// ============================================================
// RESCATE DE SOPORTE: nueva contraseña para un administrador que olvidó la suya
// Solo se corre en el servidor (nunca desde el navegador). La contraseña anterior no se puede ver:
// en la BD solo está su hash. Las sesiones y los equipos ya activados siguen funcionando.
//
//   node scripts/restablecer-admin.js                    → lista los administradores
//   node scripts/restablecer-admin.js <usuario|id>       → contraseña nueva al azar
//   node scripts/restablecer-admin.js <usuario|id> <clave> → esa contraseña (mínimo 8 caracteres)
//
// En Docker: docker compose --env-file .env.<cliente> exec backend node scripts/restablecer-admin.js
// ============================================================
require('dotenv').config();
const { prisma } = require('../src/db');
const { restablecerContrasenaAdmin } = require('../src/servicios/auth');

async function main() {
  const [identificador, contrasena] = process.argv.slice(2);

  if (!identificador) {
    const admins = await prisma.usuario.findMany({
      where: { rol: 'Administrador', activo: true },
      orderBy: { id: 'asc' },
      select: { id: true, nombre: true, usuario: true, correo: true, contrasenaHash: true },
    });
    if (admins.length === 0) return console.log('No hay administradores activos.');
    console.log('Administradores activos:\n');
    for (const a of admins) {
      const acceso = a.contrasenaHash ? 'con contraseña' : 'sin contraseña';
      console.log(`  ID ${String(a.id).padEnd(4)} ${a.nombre.padEnd(22)} usuario: ${(a.usuario || '-').padEnd(14)} ${acceso}`);
    }
    console.log('\nPara restablecer uno: node scripts/restablecer-admin.js <usuario|id> [contraseña]');
    return;
  }

  if (contrasena !== undefined && (contrasena.length < 8 || contrasena.length > 72)) {
    console.error('❌ La contraseña debe tener entre 8 y 72 caracteres.');
    process.exitCode = 1;
    return;
  }

  const resultado = await restablecerContrasenaAdmin(identificador, contrasena);
  if (!resultado) {
    console.error(`❌ No hay un administrador activo con usuario o ID "${identificador}". Corre el script sin argumentos para ver la lista.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✅ Contraseña restablecida para ${resultado.nombre} (ID ${resultado.id})`);
  console.log(`   Usuario:    ${resultado.usuario}`);
  console.log(`   Contraseña: ${resultado.contrasena}`);
  console.log('   Pídele que la cambie después de entrar.');
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
