// Rutas de usuarios, login por PIN y autorizaciones
const express = require('express');
const { prisma } = require('../db');
const { loginRateLimiter, registerLoginFailure, registerLoginSuccess } = require('../middlewares/limiteLogin');
const { generarPinSignature } = require('../servicios/auth');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { loginPin, usuarioEdicion, usuarioNuevo } = require('../../shared/esquemas/usuarios.js');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// USUARIOS
// ============================================================

router.get('/api/usuarios', async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// El rol Administrador siempre tiene acceso a todos los módulos
const PERMISOS_ADMINISTRADOR = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Creditos', 'Compras', 'Reportes', 'Carta', 'Categorias', 'Usuarios'];

router.post('/api/usuarios', validar({ body: usuarioNuevo }), async (req, res, next) => {
  try {
    // Validar PIN único
    const duplicate = await prisma.usuario.findFirst({
      where: { pin: String(req.body.pin), activo: true }
    });
    if (duplicate) {
      return next(new ErrorApp('YA_EXISTE', 'Este PIN ya está asignado a otro empleado. Elige uno diferente.', { campo: 'pin' }));
    }

    const { nombre, rol, pin, permisos } = req.body;
    const user = await prisma.usuario.create({
      data: {
        nombre: String(nombre),
        rol: String(rol),
        pin: String(pin),
        permisos: String(rol) === 'Administrador' ? PERMISOS_ADMINISTRADOR : (Array.isArray(permisos) ? permisos.map(String) : []),
      }
    });
    const { pin: userPin, ...seguro } = user;
    res.json(seguro);
  } catch (err) {
    next(err);
  }
});

router.put('/api/usuarios/:id', validar({ body: usuarioEdicion }), async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return next(new ErrorApp('NO_ENCONTRADO', 'Usuario no encontrado'));
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutableOriginal = nombresInmutables.includes(target.nombre.toLowerCase().trim());

    if (req.body.pin) {
      const duplicate = await prisma.usuario.findFirst({
        where: { pin: String(req.body.pin), activo: true, id: { not: id } }
      });
      if (duplicate) {
        return next(new ErrorApp('YA_EXISTE', 'Este PIN ya está asignado a otro empleado. Elige uno diferente.', { campo: 'pin' }));
      }
    }

    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.rol !== undefined) data.rol = String(req.body.rol);
    if (req.body.pin !== undefined) data.pin = String(req.body.pin);
    if (req.body.permisos !== undefined) data.permisos = Array.isArray(req.body.permisos) ? req.body.permisos.map(String) : [];
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);
    if ((data.rol ?? target.rol) === 'Administrador') data.permisos = PERMISOS_ADMINISTRADOR;

    if (isInmutableOriginal) {
      if (req.body.rol !== undefined && req.body.rol !== 'Administrador') {
        return next(new ErrorApp('SIN_PERMISO', '⚠️ No puedes cambiar el rol de este administrador principal.'));
      }
      if (req.body.nombre !== undefined && req.body.nombre.toLowerCase().trim() !== target.nombre.toLowerCase().trim()) {
        return next(new ErrorApp('SIN_PERMISO', '⚠️ No puedes cambiar el nombre de este administrador principal.'));
      }
      if (req.body.activo !== undefined && !req.body.activo) {
        return next(new ErrorApp('SIN_PERMISO', '⚠️ No puedes desactivar a este administrador principal.'));
      }
      // Forzar valores correctos para asegurar la inmutabilidad y permisos de administración completos
      data.rol = 'Administrador';
      data.activo = true;
      data.permisos = PERMISOS_ADMINISTRADOR;
    }

    const user = await prisma.usuario.update({
      where: { id },
      data
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/api/usuarios/login', loginRateLimiter, validar({ body: loginPin }), async (req, res, next) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      registerLoginFailure(req);
      return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto. Inténtalo de nuevo.', { campo: 'pin' }));
    }
    registerLoginSuccess(req);
    const { pin: userPin, ...safeUser } = user;
    safeUser.pinSignature = generarPinSignature(user.pin, user.id);
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    next(err);
  }
});

router.post('/api/usuarios/validate-auth', validar({ body: loginPin }), async (req, res, next) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    }
    // Solo Administrador o Cajero pueden autorizar cancelaciones/cortesías
    const rolesAutorizados = ['Administrador', 'Cajero'];
    if (!rolesAutorizados.includes(user.rol)) {
      return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'Acceso denegado. Se requiere PIN de Administrador o Cajero.', { campo: 'pin' }));
    }
    res.json({ ok: true, nombre: user.nombre, rol: user.rol });
  } catch (err) {
    next(err);
  }
});

// :usuarioId (no :id) para no pasar por validarIdsEnUrl: con un ID inválido responde exists:false y la pantalla
// cierra la sesión (si respondiera error, la pantalla asumiría que el usuario sigue activo). Se reemplaza en la tarea 7.
router.get('/api/usuarios/check/:usuarioId', async (req, res, next) => {
  try {
    const id = parseInt(req.params.usuarioId);
    if (isNaN(id)) return res.json({ exists: false });
    const user = await prisma.usuario.findUnique({
      where: { id }
    });
    if (!user || !user.activo) {
      return res.json({ exists: false });
    }
    res.json({
      exists: true,
      activo: user.activo,
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      permisos: user.permisos,
      pinSignature: generarPinSignature(user.pin, user.id)
    });
  } catch (err) {
    res.json({ exists: false, error: err.message });
  }
});

router.delete('/api/usuarios/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return next(new ErrorApp('NO_ENCONTRADO', 'Usuario no encontrado'));
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutable = nombresInmutables.includes(target.nombre.toLowerCase().trim());
    if (isInmutable) {
      return next(new ErrorApp('SIN_PERMISO', '⚠️ Este usuario administrador es una cuenta principal del sistema y no puede ser eliminado.'));
    }

    const admins = await prisma.usuario.count({ where: { rol: 'Administrador', activo: true } });
    if (target.rol === 'Administrador' && admins <= 1) {
      return next(new ErrorApp('CONFLICTO', '¡No puedes eliminar al único Administrador!'));
    }
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
