// Rutas de productos de la carta
const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// ============================================================
// PRODUCTOS (CARTA)
// ============================================================

router.get('/api/productos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/productos', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/productos/:id', async (req, res) => {
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

    const prod = await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(prod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/productos/:id', async (req, res) => {
  try {
    await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data: { activo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
