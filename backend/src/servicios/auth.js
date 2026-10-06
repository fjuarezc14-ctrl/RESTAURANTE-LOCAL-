// ============================================================
// PIN Y DATOS PÚBLICOS DEL USUARIO
// El PIN se guarda como HMAC-SHA256 con PIN_SECRET (scratch/ACUERDOS.md §2): permite buscar al
// usuario por su PIN y exigir que sea único, y una copia de la BD no basta para conocer los PINs.
// ============================================================
const crypto = require('crypto');
const { prisma } = require('../db');

const SECRETO_DESARROLLO = 'pin-secret-solo-para-desarrollo';
let avisoSecreto = false;

function secretoPin() {
  if (process.env.PIN_SECRET) return process.env.PIN_SECRET;
  if (!avisoSecreto) {
    console.warn('⚠️ PIN_SECRET no está configurado: se usa un secreto de desarrollo. Configúralo en el .env del cliente.');
    avisoSecreto = true;
  }
  return SECRETO_DESARROLLO;
}

function hashPin(pin) {
  return crypto.createHmac('sha256', secretoPin()).update(String(pin)).digest('hex');
}

// Usuario activo con ese PIN (y los filtros extra, ej. { rol: 'Administrador' }), o null
async function buscarUsuarioPorPin(pin, filtros = {}, cliente = prisma) {
  if (!/^\d{4}$/.test(String(pin ?? '').trim())) return null;
  return cliente.usuario.findFirst({ where: { pinHash: hashPin(String(pin).trim()), activo: true, ...filtros } });
}

// Convierte los PIN guardados en texto plano (BD existentes, seeds, instalador) y los borra.
// Se ejecuta al arrancar el servidor.
async function migrarPinesAHash() {
  const pendientes = await prisma.usuario.findMany({ where: { pin: { not: null } }, select: { id: true, pin: true } });
  for (const u of pendientes) {
    await prisma.usuario.update({ where: { id: u.id }, data: { pinHash: hashPin(u.pin), pin: null } });
  }
  return pendientes.length;
}

// Lo único que la API devuelve de un usuario: nunca el PIN ni los hashes
function usuarioPublico(u) {
  if (!u) return u;
  const { id, nombre, rol, permisos, activo, creadoEn, usuario, correo, inactividadMin } = u;
  return { id, nombre, rol, permisos, activo, creadoEn, usuario, correo, inactividadMin };
}

// Firma corta del PIN: la pantalla la compara para cerrar la sesión si cambió el PIN
function generarPinSignature(pinHash, userId) {
  return crypto.createHash('sha256').update(`${pinHash || ''}_${userId}_salt_hernandez_auth`).digest('hex').substring(0, 16);
}

module.exports = { hashPin, buscarUsuarioPorPin, migrarPinesAHash, usuarioPublico, generarPinSignature };
