// ============================================================
// PRIMER ARRANQUE EN DOCKER: deja la BD lista como el cliente indicado
// Lo ejecuta el contenedor del backend antes de server.js.
// Solo actúa si CLIENTE está definido y la BD aún no tiene usuarios,
// así que nunca toca una instalación que ya está en uso.
// ============================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const CLIENTE = (process.env.CLIENTE || '').trim();
const CLIENTES_DIR = process.env.CLIENTES_DIR || path.join(__dirname, '..', '..', 'installer', 'clientes');

async function main() {
  if (!CLIENTE) return;

  const dir = path.join(CLIENTES_DIR, CLIENTE);
  const rutaCliente = path.join(dir, 'cliente.json');
  if (!fs.existsSync(rutaCliente)) {
    console.error(`❌ CLIENTE="${CLIENTE}" pero no existe ${rutaCliente}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const usuarios = await prisma.usuario.count();
  await prisma.$disconnect();
  if (usuarios > 0) return; // ya inicializado

  // PINs: el del administrador puede venir del .env; los demás se generan al azar
  const cliente = JSON.parse(fs.readFileSync(rutaCliente, 'utf8'));
  const usados = new Set();
  const pinAlAzar = () => {
    let pin;
    do { pin = String(crypto.randomInt(1000, 10000)); } while (usados.has(pin));
    usados.add(pin);
    return pin;
  };
  cliente.usuarios = cliente.usuarios.map((u, i) => {
    const pin = i === 0 && process.env.INITIAL_ADMIN_PIN ? String(process.env.INITIAL_ADMIN_PIN) : pinAlAzar();
    usados.add(pin);
    return { ...u, pin };
  });

  const tmp = path.join(os.tmpdir(), `cliente-${CLIENTE}.json`);
  fs.writeFileSync(tmp, JSON.stringify(cliente));
  const rutaCarta = path.join(dir, 'carta.json');
  try {
    execFileSync('node', [path.join(__dirname, '..', 'prisma', 'seed-clean.js')], {
      stdio: 'inherit',
      env: { ...process.env, SEED_CLIENTE_JSON: tmp, SEED_CARTA_JSON: fs.existsSync(rutaCarta) ? rutaCarta : '' },
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }

  console.log(`\n🔑 CREDENCIALES INICIALES - ${cliente.empresa.name} (anótalas, solo se muestran ahora)`);
  for (const u of cliente.usuarios) console.log(`   ${u.nombre.padEnd(16)} ${u.rol.padEnd(14)} PIN: ${u.pin}`);
  console.log('');
}

main().catch((e) => {
  console.error('❌ Error en el primer arranque del cliente:', e);
  process.exit(1);
});
