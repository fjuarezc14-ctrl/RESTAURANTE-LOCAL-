// Rutas de pedidos de salón: monitores de cocina y barra, servir, entregar y cancelar
const express = require('express');
const { prisma } = require('../db');
const {
  actualizarEstadoMesa, autorizarCancelacion, avisosPendientes, confirmarAviso, registrarCancelacion,
} = require('../servicios/cancelaciones');
const { registrarAuditoria } = require('../servicios/auditoria');
const { BARRA_CATEGORIAS } = require('../servicios/empresa');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { cancelacionItem, cancelacionPedido, notasItem, preparacion } = require('../../shared/esquemas/pedidos.js');
const { requierePermiso } = require('../middlewares/permisos');
const { idempotente } = require('../middlewares/idempotencia');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// COCINA — Endpoint unificado (salon + delivery)
// ============================================================

// GET /api/pedidos/cocina → Todos los pedidos en Cocina para el monitor
router.get('/api/pedidos/cocina', requierePermiso('Cocina'), async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { estado: 'Cocina' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipoEntrega: true,
        codigoPedidosYa: true,
        mesero: true,
        adicional: true,
        createdAt: true,
        mesa: { select: { numero: true } },
        items: {
          select: {
            id: true,
            nombre: true,
            cantidad: true,
            precio: true,
            historial: true,
            notas: true,
            producto: { select: { categoria: true } },
          },
        },
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      mesaNum: p.mesa?.numero || null,
      tipoEntrega: p.tipoEntrega,
      codigoPedidosYa: p.codigoPedidosYa,
      mesero: p.mesero,
      adicional: p.adicional,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      createdAt: p.createdAt.toISOString(),
      // Filtrar bebidas: cocina solo ve lo que prepara
      items: p.items
        .filter(i => !i.historial && !BARRA_CATEGORIAS.includes(i.producto?.categoria))
        .map(i => ({
          id: i.id,
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio,
          categoria: i.producto?.categoria || '',
          notas: i.notas || null,
        })),
    })).filter(p => p.items.length > 0); // Ocultar si solo tiene bebidas

    res.json(formateados);
  } catch (err) {
    next(err);
  }
});

// GET /api/pedidos/barra → Todos los pedidos con bebidas pendientes en Cocina
router.get('/api/pedidos/barra', requierePermiso('Barra'), async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { estado: 'Cocina' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipoEntrega: true,
        codigoPedidosYa: true,
        mesero: true,
        adicional: true,
        createdAt: true,
        mesa: { select: { numero: true } },
        items: {
          select: {
            nombre: true,
            cantidad: true,
            precio: true,
            historial: true,
            notas: true,
            producto: { select: { categoria: true } },
          },
        },
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      mesaNum: p.mesa?.numero || null,
      tipoEntrega: p.tipoEntrega,
      codigoPedidosYa: p.codigoPedidosYa,
      mesero: p.mesero,
      adicional: p.adicional,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      createdAt: p.createdAt.toISOString(),
      // Barra solo ve items de categorías de barra que no se han despachado (historial === false)
      items: p.items
        .filter(i => !i.historial && BARRA_CATEGORIAS.includes(i.producto?.categoria))
        .map(i => ({
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio,
          categoria: i.producto?.categoria || '',
          notas: i.notas || null,
        })),
    })).filter(p => p.items.length > 0);

    res.json(formateados);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/items/:itemId/preparar → Cocinero o Barman marca listo un item de cocina/barra de forma individual
router.patch('/api/pedidos/items/:itemId/preparar', requierePermiso('Cocina', 'Barra'), async (req, res, next) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const item = await prisma.itemPedido.update({
      where: { id: itemId },
      data: { historial: true },
      include: { pedido: { include: { items: true } } },
    });

    const todosListos = item.pedido.items.every(i => i.historial === true);
    if (todosListos) {
      const ped = await prisma.pedido.update({
        where: { id: item.pedidoId },
        data: { estado: 'Servido' },
        include: { mesa: true },
      });

      if (ped.mesaId && ped.tipoEntrega === 'salon') {
        const enCocina = await prisma.pedido.count({
          where: { mesaId: ped.mesaId, estado: 'Cocina' },
        });
        if (enCocina === 0) {
          await prisma.mesa.update({
            where: { id: ped.mesaId },
            data: { estado: 'Servido' },
          });
        }
      }
    }

    res.json({ ok: true, todosListos });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/:id/preparar → Cocinero o Barman marca listo su sección
router.patch('/api/pedidos/:id/preparar', requierePermiso('Cocina', 'Barra'), validar({ body: preparacion }), async (req, res, next) => {
  const id = parseInt(req.params.id);
  const { seccion } = req.body; // "cocina" o "barra"

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido no encontrado'));

    // Filtrar los items que corresponden a la sección despachada
    const itemsAActualizar = (pedido.items || []).filter(i => {
      // Cada estación despacha lo suyo, también en los pedidos para llevar:
      // antes la cocina marcaba las bebidas y la barra las perdía de vista.
      const esItemBarra = BARRA_CATEGORIAS.includes(i.producto?.categoria);
      if (seccion === 'barra') return esItemBarra;
      if (seccion === 'cocina') return !esItemBarra;
      return false;
    });

    // Marcar solo los items de esta sección como historial (despachados)
    await prisma.itemPedido.updateMany({
      where: { id: { in: itemsAActualizar.map(item => item.id) } },
      data: { historial: true },
    });

    // Verificar si TODOS los ítems del pedido ya fueron despachados
    const pedidoActualizado = await prisma.pedido.findUnique({
      where: { id },
      include: { items: true },
    });
    const todosListos = pedidoActualizado.items.every(i => i.historial === true);

    // Solo marcar pedido como Servido cuando ambas estaciones terminaron
    if (todosListos) {
      const ped = await prisma.pedido.update({
        where: { id },
        data: { estado: 'Servido' },
        include: { mesa: true },
      });

      if (ped.mesaId && ped.tipoEntrega === 'salon') {
        const enCocina = await prisma.pedido.count({
          where: { mesaId: ped.mesaId, estado: 'Cocina' },
        });
        if (enCocina === 0) {
          await prisma.mesa.update({
            where: { id: ped.mesaId },
            data: { estado: 'Servido' },
          });
        }
      }
    }

    res.json({ ok: true, todosListos });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/:id/servir → Cocinero marca como Listo
router.patch('/api/pedidos/:id/servir', requierePermiso('Cocina', 'Barra', 'Salon'), async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    // Marcar items como historial
    await prisma.itemPedido.updateMany({
      where: { pedidoId: id },
      data: { historial: true },
    });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { estado: 'Servido' },
      include: { mesa: true },
    });

    // Si es pedido de salón, verificar si la mesa puede pasar a Servido
    if (pedido.mesaId && pedido.tipoEntrega === 'salon') {
      const enCocina = await prisma.pedido.count({
        where: { mesaId: pedido.mesaId, estado: 'Cocina' },
      });
      if (enCocina === 0) {
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Servido' },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/items/:itemId/entregar → Mozo marca un plato de cocina como entregado en la mesa
router.patch('/api/pedidos/items/:itemId/entregar', requierePermiso('Salon', 'Caja'), async (req, res, next) => {
  const itemId = parseInt(req.params.itemId);
  try {
    await prisma.itemPedido.update({
      where: { id: itemId },
      data: { entregado: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/:id/entregar-todo → Mozo marca todos los platos listos de cocina del pedido como entregados
router.patch('/api/pedidos/:id/entregar-todo', requierePermiso('Salon', 'Caja'), async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido no encontrado'));

    // Todo lo que ya está listo y aún no se llevó a la mesa (cocina y barra)
    const itemsAActualizar = (pedido.items || []).filter(i => i.historial && !i.entregado);

    if (itemsAActualizar.length > 0) {
      await prisma.itemPedido.updateMany({
        where: { id: { in: itemsAActualizar.map(item => item.id) } },
        data: { entregado: true },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Actualizar notas de un ítem de pedido individual
router.patch('/api/pedidos/items/:id/notas', requierePermiso('Salon', 'Caja'), validar({ body: notasItem }), async (req, res, next) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const item = await prisma.itemPedido.update({
      where: { id: parseInt(id) },
      data: { notas: notas || null },
    });
    res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CANCELACIÓN DE PEDIDOS (Solo Mozo, límite 5 min)
// ============================================================

// PATCH /api/pedidos/:id/cancelar → cancela el pedido completo (y su venta, si la tiene)
// Sin autorización solo dentro de los 5 minutos y en cocina; si no, { autorizacion: { pin } } (ver servicios/cancelaciones.js)
router.patch('/api/pedidos/:id/cancelar', requierePermiso('Salon', 'Caja'), idempotente, validar({ body: cancelacionPedido }), async (req, res, next) => {
  const id = parseInt(req.params.id);
  const { canceladoPor, motivo, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } }, mesa: true },
    });
    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido no encontrado.'));
    if (pedido.estado === 'Cancelado') return next(new ErrorApp('CONFLICTO', 'Este pedido ya está cancelado.'));
    if (!force && pedido.estado !== 'Cocina') {
      return next(new ErrorApp('CONFLICTO', 'Este pedido ya no puede cancelarse. Solo se cancelan pedidos en estado "Cocina".'));
    }
    const autorizadoPor = await autorizarCancelacion(pedido, req.body, {
      forzada: Boolean(force), itemListo: pedido.items.some((i) => i.historial),
    });

    const now = new Date();
    const motivoFinal = motivo || 'Sin motivo';
    const quien = canceladoPor || 'Sin especificar';

    const estadoMesa = await prisma.$transaction(async (tx) => {
      // Solo si sigue como se leyó: dos cancelaciones a la vez no devuelven dos veces el stock
      const marcado = await tx.pedido.updateMany({
        where: { id, estado: pedido.estado },
        data: { estado: 'Cancelado', canceladoPor: quien, motivoCancela: motivoFinal, canceladoEn: now },
      });
      if (marcado.count !== 1) throw new ErrorApp('CONFLICTO', 'El pedido cambió mientras se cancelaba. Actualiza y vuelve a intentarlo.');

      // Si tiene venta (delivery o ya cobrado), se anula también
      await tx.venta.updateMany({
        where: { pedidoId: id, anulado: false },
        data: {
          anulado: true, motivoAnulacion: `[CANCELACIÓN PEDIDO]: ${motivoFinal}`, anuladoPor: autorizadoPor || quien, anuladoEn: now,
          total: 0, subtotal: 0, igv: 0, montoEfectivo: 0, montoTarjeta: 0, montoYape: 0, montoCredito: 0, descuentoAplicado: 0,
        },
      });

      for (const item of pedido.items) {
        if (item.producto?.tipoStock === 'limitado') {
          await tx.producto.update({ where: { id: item.productoId }, data: { stock: { increment: item.cantidad } } });
        }
      }

      await registrarCancelacion(tx, {
        pedido, tipo: 'PEDIDO', motivo: motivoFinal, canceladoPor: quien, autorizadoPor, barraCategorias: BARRA_CATEGORIAS,
        items: pedido.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, notas: i.notas, categoria: i.producto?.categoria })),
      });
      await registrarAuditoria(tx, req, {
        accion: 'PEDIDO_CANCELADO', entidad: 'Pedido', entidadId: id, motivo: motivoFinal, autorizadoPor, nombreDeclarado: canceladoPor,
        antes: { estado: pedido.estado, total: pedido.total, mesa: pedido.mesa?.numero ?? null }, despues: { estado: 'Cancelado' },
      });
      return actualizarEstadoMesa(tx, pedido.mesaId);
    });

    res.json({ ok: true, mesaLiberada: estadoMesa.mesaLiberada, nuevoEstadoMesa: estadoMesa.nuevoEstadoMesa ?? 'Libre' });
  } catch (err) {
    next(err);
  }
});

// Avisos de cancelación pendientes para cada monitor (guardados en la BD: sobreviven a un reinicio)
router.get('/api/cocina/cancelaciones', requierePermiso('Cocina'), async (req, res, next) => {
  try { res.json(await avisosPendientes('Cocina')); } catch (err) { next(err); }
});
router.delete('/api/cocina/cancelaciones/:id', requierePermiso('Cocina'), async (req, res, next) => {
  try { await confirmarAviso(parseInt(req.params.id), 'Cocina'); res.json({ ok: true }); } catch (err) { next(err); }
});
router.get('/api/barra/cancelaciones', requierePermiso('Barra'), async (req, res, next) => {
  try { res.json(await avisosPendientes('Barra')); } catch (err) { next(err); }
});
router.delete('/api/barra/cancelaciones/:id', requierePermiso('Barra'), async (req, res, next) => {
  try { await confirmarAviso(parseInt(req.params.id), 'Barra'); res.json({ ok: true }); } catch (err) { next(err); }
});

// PATCH /api/pedidos/:id/cancelar-item → cancela una cantidad de un ítem; si era lo último, el pedido entero
router.patch('/api/pedidos/:id/cancelar-item', requierePermiso('Salon', 'Caja'), idempotente, validar({ body: cancelacionItem }), async (req, res, next) => {
  const id = parseInt(req.params.id);
  const { productoId, itemId, motivo, canceladoPor, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } }, mesa: true },
    });
    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido no encontrado.'));
    if (pedido.estado === 'Cancelado') return next(new ErrorApp('CONFLICTO', 'Este pedido ya está cancelado.'));
    if (!force && pedido.estado !== 'Cocina') {
      return next(new ErrorApp('CONFLICTO', 'Este pedido ya no puede modificarse. Solo se cancelan ítems de pedidos en estado "Cocina".'));
    }

    const item = itemId
      ? pedido.items.find((i) => i.id === parseInt(itemId))
      : (force
          ? pedido.items.find((i) => String(i.productoId) === String(productoId))
          : pedido.items.find((i) => String(i.productoId) === String(productoId) && !i.historial));
    if (!item) return next(new ErrorApp('NO_ENCONTRADO', 'El ítem seleccionado no se encuentra en la comanda activa.'));

    // Sin cantidad se cancela el ítem completo
    const cantidad = req.body.cantidadACancelar ?? item.cantidad;
    if (cantidad > item.cantidad) {
      return next(new ErrorApp('VALIDACION', 'La cantidad a cancelar supera la cantidad pedida.', { campo: 'cantidadACancelar' }));
    }
    const autorizadoPor = await autorizarCancelacion(pedido, req.body, { forzada: Boolean(force), itemListo: Boolean(item.historial) });

    const nuevaCantidad = item.cantidad - cantidad;
    // Componentes de un combo o plato compuesto: se cancelan junto con él
    const componentes = pedido.items.filter((i) => i.esComponente && i.productoId === item.productoId && i.id !== item.id);
    const otros = pedido.items.filter((i) => i.id !== item.id && !componentes.includes(i));
    const pedidoVacio = nuevaCantidad === 0 && otros.length === 0;
    const quien = canceladoPor || 'Sin especificar';

    const estadoMesa = await prisma.$transaction(async (tx) => {
      // El pedido y el ítem siguen como se leyeron (la fila queda bloqueada hasta terminar): dos cancelaciones
      // a la vez del mismo ítem no devuelven dos veces el stock
      const pedidoVigente = await tx.pedido.updateMany({ where: { id, estado: pedido.estado }, data: { estado: pedido.estado } });
      const itemVigente = await tx.itemPedido.updateMany({ where: { id: item.id, cantidad: item.cantidad }, data: { cantidad: item.cantidad } });
      if (pedidoVigente.count !== 1 || itemVigente.count !== 1) {
        throw new ErrorApp('CONFLICTO', 'El pedido cambió mientras se cancelaba. Actualiza y vuelve a intentarlo.');
      }
      if (item.producto?.tipoStock === 'limitado') {
        await tx.producto.update({ where: { id: item.productoId }, data: { stock: { increment: cantidad } } });
      }
      for (const comp of componentes) {
        if (comp.producto?.tipoStock === 'limitado') {
          await tx.producto.update({ where: { id: comp.productoId }, data: { stock: { increment: cantidad } } });
        }
      }

      if (pedidoVacio) {
        // Era lo último: se cancela el pedido y sus ítems se CONSERVAN (el reporte de cancelaciones los necesita)
        await tx.pedido.update({
          where: { id },
          data: { estado: 'Cancelado', canceladoPor: quien, motivoCancela: motivo || 'Cancelación completa de ítems', canceladoEn: new Date(), total: 0 },
        });
      } else {
        if (nuevaCantidad === 0) await tx.itemPedido.delete({ where: { id: item.id } });
        else await tx.itemPedido.update({ where: { id: item.id }, data: { cantidad: nuevaCantidad } });
        for (const comp of componentes) {
          const restante = Math.max(0, comp.cantidad - cantidad);
          if (nuevaCantidad === 0 || restante === 0) await tx.itemPedido.delete({ where: { id: comp.id } });
          else await tx.itemPedido.update({ where: { id: comp.id }, data: { cantidad: restante } });
        }
        const restantes = await tx.itemPedido.findMany({ where: { pedidoId: id } });
        const nuevoTotal = restantes.reduce((sum, i) => sum + i.cantidad * Number(i.precio), 0);
        await tx.pedido.update({ where: { id }, data: { total: nuevoTotal } });
      }

      await registrarCancelacion(tx, {
        pedido, tipo: pedidoVacio ? 'PEDIDO' : 'ITEM', canceladoPor: quien, autorizadoPor, motivo, barraCategorias: BARRA_CATEGORIAS,
        items: [{ nombre: item.nombre, cantidad, precio: item.precio, notas: motivo ? `CANCELADO: ${motivo}` : 'Cancelado por mozo', categoria: item.producto?.categoria }],
      });
      await registrarAuditoria(tx, req, {
        accion: pedidoVacio ? 'PEDIDO_CANCELADO' : 'ITEM_CANCELADO', entidad: 'Pedido', entidadId: id,
        motivo: motivo || null, autorizadoPor, nombreDeclarado: canceladoPor,
        antes: { item: item.nombre, cantidad: item.cantidad, listo: Boolean(item.historial) },
        despues: { cantidad: nuevaCantidad, ...(pedidoVacio ? { estadoPedido: 'Cancelado' } : {}) },
      });
      return actualizarEstadoMesa(tx, pedido.mesaId);
    });

    res.json({ ok: true, mesaLiberada: estadoMesa.mesaLiberada, nuevoEstadoMesa: estadoMesa.nuevoEstadoMesa ?? 'Libre', pedidoVacio });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
