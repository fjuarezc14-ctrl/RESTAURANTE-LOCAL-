// Aplica las migraciones a la BD de pruebas una vez, antes de todas las suites
import { execSync } from 'node:child_process';
import { prepararEntorno } from './entorno.mjs';

export default function () {
  prepararEntorno();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
}
