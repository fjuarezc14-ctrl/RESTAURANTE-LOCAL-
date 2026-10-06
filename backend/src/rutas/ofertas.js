// Rutas de ofertas por temporada
const express = require('express');
const { prisma } = require('../db');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { activacionOferta, ofertaEdicion, ofertaNueva } = require('../../shared/esquemas/carta.js');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// OFERTAS POR TEMPORADA
// ============================================================

// GET /api/ofertas → Listar todas las ofertas
router.get('/api/ofertas', async (req, res, next) => {
  try {
    const ofertas = await prisma.oferta.findMany({ orderBy: { creadoEn: 'desc' } });
    res.json(ofertas);
  } catch (err) {
    next(err);
  }
});

// POST /api/ofertas → Crear nueva oferta (solo Admin)
router.post('/api/ofertas', requierePermiso('Carta'), validar({ body: ofertaNueva }), async (req, res, next) => {
  try {
    const { nombre, descripcion, tipoDescuento, valorDescuento, categorias, activa, fechaInicio, fechaFin, creadoPor } = req.body;
    if (!nombre || !tipoDescuento || valorDescuento == null || !categorias || !creadoPor) {
      return next(new ErrorApp('VALIDACION', 'Faltan campos obligatorios: nombre, tipoDescuento, valorDescuento, categorias, creadoPor'));
    }
    const oferta = await prisma.oferta.create({
      data: {
        nombre: String(nombre),
        descripcion: descripcion ? String(descripcion) : null,
        tipoDescuento: String(tipoDescuento),
        valorDescuento: parseFloat(valorDescuento),
        categorias: Array.isArray(categorias) ? categorias.map(String) : [],
        activa: Boolean(activa),
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        creadoPor: String(creadoPor),
      }
    });
    res.json(oferta);
  } catch (err) {
    next(err);
  }
});

// PUT /api/ofertas/:id → Editar oferta
router.put('/api/ofertas/:id', requierePermiso('Carta'), validar({ body: ofertaEdicion }), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion ? String(req.body.descripcion) : null;
    if (req.body.tipoDescuento !== undefined) data.tipoDescuento = String(req.body.tipoDescuento);
    if (req.body.valorDescuento !== undefined) data.valorDescuento = parseFloat(req.body.valorDescuento);
    if (req.body.categorias !== undefined) data.categorias = Array.isArray(req.body.categorias) ? req.body.categorias.map(String) : [];
    if (req.body.fechaInicio !== undefined) data.fechaInicio = req.body.fechaInicio ? new Date(req.body.fechaInicio) : null;
    if (req.body.fechaFin !== undefined) data.fechaFin = req.body.fechaFin ? new Date(req.body.fechaFin) : null;
    const oferta = await prisma.oferta.update({ where: { id }, data });
    res.json(oferta);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/ofertas/:id/activar → Activar o desactivar oferta
router.patch('/api/ofertas/:id/activar', requierePermiso('Carta'), validar({ body: activacionOferta }), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { activa } = req.body;
    const oferta = await prisma.oferta.update({
      where: { id },
      data: { activa: Boolean(activa) }
    });
    res.json({ ok: true, activa: oferta.activa, nombre: oferta.nombre });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ofertas/:id → Eliminar oferta
router.delete('/api/ofertas/:id', requierePermiso('Carta'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.oferta.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
