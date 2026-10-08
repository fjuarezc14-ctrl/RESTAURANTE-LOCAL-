// Rutas de productos de la carta
const express = require('express');
const { prisma } = require('../db');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { productoEdicion, productoNuevo } = require('../../shared/esquemas/carta.js');
const { requierePermiso } = require('../middlewares/permisos');
const { registrarAuditoria } = require('../servicios/auditoria');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// PRODUCTOS (CARTA)
// ============================================================

router.get('/api/productos', async (req, res, next) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });

    // Las ofertas por temporada se retiraron del sistema: los productos se venden a su precio normal.
    // (Se mantienen precioOferta/ofertaNombre en null por compatibilidad con Salón y Caja.)
    const productosEnriquecidos = productos.map(p => ({ ...p, precioOferta: null, ofertaNombre: null }));

    res.json(productosEnriquecidos);
  } catch (err) {
    next(err);
  }
});

router.post('/api/productos', requierePermiso('Carta'), validar({ body: productoNuevo }), async (req, res, next) => {
  try {
    const { nombre, categoria, precio, tipoStock, stock, requiereGuarnicion, opcionesConfig, componentes, complementos } = req.body;

    const prod = await prisma.producto.create({
      data: {
        nombre: String(nombre),
        categoria: String(categoria),
        precio: parseFloat(precio),
        tipoStock: tipoStock ? String(tipoStock) : 'ilimitado',
        stock: stock ? parseInt(stock) : 0,
        requiereGuarnicion: requiereGuarnicion !== undefined ? Boolean(requiereGuarnicion) : false,
        opcionesConfig: opcionesConfig !== undefined ? (typeof opcionesConfig === 'string' ? opcionesConfig : JSON.stringify(opcionesConfig)) : null,
        componentes: componentes ? (typeof componentes === 'string' ? componentes : JSON.stringify(componentes)) : null,
        complementos: complementos ? (typeof complementos === 'string' ? complementos : JSON.stringify(complementos)) : null,
      }
    });
    res.json(prod);
  } catch (err) {
    next(err);
  }
});

router.put('/api/productos/:id', requierePermiso('Carta'), validar({ body: productoEdicion }), async (req, res, next) => {
  try {
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.categoria !== undefined) data.categoria = String(req.body.categoria);
    if (req.body.requiereGuarnicion !== undefined) data.requiereGuarnicion = Boolean(req.body.requiereGuarnicion);
    if (req.body.opcionesConfig !== undefined) {
      data.opcionesConfig = req.body.opcionesConfig ? (typeof req.body.opcionesConfig === 'string' ? req.body.opcionesConfig : JSON.stringify(req.body.opcionesConfig)) : null;
    }
    if (req.body.componentes !== undefined) {
      data.componentes = req.body.componentes ? (typeof req.body.componentes === 'string' ? req.body.componentes : JSON.stringify(req.body.componentes)) : null;
    }
    if (req.body.complementos !== undefined) {
      data.complementos = req.body.complementos ? (typeof req.body.complementos === 'string' ? req.body.complementos : JSON.stringify(req.body.complementos)) : null;
    }
    if (req.body.precio !== undefined) data.precio = parseFloat(req.body.precio);
    if (req.body.tipoStock !== undefined) data.tipoStock = String(req.body.tipoStock);
    if (req.body.stock !== undefined) data.stock = parseInt(req.body.stock);
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    const id = parseInt(req.params.id);
    const prod = await prisma.$transaction(async (tx) => {
      const antes = await tx.producto.findUnique({ where: { id }, select: { nombre: true, precio: true } });
      const actualizado = await tx.producto.update({ where: { id }, data });
      if (antes && data.precio !== undefined && Number(antes.precio) !== Number(actualizado.precio)) {
        await registrarAuditoria(tx, req, {
          accion: 'PRECIO_CAMBIADO', entidad: 'Producto', entidadId: id,
          antes: { nombre: antes.nombre, precio: antes.precio }, despues: { nombre: actualizado.nombre, precio: actualizado.precio },
        });
      }
      return actualizado;
    });
    res.json(prod);
  } catch (err) {
    next(err);
  }
});

router.delete('/api/productos/:id', requierePermiso('Carta'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const prod = await tx.producto.update({ where: { id }, data: { activo: false } });
      await registrarAuditoria(tx, req, {
        accion: 'PRODUCTO_ELIMINADO', entidad: 'Producto', entidadId: id, antes: { nombre: prod.nombre, precio: prod.precio, activo: true },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
