// ============================================================
// CONFIGURACIÓN POST-INSTALACIÓN (WINDOWS)
// Lo ejecuta el instalador con el node.exe incluido. Es idempotente:
// en una actualización conserva la base de datos y la contraseña.
// ============================================================
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PG_BIN = path.join(ROOT, 'pgsql', 'bin');
const DATA_DIR = path.join(ROOT, 'data');
const BACKEND_DIR = path.join(ROOT, 'app', 'backend');
const LOGS_DIR = path.join(ROOT, 'logs');
const ENV_FILE = path.join(BACKEND_DIR, '.env');
const NODE_EXE = process.execPath;
const CLIENTE_JSON = path.join(__dirname, 'cliente.json'); // datos y PINs del cliente (solo si el build fue de un cliente)
const CARTA_JSON = path.join(__dirname, 'carta.json'); // carta inicial del cliente (precios en S/ 0)
// Marca una base recién creada que todavía no tiene su contraseña guardada en .env:
// si una instalación falla a medias, la siguiente puede rehacerla sin riesgo de borrar ventas.
const MARCA_BASE_NUEVA = path.join(__dirname, 'base-sin-configurar.tmp');

const PG_PORT = 5446;
const APP_PORT = 5188;
const DB_NAME = 'restaurante_local';
const DB_SERVICE = 'ValetecPOS-DB';
const APP_SERVICE = 'ValetecPOS-App';
const FIREWALL_RULE = 'Valetec POS';
const NETWORK_SERVICE_SID = '*S-1-5-20'; // SID de NetworkService: independiente del idioma de Windows

fs.mkdirSync(LOGS_DIR, { recursive: true });
const LOG_FILE = path.join(LOGS_DIR, 'instalacion.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + os.EOL);
}

function run(cmd, args, { allowFail = false, env = {}, cwd, capture = false } = {}) {
  log(`> ${path.basename(cmd)} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (out && !capture) log(out);
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${path.basename(cmd)} terminó con código ${r.status}: ${out || r.error?.message || ''}`);
  }
  return { status: r.status, stdout: (r.stdout || '').trim() };
}

const pgExe = (name) => path.join(PG_BIN, `${name}.exe`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readEnvPassword() {
  if (!fs.existsSync(ENV_FILE)) return null;
  const match = fs.readFileSync(ENV_FILE, 'utf8').match(/postgresql:\/\/postgres:([^@]+)@/);
  return match ? decodeURIComponent(match[1]) : null;
}

function serviceExists(name) {
  return run('sc.exe', ['query', name], { allowFail: true, capture: true }).status === 0;
}

function initDatabaseCluster(password) {
  log('Inicializando base de datos PostgreSQL...');
  const pwFile = path.join(os.tmpdir(), `valetec-pw-${process.pid}.txt`);
  fs.writeFileSync(pwFile, password);
  try {
    fs.writeFileSync(MARCA_BASE_NUEVA, new Date().toISOString());
    run(pgExe('initdb'), ['-D', DATA_DIR, '-U', 'postgres', '-E', 'UTF8', '--locale=C', '-A', 'scram-sha-256', `--pwfile=${pwFile}`]);
  } finally {
    fs.rmSync(pwFile, { force: true });
  }
  fs.appendFileSync(
    path.join(DATA_DIR, 'postgresql.conf'),
    `${os.EOL}# Valetec POS${os.EOL}port = ${PG_PORT}${os.EOL}listen_addresses = 'localhost'${os.EOL}`
  );
}

async function waitFor(check, label, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await sleep(1500);
  }
  throw new Error(`Tiempo de espera agotado: ${label}`);
}

function psql(password, sql, db = 'postgres') {
  return run(pgExe('psql'), ['-h', 'localhost', '-p', String(PG_PORT), '-U', 'postgres', '-d', db, '-tAc', sql], {
    env: { PGPASSWORD: password },
    capture: true,
  }).stdout;
}

// -U ausente = la cuenta del sistema (LocalSystem), que puede leer cualquier carpeta
function registrarServicioDB(cuenta) {
  const args = ['register', '-N', DB_SERVICE, '-D', DATA_DIR, '-S', 'auto'];
  if (cuenta) args.push('-U', cuenta);
  run(pgExe('pg_ctl'), args);
}

// Arranca el servicio y espera a que la base acepte conexiones. Devuelve false si no lo logra.
async function iniciarServicioDB(timeoutMs = 45000) {
  const inicio = run('net.exe', ['start', DB_SERVICE], { allowFail: true, capture: true });
  if (inicio.status !== 0) log(`net start ${DB_SERVICE}: ${inicio.stdout.replace(/\s+/g, ' ').trim()}`);
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    if (run(pgExe('pg_isready'), ['-h', 'localhost', '-p', String(PG_PORT)], { allowFail: true, capture: true }).status === 0) {
      return true;
    }
    await sleep(1500);
  }
  return false;
}

function writeAppServiceConfig() {
  const xml = `<service>
  <id>${APP_SERVICE}</id>
  <name>Valetec POS - Aplicación</name>
  <description>Servidor del sistema Valetec POS (puerto ${APP_PORT}).</description>
  <executable>${NODE_EXE}</executable>
  <arguments>server.js</arguments>
  <workingdirectory>${BACKEND_DIR}</workingdirectory>
  <env name="TZ" value="UTC"/>
  <env name="NODE_ENV" value="production"/>
  <env name="CHECKPOINT_DISABLE" value="1"/>
  <depend>${DB_SERVICE}</depend>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="5 sec"/>
  <logpath>${LOGS_DIR}</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
</service>
`;
  fs.writeFileSync(path.join(__dirname, `${APP_SERVICE}.xml`), xml, 'utf8');
}

function localIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

async function main() {
  log('=== Configuración de Valetec POS ===');

  // 1. Base de datos (se conserva en actualizaciones)
  let password = readEnvPassword();
  let clusterExists = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (clusterExists && !password) {
    if (!fs.existsSync(MARCA_BASE_NUEVA)) {
      throw new Error(`Existe ${DATA_DIR} pero falta ${ENV_FILE} con la contraseña. No se puede continuar sin perder datos.`);
    }
    // Base a medio crear de una instalación anterior fallida: se rehace desde cero
    log('Se encontró una base incompleta de un intento anterior. Se vuelve a crear...');
    run('net.exe', ['stop', DB_SERVICE], { allowFail: true, capture: true });
    run(pgExe('pg_ctl'), ['unregister', '-N', DB_SERVICE], { allowFail: true });
    await sleep(2000);
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    clusterExists = false;
  }
  if (!clusterExists) {
    password = crypto.randomBytes(18).toString('hex');
    initDatabaseCluster(password);
  }

  // La cuenta del servicio necesita leer los binarios y escribir en data. Si la instalación
  // quedó dentro de C:\Users\<usuario>, NetworkService no alcanza los archivos por herencia.
  run('icacls.exe', [ROOT, '/grant', `${NETWORK_SERVICE_SID}:(OI)(CI)RX`, '/T', '/Q'], { allowFail: true });
  run('icacls.exe', [DATA_DIR, '/grant', `${NETWORK_SERVICE_SID}:(OI)(CI)F`, '/T', '/Q']);

  // 2. Servicio de PostgreSQL: primero con NetworkService y, si Windows niega el arranque
  // (típico al instalar dentro del perfil del usuario), se reintenta con la cuenta del sistema.
  if (!serviceExists(DB_SERVICE)) registrarServicioDB('NT AUTHORITY\\NetworkService');
  if (!(await iniciarServicioDB())) {
    log('El servicio no arrancó con NetworkService. Reintentando con la cuenta del sistema (LocalSystem)...');
    run('net.exe', ['stop', DB_SERVICE], { allowFail: true, capture: true });
    run(pgExe('pg_ctl'), ['unregister', '-N', DB_SERVICE], { allowFail: true });
    await sleep(2000);
    registrarServicioDB(null);
    if (!(await iniciarServicioDB())) {
      const estado = run('sc.exe', ['query', DB_SERVICE], { allowFail: true, capture: true }).stdout;
      throw new Error(`PostgreSQL no respondió en el puerto ${PG_PORT}. Estado del servicio:\n${estado}`);
    }
  }

  if (psql(password, `SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'`) !== '1') {
    psql(password, `CREATE DATABASE ${DB_NAME}`);
  }

  // 3. Configuración del backend (solo se crea en la primera instalación)
  const databaseUrl = `postgresql://postgres:${encodeURIComponent(password)}@localhost:${PG_PORT}/${DB_NAME}`;
  if (!fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(ENV_FILE, [
      `DATABASE_URL="${databaseUrl}"`,
      `PORT=${APP_PORT}`,
      'IGV_RATE=0.105',
      'INITIAL_ADMIN_PIN=1234',
      '',
    ].join(os.EOL));
  }
  fs.rmSync(MARCA_BASE_NUEVA, { force: true }); // la contraseña ya está guardada: la base deja de ser descartable

  // 4. Migraciones
  // Rutas explícitas de los motores para que Prisma no intente descargarlos (instalación sin internet)
  const prismaEnv = {
    DATABASE_URL: databaseUrl,
    CHECKPOINT_DISABLE: '1',
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
    PRISMA_SCHEMA_ENGINE_BINARY: path.join(BACKEND_DIR, 'node_modules', '@prisma', 'engines', 'schema-engine-windows.exe'),
    PRISMA_QUERY_ENGINE_LIBRARY: path.join(BACKEND_DIR, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'),
  };
  run(NODE_EXE, [path.join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
    cwd: BACKEND_DIR,
    env: prismaEnv,
  });

  // 5. Datos iniciales solo si la base está vacía (nunca borra ventas existentes)
  const usuarios = parseInt(psql(password, 'SELECT count(*) FROM "Usuario"', DB_NAME), 10);
  const ventas = parseInt(psql(password, 'SELECT count(*) FROM "Venta"', DB_NAME), 10);
  const hayCliente = fs.existsSync(CLIENTE_JSON);
  if (usuarios === 0 && ventas === 0) {
    log('Base vacía: creando usuarios, 12 mesas y configuración inicial de la empresa...');
    run(NODE_EXE, [path.join(BACKEND_DIR, 'prisma', 'seed-clean.js')], {
      cwd: BACKEND_DIR,
      env: {
        ...prismaEnv,
        ...(hayCliente ? { SEED_CLIENTE_JSON: CLIENTE_JSON } : {}),
        ...(fs.existsSync(CARTA_JSON) ? { SEED_CARTA_JSON: CARTA_JSON } : {}),
      },
    });
  }
  // Los PINs no deben quedar en disco después de crear los usuarios
  fs.rmSync(CLIENTE_JSON, { force: true });

  // 6. Servicio de la aplicación (se reinstala para tomar la nueva versión)
  const winsw = path.join(__dirname, `${APP_SERVICE}.exe`);
  writeAppServiceConfig();
  if (serviceExists(APP_SERVICE)) {
    run(winsw, ['stop'], { allowFail: true });
    run(winsw, ['uninstall'], { allowFail: true });
    await sleep(2000);
  }
  run(winsw, ['install']);
  run(winsw, ['start']);

  // 7. Firewall para que los celulares de los mozos se conecten
  run('netsh.exe', ['advfirewall', 'firewall', 'delete', 'rule', `name=${FIREWALL_RULE}`], { allowFail: true, capture: true });
  run('netsh.exe', ['advfirewall', 'firewall', 'add', 'rule', `name=${FIREWALL_RULE}`, 'dir=in', 'action=allow', 'protocol=TCP', `localport=${APP_PORT}`, 'profile=any']);

  await waitFor(async () => {
    try {
      const res = await fetch(`http://localhost:${APP_PORT}/api/status`);
      return res.ok;
    } catch {
      return false;
    }
  }, 'La aplicación no respondió');

  const urls = [`http://localhost:${APP_PORT}`, ...localIps().map((ip) => `http://${ip}:${APP_PORT}`)];
  fs.writeFileSync(path.join(ROOT, 'ACCESO.txt'), [
    'VALETEC POS - Direcciones de acceso',
    '',
    `Caja (esta PC):   ${urls[0]}`,
    ...urls.slice(1).map((u) => `Celulares mozos:  ${u}`),
    '',
    hayCliente
      ? 'PINs de acceso: según las credenciales entregadas por VT VALETEC'
      : 'PIN inicial del administrador: 1234 (cámbialo en Usuarios)',
    '',
  ].join(os.EOL));

  log(`✅ Instalación completa. Acceso: ${urls.join('  |  ')}`);
}

main().catch((err) => {
  log(`❌ ERROR: ${err.message}`);
  process.exit(1);
});
