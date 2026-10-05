// Rutas de usuarios, login por PIN y autorizaciones
const express = require('express');
const { prisma } = require('../db');
const { loginRateLimiter, registerLoginFailure, registerLoginSuccess } = require('../middlewares/limiteLogin');
const { generarPinSignature } = require('../servicios/auth');

const router = express.Router();

// ============================================================
// USUARIOS
// ============================================================

router.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// El rol Administrador siempre tiene acceso a todos los módulos
const PERMISOS_ADMINISTRADOR = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Creditos', 'Compras', 'Reportes', 'Carta', 'Categorias', 'Usuarios'];

router.post('/api/usuarios', async (req, res) => {
  try {
    // Validar PIN único
    const duplicate = await prisma.usuario.findFirst({
      where: { pin: String(req.body.pin), activo: true }
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Este PIN ya está asignado a otro empleado. Elige uno diferente.' });
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
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/usuarios/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutableOriginal = nombresInmutables.includes(target.nombre.toLowerCase().trim());

    if (req.body.pin) {
      const duplicate = await prisma.usuario.findFirst({
        where: { pin: String(req.body.pin), activo: true, id: { not: id } }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Este PIN ya está asignado a otro empleado. Elige uno diferente.' });
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
        return res.status(400).json({ error: '⚠️ No puedes cambiar el rol de este administrador principal.' });
      }
      if (req.body.nombre !== undefined && req.body.nombre.toLowerCase().trim() !== target.nombre.toLowerCase().trim()) {
        return res.status(400).json({ error: '⚠️ No puedes cambiar el nombre de este administrador principal.' });
      }
      if (req.body.activo !== undefined && !req.body.activo) {
        return res.status(400).json({ error: '⚠️ No puedes desactivar a este administrador principal.' });
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/usuarios/login', loginRateLimiter, async (req, res) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      registerLoginFailure(req);
      return res.status(401).json({ error: 'PIN incorrecto. Inténtalo de nuevo.' });
    }
    registerLoginSuccess(req);
    const { pin: userPin, ...safeUser } = user;
    safeUser.pinSignature = generarPinSignature(user.pin, user.id);
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/usuarios/validate-auth', async (req, res) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'PIN incorrecto.' });
    }
    // Solo Administrador o Cajero pueden autorizar cancelaciones/cortesías
    const rolesAutorizados = ['Administrador', 'Cajero'];
    if (!rolesAutorizados.includes(user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere PIN de Administrador o Cajero.' });
    }
    res.json({ ok: true, nombre: user.nombre, rol: user.rol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/usuarios/check/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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

router.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutable = nombresInmutables.includes(target.nombre.toLowerCase().trim());
    if (isInmutable) {
      return res.status(400).json({ error: '⚠️ Este usuario administrador es una cuenta principal del sistema y no puede ser eliminado.' });
    }

    const admins = await prisma.usuario.count({ where: { rol: 'Administrador', activo: true } });
    if (target.rol === 'Administrador' && admins <= 1) {
      return res.status(400).json({ error: '¡No puedes eliminar al único Administrador!' });
    }
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
