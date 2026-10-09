// Rutas de usuarios (el login por PIN y las autorizaciones están en rutas/auth.js)
const express = require('express');
const { prisma } = require('../db');
const bcrypt = require('bcryptjs');
const { buscarUsuarioPorPin, hashPin, usuarioPublico } = require('../servicios/auth');
const { cerrarSesionesDeUsuario } = require('../servicios/sesiones');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { usuarioEdicion, usuarioNuevo } = require('../../shared/esquemas/usuarios.js');
const { soloAdmin } = require('../middlewares/permisos');
const { requiereSesion } = require('../middlewares/sesion');
const { esAdmin, tienePermiso } = require('../../shared/permisos.js');
const { registrarAuditoria } = require('../servicios/auditoria');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// USUARIOS
// ============================================================

// Lista del personal (selector de mozos, cajeros…). Siempre con sesión; el usuario y el correo de acceso
// solo los ve quien administra el personal
router.get('/api/usuarios', requiereSesion, async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    const veAccesos = esAdmin(req.usuario) || tienePermiso(req.usuario, 'Usuarios');
    res.json(usuarios.map((u) => {
      const publico = usuarioPublico(u);
      if (veAccesos) return publico;
      const { usuario, correo, ...resto } = publico;
      return resto;
    }));
  } catch (err) {
    next(err);
  }
});

// Usuario, correo, contraseña e inactividad: solo se tocan si llegan (null los borra)
async function datosDeAcceso(body) {
  const data = {};
  if (body.usuario !== undefined) data.usuario = body.usuario;
  if (body.correo !== undefined) data.correo = body.correo;
  if (body.inactividadMin !== undefined) data.inactividadMin = body.inactividadMin;
  if (body.contrasena) data.contrasenaHash = await bcrypt.hash(body.contrasena, 10);
  return data;
}

// Lo que se guarda de un usuario en la auditoría: nunca el PIN ni la contraseña
const CAMPOS_AUDITADOS = ['nombre', 'rol', 'permisos', 'activo', 'usuario', 'correo', 'inactividadMin'];
const resumenUsuario = (u) => Object.fromEntries(CAMPOS_AUDITADOS.map((c) => [c, u[c] ?? null]));
function cambiosDeUsuario(antes, despues) {
  const a = resumenUsuario(antes);
  const d = resumenUsuario(despues);
  const campos = CAMPOS_AUDITADOS.filter((c) => JSON.stringify(a[c]) !== JSON.stringify(d[c]));
  return { antes: Object.fromEntries(campos.map((c) => [c, a[c]])), despues: Object.fromEntries(campos.map((c) => [c, d[c]])), campos };
}

// El rol Administrador siempre tiene acceso a todos los módulos
const PERMISOS_ADMINISTRADOR = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Creditos', 'Compras', 'Reportes', 'Carta', 'Categorias', 'Usuarios'];

router.post('/api/usuarios', soloAdmin, validar({ body: usuarioNuevo }), async (req, res, next) => {
  try {
    // Validar PIN único
    const duplicate = await buscarUsuarioPorPin(req.body.pin);
    if (duplicate) {
      return next(new ErrorApp('YA_EXISTE', 'Este PIN ya está asignado a otro empleado. Elige uno diferente.', { campo: 'pin' }));
    }

    const { nombre, rol, pin, permisos } = req.body;
    const datos = {
      nombre: String(nombre),
      rol: String(rol),
      pinHash: hashPin(pin),
      permisos: String(rol) === 'Administrador' ? PERMISOS_ADMINISTRADOR : (Array.isArray(permisos) ? permisos.map(String) : []),
      ...(await datosDeAcceso(req.body)),
    };
    const user = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({ data: datos });
      await registrarAuditoria(tx, req, { accion: 'USUARIO_CREADO', entidad: 'Usuario', entidadId: creado.id, despues: resumenUsuario(creado) });
      return creado;
    });
    res.json(usuarioPublico(user));
  } catch (err) {
    next(err);
  }
});

router.put('/api/usuarios/:id', soloAdmin, validar({ body: usuarioEdicion }), async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return next(new ErrorApp('NO_ENCONTRADO', 'Usuario no encontrado'));
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutableOriginal = nombresInmutables.includes(target.nombre.toLowerCase().trim());

    if (req.body.pin) {
      const duplicate = await buscarUsuarioPorPin(req.body.pin, { id: { not: id } });
      if (duplicate) {
        return next(new ErrorApp('YA_EXISTE', 'Este PIN ya está asignado a otro empleado. Elige uno diferente.', { campo: 'pin' }));
      }
    }

    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.rol !== undefined) data.rol = String(req.body.rol);
    if (req.body.pin !== undefined) data.pinHash = hashPin(req.body.pin);
    if (req.body.permisos !== undefined) data.permisos = Array.isArray(req.body.permisos) ? req.body.permisos.map(String) : [];
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);
    Object.assign(data, await datosDeAcceso(req.body));
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

    // Cambiar el PIN o desactivar al usuario cierra sus sesiones abiertas, en la misma transacción
    const motivoCierre = data.activo === false ? 'USUARIO_DESACTIVADO' : (data.pinHash ? 'PIN_CAMBIADO' : null);
    const user = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({ where: { id }, data });
      if (motivoCierre) await cerrarSesionesDeUsuario(id, motivoCierre, tx);
      const base = { entidad: 'Usuario', entidadId: id };
      const cambios = cambiosDeUsuario(target, actualizado);
      if (cambios.campos.length || data.contrasenaHash) {
        await registrarAuditoria(tx, req, {
          ...base, accion: 'USUARIO_EDITADO', antes: cambios.antes,
          despues: { ...cambios.despues, ...(data.contrasenaHash ? { contrasena: 'cambiada' } : {}) },
        });
      }
      if (data.pinHash) await registrarAuditoria(tx, req, { ...base, accion: 'PIN_CAMBIADO', despues: { nombre: actualizado.nombre } });
      if (data.activo === false && target.activo) {
        await registrarAuditoria(tx, req, { ...base, accion: 'USUARIO_DESACTIVADO', antes: { activo: true }, despues: { activo: false } });
      }
      return actualizado;
    });
    res.json(usuarioPublico(user));
  } catch (err) {
    next(err);
  }
});

router.delete('/api/usuarios/:id', soloAdmin, async (req, res, next) => {
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
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { activo: false } });
      await cerrarSesionesDeUsuario(id, 'USUARIO_DESACTIVADO', tx);
      await registrarAuditoria(tx, req, {
        accion: 'USUARIO_DESACTIVADO', entidad: 'Usuario', entidadId: id,
        antes: { nombre: target.nombre, activo: target.activo }, despues: { activo: false },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
