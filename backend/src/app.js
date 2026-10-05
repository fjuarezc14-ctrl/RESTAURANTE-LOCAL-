require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// <modulos>
const { prisma } = require('./db');
const { loginRateLimiter, registerLoginFailure, registerLoginSuccess } = require('./middlewares/limiteLogin');
const { generarPinSignature } = require('./servicios/auth');
const { COLORES_CATEGORIA, actualizarDestinoCategoria, mismoNombre, renombrarCategoriaEnOfertas, sincronizarCategorias } = require('./servicios/categorias');
const { calcularSubtotalEIgv, limpiarCodigoPago, obtenerMontosVenta, parsearCreditoSplit } = require('./servicios/dinero');
const { getEmpresaConfig, isBarraCategoria } = require('./servicios/empresa');
// </modulos>

const app = express();

app.use(cors());
app.use(express.json());

// <rutas>
app.use(require('./rutas/configuracion'));
app.use(require('./rutas/clientes'));
app.use(require('./rutas/mesas'));
app.use(require('./rutas/pedidos'));
app.use(require('./rutas/delivery'));
app.use(require('./rutas/productos'));
// </rutas>

// GET /api/categorias → Categorías con destino y cantidad de productos
app.get('/api/categorias', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categorias → Crear categoría
app.post('/api/categorias', async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const destino = req.body.destino === 'barra' ? 'barra' : 'cocina';
    const color = COLORES_CATEGORIA.includes(req.body.color) ? req.body.color : (destino === 'barra' ? 'sky' : 'amber');
    if (!nombre) return res.status(400).json({ error: 'Escribe el nombre de la categoría.' });

    const todas = await prisma.categoria.findMany({ select: { nombre: true } });
    if (todas.some(c => mismoNombre(c.nombre, nombre))) {
      return res.status(409).json({ error: `Ya existe la categoría "${nombre}".` });
    }

    await getEmpresaConfig();
    const cat = await prisma.$transaction(async (tx) => {
      const creada = await tx.categoria.create({ data: { nombre, color } });
      await actualizarDestinoCategoria(tx, null, nombre, destino === 'barra');
      return creada;
    });
    res.json({ ...cat, destino, productos: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categorias/:id → Renombrar, cambiar destino o color (arrastra los productos)
app.put('/api/categorias/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actual = await prisma.categoria.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Categoría no encontrada.' });

    const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim() : actual.nombre;
    if (!nombre) return res.status(400).json({ error: 'Escribe el nombre de la categoría.' });
    await getEmpresaConfig();
    const esBarra = req.body.destino !== undefined ? req.body.destino === 'barra' : isBarraCategoria(actual.nombre);
    const color = COLORES_CATEGORIA.includes(req.body.color) ? req.body.color : actual.color;

    if (nombre !== actual.nombre) {
      const otras = await prisma.categoria.findMany({ where: { id: { not: id } }, select: { nombre: true } });
      if (otras.some(c => mismoNombre(c.nombre, nombre))) {
        return res.status(409).json({ error: `Ya existe la categoría "${nombre}".` });
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categorias/:id?moverA=Nombre → Eliminar; si tiene productos se deben mover a otra
app.delete('/api/categorias/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actual = await prisma.categoria.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Categoría no encontrada.' });

    const moverA = req.query.moverA ? String(req.query.moverA).trim() : '';
    const enUso = await prisma.producto.count({ where: { categoria: actual.nombre, activo: true } });

    if (enUso > 0) {
      if (!moverA) {
        return res.status(409).json({ error: `La categoría tiene ${enUso} producto(s). Elige a dónde moverlos.`, productos: enUso });
      }
      const destino = await prisma.categoria.findUnique({ where: { nombre: moverA } });
      if (!destino || destino.id === id) return res.status(400).json({ error: 'Elige otra categoría válida para mover los productos.' });
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
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// OFERTAS POR TEMPORADA
// ============================================================

// GET /api/ofertas → Listar todas las ofertas
app.get('/api/ofertas', async (req, res) => {
  try {
    const ofertas = await prisma.oferta.findMany({ orderBy: { creadoEn: 'desc' } });
    res.json(ofertas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ofertas → Crear nueva oferta (solo Admin)
app.post('/api/ofertas', async (req, res) => {
  try {
    const { nombre, descripcion, tipoDescuento, valorDescuento, categorias, activa, fechaInicio, fechaFin, creadoPor } = req.body;
    if (!nombre || !tipoDescuento || valorDescuento == null || !categorias || !creadoPor) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, tipoDescuento, valorDescuento, categorias, creadoPor' });
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ofertas/:id → Editar oferta
app.put('/api/ofertas/:id', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ofertas/:id/activar → Activar o desactivar oferta
app.patch('/api/ofertas/:id/activar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { activa } = req.body;
    const oferta = await prisma.oferta.update({
      where: { id },
      data: { activa: Boolean(activa) }
    });
    res.json({ ok: true, activa: oferta.activa, nombre: oferta.nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ofertas/:id → Eliminar oferta
app.delete('/api/ofertas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.oferta.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USUARIOS
// ============================================================

app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// El rol Administrador siempre tiene acceso a todos los módulos
const PERMISOS_ADMINISTRADOR = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Creditos', 'Compras', 'Reportes', 'Carta', 'Categorias', 'Usuarios'];

app.post('/api/usuarios', async (req, res) => {
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

app.put('/api/usuarios/:id', async (req, res) => {
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

app.post('/api/usuarios/login', loginRateLimiter, async (req, res) => {
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

app.post('/api/usuarios/validate-auth', async (req, res) => {
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

app.get('/api/usuarios/check/:id', async (req, res) => {
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

app.delete('/api/usuarios/:id', async (req, res) => {
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

// ============================================================
// CAJA / VENTAS
// ============================================================

// PATCH /api/ventas/:ventaId/metodo-pago → Corregir método de pago (requiere PIN Administrador)
app.patch('/api/ventas/:ventaId/metodo-pago', async (req, res) => {
  const { ventaId } = req.params;
  const { metodoPago, pin, montoEfectivo, montoTarjeta, montoYape, montoCredito, clienteCreditoId } = req.body;

  const metodosPermitidos = ['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto', 'Crédito'];
  if (!metodoPago || !metodosPermitidos.includes(metodoPago)) {
    return res.status(400).json({ error: `Método de pago inválido. Opciones: ${metodosPermitidos.join(', ')}` });
  }
  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar el método de pago.' });
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    const pedido = venta.pedido;
    if (!pedido) return res.status(404).json({ error: 'Pedido asociado no encontrado.' });

    const metodoPagoAnterior = venta.metodoPago;

    // Calcular costo original del pedido
    const baseItemsTotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    let shippingFee = 0;
    if (pedido.tipoEntrega === 'delivery' && pedido.codigoPedidosYa?.startsWith('DELIVERY -')) {
      const matchEnvio = pedido.codigoPedidosYa.match(/\[E:(\d+\.?\d*)\]/);
      if (matchEnvio && matchEnvio[1]) {
        shippingFee = parseFloat(matchEnvio[1]);
      }
    }
    const originalTotal = baseItemsTotal + shippingFee;
    const desc = parseFloat(venta.descuentoAplicado || 0);

    // Si el nuevo método es Cortesía, el total va a 0.00; de lo contrario, preservar el descuento original
    const nuevoTotal = metodoPago === 'Cortesía' ? 0.00 : Math.max(0, parseFloat((originalTotal - desc).toFixed(2)));
    const { subtotal, igv } = calcularSubtotalEIgv(nuevoTotal);

    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;

    if (metodoPago === 'Mixto') {
      finalMontoEfectivo = parseFloat(montoEfectivo || 0);
      finalMontoTarjeta = parseFloat(montoTarjeta || 0);
      finalMontoYape = parseFloat(montoYape || 0);
      finalMontoCredito = parseFloat(montoCredito || 0);
    } else if (metodoPago === 'Efectivo') {
      finalMontoEfectivo = nuevoTotal;
    } else if (metodoPago === 'Tarjeta') {
      finalMontoTarjeta = nuevoTotal;
    } else if (metodoPago === 'Yape') {
      finalMontoYape = nuevoTotal;
    } else if (metodoPago === 'Crédito') {
      finalMontoCredito = nuevoTotal;
    }

    if (finalMontoCredito > 0 && !clienteCreditoId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para registrar la venta a crédito.' });
    }

    // Actualizar Venta
    const ventaActualizada = await prisma.venta.update({
      where: { id: parseInt(ventaId) },
      data: {
        metodoPago,
        total: nuevoTotal,
        subtotal,
        igv,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape,
        montoCredito: finalMontoCredito,
        clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null
      },
    });

    // Actualizar Pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        total: nuevoTotal
      }
    });

    console.log(`🔄 Método de pago corregido por ${admin.nombre} (${admin.rol}): Venta #${ventaId} → ${metodoPagoAnterior} (S/ ${venta.total.toFixed(2)}) → ${metodoPago} (S/ ${nuevoTotal.toFixed(2)})`);

    res.json({ ok: true, ventaId: ventaActualizada.id, metodoPago: ventaActualizada.metodoPago, cambiadoPor: admin.nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ventas/:ventaId/tipo-entrega → Corregir tipo de entrega (PedidosYa, Para Llevar, Delivery)
app.patch('/api/ventas/:ventaId/tipo-entrega', async (req, res) => {
  const { ventaId } = req.params;
  const {
    tipoEntrega, // "ParaLlevar", "DeliveryPropio", "PedidosYa"
    codigoPedidosYa,
    nombreCliente,
    telefono,
    direccion,
    montoDelivery,
    montoConCuanto,
    metodoPago, // 'Efectivo' | 'Tarjeta' | 'Yape'
    pin
  } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar el tipo de entrega.' });
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    const pedido = venta.pedido;
    if (!pedido) return res.status(404).json({ error: 'Pedido asociado no encontrado.' });

    // Calcular el costo base de los ítems del pedido
    const baseItemsTotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    let nuevoTotal = baseItemsTotal;
    let finalCodigo = '';
    let finalNombre = nombreCliente || 'CONSUMIDOR FINAL';
    let finalMetodoPago = metodoPago || 'Efectivo';
    let nuevoTipoEntrega = 'llevar';

    if (tipoEntrega === 'PedidosYa') {
      nuevoTipoEntrega = 'llevar';
      finalCodigo = codigoPedidosYa ? String(codigoPedidosYa) : 'S/D';
      finalNombre = 'PEDIDOS YA';
      finalMetodoPago = 'PedidosYa';
    } else if (tipoEntrega === 'ParaLlevar') {
      nuevoTipoEntrega = 'llevar';
      finalCodigo = `LLEVAR - ${finalNombre.toUpperCase()}`;
    } else if (tipoEntrega === 'DeliveryPropio') {
      nuevoTipoEntrega = 'delivery';
      const shippingFee = parseFloat(montoDelivery || 0);
      nuevoTotal = baseItemsTotal + shippingFee;

      const tVal = telefono || 'S/D';
      const dVal = direccion || 'S/D';
      const eVal = shippingFee.toFixed(2);
      const cVal = parseFloat(montoConCuanto || 0).toFixed(2);

      finalCodigo = `DELIVERY - ${finalNombre.toUpperCase()} [T:${tVal}] [D:${dVal}] [E:${eVal}] [C:${cVal}]`;
      finalNombre = `DELIVERY - ${finalNombre.toUpperCase()} [T:${tVal}] [D:${dVal}] [E:${eVal}] [C:${cVal}]`;
    } else {
      return res.status(400).json({ error: 'Tipo de entrega inválido.' });
    }

    const { subtotal, igv } = calcularSubtotalEIgv(nuevoTotal);

    // Actualizar Pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        total: nuevoTotal,
        tipoEntrega: nuevoTipoEntrega,
        codigoPedidosYa: finalCodigo,
      }
    });

    // Actualizar Venta
    const ventaActualizada = await prisma.venta.update({
      where: { id: venta.id },
      data: {
        total: nuevoTotal,
        subtotal,
        igv,
        metodoPago: finalMetodoPago,
        nombreCliente: finalNombre,
        numDocumento: tipoEntrega === 'PedidosYa' ? finalCodigo : (venta.numDocumento || 'S/D'),
      }
    });

    console.log(`🔄 Tipo de entrega corregido por ${admin.nombre} (${admin.rol}): Venta #${ventaId} a ${tipoEntrega}`);

    res.json({ ok: true, ventaId: ventaActualizada.id, cambiadoPor: admin.nombre });
  } catch (err) {
    console.error('Error al cambiar tipo de entrega:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

// PATCH /api/ventas/:ventaId/datos-cliente → Corregir datos de facturación / datos de cliente de una venta
app.patch('/api/ventas/:ventaId/datos-cliente', async (req, res) => {
  const { ventaId } = req.params;
  const {
    tipoComprobante, // "Boleta" | "Factura" | "Ticket"
    numDocumento,
    nombreCliente,
    clienteDireccion,
    pin
  } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar los datos del cliente.' });
    }

    // Obtener la venta
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    // Actualizar datos
    const ventaActualizada = await prisma.$transaction(async (tx) => {
      // Se conserva como ticket de venta: no se emiten comprobantes electrónicos
      const newSerie = null;
      const newNumero = null;
      const newEstado = 'NO_APLICA';
      const newEstadoNube = 'NO_APLICA';

      return await tx.venta.update({
        where: { id: venta.id },
        data: {
          tipoComprobante: 'Ticket',
          numDocumento: numDocumento || null,
          nombreCliente: nombreCliente || null,
          clienteDireccion: clienteDireccion || null,
          serie: newSerie,
          numero: newNumero,
          estadoSunat: newEstado,
          estadoNubefact: newEstadoNube
        }
      });
    });

    console.log(`🔄 Datos de cliente corregidos por ${admin.nombre} (${admin.rol}): Venta #${ventaId}`);

    res.json({ ok: true, venta: ventaActualizada, cambiadoPor: admin.nombre });
  } catch (err) {
    console.error('Error al cambiar datos de cliente:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

// PATCH /api/ventas/:ventaId/anular → Anular / Registrar devolución de un pedido entregado
app.patch('/api/ventas/:ventaId/anular', async (req, res) => {
  const { ventaId } = req.params;
  const { pin, motivo } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede anular o registrar devolución de ventas.' });
    }

    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: {
        pedido: {
          include: {
            items: { include: { producto: true } }
          }
        }
      }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    if (venta.anulado || venta.pedido?.estado === 'Cancelado') {
      return res.status(400).json({ error: 'Esta venta ya se encuentra anulada / devuelta.' });
    }

    const motivoFinal = motivo ? String(motivo).trim() : 'Devolución de pedido por cliente';
    const now = new Date();

    const ventaAnulada = await prisma.$transaction(async (tx) => {
      const vUpdated = await tx.venta.update({
        where: { id: venta.id },
        data: {
          anulado: true,
          motivoAnulacion: motivoFinal,
          anuladoPor: admin.nombre,
          anuladoEn: now,
          montoOriginal: venta.montoOriginal || venta.total,
          total: 0.00,
          subtotal: 0.00,
          igv: 0.00,
          montoEfectivo: 0.00,
          montoTarjeta: 0.00,
          montoYape: 0.00,
          montoCredito: 0.00,
          descuentoAplicado: 0.00
        }
      });

      if (venta.pedidoId) {
        await tx.pedido.update({
          where: { id: venta.pedidoId },
          data: {
            estado: 'Cancelado',
            motivoCancela: `[DEVOLUCIÓN CAJA]: ${motivoFinal}`,
            canceladoPor: admin.nombre,
            canceladoEn: now
          }
        });

        // Restaurar stock físico de los productos limitados devueltos
        if (venta.pedido?.items && Array.isArray(venta.pedido.items)) {
          for (const item of venta.pedido.items) {
            if (item.producto?.tipoStock === 'limitado') {
              await tx.producto.update({
                where: { id: item.productoId },
                data: { stock: { increment: item.cantidad } },
              });
            }
          }
        }
      }

      // Si la venta pertenece a un turno anterior y se pagó en efectivo, registrar la salida de la gaveta de hoy (BUG-06)
      const turnoAbierto = await tx.cierreCaja.findFirst({
        where: { estado: 'ABIERTO' },
        orderBy: { fechaApertura: 'desc' },
      });
      const ventaEfectivoPrevio = Number(venta.montoEfectivo) || (venta.metodoPago === 'Efectivo' ? Number(venta.total) : 0);
      if (turnoAbierto && ventaEfectivoPrevio > 0 && new Date(venta.createdAt) < new Date(turnoAbierto.fechaApertura)) {
        await tx.movimientoCaja.create({
          data: {
            tipo: 'RETIRO',
            monto: ventaEfectivoPrevio,
            motivo: `[DEVOLUCIÓN TICKET #${venta.id} DE TURNO PREVIO]: ${motivoFinal}`,
            cajeroNombre: admin.nombre,
            turnoId: turnoAbierto.id,
          }
        });
      }

      return vUpdated;
    });

    console.log(`🚫 Venta #${ventaId} anulada/devuelta por ${admin.nombre}. Motivo: ${motivoFinal}`);

    res.json({
      ok: true,
      venta: ventaAnulada,
      anuladoPor: admin.nombre,
      mensaje: 'Venta anulada y devuelta a S/ 0.00 con éxito.'
    });
  } catch (err) {
    console.error('Error al anular venta:', err);
    res.status(500).json({ error: 'Error al anular venta: ' + err.message });
  }
});

// POST /api/ventas → Cobrar mesa (acepta pedidoIds array o pedidoId simple)
app.post('/api/ventas', async (req, res) => {
  const {
    pedidoId,
    pedidoIds,
    tipoComprobante,
    numDocumento,
    nombreCliente,
    total,
    metodoPago,
    clienteDireccion,
    ofertaDescripcion,
    descuentoAplicado,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    creditosDetalle,
    cortesiaItemIds,
    motivoCortesia,
    cajeroNombre,
    codigoPago
  } = req.body;
  const idsAPagar = pedidoIds || [pedidoId];
  const idPrincipal = idsAPagar[idsAPagar.length - 1]; // El más reciente como venta principal

  try {
    // 0. Validar si la caja se encuentra abierta para procesar cobros (BUG-05)
    const turnoActivo = await prisma.cierreCaja.findFirst({ where: { estado: 'ABIERTO' } });
    if (!turnoActivo) {
      return res.status(400).json({
        error: 'La caja se encuentra cerrada. Debe aperturar un turno de caja antes de realizar cobros.',
        cajaCerrada: true,
      });
    }

    // 1. Validar si ya existe una venta asociada a estos pedidos (evita error de doble cobro por concurrencia)
    const ventaExistente = await prisma.venta.findFirst({
      where: { pedidoId: { in: idsAPagar } },
    });
    if (ventaExistente) {
      return res.json({
        ok: true,
        ventaId: ventaExistente.id,
        estadoNubefact: ventaExistente.estadoSunat,
        serie: ventaExistente.serie,
        numero: ventaExistente.numero,
        yaCobrado: true
      });
    }

    // 1.0 Una mesa de salón no se cobra mientras tenga platos en preparación:
    // al pasar a "Cobrado" desaparecerían de los monitores de cocina y barra sin prepararse.
    const enPreparacion = await prisma.pedido.findMany({
      where: { id: { in: idsAPagar }, estado: 'Cocina', tipoEntrega: 'salon' },
      select: { id: true, items: { where: { historial: false }, select: { cantidad: true } } },
    });
    if (enPreparacion.length > 0) {
      const pendientes = enPreparacion.reduce((s, p) => s + p.items.reduce((a, i) => a + i.cantidad, 0), 0);
      return res.status(409).json({
        error: `La mesa todavía tiene ${pendientes > 0 ? `${pendientes} plato(s)` : 'pedidos'} en preparación. Cóbrala cuando cocina y barra marquen todo como listo.`,
        enPreparacion: true,
      });
    }

    // 1.0b Tampoco se cobra si hay platos listos que el mozo aún no llevó a la mesa
    const porServir = await prisma.itemPedido.findMany({
      where: { pedidoId: { in: idsAPagar }, historial: true, entregado: false, pedido: { tipoEntrega: 'salon' } },
      select: { nombre: true, cantidad: true },
    });
    if (porServir.length > 0) {
      const detalle = porServir.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
      return res.status(409).json({
        error: `La mesa tiene platos que el mozo aún no ha servido: ${detalle}. Cóbrala cuando el mozo los marque como servidos.`,
        porServir: true,
      });
    }

    const venta = await prisma.$transaction(async (tx) => {
      // 1.1 Doble chequeo atómico dentro de la transacción (Race Condition Guard)
      const ventaExistenteTx = await tx.venta.findFirst({
        where: { pedidoId: { in: idsAPagar } },
      });
      if (ventaExistenteTx) {
        return { ...ventaExistenteTx, yaCobrado: true };
      }

      // Mover todos los items de los otros pedidos adicionales al pedido principal para que se consoliden en el detalle de la venta
      if (idsAPagar.length > 1) {
        const otrosIds = idsAPagar.filter(id => id !== idPrincipal);
        await tx.itemPedido.updateMany({
          where: { pedidoId: { in: otrosIds } },
          data: { pedidoId: idPrincipal },
        });
        await tx.pedido.updateMany({
          where: { id: { in: otrosIds } },
          data: { total: 0 },
        });
      }

      // Procesar cortesías individuales por ítem
      let itemsCortesiaDescuento = 0;
      if (cortesiaItemIds && Array.isArray(cortesiaItemIds) && cortesiaItemIds.length > 0) {
        const itemIds = cortesiaItemIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        const itemsAActualizar = await tx.itemPedido.findMany({
          where: { id: { in: itemIds } }
        });

        for (const item of itemsAActualizar) {
          itemsCortesiaDescuento += item.precio * item.cantidad;
          let nuevaNota = item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]';
          await tx.itemPedido.update({
            where: { id: item.id },
            data: {
              precio: 0.00,
              notas: nuevaNota
            }
          });
        }
      }

      // Recalcular el total consolidado del pedido principal en la DB
      const todosLosItemsPrincipal = await tx.itemPedido.findMany({
        where: { pedidoId: idPrincipal }
      });
      const nuevoTotalPedido = todosLosItemsPrincipal.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

      await tx.pedido.update({
        where: { id: idPrincipal },
        data: { total: nuevoTotalPedido }
      });

      const descVal = Math.max(0, parseFloat(descuentoAplicado || 0) || 0);
      const finalTotal = (metodoPago === 'Cortesía' || metodoPago === 'Consumo') 
        ? 0.00 
        : Math.max(0, Math.round((nuevoTotalPedido - descVal) * 100) / 100);
      const { subtotal, igv } = calcularSubtotalEIgv(finalTotal);

      let finalMontoEfectivo = 0;
      let finalMontoTarjeta = 0;
      let finalMontoYape = 0;
      let finalMontoCredito = 0;
      let finalClienteCreditoId = clienteCreditoId ? parseInt(clienteCreditoId) : null;
      let validCreditosSplits = [];

      if ((metodoPago === 'Crédito' || metodoPago === 'Mixto') && creditosDetalle && Array.isArray(creditosDetalle) && creditosDetalle.length > 0) {
        validCreditosSplits = creditosDetalle
          .map(c => ({
            clienteId: parseInt(c.clienteId || c.id),
            nombre: String(c.nombre || '').trim(),
            monto: parseFloat(c.monto || 0)
          }))
          .filter(c => !isNaN(c.clienteId) && c.clienteId > 0 && c.monto > 0);
      }

      if (metodoPago === 'Mixto') {
        finalMontoEfectivo = parseFloat(montoEfectivo || 0);
        finalMontoTarjeta = parseFloat(montoTarjeta || 0);
        finalMontoYape = parseFloat(montoYape || 0);
        if (validCreditosSplits.length > 0) {
          finalMontoCredito = validCreditosSplits.reduce((s, c) => s + c.monto, 0);
          finalClienteCreditoId = validCreditosSplits[0].clienteId;
        } else {
          finalMontoCredito = parseFloat(montoCredito || 0);
          finalClienteCreditoId = finalMontoCredito > 0 ? (clienteCreditoId ? parseInt(clienteCreditoId) : null) : null;
        }
      } else if (metodoPago === 'Efectivo') {
        finalMontoEfectivo = finalTotal;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Tarjeta') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = finalTotal;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Yape') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = finalTotal;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Crédito') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        if (validCreditosSplits.length > 0) {
          finalMontoCredito = validCreditosSplits.reduce((s, c) => s + c.monto, 0);
          finalClienteCreditoId = validCreditosSplits[0].clienteId;
        } else {
          finalMontoCredito = finalTotal;
          finalClienteCreditoId = clienteCreditoId ? parseInt(clienteCreditoId) : null;
        }
      } else if (metodoPago === 'Cortesía' || metodoPago === 'Consumo') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      }

      if (finalMontoCredito > 0 && !finalClienteCreditoId) {
        throw new Error('Debe seleccionar al menos un cliente para registrar la venta a crédito.');
      }

      // Solo se emiten tickets de venta: la boleta o factura la emite la empresa en el portal de SUNAT
      const serie = null;
      const numero = null;
      const initEstadoSunat = 'NO_APLICA';

      let descAplicado = descuentoAplicado ? parseFloat(descuentoAplicado) : 0;
      let descDescrip = ofertaDescripcion ? String(ofertaDescripcion) : null;
      const motivoStr = motivoCortesia && String(motivoCortesia).trim() ? ` (${String(motivoCortesia).trim()})` : '';
      if (metodoPago === 'Cortesía' || metodoPago === 'Consumo') {
        descAplicado = nuevoTotalPedido;
        descDescrip = metodoPago === 'Cortesía' ? `Cortesía total del pedido${motivoStr}` : `Consumo de personal${motivoStr}`;
      } else if (itemsCortesiaDescuento > 0) {
        descAplicado += itemsCortesiaDescuento;
        descDescrip = descDescrip ? `${descDescrip} + Cortesía de ítems${motivoStr}` : `Cortesía de ítems${motivoStr}`;
      }

      // Si hay splits múltiples de crédito, anexar la etiqueta a ofertaDescripcion solo si aplica
      if ((metodoPago === 'Crédito' || (metodoPago === 'Mixto' && finalMontoCredito > 0)) && validCreditosSplits.length > 0) {
        const splitTag = `[CREDITO_SPLIT:${JSON.stringify(validCreditosSplits)}]`;
        descDescrip = descDescrip ? `${descDescrip} ${splitTag}` : splitTag;
      }

      const ventaCreada = await tx.venta.create({
        data: {
          pedidoId: idPrincipal,
          tipoComprobante: 'Ticket',
          numDocumento,
          nombreCliente: (metodoPago === 'Cortesía' || metodoPago === 'Consumo') 
            ? (nombreCliente || 'CONSUMO PERSONAL / CORTESÍA') 
            : ((!nombreCliente || nombreCliente === 'PÚBLICO GENERAL') && validCreditosSplits.length > 0)
              ? validCreditosSplits.map(c => c.nombre).filter(Boolean).join(', ') || 'PÚBLICO GENERAL'
              : (nombreCliente || 'PÚBLICO GENERAL'),
          clienteDireccion: clienteDireccion || '',
          total: finalTotal,
          igv,
          subtotal,
          metodoPago,
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
          montoCredito: finalMontoCredito,
          clienteCreditoId: finalClienteCreditoId,
          codigoPago: limpiarCodigoPago(codigoPago, metodoPago, finalMontoTarjeta, finalMontoYape),
          estadoNubefact: initEstadoSunat,
          estadoSunat: initEstadoSunat,
          serie,
          numero,
          ofertaDescripcion: descDescrip,
          descuentoAplicado: descAplicado,
          cajeroNombre: cajeroNombre ? String(cajeroNombre).trim() : null,
        },
      });

      // Auto-registro silencioso en Directorio de Clientes (Consumo, sin crédito)
      const cleanNom = String(nombreCliente || '').trim();
      const esNombreGenerico = !cleanNom || ['PÚBLICO GENERAL', 'CONSUMIDOR FINAL', 'PEDIDOS YA', 'CONSUMO PERSONAL / CORTESÍA'].includes(cleanNom.toUpperCase());
      const cleanDoc = numDocumento && String(numDocumento).trim().length >= 8 && !['S/D', '00000000', '0'].includes(String(numDocumento).trim())
        ? String(numDocumento).trim()
        : null;

      if (!esNombreGenerico) {
        let cExistente = null;
        if (cleanDoc) {
          cExistente = await tx.cliente.findFirst({ where: { numDoc: cleanDoc } });
        }
        if (!cExistente) {
          cExistente = await tx.cliente.findFirst({
            where: { nombre: { equals: cleanNom, mode: 'insensitive' } }
          });
        }

        if (!cExistente) {
          await tx.cliente.create({
            data: {
              nombre: cleanNom,
              tipoDoc: cleanDoc ? (cleanDoc.length === 11 ? 'RUC' : 'DNI') : 'DNI',
              numDoc: cleanDoc || null,
              direccion: clienteDireccion ? String(clienteDireccion).trim() : null,
              tieneCredito: false, // Cliente regular de consumo
              esTrabajador: false,
              activo: true,
            }
          }).catch(() => null);
        } else if (!cExistente.direccion && clienteDireccion) {
          await tx.cliente.update({
            where: { id: cExistente.id },
            data: { direccion: String(clienteDireccion).trim() }
          }).catch(() => null);
        }
      }

      // Marcar TODOS los pedidos de la mesa como Cobrado
      await tx.pedido.updateMany({
        where: { id: { in: idsAPagar } },
        data: { estado: 'Cobrado' },
      });

      // Liberar la mesa
      const pedidoPrincipal = await tx.pedido.findUnique({ where: { id: idsAPagar[0] } });
      if (pedidoPrincipal?.mesaId) {
        const mObj = await tx.mesa.update({
          where: { id: pedidoPrincipal.mesaId },
          data: { estado: 'Libre' },
        });
        // Liberar automáticamente las mesas que estaban unidas a esta
        await tx.mesa.updateMany({
          where: { estado: `Unida a Mesa ${mObj.numero}` },
          data: { estado: 'Libre' },
        });
      }

      return ventaCreada;
    });

    if (venta.yaCobrado) {
      return res.json({
        ok: true,
        ventaId: venta.id,
        estadoNubefact: venta.estadoSunat,
        serie: venta.serie,
        numero: venta.numero,
        yaCobrado: true
      });
    }

    res.json({ ok: true, ventaId: venta.id, estadoNubefact: venta.estadoSunat, serie: venta.serie || null, numero: venta.numero || null });
  } catch (err) {
    console.error('Error al procesar cobro:', err);
    if (err.code === 'P2002' || (err.message && err.message.includes('pedidoId'))) {
      const ventaExistente = await prisma.venta.findFirst({
        where: { pedidoId: { in: idsAPagar } },
      });
      if (ventaExistente) {
        return res.json({
          ok: true,
          ventaId: ventaExistente.id,
          estadoNubefact: ventaExistente.estadoSunat,
          serie: ventaExistente.serie,
          numero: ventaExistente.numero,
          yaCobrado: true
        });
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas → Historial detallado de las ventas del día o rango de fechas (hora Perú)
app.get('/api/ventas', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const ayerPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      ayerPeru.setDate(ayerPeru.getDate() - 1);
      ayerPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(ayerPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: filtroFecha
      },
      include: {
        pedido: {
          include: {
            items: true,
            mesa: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formateadas = ventas.map(v => ({
      id: v.id,
      pedidoId: v.pedidoId,
      tipoComprobante: v.tipoComprobante,
      numDocumento: v.numDocumento,
      nombreCliente: v.nombreCliente,
      clienteDireccion: v.clienteDireccion || '',
      total: v.total,
      igv: v.igv,
      subtotal: v.subtotal,
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo,
      montoTarjeta: v.montoTarjeta,
      montoYape: v.montoYape,
      montoCredito: v.montoCredito || 0,
      clienteCreditoId: v.clienteCreditoId || null,
      ofertaDescripcion: v.ofertaDescripcion || null,
      descuentoAplicado: v.descuentoAplicado || 0,
      creditoSplit: parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, v.montoCredito || (v.metodoPago === 'Crédito' ? v.total : 0)),
      anulado: v.anulado || v.pedido?.estado === 'Cancelado',
      motivoAnulacion: v.motivoAnulacion || v.pedido?.motivoCancela || null,
      anuladoPor: v.anuladoPor || v.pedido?.canceladoPor || null,
      anuladoEn: v.anuladoEn || v.pedido?.canceladoEn || null,
      montoOriginal: v.montoOriginal || null,
      hora: v.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      mesaNum: v.pedido?.mesa?.numero || null,
      mesero: v.pedido?.mesero || null,
      cajeroNombre: v.cajeroNombre || 'Cajero Principal',
      codigoPago: v.codigoPago || null,
      codigoPedidosYa: v.pedido?.codigoPedidosYa || null,
      tipoEntrega: v.pedido?.tipoEntrega || 'salon',
      estadoPedido: v.pedido?.estado || null,
      createdAt: v.createdAt.toISOString(),
      estadoNubefact: v.estadoNubefact,
      serie: v.serie,
      numero: v.numero,
      itemsResumen: v.pedido?.items
        ?.filter(i => !i.esComponente)
        ?.map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || '',

      items: v.pedido?.items
        ?.filter(i => !i.esComponente)
        ?.map(i => ({
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio
        })) || [],
    }));

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas/resumen → Estadísticas del día (hora Perú)
app.get('/api/ventas/resumen', async (req, res) => {
  try {
    const { desde } = req.query;
    let filterDate;
    if (desde) {
      filterDate = new Date(desde);
    } else {
      // Inicio del día operativo a las 3:00 AM en UTC-5
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      filterDate = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
    }

    const [ventas, abonos, clientes] = await Promise.all([
      prisma.venta.findMany({
        where: {
          createdAt: { gte: filterDate },
          pedido: { estado: { not: 'Cancelado' } }
        },
      }),
      prisma.abonoCredito.findMany({
        where: {
          creadoEn: { gte: filterDate }
        }
      }),
      prisma.cliente.findMany()
    ]);

    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    const totalIGVVentas = ventas.reduce((s, v) => s + v.igv, 0);
    const atendidas = ventas.length;

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalYape = 0;

    ventas.forEach(v => {
      const { efec, tarj, yape } = obtenerMontosVenta(v);
      totalEfectivo += efec;
      totalTarjeta += tarj;
      totalYape += yape;
    });

    // Sumar abonos a la caja física
    abonos.forEach(a => {
      totalEfectivo += a.montoEfectivo || 0;
      totalTarjeta += a.montoTarjeta || 0;
      totalYape += a.montoYape || 0;
    });

    const ingresosCaja = totalEfectivo + totalTarjeta + totalYape;
    const ingresosPedidosYa = ventas
      .filter(v => v.metodoPago === 'PedidosYa')
      .reduce((s, v) => s + v.total, 0);

    const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
    let consumoClientes = 0;
    let consumoPlanilla = 0;

    ventas.forEach(v => {
      if (v.metodoPago === 'Consumo') {
        consumoPlanilla += (v.descuentoAplicado || v.total);
      } else {
        const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
        if (splits.length > 0) {
          splits.forEach(s => {
            const esTrab = clienteMap.get(s.clienteId) || false;
            if (esTrab) {
              consumoPlanilla += s.monto;
            } else {
              consumoClientes += s.monto;
            }
          });
        } else if (v.metodoPago === 'Crédito') {
          consumoClientes += v.total;
        } else if (parseFloat(v.montoCredito || 0) > 0) {
          consumoClientes += parseFloat(v.montoCredito);
        }
      }
    });

    const totalCortesias = ventas
      .filter(v => v.metodoPago === 'Cortesía')
      .reduce((s, v) => s + (v.descuentoAplicado || v.total), 0);

    const porMetodoPago = {
      Efectivo: totalEfectivo,
      Tarjeta: totalTarjeta,
      Yape: totalYape,
      PedidosYa: ingresosPedidosYa,
      ConsumoPlanilla: consumoPlanilla,
      ConsumoClientes: consumoClientes,
      Cortesía: totalCortesias,
    };

    res.json({
      atendidas,
      ingresos: totalVentas,
      ingresosCaja,
      ingresosPedidosYa,
      consumoPlanilla,
      consumoClientes,
      totalCortesias,
      porMetodoPago,
      igvVentas: totalIGVVentas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CIERRES DE CAJA Y ARQUEOS PERSISTENTES (PostgreSQL)
// ============================================================

// GET /api/caja/estado → Estado en vivo de la caja (ABIERTO / CERRADO) y supervisión en tiempo real
app.get('/api/caja/estado', async (req, res) => {
  try {
    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    const ultimoCerrado = await prisma.cierreCaja.findFirst({
      where: { estado: 'CERRADO' },
      orderBy: { fechaCierre: 'desc' },
    });

    if (!turnoAbierto) {
      return res.json({
        ok: true,
        abierto: false,
        turno: null,
        ultimoCierre: ultimoCerrado,
      });
    }

    // Si hay un turno abierto, calcular métricas en vivo desde fechaApertura
    const desde = turnoAbierto.fechaApertura;
    const [ventas, movimientos, abonos] = await Promise.all([
      prisma.venta.findMany({
        where: {
          createdAt: { gte: desde },
          anulado: false,
          pedido: { estado: { not: 'Cancelado' } },
        },
        select: {
          total: true,
          montoEfectivo: true,
          montoTarjeta: true,
          montoYape: true,
          montoCredito: true,
          metodoPago: true,
          anulado: true,
          pedido: { select: { estado: true } }
        },
      }),
      prisma.movimientoCaja.findMany({
        where: {
          OR: [
            { turnoId: turnoAbierto.id },
            { creadoEn: { gte: desde } },
          ],
        },
        orderBy: { creadoEn: 'desc' },
      }),
      prisma.abonoCredito.findMany({
        where: {
          creadoEn: { gte: desde },
        },
        select: { montoEfectivo: true, montoTarjeta: true, montoYape: true, monto: true, metodoPago: true },
      }),
    ]);

    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    let ventasYape = 0;
    let ventasPedidosYa = 0;
    let ventasConsumo = 0;
    let totalVentas = 0;

    for (const v of ventas) {
      totalVentas += Number(v.total) || 0;
      const { efec, tarj, yape } = obtenerMontosVenta(v);
      ventasEfectivo += efec;
      ventasTarjeta += tarj;
      ventasYape += yape;
      if (v.metodoPago === 'PedidosYa') ventasPedidosYa += Number(v.total) || 0;
      if (v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía') ventasConsumo += Number(v.total) || 0;
    }

    const retirosCaja = movimientos.filter(m => m.tipo === 'RETIRO').reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const ingresosExtra = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + (Number(m.monto) || 0), 0);

    // Sumar abonos a todos los métodos para coincidencia exacta con el arqueo
    const abonosEfectivo = abonos.reduce((s, a) => s + (Number(a.montoEfectivo) || (a.metodoPago === 'Efectivo' ? Number(a.monto) : 0)), 0);
    const abonosTarjeta = abonos.reduce((s, a) => s + (Number(a.montoTarjeta) || (a.metodoPago === 'Tarjeta' ? Number(a.monto) : 0)), 0);
    const abonosYape = abonos.reduce((s, a) => s + (Number(a.montoYape) || (a.metodoPago === 'Yape' ? Number(a.monto) : 0)), 0);

    ventasTarjeta += abonosTarjeta;
    ventasYape += abonosYape;

    const fondoInicial = Number(turnoAbierto.montoInicial) || 0;
    const efectivoEsperadoEnGaveta = Math.max(0, fondoInicial + ventasEfectivo + abonosEfectivo + ingresosExtra - retirosCaja);

    res.json({
      ok: true,
      abierto: true,
      turno: turnoAbierto,
      ultimoCierre: ultimoCerrado,
      resumenEnVivo: {
        montoInicial: fondoInicial,
        cajeroNombre: turnoAbierto.cajeroNombre,
        fechaApertura: turnoAbierto.fechaApertura,
        ventasEfectivo,
        ventasTarjeta,
        ventasYape,
        ventasPedidosYa,
        ventasConsumo,
        totalVentas,
        cantidadVentas: ventas.length,
        egresosEfectivo: retirosCaja,
        retirosCaja,
        ingresosExtra,
        movimientos,
        abonosEfectivo,
        abonosTarjeta,
        abonosYape,
        efectivoEsperadoEnGaveta,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/caja/movimientos → Registrar salida (retiro de emergencia) o ingreso extra en la gaveta
app.post('/api/caja/movimientos', async (req, res) => {
  try {
    const { monto, motivo, tipo = 'RETIRO', cajeroNombre } = req.body;
    const parsedMonto = parseFloat(monto || 0);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0.' });
    }
    if (!motivo || !String(motivo).trim()) {
      return res.status(400).json({ error: 'Debe especificar el motivo del retiro o salida de caja.' });
    }

    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });
    if (!turnoAbierto) {
      return res.status(400).json({ error: 'No se pueden registrar salidas de dinero con la caja cerrada.' });
    }

    const mov = await prisma.movimientoCaja.create({
      data: {
        turnoId: turnoAbierto.id,
        tipo: tipo === 'INGRESO' ? 'INGRESO' : 'RETIRO',
        monto: parsedMonto,
        motivo: String(motivo).trim(),
        cajeroNombre: cajeroNombre ? String(cajeroNombre).trim() : turnoAbierto.cajeroNombre,
      },
    });

    console.log(`💸 Movimiento de Caja registrado [${mov.tipo}]: S/ ${mov.monto.toFixed(2)} - "${mov.motivo}" por ${mov.cajeroNombre}`);
    res.json({ ok: true, movimiento: mov });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/caja/movimientos → Listar salidas y movimientos del turno activo o histórico
app.get('/api/caja/movimientos', async (req, res) => {
  try {
    const { turnoId, desde, hasta } = req.query;
    let whereClause = {};

    if (desde && hasta) {
      // Rango de reportes: el día contable va de 03:00 a 02:59 (hora de Lima)
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      whereClause.creadoEn = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00'),
      };
    } else if (turnoId) {
      whereClause.turnoId = parseInt(turnoId);
    } else {
      const turnoAbierto = await prisma.cierreCaja.findFirst({
        where: { estado: 'ABIERTO' },
        orderBy: { fechaApertura: 'desc' },
      });
      if (!turnoAbierto) {
        return res.json({ ok: true, movimientos: [] });
      }
      whereClause = {
        OR: [
          { turnoId: turnoAbierto.id },
          { creadoEn: { gte: turnoAbierto.fechaApertura } },
        ],
      };
    }

    const movimientos = await prisma.movimientoCaja.findMany({
      where: whereClause,
      orderBy: { creadoEn: 'desc' },
    });
    res.json({ ok: true, movimientos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/caja/apertura → Registrar la apertura formal de turno con fondo inicial
app.post('/api/caja/apertura', async (req, res) => {
  try {
    const { cajeroNombre, montoInicial, notaApertura } = req.body;

    if (!cajeroNombre || !String(cajeroNombre).trim()) {
      return res.status(400).json({ error: 'El nombre del cajero es obligatorio para abrir la caja.' });
    }

    // Verificar si ya existe un turno abierto
    const turnoExistente = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
    });

    if (turnoExistente) {
      return res.status(400).json({
        error: `Ya existe un turno abierto por "${turnoExistente.cajeroNombre}" desde las ${new Date(turnoExistente.fechaApertura).toLocaleTimeString('es-PE')}. Debe cerrarse antes de abrir uno nuevo.`,
        turno: turnoExistente,
      });
    }

    const fondo = parseFloat(montoInicial || 0);

    const nuevoTurno = await prisma.cierreCaja.create({
      data: {
        estado: 'ABIERTO',
        fechaApertura: new Date(),
        fechaCierre: null,
        cajeroNombre: String(cajeroNombre).trim(),
        montoInicial: Math.max(0, isNaN(fondo) ? 0 : fondo),
        notaApertura: notaApertura ? String(notaApertura).trim() : null,
        efectivoVentas: 0,
        efectivoEsperado: 0,
        efectivoContado: 0,
        diferencia: 0,
      },
    });

    console.log(`🔓 Turno de Caja ABIERTO por ${cajeroNombre} con Fondo Inicial S/ ${nuevoTurno.montoInicial.toFixed(2)}`);
    res.json({ ok: true, turno: nuevoTurno });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/caja/cierre → Registrar un arqueo y cierre de turno
app.post('/api/caja/cierre', async (req, res) => {
  try {
    const {
      fechaApertura,
      fechaCierre,
      cajeroNombre,
      montoInicial,
      efectivoVentas,
      efectivoEsperado,
      efectivoContado,
      diferencia,
      totalTarjeta,
      totalYape,
      totalConsumo,
      totalPedidosYa,
      egresosEfectivo,
      abonosEfectivo,
      nota,
    } = req.body;

    if (!cajeroNombre) {
      return res.status(400).json({ error: 'El nombre del cajero es obligatorio.' });
    }

    // Buscar si hay un turno ABIERTO para cerrarlo
    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!turnoAbierto) {
      return res.status(400).json({ error: 'No hay un turno de caja abierto para cerrar. Debe abrir la caja primero.' });
    }

    // Validación de que ningún valor monetario sea negativo
    const camposMonetarios = [
      { nombre: 'Monto inicial', val: montoInicial },
      { nombre: 'Efectivo ventas', val: efectivoVentas },
      { nombre: 'Efectivo esperado', val: efectivoEsperado },
      { nombre: 'Efectivo contado', val: efectivoContado },
      { nombre: 'Total tarjeta', val: totalTarjeta },
      { nombre: 'Total yape', val: totalYape },
      { nombre: 'Total consumo', val: totalConsumo },
      { nombre: 'Total PedidosYa', val: totalPedidosYa },
      { nombre: 'Egresos de efectivo', val: egresosEfectivo },
      { nombre: 'Abonos de efectivo', val: abonosEfectivo },
    ];

    const campoInvalido = camposMonetarios.find(c => c.val !== undefined && c.val !== null && parseFloat(c.val) < 0);
    if (campoInvalido) {
      return res.status(400).json({ 
        error: `El valor de "${campoInvalido.nombre}" no puede ser negativo. Debe ser 0 o mayor a cero.` 
      });
    }

    const mInicial = Math.max(0, parseFloat(montoInicial !== undefined && montoInicial !== null ? montoInicial : turnoAbierto.montoInicial || 0));
    const efecVentas = Math.max(0, parseFloat(efectivoVentas || 0));
    const efecEsperado = Math.max(0, parseFloat(efectivoEsperado || 0));
    const efecContado = Math.max(0, parseFloat(efectivoContado || 0));
    const totTarjeta = Math.max(0, parseFloat(totalTarjeta || 0));
    const totYape = Math.max(0, parseFloat(totalYape || 0));
    const totConsumo = Math.max(0, parseFloat(totalConsumo || 0));
    const totPedidosYa = Math.max(0, parseFloat(totalPedidosYa || 0));
    const egresosEfec = Math.max(0, parseFloat(egresosEfectivo || 0));
    const abonosEfec = Math.max(0, parseFloat(abonosEfectivo || 0));
    const difCalculada = Math.round((efecContado - efecEsperado) * 100) / 100;

    const cierre = await prisma.cierreCaja.update({
      where: { id: turnoAbierto.id },
      data: {
        estado: 'CERRADO',
        fechaCierre: fechaCierre ? new Date(fechaCierre) : new Date(),
        cajeroNombre: String(cajeroNombre).trim(),
        montoInicial: mInicial,
        efectivoVentas: efecVentas,
        efectivoEsperado: efecEsperado,
        efectivoContado: efecContado,
        diferencia: difCalculada,
        totalTarjeta: totTarjeta,
        totalYape: totYape,
        totalConsumo: totConsumo,
        totalPedidosYa: totPedidosYa,
        egresosEfectivo: egresosEfec,
        abonosEfectivo: abonosEfec,
        nota: nota ? String(nota).trim() : null,
      },
    });

    console.log(`🔒 Cierre de Caja registrado exitosamente por ${cajeroNombre}: Esperado S/ ${cierre.efectivoEsperado.toFixed(2)}, Contado S/ ${cierre.efectivoContado.toFixed(2)}, Dif: S/ ${cierre.diferencia.toFixed(2)}`);
    res.json({ ok: true, cierre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/caja/cierre-forzado → Cierre administrativo por parte del Administrador
app.post('/api/caja/cierre-forzado', async (req, res) => {
  try {
    const { adminNombre, adminPin, motivo } = req.body;

    if (!adminPin || typeof adminPin !== 'string' || !adminPin.trim()) {
      return res.status(400).json({ error: 'El PIN de Administrador es obligatorio.' });
    }

    // Validar PIN de administrador
    const admin = await prisma.usuario.findFirst({
      where: {
        pin: adminPin.trim(),
        rol: 'Administrador',
        activo: true,
      },
    });

    if (!admin) {
      return res.status(403).json({ error: 'PIN de Administrador inválido o no autorizado.' });
    }

    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!turnoAbierto) {
      return res.status(400).json({ error: 'No hay ninguna caja abierta en este momento.' });
    }

    const now = new Date();
    const cierre = await prisma.cierreCaja.update({
      where: { id: turnoAbierto.id },
      data: {
        estado: 'CERRADO',
        fechaCierre: now,
        cerradoPorAdmin: true,
        nota: `[CIERRE FORZADO POR ADMINISTRADOR: ${admin.nombre}] Motivo: ${motivo || 'Cierre de turno por administración'}`,
      },
    });

    console.log(`⚠️ Turno #${turnoAbierto.id} cerrado administrativamente por Admin ${admin.nombre}`);
    res.json({ ok: true, mensaje: 'Turno cerrado forzosamente por Administrador con éxito.', cierre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/caja/ultimo-cierre → Obtener el último cierre de caja registrado
app.get('/api/caja/ultimo-cierre', async (req, res) => {
  try {
    const ultimo = await prisma.cierreCaja.findFirst({
      where: { estado: 'CERRADO' },
      orderBy: { fechaCierre: 'desc' },
    });
    res.json({ ok: true, ultimoCierre: ultimo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/caja/cierres → Historial de los últimos cierres de caja
app.get('/api/caja/cierres', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 30);
    const cierres = await prisma.cierreCaja.findMany({
      orderBy: { id: 'desc' },
      take: Math.min(limit, 100),
    });
    res.json({ ok: true, cierres });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// COMPRAS (RCE)
// ============================================================

app.get('/api/compras', async (req, res) => {
  const { desde, hasta, categoria, metodoPago, busqueda } = req.query;
  try {
    const conditions = [];

    // La fecha de un gasto es un día de calendario. fechaEmision se guarda como
    // "YYYY-MM-DD 12:00 Lima" (17:00 UTC) y los registros antiguos como "YYYY-MM-DD 00:00 UTC":
    // ambos caen en el mismo día UTC, así que se filtra por día UTC. Los registros sin
    // fechaEmision solo tienen la hora real de registro (fecha) y se filtran por día de Lima.
    const soloDia = (v) => String(v).split('T')[0];
    const diaSiguiente = (dia) => {
      const d = new Date(`${dia}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split('T')[0];
    };
    let filtroEmision;
    let filtroRegistro;
    if (desde) {
      const d = soloDia(desde);
      const h = hasta ? diaSiguiente(soloDia(hasta)) : null;
      filtroEmision = { gte: new Date(`${d}T00:00:00.000Z`), ...(h ? { lt: new Date(`${h}T00:00:00.000Z`) } : {}) };
      filtroRegistro = { gte: new Date(`${d}T00:00:00.000-05:00`), ...(h ? { lt: new Date(`${h}T00:00:00.000-05:00`) } : {}) };
    } else {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      filtroEmision = { gte: inicioMes };
      filtroRegistro = { gte: inicioMes };
    }

    conditions.push({
      OR: [
        { fechaEmision: filtroEmision },
        { fechaEmision: null, fecha: filtroRegistro },
      ]
    });

    if (categoria && categoria !== 'Todas') {
      conditions.push({ categoria });
    }

    if (metodoPago && metodoPago !== 'Todos') {
      // Los pagos mixtos se guardan como "Mixto (Efec: S/ …, Yape: S/ …)"
      conditions.push(metodoPago === 'Mixto' ? { metodoPago: { startsWith: 'Mixto' } } : { metodoPago });
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim();
      conditions.push({
        OR: [
          { proveedor: { contains: q, mode: 'insensitive' } },
          { ruc: { contains: q, mode: 'insensitive' } },
          { serieNumero: { contains: q, mode: 'insensitive' } },
        ]
      });
    }

    const whereClause = conditions.length > 0 ? { AND: conditions } : {};

    const compras = await prisma.compra.findMany({
      where: whereClause,
      orderBy: [{ fechaEmision: 'desc' }, { fecha: 'desc' }, { creadoEn: 'desc' }],
    });
    res.json(compras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/compras/stats → KPIs del mes actual
app.get('/api/compras/stats', async (req, res) => {
  try {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const compras = await prisma.compra.findMany({
      where: {
        OR: [
          { fechaEmision: { gte: inicioMes } },
          { fechaEmision: null, fecha: { gte: inicioMes } },
        ]
      },
    });

    const totalGastado = compras.reduce((s, c) => s + c.total, 0);
    const totalIGV = compras.reduce((s, c) => s + c.igv, 0);
    const numFacturas = compras.length;

    // Top proveedor
    const porProveedor = {};
    compras.forEach(c => {
      porProveedor[c.proveedor] = (porProveedor[c.proveedor] || 0) + c.total;
    });
    const topProveedor = Object.entries(porProveedor).sort((a, b) => b[1] - a[1])[0];

    // Breakdown por categoría
    const porCategoria = {};
    compras.forEach(c => {
      const cat = c.categoria || 'Sin Categoría';
      porCategoria[cat] = (porCategoria[cat] || 0) + c.total;
    });

    res.json({
      totalGastado,
      totalIGV,
      numFacturas,
      topProveedor: topProveedor ? { nombre: topProveedor[0], total: topProveedor[1] } : null,
      porCategoria,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compras/sincronizar-sunat → Proxy seguro a apisunat.pe
// Modo demo: si APISUNAT_TOKEN no está configurado, retorna datos de ejemplo reales.
app.post('/api/compras/sincronizar-sunat', async (req, res) => {
  const { periodo, fechaInicio, fechaFin } = req.body;
  const token = process.env.APISUNAT_TOKEN;
  const MODO_DEMO = !token || token.includes('tu_token') || token === '';

  // Datos de demo basados en la respuesta real de la documentación oficial de apisunat.pe
  const DEMO_ITEMS = [
    {
      emisor: { ruc: '10061488176', razon_social: 'AGUILA ULLOA EFRAIN VICTOR' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'E001', numero: '88', fecha_emision: '2025-12-01', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '438.98', total_igv: '79.02', monto_total_general: '518.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/10061488176-01-E001-88',
        xml: 'https://apisunat.pe/rce/document/xml/10061488176-01-E001-88',
      },
    },
    {
      emisor: { ruc: '10080275973', razon_social: 'REYES MARIÑOS DE ZEGARRA YSABEL' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'FF01', numero: '693', fecha_emision: '2025-12-01', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '667.46', total_igv: '120.14', monto_total_general: '787.60' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/10080275973-01-FF01-693',
        xml: 'https://apisunat.pe/rce/document/xml/10080275973-01-FF01-693',
      },
    },
    {
      emisor: { ruc: '20601245789', razon_social: 'DISTRIBUIDORA ALIMENTOS & INSUMOS S.A.C.' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'F001', numero: '2145', fecha_emision: '2025-12-03', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '1186.44', total_igv: '213.56', monto_total_general: '1400.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/20601245789-01-F001-2145',
        xml: 'https://apisunat.pe/rce/document/xml/20601245789-01-F001-2145',
      },
    },
    {
      emisor: { ruc: '20100128056', razon_social: 'BACKUS Y JOHNSTON S.A.A.' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'F001', numero: '98443', fecha_emision: '2025-12-05', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '423.73', total_igv: '76.27', monto_total_general: '500.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/20100128056-01-F001-98443',
        xml: 'https://apisunat.pe/rce/document/xml/20100128056-01-F001-98443',
      },
    },
  ];

  try {
    let itemsParaProcesar = [];

    if (MODO_DEMO) {
      itemsParaProcesar = DEMO_ITEMS;
    } else {
      // Llamada real a apisunat.pe con paginación
      const params = new URLSearchParams();
      if (periodo) params.set('period', periodo);
      if (fechaInicio) params.set('start_date', fechaInicio);
      if (fechaFin) params.set('end_date', fechaFin);
      params.set('page', '1');

      const resp = await fetch(`https://dev.apisunat.pe/api/v1/sunat/rce?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ error: `apisunat.pe respondió con ${resp.status}: ${txt}` });
      }

      const data = await resp.json();
      itemsParaProcesar = (data.payload?.items) || [];
    }

    // Mapear tipo_comprobante a nombre legible
    const TIPOS = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito', '08': 'Nota de Débito' };

    let importadas = 0;
    let duplicadas = 0;

    for (const item of itemsParaProcesar) {
      const serieNumero = `${item.detalle.serie}-${item.detalle.numero}`;

      // Verificar duplicado por serieNumero + RUC del emisor
      const existe = await prisma.compra.findFirst({
        where: { serieNumero, ruc: item.emisor.ruc },
      });

      if (existe) {
        duplicadas++;
        continue;
      }

      const baseImponible = parseFloat(item.totales.total_grav_oner || 0);
      const igv = parseFloat(item.totales.total_igv || 0);
      const total = parseFloat(item.totales.monto_total_general || 0);
      const tipoDoc = TIPOS[item.detalle.tipo_comprobante] || 'Factura';
      const fechaEmision = item.detalle.fecha_emision ? new Date(item.detalle.fecha_emision + 'T00:00:00.000-05:00') : null;

      await prisma.compra.create({
        data: {
          proveedor: item.emisor.razon_social,
          ruc: item.emisor.ruc,
          tipoDocumento: tipoDoc,
          serieNumero,
          baseImponible,
          igv,
          total,
          origenCarga: MODO_DEMO ? 'demo' : 'sunat',
          fechaEmision,
          urlPdf: item.url_descarga?.pdf || null,
          urlXml: item.url_descarga?.xml || null,
        },
      });

      importadas++;
    }

    res.json({
      ok: true,
      modoDemo: MODO_DEMO,
      importadas,
      duplicadas,
      total: importadas + duplicadas,
      mensaje: MODO_DEMO
        ? `✅ MODO DEMO: ${importadas} facturas de ejemplo importadas desde la documentación de apisunat.pe. (${duplicadas} ya existían)`
        : `✅ ${importadas} facturas importadas desde SUNAT. (${duplicadas} ya existían)`,
    });
  } catch (err) {
    console.error('[Sync SUNAT]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/compras', async (req, res) => {
  try {
    const { proveedor, ruc, tipoDocumento, serieNumero, baseImponible, igv, total, xmlData, origenCarga, categoria, fechaEmision, metodoPago } = req.body;
    const compra = await prisma.compra.create({
      data: {
        proveedor: String(proveedor),
        ruc: ruc ? String(ruc) : null,
        tipoDocumento: tipoDocumento ? String(tipoDocumento) : 'Factura',
        serieNumero: serieNumero ? String(serieNumero) : null,
        baseImponible: parseFloat(baseImponible),
        igv: parseFloat(igv),
        total: parseFloat(total),
        xmlData: xmlData ? String(xmlData) : null,
        origenCarga: origenCarga ? String(origenCarga) : 'manual',
        categoria: categoria ? String(categoria) : null,
        fecha: fechaEmision ? (fechaEmision.includes('T') ? new Date(fechaEmision) : new Date(`${fechaEmision}T12:00:00.000-05:00`)) : new Date(),
        fechaEmision: fechaEmision ? (fechaEmision.includes('T') ? new Date(fechaEmision) : new Date(`${fechaEmision}T12:00:00.000-05:00`)) : null,
        metodoPago: metodoPago ? String(metodoPago) : 'Efectivo',
      }
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/compras/:id/categoria → Actualizar categoría de una compra
app.patch('/api/compras/:id/categoria', async (req, res) => {
  const { id } = req.params;
  const { categoria } = req.body;
  try {
    const compra = await prisma.compra.update({
      where: { id: parseInt(id) },
      data: { categoria: categoria ? String(categoria) : null },
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/compras/:id → Editar todos los datos de una compra/gasto
app.put('/api/compras/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { proveedor, ruc, tipoDocumento, serieNumero, baseImponible, igv, total, categoria, fechaEmision, metodoPago } = req.body;
  try {
    const data = {};
    if (proveedor !== undefined) data.proveedor = String(proveedor);
    if (ruc !== undefined) data.ruc = ruc ? String(ruc) : null;
    if (tipoDocumento !== undefined) data.tipoDocumento = String(tipoDocumento);
    if (serieNumero !== undefined) data.serieNumero = serieNumero ? String(serieNumero) : null;
    if (baseImponible !== undefined) data.baseImponible = parseFloat(baseImponible) || 0;
    if (igv !== undefined) data.igv = parseFloat(igv) || 0;
    if (total !== undefined) data.total = parseFloat(total) || 0;
    if (categoria !== undefined) data.categoria = categoria ? String(categoria) : null;
    if (fechaEmision !== undefined) {
      const parsedDate = fechaEmision ? (fechaEmision.includes('T') ? new Date(fechaEmision) : new Date(`${fechaEmision}T12:00:00.000-05:00`)) : null;
      data.fechaEmision = parsedDate;
      if (parsedDate) data.fecha = parsedDate;
    }
    if (metodoPago !== undefined) data.metodoPago = String(metodoPago);

    const compra = await prisma.compra.update({
      where: { id },
      data,
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/compras/:id → Eliminar una compra o gasto
app.delete('/api/compras/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.compra.delete({
      where: { id },
    });
    res.json({ ok: true, mensaje: 'Gasto/Compra eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REPORTES
// ============================================================

// GET /api/reportes/cancelaciones → Pedidos cancelados del día o rango de fechas
app.get('/api/reportes/cancelaciones', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      hoyPeru.setHours(0, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        AND: [
          {
            OR: [
              { estado: 'Cancelado' },
              { Venta: { anulado: true } }
            ]
          },
          {
            OR: [
              { canceladoEn: filtroFecha },
              { createdAt: filtroFecha },
              { Venta: { anuladoEn: filtroFecha } }
            ]
          }
        ]
      },
      include: { items: true, mesa: true, Venta: true },
      orderBy: { id: 'desc' },
    });

    const formateados = pedidos.map(p => {
      const esDevolucionCaja = !!p.Venta?.anulado || (p.motivoCancela || '').startsWith('[DEVOLUCIÓN CAJA]');
      const fechaIncidencia = p.Venta?.anuladoEn || p.canceladoEn || p.createdAt;
      return {
        id: p.id,
        ventaId: p.Venta?.id || null,
        tipo: esDevolucionCaja ? 'Devolución en Caja' : 'Comanda Cancelada',
        hora: fechaIncidencia ? new Date(fechaIncidencia).toLocaleTimeString('es-PE', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
        }) : '--:--',
        fecha: fechaIncidencia ? new Date(fechaIncidencia).toLocaleDateString('es-PE') : '--/--/----',
        fechaRaw: fechaIncidencia,
        mesa: p.mesa?.numero || null,
        codigoPedidosYa: p.codigoPedidosYa,
        canceladoPor: p.Venta?.anuladoPor || p.canceladoPor || 'Admin',
        motivoCancela: (p.Venta?.motivoAnulacion || (p.motivoCancela || '').replace('[DEVOLUCIÓN CAJA]: ', '') || 'Sin motivo especificado').trim(),
        total: Number(p.Venta?.montoOriginal || p.total || 0),
        metodoPagoOriginal: p.Venta?.metodoPago || 'No cobrado',
        resumenItems: (p.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', '),
      };
    });

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/mozos → Estadísticas por mozo por rango de fechas
app.get('/api/reportes/mozos', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      hoyPeru.setHours(0, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        createdAt: filtroFecha,
        tipoEntrega: 'salon',
        estado: { not: 'Cancelado' },
      },
      select: { mesero: true, estado: true },
    });

    const mozos = {};
    for (const p of pedidos) {
      if (!mozos[p.mesero]) mozos[p.mesero] = { activas: 0, atendidas: 0 };
      if (p.estado === 'Cocina' || p.estado === 'Servido') mozos[p.mesero].activas++;
      if (p.estado === 'Cobrado') mozos[p.mesero].atendidas++;
    }

    const resultado = Object.entries(mozos).map(([nombre, stats]) => ({
      nombre,
      mesasActivas: stats.activas,
      mesasAtendidas: stats.atendidas,
    })).sort((a, b) => b.mesasAtendidas - a.mesasAtendidas);

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/cajeros → Rendimiento y desglose de ventas por cajero
app.get('/api/reportes/cajeros', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      hoyPeru.setHours(0, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: filtroFecha,
        anulado: false,
        pedido: { estado: { not: 'Cancelado' } }
      },
      select: {
        total: true,
        montoEfectivo: true,
        montoTarjeta: true,
        montoYape: true,
        metodoPago: true,
        cajeroNombre: true,
      }
    });

    const cajeros = {};
    for (const v of ventas) {
      const cajero = (v.cajeroNombre && v.cajeroNombre.trim()) || 'Cajero Principal';
      if (!cajeros[cajero]) {
        cajeros[cajero] = {
          nombre: cajero,
          totalVentas: 0,
          cantidadTickets: 0,
          efectivo: 0,
          tarjeta: 0,
          yape: 0,
          otros: 0
        };
      }

      let efec = Number(v.montoEfectivo) || (v.metodoPago === 'Efectivo' ? v.total : 0);
      let tarj = Number(v.montoTarjeta) || (v.metodoPago === 'Tarjeta' ? v.total : 0);
      let yape = Number(v.montoYape) || (v.metodoPago === 'Yape' ? v.total : 0);
      if (v.metodoPago === 'Mixto' && (efec + tarj + yape) < v.total) {
        efec += (v.total - (efec + tarj + yape));
      }

      cajeros[cajero].totalVentas += Number(v.total) || 0;
      cajeros[cajero].cantidadTickets += 1;
      cajeros[cajero].efectivo += efec;
      cajeros[cajero].tarjeta += tarj;
      cajeros[cajero].yape += yape;
      if (v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía' || v.metodoPago === 'Crédito') {
        cajeros[cajero].otros += Number(v.total) || 0;
      }
    }

    const resultado = Object.values(cajeros).map(c => ({
      ...c,
      ticketPromedio: c.cantidadTickets > 0 ? (c.totalVentas / c.cantidadTickets) : 0
    })).sort((a, b) => b.totalVentas - a.totalVentas);

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/contable → Ventas y compras por rango de fechas
app.get('/api/reportes/contable', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      filtroFecha = { gte: inicioMes };
    }

    const [ventas, compras, abonos, clientes] = await Promise.all([
      prisma.venta.findMany({
        where: {
          createdAt: filtroFecha,
          anulado: false,
          pedido: { estado: { not: 'Cancelado' } }
        }
      }),
      prisma.compra.findMany({ where: { creadoEn: filtroFecha } }),
      prisma.abonoCredito.findMany({ where: { creadoEn: filtroFecha } }),
      prisma.cliente.findMany()
    ]);

    const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);
    const ventasIGV = ventas.reduce((s, v) => s + v.igv, 0);
    const ventasBase = ventas.reduce((s, v) => s + v.subtotal, 0);
    const comprasTotal = compras.reduce((s, c) => s + c.total, 0);
    const comprasIGV = compras.reduce((s, c) => s + c.igv, 0);
    const comprasBase = compras.reduce((s, c) => s + c.baseImponible, 0);

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalYape = 0;

    ventas.forEach(v => {
      const { efec, tarj, yape } = obtenerMontosVenta(v);
      totalEfectivo += efec;
      totalTarjeta += tarj;
      totalYape += yape;
    });

    // Sumar abonos a la caja física
    abonos.forEach(a => {
      totalEfectivo += a.montoEfectivo || 0;
      totalTarjeta += a.montoTarjeta || 0;
      totalYape += a.montoYape || 0;
    });

    const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
    let consumoClientes = 0;
    let consumoPlanilla = 0;

    ventas.forEach(v => {
      if (v.metodoPago === 'Consumo') {
        consumoPlanilla += (v.descuentoAplicado || v.total);
      } else {
        const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
        if (splits.length > 0) {
          splits.forEach(s => {
            const esTrab = clienteMap.get(s.clienteId) || false;
            if (esTrab) {
              consumoPlanilla += s.monto;
            } else {
              consumoClientes += s.monto;
            }
          });
        } else if (v.metodoPago === 'Crédito') {
          consumoClientes += v.total;
        } else if (parseFloat(v.montoCredito || 0) > 0) {
          consumoClientes += parseFloat(v.montoCredito);
        }
      }
    });

    res.json({
      ventasTotal, ventasIGV, ventasBase,
      comprasTotal, comprasIGV, comprasBase,
      igvAPagar: ventasIGV - comprasIGV,
      desgloseCaja: {
        efectivo: totalEfectivo,
        tarjeta: totalTarjeta,
        yape: totalYape,
        pedidosYa: ventas.filter(v => v.metodoPago === 'PedidosYa').reduce((s, v) => s + v.total, 0),
        consumos: consumoPlanilla,
        consumoPlanilla,
        credito: consumoClientes,
        consumoClientes,
        cortesias: ventas.filter(v => v.metodoPago === 'Cortesía').reduce((s, v) => s + (v.descuentoAplicado || v.total), 0),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/pollos → Reporte de pollos vendidos e inventario con conversión fraccionada
app.get('/api/reportes/pollos', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const lteDate = hasta.length === 10 ? new Date(nextDayStr + 'T02:59:59.999-05:00') : new Date(hasta);
      filtroFecha = { gte: gteDate, lte: lteDate };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    // Obtener TODOS los pedidos cobrados (incluyendo items con precio 0 que son componentes de combos)
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Cobrado',
        createdAt: filtroFecha
      },
      include: {
        items: {
          include: { producto: true }
        }
      }
    });

    // Tabla de conversión de fracciones de pollo a unidades enteras
    const FRACCIONES = {
      '1/8': 0.125,
      '1/4': 0.25,
      '1/2': 0.5,
      '1': 1.0,
    };

    // Determinar la fracción de un item basado en nombre o categoría
    const obtenerFraccion = (nombre, categoria) => {
      const n = (nombre || '').toLowerCase();
      const cat = (categoria || '').toLowerCase();
      // Solo cuenta lo que sale del horno
      const esPollo = cat.includes('pollo') || cat.includes('brasa') || cat.includes('mostrito') || n.includes('mostrito');
      if (!esPollo) return 0;

      // Los platos tipo "Mostrito" en gastronomía peruana corresponden por estándar a 1/4 de pollo
      if (n.includes('mostrito') || cat.includes('mostrito')) {
        if (n.includes('1/8') || n.includes('octavo')) return FRACCIONES['1/8'];
        if (n.includes('1/2') || n.includes('medio')) return FRACCIONES['1/2'];
        return FRACCIONES['1/4'];
      }

      // Detectar fracción en el nombre
      if (n.includes('1/8') || n.includes('octavo')) return FRACCIONES['1/8'];
      if (n.includes('1/4') || n.includes('cuarto')) return FRACCIONES['1/4'];
      if (n.includes('1/2') || n.includes('medio')) return FRACCIONES['1/2'];
      if (n.includes('1 pollo') || n.startsWith('1 pollo') || n.includes('pollo entero') || n.includes('un pollo')) return FRACCIONES['1'];

      // Fallback: si tiene "pollo" pero no fracción específica, asumir 1 entero
      return n.includes('pollo') ? FRACCIONES['1'] : 0;
    };

    // Acumulación por producto
    const productos = {};
    let totalOctavos = 0, totalCuartos = 0, totalMedios = 0, totalEnteros = 0;
    let unidadesTotales = 0;
    let ventasConPollo = 0;

    for (const p of pedidos) {
      for (const item of p.items) {
        const fraccion = obtenerFraccion(item.nombre, item.producto?.categoria);
        if (fraccion > 0) {
          const prodId = item.productoId;
          if (!productos[prodId]) {
            productos[prodId] = {
              id: prodId,
              nombre: item.nombre,
              categoria: item.producto?.categoria || 'Sin categoría',
              cantidadVendida: 0,
              unidadesEquivalentes: 0,
              stockActual: item.producto?.stock || 0,
            };
          }
          const unidades = fraccion * item.cantidad;
          productos[prodId].cantidadVendida += item.cantidad;
          productos[prodId].unidadesEquivalentes += unidades;
          unidadesTotales += unidades;
          ventasConPollo++;

          if (fraccion === FRACCIONES['1/8']) totalOctavos += item.cantidad;
          else if (fraccion === FRACCIONES['1/4']) totalCuartos += item.cantidad;
          else if (fraccion === FRACCIONES['1/2']) totalMedios += item.cantidad;
          else if (fraccion === FRACCIONES['1']) totalEnteros += item.cantidad;
        }
      }
    }

    // Calcular total de pollos vendidos con la fórmula: Σ (Octavos × 0.125 + Cuartos × 0.25 + Medios × 0.50 + Enteros × 1.0)
    const totalFormula = (totalOctavos * FRACCIONES['1/8']) + (totalCuartos * FRACCIONES['1/4']) + (totalMedios * FRACCIONES['1/2']) + (totalEnteros * FRACCIONES['1']);

    // Stock inicial configurable: usar el mayor stock de los productos de pollo registrado, o 0 si no hay
    const productosPollo = await prisma.producto.findMany({
      where: { categoria: { in: ['Pollos a la Brasa', 'Piqueo', 'Piqueos'] } }
    });
    const stockInicial = productosPollo.reduce((max, p) => Math.max(max, p.stock || 0), 50) || 50; // Default 50 si no hay stock
    const porcentajeRotacion = stockInicial > 0 ? parseFloat(((totalFormula / stockInicial) * 100).toFixed(1)) : 0;

    res.json({
      totalOctavos,
      totalCuartos,
      totalMedios,
      totalEnteros,
      totalVentasConPollo: ventasConPollo,
      totalUnidadesEquivalentes: parseFloat((Number(totalFormula) || 0).toFixed(2)),
      stockInicial,
      porcentajeRotacion,
      detalles: Object.values(productos).sort((a, b) => b.unidadesEquivalentes - a.unidadesEquivalentes),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/rotacion → Cantidad vendida de cada producto por rango de fechas
app.get('/api/reportes/rotacion', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const lteDate = hasta.length === 10 ? new Date(nextDayStr + 'T02:59:59.999-05:00') : new Date(hasta);
      filtroFecha = { gte: gteDate, lte: lteDate };
    } else if (desde) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      filtroFecha = { gte: gteDate };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Cobrado',
        createdAt: filtroFecha
      },
      include: {
        items: {
          include: {
            producto: true
          }
        }
      }
    });

    const rotacion = {};
    for (const p of pedidos) {
      for (const item of p.items) {
        const prodId = item.productoId;
        if (!rotacion[prodId]) {
          rotacion[prodId] = {
            id: prodId,
            nombre: item.nombre,
            categoria: item.producto?.categoria || 'Sin categoría',
            cantidad: 0,
            precio: item.precio,
            total: 0
          };
        }
        rotacion[prodId].cantidad += item.cantidad;
        rotacion[prodId].total += item.cantidad * item.precio;
      }
    }

    const resultado = Object.values(rotacion).sort((a, b) => b.cantidad - a.cantidad);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// FRONTEND COMPILADO (INSTALADOR WINDOWS)
// Si existe la carpeta dist, el backend sirve la app en el mismo puerto.
// En Docker/desarrollo no existe y Vite sirve el frontend.
// ============================================================
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  console.log(`🖥️ Sirviendo frontend desde ${FRONTEND_DIST}`);
}

module.exports = { app, prisma };
