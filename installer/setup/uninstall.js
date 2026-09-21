// ============================================================
// DESINSTALACIÓN (WINDOWS): detiene y elimina servicios y regla de firewall.
// La carpeta data (ventas) la elimina el desinstalador solo si el usuario lo confirma.
// ============================================================
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DB_SERVICE = 'ValetecPOS-DB';
const APP_SERVICE = 'ValetecPOS-App';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
  console.log(`> ${path.basename(cmd)} ${args.join(' ')} (código ${r.status})`);
}

const winsw = path.join(__dirname, `${APP_SERVICE}.exe`);
run(winsw, ['stop']);
run(winsw, ['uninstall']);
run('net.exe', ['stop', DB_SERVICE]);
run(path.join(ROOT, 'pgsql', 'bin', 'pg_ctl.exe'), ['unregister', '-N', DB_SERVICE]);
run('netsh.exe', ['advfirewall', 'firewall', 'delete', 'rule', 'name=Valetec POS']);
