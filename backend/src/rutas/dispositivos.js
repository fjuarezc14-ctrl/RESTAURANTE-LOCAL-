// Administración de equipos activados y sesiones abiertas (tarea 10, ACUERDOS §2). Solo el Administrador,
// y siempre con sesión: aunque AUTH_OBLIGATORIA esté apagada, nadie sin sesión puede revocar equipos.
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { ErrorApp } = require('../middlewares/errores');
const { soloAdmin } = require('../middlewares/permisos');
const { requiereSesion } = require('../middlewares/sesion');
const { validar } = require('../middlewares/validar');
const { cerrarSesionesDeUsuario, revocarDispositivo } = require('../servicios/sesiones');
const { id } = require('../../shared/esquemas/comunes.js');

const router = express.Router();
const conId = validar({ params: z.looseObject({ id }) });
const admin = [requiereSesion, soloAdmin];

// GET /api/dispositivos → equipos activados (también los revocados, para ver el historial)
router.get('/api/dispositivos', admin, async (req, res, next) => {
  try {
    const dispositivos = await prisma.dispositivo.findMany({
      orderBy: [{ revocadoEn: { sort: 'asc', nulls: 'first' } }, { ultimoUso: 'desc' }],
      select: {
        id: true, nombre: true, agente: true, creadoEn: true, ultimoUso: true, revocadoEn: true,
        activador: { select: { id: true, nombre: true } },
      },
    });
    res.json(dispositivos.map(({ activador, ...d }) => ({ ...d, activadoPor: activador })));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/dispositivos/:id → lo revoca y cierra sus sesiones; tendrá que activarse de nuevo
router.delete('/api/dispositivos/:id', admin, conId, async (req, res, next) => {
  try {
    const dispositivo = await prisma.dispositivo.findUnique({ where: { id: req.params.id } });
    if (!dispositivo) return next(new ErrorApp('NO_ENCONTRADO', 'El dispositivo no existe.'));
    if (!dispositivo.revocadoEn) {
      await prisma.$transaction((tx) => revocarDispositivo(dispositivo.id, tx));
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/usuarios/:id/sesiones → sesiones abiertas del usuario, con el equipo de cada una
router.get('/api/usuarios/:id/sesiones', admin, conId, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!usuario) return next(new ErrorApp('NO_ENCONTRADO', 'El usuario no existe.'));
    const sesiones = await prisma.sesion.findMany({
      where: { usuarioId: usuario.id, cerradaEn: null },
      orderBy: { ultimaActividad: 'desc' },
      select: { id: true, creadaEn: true, ultimaActividad: true, dispositivo: { select: { id: true, nombre: true } } },
    });
    res.json(sesiones);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios/:id/cerrar-sesiones → "cerrar sesión en todos los equipos" (los equipos siguen activados)
router.post('/api/usuarios/:id/cerrar-sesiones', admin, conId, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!usuario) return next(new ErrorApp('NO_ENCONTRADO', 'El usuario no existe.'));
    await cerrarSesionesDeUsuario(usuario.id, 'REVOCADA');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
