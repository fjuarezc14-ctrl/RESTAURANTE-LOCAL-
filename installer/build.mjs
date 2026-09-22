#!/usr/bin/env node
// ============================================================
// GENERA EL INSTALADOR WINDOWS: installer/dist/ValetecPOS-Setup-<version>[-cliente].exe
// Se compila en Linux. Requisitos: Node 20+, npm, unzip y `makensis` o Docker.
// Uso: ./installer/build.sh [cliente]   (cliente = carpeta en installer/clientes/)
// ============================================================
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const NODE_VERSION = '20.20.2';
const PG_VERSION = '16.10-1';
const WINSW_VERSION = '2.12.0';
const OBFUSCATOR_VERSION = '4.1.1';

const INST = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(INST, '..');
const CACHE = path.join(INST, 'cache');
const STAGE = path.join(INST, 'build', 'stage');
const OUT = path.join(INST, 'dist');
const BACKEND = path.join(STAGE, 'app', 'backend');
const DIST = path.join(STAGE, 'app', 'dist');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;

const CLIENTE = process.argv[2] || '';
const CLIENTE_DIR = path.join(INST, 'clientes', CLIENTE);
const SUFIJO = CLIENTE ? `-${CLIENTE}` : '';
const OUTFILE = path.join(OUT, `ValetecPOS-Setup-${VERSION}${SUFIJO}.exe`);

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// Ejecuta un comando mostrando su salida
function sh(cmd, { cwd = REPO, env = {}, quiet = false } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, stdio: quiet ? 'pipe' : 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    if (quiet) process.stderr.write(r.stderr || '');
    fail(`Falló: ${cmd}`);
  }
}

const q = (p) => `"${p}"`;

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  console.log(`⬇️  Descargando ${path.basename(dest)}...`);
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'curl/8' } });
  if (!res.ok) fail(`No se pudo descargar ${url} (HTTP ${res.status})`);
  fs.writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(`${dest}.part`, dest);
}

// Extrae carpetas de un .zip
function unzip(zip, entries, dest) {
  fs.mkdirSync(dest, { recursive: true });
  sh(`unzip -q -o ${q(zip)} ${entries.map((e) => `'${e}/*'`).join(' ')} -d ${q(dest)}`);
}

function copy(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function removeFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const full = path.join(entry.parentPath ?? entry.path, entry.name);
    if (entry.isFile() && predicate(full, entry.name)) fs.rmSync(full);
  }
}

// PINs aleatorios por usuario. Se guardan en pins.local.json (fuera de git) y se reutilizan
// en cada build para que las credenciales entregadas no cambien.
function prepararUsuarios() {
  const cliente = JSON.parse(fs.readFileSync(path.join(CLIENTE_DIR, 'cliente.json'), 'utf8'));
  const pinsFile = path.join(CLIENTE_DIR, 'pins.local.json');
  const pins = fs.existsSync(pinsFile) ? JSON.parse(fs.readFileSync(pinsFile, 'utf8')) : {};
  const usados = new Set(Object.values(pins));
  const trivial = (p) => /^(\d)\1{3}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p);
  for (const u of cliente.usuarios) {
    while (!pins[u.nombre]) {
      const p = String(crypto.randomInt(1000, 10000));
      if (!usados.has(p) && !trivial(p)) {
        pins[u.nombre] = p;
        usados.add(p);
      }
    }
    u.pin = pins[u.nombre];
  }
  fs.writeFileSync(pinsFile, JSON.stringify(pins, null, 2));
  fs.writeFileSync(path.join(STAGE, 'setup', 'cliente.json'), JSON.stringify(cliente, null, 2));
  const filas = cliente.usuarios.map((u) => `  ${u.nombre.padEnd(16)} ${u.rol.padEnd(14)} PIN: ${u.pin}`);
  fs.writeFileSync(path.join(OUT, `CREDENCIALES${SUFIJO}.txt`), [
    `CREDENCIALES INICIALES - ${cliente.empresa.name}`, '', ...filas, '',
    'Cambia los PINs y los nombres en el menú Usuarios después de instalar.', '',
  ].join('\r\n'));
  return cliente;
}

async function compilarNsis() {
  const args = `-V2 ${q(`-DSTAGE=${STAGE}`)} -DVERSION=${VERSION} ${q(`-DOUTFILE=${OUTFILE}`)} ${q(path.join(INST, 'valetec.nsi'))}`;
  if (spawnSync('makensis', ['-VERSION']).status === 0) {
    sh(`makensis ${args}`);
    return;
  }
  // Sin NSIS instalado: compilar dentro de Docker montando el repo en /w
  const rel = (p) => `/w/${path.relative(REPO, p).split(path.sep).join('/')}`;
  const dockerArgs = `-V2 -DSTAGE=${rel(STAGE)} -DVERSION=${VERSION} -DOUTFILE=${rel(OUTFILE)} ${rel(path.join(INST, 'valetec.nsi'))}`;
  sh(`docker run --rm -v ${q(`${REPO}:/w`)} -w /w debian:stable-slim sh -c "apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nsis >/dev/null 2>&1 && makensis ${dockerArgs} && chown $(id -u):$(id -g) ${rel(OUTFILE)}"`);
}

async function main() {
  if (CLIENTE && !fs.existsSync(path.join(CLIENTE_DIR, 'cliente.json'))) fail(`No existe ${CLIENTE_DIR}/cliente.json`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  await download(`https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`, path.join(CACHE, 'node-win.zip'));
  await download(`https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`, path.join(CACHE, 'pgsql-win.zip'));
  await download(`https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/WinSW.NET4.exe`, path.join(CACHE, 'winsw.exe'));
  await download('https://aka.ms/vs/17/release/vc_redist.x64.exe', path.join(CACHE, 'vc_redist.x64.exe'));

  console.log('🧹 Preparando carpeta de empaquetado...');
  fs.rmSync(path.join(INST, 'build'), { recursive: true, force: true });
  for (const d of ['node', 'app/backend', 'setup']) fs.mkdirSync(path.join(STAGE, d), { recursive: true });

  // 1. Node portable (solo el ejecutable)
  const nodeTmp = path.join(INST, 'build', 'node-tmp');
  unzip(path.join(CACHE, 'node-win.zip'), [`node-v${NODE_VERSION}-win-x64`], nodeTmp);
  fs.copyFileSync(path.join(nodeTmp, `node-v${NODE_VERSION}-win-x64`, 'node.exe'), path.join(STAGE, 'node', 'node.exe'));
  fs.rmSync(nodeTmp, { recursive: true, force: true });

  // 2. PostgreSQL portable (sin pgAdmin, documentación ni librerías de desarrollo)
  unzip(path.join(CACHE, 'pgsql-win.zip'), ['pgsql/bin', 'pgsql/lib', 'pgsql/share'], STAGE);
  removeFiles(path.join(STAGE, 'pgsql', 'lib'), (_, name) => name.endsWith('.lib') || name.endsWith('.a'));
  fs.rmSync(path.join(STAGE, 'pgsql', 'share', 'doc'), { recursive: true, force: true });

  // 3. Frontend compilado
  console.log('🏗️  Compilando frontend...');
  sh('npm ci --silent --no-audit --no-fund');
  sh('npx vite build --logLevel warn');
  copy(path.join(REPO, 'dist'), DIST);

  // 4. Backend con motores de Prisma para Windows
  console.log('📦 Empaquetando backend...');
  for (const f of ['server.js', 'config', 'prisma', 'package.json', 'package-lock.json']) {
    copy(path.join(REPO, 'backend', f), path.join(BACKEND, f));
  }
  fs.rmSync(path.join(BACKEND, 'prisma', 'seed.js'), { force: true }); // seed de demostración: borra ventas
  sh('npm ci --silent --no-audit --no-fund', { cwd: BACKEND, env: { PRISMA_CLI_BINARY_TARGETS: 'windows' } });
  sh('npx prisma generate', { cwd: BACKEND, quiet: true });
  // El CLI no siempre descarga el schema-engine de Windows: se obtiene directo de los binarios de Prisma
  const engineHash = spawnSync(process.execPath, ['-p', "require('@prisma/engines-version').enginesVersion"], { cwd: BACKEND, encoding: 'utf8' }).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(engineHash)) fail('No se pudo leer la versión del motor de Prisma');
  const engineGz = path.join(CACHE, `schema-engine-${engineHash}.exe.gz`);
  await download(`https://binaries.prisma.sh/all_commits/${engineHash}/windows/schema-engine.exe.gz`, engineGz);
  fs.writeFileSync(path.join(BACKEND, 'node_modules', '@prisma', 'engines', 'schema-engine-windows.exe'), zlib.gunzipSync(fs.readFileSync(engineGz)));
  // Quitar motores de Linux/macOS (no se usan en Windows)
  removeFiles(path.join(BACKEND, 'node_modules'), (_, name) =>
    /^(libquery_engine|query_engine|query-engine|schema-engine)/.test(name) && /linux|debian|darwin|rhel|musl/.test(name));
  for (const f of ['@prisma/engines/schema-engine-windows.exe', '.prisma/client/query_engine-windows.dll.node']) {
    if (!fs.existsSync(path.join(BACKEND, 'node_modules', f))) fail(`Falta ${f}`);
  }

  // 5. Scripts de configuración, servicio, runtime de Visual C++ e icono
  for (const f of ['setup.js', 'uninstall.js']) fs.copyFileSync(path.join(INST, 'setup', f), path.join(STAGE, 'setup', f));
  fs.copyFileSync(path.join(CACHE, 'winsw.exe'), path.join(STAGE, 'setup', 'ValetecPOS-App.exe'));
  fs.copyFileSync(path.join(CACHE, 'vc_redist.x64.exe'), path.join(STAGE, 'setup', 'vc_redist.x64.exe'));
  const iconCliente = path.join(CLIENTE_DIR, 'icon.ico');
  fs.copyFileSync(CLIENTE && fs.existsSync(iconCliente) ? iconCliente : path.join(INST, 'icon.ico'), path.join(STAGE, 'setup', 'icon.ico'));

  // 6. Marca y usuarios del cliente
  if (CLIENTE) {
    const cliente = prepararUsuarios();
    const logo = path.join(CLIENTE_DIR, 'logo.png');
    if (fs.existsSync(logo)) {
      // El logo reemplaza al genérico con el mismo nombre de archivo (incluido el hash de Vite)
      const assets = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /^logo-.*\.png$/.test(f));
      for (const f of [path.join(DIST, 'logo.png'), ...assets.map((a) => path.join(DIST, 'assets', a))]) fs.copyFileSync(logo, f);
    }
    const indexHtml = path.join(DIST, 'index.html');
    fs.writeFileSync(indexHtml, fs.readFileSync(indexHtml, 'utf8').replace(/<title>.*<\/title>/, `<title>${cliente.empresa.name} - Sistema POS</title>`));
  }

  // 7. Ofuscación del código propio (solo en la copia empaquetada, el repo no se toca)
  console.log('🔒 Ofuscando código...');
  const obf = `npx --yes javascript-obfuscator@${OBFUSCATOR_VERSION}`;
  const obfBackend = '--compact true --string-array true --string-array-encoding base64 --string-array-threshold 0.75 '
    + '--identifier-names-generator hexadecimal --rename-globals false --self-defending false --control-flow-flattening false';
  for (const f of ['server.js', 'config/company.js', 'prisma/seed-clean.js']) {
    const file = path.join(BACKEND, f);
    sh(`${obf} ${q(file)} --output ${q(file)} ${obfBackend}`, { quiet: true });
  }
  removeFiles(path.join(DIST, 'assets'), (_, name) => name.endsWith('.map'));
  for (const f of fs.readdirSync(path.join(DIST, 'assets')).filter((a) => a.endsWith('.js'))) {
    const file = path.join(DIST, 'assets', f);
    sh(`${obf} ${q(file)} --output ${q(file)} --compact true --string-array true --string-array-threshold 0.5 `
      + '--identifier-names-generator hexadecimal --rename-globals false --self-defending false', { quiet: true });
  }

  // 8. Instalador
  console.log('🔨 Generando instalador...');
  await compilarNsis();
  const mb = (fs.statSync(OUTFILE).size / 1024 / 1024).toFixed(0);
  console.log(`✅ Instalador listo: ${OUTFILE} (${mb} MB)`);
  if (CLIENTE) console.log(`🔑 Credenciales: ${path.join(OUT, `CREDENCIALES${SUFIJO}.txt`)}`);
}

main().catch((err) => fail(err.stack || err.message));
