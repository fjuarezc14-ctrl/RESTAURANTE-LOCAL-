// Consulta del registro de auditoría (tarea 11). Solo el Administrador y siempre con sesión.
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { soloAdmin } = require('../middlewares/permisos');
const { requiereSesion } = require('../middlewares/sesion');
const { validar } = require('../middlewares/validar');
const { ACCIONES } = require('../servicios/auditoria');
const { conRangoFechas, desdeTexto, idOpcional } = require('../../shared/esquemas/comunes.js');

const router = express.Router();
const admin = [requiereSesion, soloAdmin];

const consultaAuditoria = conRangoFechas({
  usuarioId: idOpcional,
  accion: z.enum(Object.keys(ACCIONES), { error: 'Acción no válida.' }).optional(),
  page: desdeTexto(z.number().int().min(1).max(100000).optional()),
  limit: desdeTexto(z.number().int().min(1).max(200).optional()),
});

// Día calendario de Lima (UTC-5 todo el año): [00:00 de desde, 00:00 del día siguiente a hasta)
function rangoLima(desde, hasta) {
  const fin = new Date(`${hasta}T00:00:00.000-05:00`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return { gte: new Date(`${desde}T00:00:00.000-05:00`), lt: fin };
}

// GET /api/auditoria/acciones → lista para el filtro de la pantalla
router.get('/api/auditoria/acciones', admin, (req, res) => {
  res.json(Object.entries(ACCIONES).map(([codigo, nombre]) => ({ codigo, nombre })));
});

// GET /api/auditoria?desde&hasta&usuarioId&accion&page&limit → de lo más reciente a lo más antiguo
router.get('/api/auditoria', admin, validar({ query: consultaAuditoria }), async (req, res, next) => {
  try {
    const { desde, hasta, usuarioId, accion } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const where = {
      ...(desde && hasta ? { creadoEn: rangoLima(desde, hasta) } : {}),
      ...(usuarioId ? { usuarioId } : {}),
      ...(accion ? { accion } : {}),
    };
    const [total, registros] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    res.json({ registros, total, page, limit });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
