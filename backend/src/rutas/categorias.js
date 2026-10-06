// Rutas de categorías de la carta
const express = require('express');
const { prisma } = require('../db');
const { COLORES_CATEGORIA, actualizarDestinoCategoria, mismoNombre, renombrarCategoriaEnOfertas, sincronizarCategorias } = require('../servicios/categorias');
const { getEmpresaConfig, isBarraCategoria } = require('../servicios/empresa');
const { ErrorApp } = require('../middlewares/errores');
const { validarIdsEnUrl } = require('../middlewares/validar');

const router = express.Router();
validarIdsEnUrl(router);

// GET /api/categorias → Categorías con destino y cantidad de productos
router.get('/api/categorias', async (req, res, next) => {
  try {
    await getEmpresaConfig();
    await sincronizarCategorias();
    const categorias = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
    const conteo = await prisma.producto.groupBy({ by: ['categoria'], where: { activo: true }, _count: { _all: true } });
    res.json(categorias.map(c => ({
      ...c,
      destino: isBarraCategoria(c.nombre) ? 'barra' : 'cocina',
      productos: conteo.find(x => x.categoria === c.nombre)?._count._all || 0,
    })));
  } catch (err) {
    next(err);
  }
});

// POST /api/categorias → Crear categoría
router.post('/api/categorias', async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const destino = req.body.destino === 'barra' ? 'barra' : 'cocina';
    const color = COLORES_CATEGORIA.includes(req.body.color) ? req.body.color : (destino === 'barra' ? 'sky' : 'amber');
    if (!nombre) return next(new ErrorApp('VALIDACION', 'Escribe el nombre de la categoría.', { campo: 'nombre' }));

    const todas = await prisma.categoria.findMany({ select: { nombre: true } });
    if (todas.some(c => mismoNombre(c.nombre, nombre))) {
      return next(new ErrorApp('YA_EXISTE', `Ya existe la categoría "${nombre}".`, { campo: 'nombre' }));
    }

    await getEmpresaConfig();
    const cat = await prisma.$transaction(async (tx) => {
      const creada = await tx.categoria.create({ data: { nombre, color } });
      await actualizarDestinoCategoria(tx, null, nombre, destino === 'barra');
      return creada;
    });
    res.json({ ...cat, destino, productos: 0 });
  } catch (err) {
    next(err);
  }
});

// PUT /api/categorias/:id → Renombrar, cambiar destino o color (arrastra los productos)
router.put('/api/categorias/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const actual = await prisma.categoria.findUnique({ where: { id } });
    if (!actual) return next(new ErrorApp('NO_ENCONTRADO', 'Categoría no encontrada.'));

    const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim() : actual.nombre;
    if (!nombre) return next(new ErrorApp('VALIDACION', 'Escribe el nombre de la categoría.', { campo: 'nombre' }));
    await getEmpresaConfig();
    const esBarra = req.body.destino !== undefined ? req.body.destino === 'barra' : isBarraCategoria(actual.nombre);
    const color = COLORES_CATEGORIA.includes(req.body.color) ? req.body.color : actual.color;

    if (nombre !== actual.nombre) {
      const otras = await prisma.categoria.findMany({ where: { id: { not: id } }, select: { nombre: true } });
      if (otras.some(c => mismoNombre(c.nombre, nombre))) {
        return next(new ErrorApp('YA_EXISTE', `Ya existe la categoría "${nombre}".`, { campo: 'nombre' }));
      }
    }

    const cat = await prisma.$transaction(async (tx) => {
      const editada = await tx.categoria.update({ where: { id }, data: { nombre, color } });
      if (nombre !== actual.nombre) {
        await tx.producto.updateMany({ where: { categoria: actual.nombre }, data: { categoria: nombre } });
        await renombrarCategoriaEnOfertas(tx, actual.nombre, nombre);
      }
      await actualizarDestinoCategoria(tx, actual.nombre, nombre, esBarra);
      return editada;
    });
    res.json({ ...cat, destino: esBarra ? 'barra' : 'cocina' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categorias/:id?moverA=Nombre → Eliminar; si tiene productos se deben mover a otra
router.delete('/api/categorias/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const actual = await prisma.categoria.findUnique({ where: { id } });
    if (!actual) return next(new ErrorApp('NO_ENCONTRADO', 'Categoría no encontrada.'));

    const moverA = req.query.moverA ? String(req.query.moverA).trim() : '';
    const enUso = await prisma.producto.count({ where: { categoria: actual.nombre, activo: true } });

    if (enUso > 0) {
      if (!moverA) {
        return next(new ErrorApp('CONFLICTO', `La categoría tiene ${enUso} producto(s). Elige a dónde moverlos.`, { datos: { productos: enUso } }));
      }
      const destino = await prisma.categoria.findUnique({ where: { nombre: moverA } });
      if (!destino || destino.id === id) return next(new ErrorApp('VALIDACION', 'Elige otra categoría válida para mover los productos.', { campo: 'moverA' }));
    }

    await getEmpresaConfig();
    await prisma.$transaction(async (tx) => {
      if (enUso > 0) {
        await tx.producto.updateMany({ where: { categoria: actual.nombre }, data: { categoria: moverA } });
      }
      await renombrarCategoriaEnOfertas(tx, actual.nombre, null);
      await actualizarDestinoCategoria(tx, actual.nombre, null, false);
      await tx.categoria.delete({ where: { id } });
    });
    res.json({ ok: true, movidos: enUso });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
