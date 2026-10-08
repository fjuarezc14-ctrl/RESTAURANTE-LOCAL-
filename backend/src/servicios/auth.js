// @ts-check
// ============================================================
// PIN Y DATOS PÚBLICOS DEL USUARIO
// El PIN se guarda como HMAC-SHA256 con PIN_SECRET (scratch/ACUERDOS.md §2): permite buscar al
// usuario por su PIN y exigir que sea único, y una copia de la BD no basta para conocer los PINs.
// ============================================================
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
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

// Sin un administrador con contraseña nadie podría activar el primer dispositivo. Al arrancar, si falta,
// el primer Administrador activo recibe el usuario "admin" y INITIAL_ADMIN_PASSWORD (o una al azar que se muestra en el log).
async function asegurarAccesoAdministrador() {
  const conAcceso = await prisma.usuario.count({ where: { rol: 'Administrador', activo: true, contrasenaHash: { not: null } } });
  if (conAcceso > 0) return null;
  const admin = await prisma.usuario.findFirst({ where: { rol: 'Administrador', activo: true }, orderBy: { id: 'asc' } });
  if (!admin) return null;

  const ocupado = await prisma.usuario.findFirst({ where: { usuario: 'admin', id: { not: admin.id } } });
  const usuario = admin.usuario || (ocupado ? `admin${admin.id}` : 'admin');
  const generada = !process.env.INITIAL_ADMIN_PASSWORD;
  const contrasena = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await prisma.usuario.update({ where: { id: admin.id }, data: { usuario, contrasenaHash: await bcrypt.hash(contrasena, 10) } });
  return { usuario, contrasena, generada };
}

// Rescate de soporte (scripts/restablecer-admin.js): nueva contraseña para UN administrador elegido por su
// usuario o ID. La anterior no se puede mostrar: solo se guarda su hash. Las sesiones y equipos activados siguen.
async function restablecerContrasenaAdmin(identificador, contrasenaNueva) {
  const id = /^\d+$/.test(String(identificador)) ? Number(identificador) : null;
  const admin = await prisma.usuario.findFirst({
    where: { rol: 'Administrador', activo: true, OR: [...(id ? [{ id }] : []), { usuario: String(identificador).toLowerCase() }] },
  });
  if (!admin) return null;
  const ocupado = admin.usuario ? null : await prisma.usuario.findFirst({ where: { usuario: 'admin' } });
  const usuario = admin.usuario || (ocupado ? `admin${admin.id}` : 'admin');
  const contrasena = contrasenaNueva || crypto.randomBytes(9).toString('base64url');
  await prisma.usuario.update({ where: { id: admin.id }, data: { usuario, contrasenaHash: await bcrypt.hash(contrasena, 10) } });
  return { id: admin.id, nombre: admin.nombre, usuario, contrasena };
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

module.exports = {
  hashPin, buscarUsuarioPorPin, migrarPinesAHash, asegurarAccesoAdministrador, restablecerContrasenaAdmin, usuarioPublico, generarPinSignature,
};
