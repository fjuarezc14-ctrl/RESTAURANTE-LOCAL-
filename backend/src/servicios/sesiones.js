// @ts-check
// ============================================================
// SESIONES Y DISPOSITIVOS (scratch/ACUERDOS.md §2)
// Dos cookies httpOnly: <CLIENTE>_disp (dispositivo activado, 180 días) y <CLIENTE>_sesion (usuario que entró con PIN).
// En la BD solo se guarda el SHA-256 de cada token.
// ============================================================
const crypto = require('crypto');
const { prisma } = require('../db');

const DIAS_DISPOSITIVO = 180;
const MINUTO_MS = 60 * 1000;

// En desarrollo todos los clientes comparten localhost y las cookies no se separan por puerto: van con prefijo
const prefijo = () => (process.env.CLIENTE || 'valetec').replace(/[^a-zA-Z0-9_-]/g, '');
const cookieSesion = () => `${prefijo()}_sesion`;
const cookieDispositivo = () => `${prefijo()}_disp`;

const crearToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function opcionesCookie(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.MODO_INSTALACION === 'web', // en la red local es HTTP
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

function leerCookies(req) {
  const cookies = {};
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    const nombre = parte.slice(0, i).trim();
    try {
      cookies[nombre] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      cookies[nombre] = parte.slice(i + 1).trim();
    }
  }
  return cookies;
}

const tokenDeSesion = (req) => leerCookies(req)[cookieSesion()];
const tokenDeDispositivo = (req) => leerCookies(req)[cookieDispositivo()];

// Dispositivo activado (no revocado) de la petición, o null
async function dispositivoDe(req) {
  const token = tokenDeDispositivo(req);
  if (!token) return null;
  const dispositivo = await prisma.dispositivo.findUnique({ where: { tokenHash: hashToken(token) } });
  return dispositivo && !dispositivo.revocadoEn ? dispositivo : null;
}

async function activarDispositivo(res, { usuarioId, nombre, agente }) {
  const token = crearToken();
  const dispositivo = await prisma.dispositivo.create({
    data: { tokenHash: hashToken(token), nombre, agente: String(agente || '').slice(0, 300), activadoPor: usuarioId },
  });
  res.cookie(cookieDispositivo(), token, opcionesCookie(DIAS_DISPOSITIVO * 24 * 60 * MINUTO_MS));
  return dispositivo;
}

// Renueva la cookie del dispositivo cada vez que se usa (180 días desde el último uso)
function renovarCookieDispositivo(req, res) {
  const token = tokenDeDispositivo(req);
  if (token) res.cookie(cookieDispositivo(), token, opcionesCookie(DIAS_DISPOSITIVO * 24 * 60 * MINUTO_MS));
}

async function abrirSesion(res, { usuarioId, dispositivoId }) {
  const token = crearToken();
  const sesion = await prisma.sesion.create({ data: { tokenHash: hashToken(token), usuarioId, dispositivoId } });
  res.cookie(cookieSesion(), token, opcionesCookie());
  return sesion;
}

const borrarCookieSesion = (res) => res.clearCookie(cookieSesion(), opcionesCookie());
const borrarCookieDispositivo = (res) => res.clearCookie(cookieDispositivo(), opcionesCookie());

async function cerrarSesion(id, motivo) {
  await prisma.sesion.updateMany({ where: { id, cerradaEn: null }, data: { cerradaEn: new Date(), motivoCierre: motivo } });
}

// motivo: REVOCADA | USUARIO_DESACTIVADO | PIN_CAMBIADO. `cliente` permite hacerlo dentro de un $transaction
async function cerrarSesionesDeUsuario(usuarioId, motivo, cliente = prisma) {
  const { count } = await cliente.sesion.updateMany({ where: { usuarioId, cerradaEn: null }, data: { cerradaEn: new Date(), motivoCierre: motivo } });
  return count;
}

async function revocarDispositivo(dispositivoId, cliente = prisma) {
  await cliente.dispositivo.update({ where: { id: dispositivoId }, data: { revocadoEn: new Date() } });
  await cliente.sesion.updateMany({ where: { dispositivoId, cerradaEn: null }, data: { cerradaEn: new Date(), motivoCierre: 'REVOCADA' } });
}

// Sesión de la petición con su usuario y dispositivo. { sesion } si es válida; { motivo } si no
async function validarSesion(req) {
  const token = tokenDeSesion(req);
  if (!token) return { motivo: 'SIN_COOKIE' };
  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: true, dispositivo: true },
  });
  if (!sesion || sesion.cerradaEn) return { motivo: 'CERRADA' };
  if (sesion.dispositivo.revocadoEn) return { motivo: 'DISPOSITIVO_REVOCADO' };
  if (!sesion.usuario.activo) {
    await cerrarSesion(sesion.id, 'USUARIO_DESACTIVADO');
    return { motivo: 'CERRADA' };
  }
  const limite = sesion.usuario.inactividadMin;
  if (limite && Date.now() - sesion.ultimaActividad.getTime() > limite * MINUTO_MS) {
    await cerrarSesion(sesion.id, 'INACTIVIDAD');
    return { motivo: 'CERRADA' };
  }
  return { sesion };
}

// Como máximo una escritura por minuto por sesión, para no escribir en la BD en cada petición
async function registrarActividad(sesion) {
  if (Date.now() - sesion.ultimaActividad.getTime() < MINUTO_MS) return;
  await prisma.sesion.update({ where: { id: sesion.id }, data: { ultimaActividad: new Date() } });
  await prisma.dispositivo.update({ where: { id: sesion.dispositivoId }, data: { ultimoUso: new Date() } });
}

module.exports = {
  cookieSesion,
  cookieDispositivo,
  hashToken,
  leerCookies,
  dispositivoDe,
  activarDispositivo,
  renovarCookieDispositivo,
  abrirSesion,
  borrarCookieSesion,
  borrarCookieDispositivo,
  cerrarSesion,
  cerrarSesionesDeUsuario,
  revocarDispositivo,
  validarSesion,
  registrarActividad,
};
