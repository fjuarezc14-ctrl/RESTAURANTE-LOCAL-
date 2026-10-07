// Rutas de sesión: activación del dispositivo, login por PIN, autorizaciones y contraseña (ACUERDOS §2)
const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { ErrorApp } = require('../middlewares/errores');
const { crearLimitador } = require('../middlewares/limiteLogin');
const { requiereSesion } = require('../middlewares/sesion');
const { validar } = require('../middlewares/validar');
const { buscarUsuarioPorPin, usuarioPublico } = require('../servicios/auth');
const { getEmpresaConfig } = require('../servicios/empresa');
const {
  abrirSesion, activarDispositivo, borrarCookieDispositivo, borrarCookieSesion, cerrarSesion, dispositivoDe,
  renovarCookieDispositivo, revocarDispositivo, validarSesion,
} = require('../servicios/sesiones');
const { activacion, cambioContrasena, loginPin } = require('../../shared/esquemas/usuarios.js');

const router = express.Router();

const FALLOS_PIN_PARA_REVOCAR = 10;
const ROLES_QUE_AUTORIZAN = ['Administrador', 'Cajero'];

const limitadorActivacion = crearLimitador();
const limitadorPin = crearLimitador();
const limitadorAutorizacion = crearLimitador((req) => `sesion:${req.sesion?.id}`);

// GET /api/auth/marca → nombre del restaurante para la pantalla de login (pública)
router.get('/api/auth/marca', async (req, res, next) => {
  try {
    const conf = await getEmpresaConfig();
    res.json({
      nombre: conf.name,
      brandShort: conf.brandShort,
      tagline: conf.tagline,
      modoInstalacion: process.env.MODO_INSTALACION || 'local',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/activar → usuario o correo + contraseña: registra el dispositivo y abre la sesión
router.post('/api/auth/activar', limitadorActivacion.middleware, validar({ body: activacion }), async (req, res, next) => {
  try {
    const { usuario, contrasena, nombreDispositivo } = req.body;
    const identificador = usuario.toLowerCase();
    const user = await prisma.usuario.findFirst({
      where: {
        activo: true,
        OR: [{ usuario: { equals: identificador, mode: 'insensitive' } }, { correo: { equals: identificador, mode: 'insensitive' } }],
      },
    });
    const valida = Boolean(user?.contrasenaHash) && await bcrypt.compare(contrasena, user.contrasenaHash);
    if (!valida) {
      limitadorActivacion.fallo(req);
      return next(new ErrorApp('CREDENCIALES_INCORRECTAS', 'Usuario o contraseña incorrectos.', { campo: 'contrasena' }));
    }
    limitadorActivacion.exito(req);

    const dispositivo = await activarDispositivo(res, { usuarioId: user.id, nombre: nombreDispositivo, agente: req.headers['user-agent'] });
    await abrirSesion(res, { usuarioId: user.id, dispositivoId: dispositivo.id });
    res.json({ usuario: usuarioPublico(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login → PIN en un dispositivo ya activado
router.post('/api/auth/login', limitadorPin.middleware, validar({ body: loginPin }), async (req, res, next) => {
  try {
    const dispositivo = await dispositivoDe(req);
    if (!dispositivo) {
      return next(new ErrorApp('DISPOSITIVO_NO_ACTIVADO', 'Este dispositivo no está activado. Entra con tu usuario y contraseña.'));
    }

    const user = await buscarUsuarioPorPin(req.body.pin);
    if (!user) {
      limitadorPin.fallo(req);
      const fallos = dispositivo.fallosPin + 1;
      if (fallos >= FALLOS_PIN_PARA_REVOCAR) {
        await revocarDispositivo(dispositivo.id);
        borrarCookieDispositivo(res);
        borrarCookieSesion(res);
        return next(new ErrorApp('DISPOSITIVO_NO_ACTIVADO', 'Demasiados PIN incorrectos: el dispositivo se desactivó. Actívalo de nuevo con tu usuario y contraseña.'));
      }
      await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { fallosPin: fallos } });
      return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto. Inténtalo de nuevo.', { campo: 'pin' }));
    }
    limitadorPin.exito(req);
    await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { fallosPin: 0, ultimoUso: new Date() } });

    // En un dispositivo compartido, la sesión del usuario anterior se cierra
    const anterior = await validarSesion(req);
    if (anterior.sesion) await cerrarSesion(anterior.sesion.id, 'OTRA_SESION');

    await abrirSesion(res, { usuarioId: user.id, dispositivoId: dispositivo.id });
    renovarCookieDispositivo(req, res);
    res.json({ usuario: usuarioPublico(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout → cierra la sesión; el dispositivo sigue activado
router.post('/api/auth/logout', async (req, res, next) => {
  try {
    if (req.sesion) await cerrarSesion(req.sesion.id, 'LOGOUT');
    borrarCookieSesion(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/yo → usuario de la sesión actual
router.get('/api/auth/yo', requiereSesion, (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario), dispositivo: { id: req.dispositivo.id, nombre: req.dispositivo.nombre } });
});

// POST /api/auth/autorizar → valida el PIN de un Administrador o Cajero (anular, cortesía, descuento)
router.post('/api/auth/autorizar', requiereSesion, limitadorAutorizacion.middleware, validar({ body: loginPin }), async (req, res, next) => {
  try {
    const user = await buscarUsuarioPorPin(req.body.pin);
    if (!user) {
      limitadorAutorizacion.fallo(req);
      return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    }
    if (!ROLES_QUE_AUTORIZAN.includes(user.rol)) {
      limitadorAutorizacion.fallo(req);
      return next(new ErrorApp('SIN_PERMISO', 'Se requiere el PIN de un Administrador o Cajero.', { campo: 'pin' }));
    }
    limitadorAutorizacion.exito(req);
    res.json({ autorizadoPor: { id: user.id, nombre: user.nombre, rol: user.rol } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/contrasena → cambiar la propia contraseña
router.put('/api/auth/contrasena', requiereSesion, validar({ body: cambioContrasena }), async (req, res, next) => {
  try {
    const user = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const valida = Boolean(user.contrasenaHash) && await bcrypt.compare(req.body.actual, user.contrasenaHash);
    if (!valida) return next(new ErrorApp('CREDENCIALES_INCORRECTAS', 'La contraseña actual no es correcta.', { campo: 'actual' }));
    await prisma.usuario.update({ where: { id: user.id }, data: { contrasenaHash: await bcrypt.hash(req.body.nueva, 10) } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
