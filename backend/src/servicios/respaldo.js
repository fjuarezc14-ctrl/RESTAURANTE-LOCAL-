// @ts-check
// ============================================================
// RESPALDO DE LA BASE (tarea 20): pg_dump en formato "custom" (.dump), el mismo que deja
// "Sacar respaldo" en Windows y que carga scripts/importar-respaldo.sh. Se restaura con pg_restore.
// Dónde está pg_dump: PG_DUMP (si se define), el del instalador de Windows (C:\ValetecPOS\pgsql\bin)
// o el del sistema (la imagen Docker del backend instala postgresql16-client).
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function rutaPgDump() {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;
  const windows = path.resolve(__dirname, '..', '..', '..', '..', 'pgsql', 'bin', 'pg_dump.exe');
  return fs.existsSync(windows) ? windows : 'pg_dump';
}

// pg_dump no entiende los parámetros de Prisma (?connection_limit=...): se quitan
function urlParaPgDump() {
  const url = new URL(String(process.env.DATABASE_URL));
  url.search = '';
  return url.toString();
}

/** Inicia pg_dump; el .dump sale por stdout */
function iniciarPgDump() {
  return spawn(rutaPgDump(), ['-Fc', '--no-owner', '-d', urlParaPgDump()], { windowsHide: true });
}

module.exports = { iniciarPgDump, rutaPgDump };
