// ============================================================
// RESPALDO DE LA BASE DE DATOS (WINDOWS)
// - setup.js lo usa antes de actualizar (si falla, la actualización se detiene).
// - El acceso directo "Sacar respaldo" lo ejecuta solo: deja el archivo en C:\ValetecPOS\respaldos.
// El archivo .dump se restaura con pg_restore (también sirve para pasar la base a la versión web).
// ============================================================
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESPALDOS_DIR = path.join(ROOT, 'respaldos');
const ENV_FILE = path.join(ROOT, 'app', 'backend', '.env');
const PG_DUMP = path.join(ROOT, 'pgsql', 'bin', 'pg_dump.exe');
const PG_PORT = 5446;
const DB_NAME = 'restaurante_local';
const MAX_AUTOMATICOS = 5; // respaldos "antes-de-actualizar" que se conservan

function leerContrasena() {
  const match = fs.existsSync(ENV_FILE) && fs.readFileSync(ENV_FILE, 'utf8').match(/postgresql:\/\/postgres:([^@]+)@/);
  if (!match) throw new Error(`No se encontró la contraseña de la base en ${ENV_FILE}`);
  return decodeURIComponent(match[1]);
}

// Devuelve la ruta del archivo creado. Lanza un error si pg_dump falla.
function sacarRespaldo(prefijo = 'respaldo', password = leerContrasena()) {
  fs.mkdirSync(RESPALDOS_DIR, { recursive: true });
  const fecha = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', '_').replace(':', '-'); // hora de Lima
  const archivo = path.join(RESPALDOS_DIR, `${prefijo}-${fecha}.dump`);
  const r = spawnSync(PG_DUMP, ['-h', 'localhost', '-p', String(PG_PORT), '-U', 'postgres', '-d', DB_NAME, '-Fc', '--no-owner', '-f', archivo], {
    env: { ...process.env, PGPASSWORD: password }, encoding: 'utf8', windowsHide: true,
  });
  if (r.status !== 0 || !fs.existsSync(archivo) || fs.statSync(archivo).size === 0) {
    fs.rmSync(archivo, { force: true });
    throw new Error(`pg_dump falló (código ${r.status}): ${(r.stderr || r.error?.message || '').trim()}`);
  }
  if (prefijo === 'antes-de-actualizar') {
    const viejos = fs.readdirSync(RESPALDOS_DIR).filter((f) => f.startsWith(`${prefijo}-`)).sort().slice(0, -MAX_AUTOMATICOS);
    for (const f of viejos) fs.rmSync(path.join(RESPALDOS_DIR, f), { force: true });
  }
  return archivo;
}

module.exports = { sacarRespaldo, RESPALDOS_DIR };

if (require.main === module) {
  try {
    console.log('Sacando respaldo de la base de datos...');
    const archivo = sacarRespaldo();
    console.log(`\nListo: ${archivo} (${(fs.statSync(archivo).size / 1024 / 1024).toFixed(1)} MB)`);
    console.log('Guarda una copia fuera de esta PC (USB o nube).');
    spawnSync('explorer.exe', [RESPALDOS_DIR]);
  } catch (err) {
    console.error(`\nNo se pudo sacar el respaldo: ${err.message}`);
  }
  setTimeout(() => {}, 8000); // deja leer el mensaje antes de cerrar la ventana
}
