// Rutas de pedidos de salón: monitores de cocina y barra, servir, entregar y cancelar
const express = require('express');
const { prisma } = require('../db');
const { alertasCancelacion } = require('../servicios/cancelaciones');
const { BARRA_CATEGORIAS } = require('../servicios/empresa');

const router = express.Router();

// ============================================================
// COCINA — Endpoint unificado (salon + delivery)
// ============================================================

// GET /api/pedidos/cocina → Todos los pedidos en Cocina para el monitor
router.get('/api/pedidos/cocina', async (req, res) => {
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
        estadoEnsalada: true,
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
      estadoEnsalada: p.estadoEnsalada,
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
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/barra → Todos los pedidos con bebidas pendientes en Cocina
router.get('/api/pedidos/barra', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/items/:itemId/preparar → Cocinero o Barman marca listo un item de cocina/barra de forma individual
router.patch('/api/pedidos/items/:itemId/preparar', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/preparar → Cocinero o Barman marca listo su sección
router.patch('/api/pedidos/:id/preparar', async (req, res) => {
  const id = parseInt(req.params.id);
  const { seccion } = req.body; // "cocina" o "barra"

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/servir → Cocinero marca como Listo
router.patch('/api/pedidos/:id/servir', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/items/:itemId/entregar → Mozo marca un plato de cocina como entregado en la mesa
router.patch('/api/pedidos/items/:itemId/entregar', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    await prisma.itemPedido.update({
      where: { id: itemId },
      data: { entregado: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/entregar-todo → Mozo marca todos los platos listos de cocina del pedido como entregados
router.patch('/api/pedidos/:id/entregar-todo', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

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
    res.status(500).json({ error: err.message });
  }
});

// Actualizar notas de un ítem de pedido individual
router.patch('/api/pedidos/items/:id/notas', async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const item = await prisma.itemPedido.update({
      where: { id: parseInt(id) },
      data: { notas: notas || null },
    });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CANCELACIÓN DE PEDIDOS (Solo Mozo, límite 5 min)
// ============================================================

router.patch('/api/pedidos/:id/cancelar', async (req, res) => {
  const id = parseInt(req.params.id);
  const { canceladoPor, motivo, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        items: { include: { producto: true } },
        mesa: true,
      },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Si no es una cancelación forzada por supervisor, aplicar filtros normales
    if (!force) {
      if (pedido.estado !== 'Cocina') {
        return res.status(400).json({
          error: 'Este pedido ya no puede cancelarse. Solo se cancelan pedidos en estado "Cocina".',
        });
      }
    }

    const now = new Date();
    let mesaLiberada = false;
    let nuevoEstadoMesa = 'Libre';

    await prisma.$transaction(async (tx) => {
      // 1. Cancelar el pedido
      await tx.pedido.update({
        where: { id },
        data: {
          estado: 'Cancelado',
          canceladoPor: canceladoPor || 'Sin especificar',
          motivoCancela: motivo || 'Sin motivo',
          canceladoEn: now,
        },
      });

      // 2. Si existe venta asociada (ej. pedido delivery o ya cobrado), anularla también
      await tx.venta.updateMany({
        where: { pedidoId: id, anulado: false },
        data: {
          anulado: true,
          motivoAnulacion: `[CANCELACIÓN PEDIDO]: ${motivo || 'Sin motivo'}`,
          anuladoPor: canceladoPor || 'Administrador',
          anuladoEn: now,
          total: 0.00,
          subtotal: 0.00,
          igv: 0.00,
          montoEfectivo: 0.00,
          montoTarjeta: 0.00,
          montoYape: 0.00,
          montoCredito: 0.00,
          descuentoAplicado: 0.00,
        },
      });

      // 3. Restaurar stock de productos limitados
      for (const item of pedido.items) {
        if (item.producto?.tipoStock === 'limitado') {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stock: { increment: item.cantidad } },
          });
        }
      }

      // 4. Liberar mesa si no quedan pedidos activos o actualizar su estado
      if (pedido.mesaId) {
        const activos = await tx.pedido.findMany({
          where: { mesaId: pedido.mesaId, estado: { in: ['Cocina', 'Servido'] }, id: { not: id } },
        });

        if (activos.length === 0) {
          const mObj = await tx.mesa.update({
            where: { id: pedido.mesaId },
            data: { estado: 'Libre' },
          });
          if (mObj?.numero) {
            await tx.mesa.updateMany({
              where: { estado: `Unida a Mesa ${mObj.numero}` },
              data: { estado: 'Libre' },
            });
          }
          mesaLiberada = true;
        } else {
          // Si hay al menos un pedido activo en Cocina, la mesa debe quedarse en Cocina.
          // Si todos los activos están en Servido, pasa a Servido (Azul).
          const hayEnCocina = activos.some(p => p.estado === 'Cocina');
          nuevoEstadoMesa = hayEnCocina ? 'Cocina' : 'Servido';

          await tx.mesa.update({
            where: { id: pedido.mesaId },
            data: { estado: nuevoEstadoMesa },
          });
        }
      }
    });

    // 🔔 Registrar alerta de cancelación para cocina (store en memoria)
    const itemsParaCocina = (pedido.items || []).filter(i =>
      !BARRA_CATEGORIAS.includes(i.producto?.categoria || '')
    );
    if (itemsParaCocina.length > 0) {
      alertasCancelacion.cocina.push({
        id: `cancel-${Date.now()}-${pedido.id}`,
        pedidoId: pedido.id,
        items: itemsParaCocina.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          notas: i.notas || null,
        })),
        mesaInfo: pedido.mesaId ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}` : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery'),
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Administrador',
        canceladoEn: new Date().toISOString(),
      });
    }

    // 🔔 Registrar alerta de cancelación para barra (store en memoria)
    const itemsParaBarra = (pedido.items || []).filter(i =>
      BARRA_CATEGORIAS.includes(i.producto?.categoria || '')
    );
    if (itemsParaBarra.length > 0) {
      alertasCancelacion.barra.push({
        id: `cancel-${Date.now()}-${pedido.id}`,
        pedidoId: pedido.id,
        items: itemsParaBarra.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          notas: i.notas || null,
        })),
        mesaInfo: pedido.mesaId ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}` : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery'),
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Administrador',
        canceladoEn: new Date().toISOString(),
      });
    }

    res.json({ ok: true, mesaLiberada, nuevoEstadoMesa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cocina/cancelaciones → Devuelve las alertas de cancelación pendientes de confirmación para Cocina
router.get('/api/cocina/cancelaciones', (req, res) => {
  res.json(alertasCancelacion.cocina);
});

// DELETE /api/cocina/cancelaciones/:id → Cocina confirma que vio la alerta ("Entendido")
router.delete('/api/cocina/cancelaciones/:id', (req, res) => {
  const { id } = req.params;
  alertasCancelacion.cocina = alertasCancelacion.cocina.filter(c => c.id !== id);
  res.json({ ok: true });
});

// GET /api/barra/cancelaciones → Devuelve las alertas de cancelación pendientes de confirmación para Barra
router.get('/api/barra/cancelaciones', (req, res) => {
  res.json(alertasCancelacion.barra);
});

// DELETE /api/barra/cancelaciones/:id → Barra confirma que vio la alerta ("Entendido")
router.delete('/api/barra/cancelaciones/:id', (req, res) => {
  const { id } = req.params;
  alertasCancelacion.barra = alertasCancelacion.barra.filter(c => c.id !== id);
  res.json({ ok: true });
});

router.patch('/api/pedidos/:id/cancelar-item', async (req, res) => {
  const id = parseInt(req.params.id);
  const { productoId, itemId, cantidadACancelar, motivo, canceladoPor, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        items: { include: { producto: true } },
        mesa: true,
      },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Si no es una cancelación forzada por supervisor, aplicar filtros normales
    if (!force) {
      if (pedido.estado !== 'Cocina') {
        return res.status(400).json({
          error: 'Este pedido ya no puede modificarse. Solo se cancelan ítems de pedidos en estado "Cocina".',
        });
      }
    }

    const item = itemId
      ? pedido.items.find(i => i.id === parseInt(itemId))
      : (force
          ? pedido.items.find(i => String(i.productoId) === String(productoId))
          : pedido.items.find(i => String(i.productoId) === String(productoId) && !i.historial));

    if (!item) return res.status(404).json({ error: 'El ítem seleccionado no se encuentra en la comanda activa.' });

    if (cantidadACancelar > item.cantidad) {
      return res.status(400).json({ error: 'La cantidad a cancelar supera la cantidad pedida.' });
    }

    // Calcular nueva cantidad
    const nuevaCantidad = item.cantidad - cantidadACancelar;

    // Restaurar stock
    if (item.producto?.tipoStock === 'limitado') {
      await prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: cantidadACancelar } },
      });
    }

    // Si el item cancelado es un combo o plato con componentes vinculados, limpiar componentes huérfanos
    const componentesVinculados = (pedido.items || []).filter(i => i.esComponente && i.productoId === item.productoId);
    for (const comp of componentesVinculados) {
      if (nuevaCantidad === 0) {
        await prisma.itemPedido.delete({ where: { id: comp.id } }).catch(() => null);
      } else {
        const nuevaCantComp = Math.max(0, comp.cantidad - cantidadACancelar);
        if (nuevaCantComp === 0) {
          await prisma.itemPedido.delete({ where: { id: comp.id } }).catch(() => null);
        } else {
          await prisma.itemPedido.update({ where: { id: comp.id }, data: { cantidad: nuevaCantComp } }).catch(() => null);
        }
      }
      if (comp.producto?.tipoStock === 'limitado') {
        await prisma.producto.update({
          where: { id: comp.productoId },
          data: { stock: { increment: cantidadACancelar } },
        }).catch(() => null);
      }
    }

    // 🔔 Registrar alerta de cancelación para KDS (Cocina y Barra)
    const categoriaProd = item.producto?.categoria || '';
    const esBarra = BARRA_CATEGORIAS.includes(categoriaProd);
    const mesaInfo = pedido.mesaId 
      ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}` 
      : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery');

    const itemAlerta = {
      nombre: item.nombre,
      cantidad: cantidadACancelar,
      precio: item.precio,
      notas: motivo ? `CANCELADO: ${motivo}` : 'Cancelado por mozo',
    };

    if (esBarra) {
      alertasCancelacion.barra.push({
        id: `cancel-item-${Date.now()}-${item.id}`,
        pedidoId: pedido.id,
        items: [itemAlerta],
        mesaInfo,
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Mozo',
        canceladoEn: new Date().toISOString(),
      });
    } else {
      alertasCancelacion.cocina.push({
        id: `cancel-item-${Date.now()}-${item.id}`,
        pedidoId: pedido.id,
        items: [itemAlerta],
        mesaInfo,
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Mozo',
        canceladoEn: new Date().toISOString(),
      });
    }

    const esUltimoItem = pedido.items.length === 1 && cantidadACancelar === item.cantidad;

    // Declarar en el scope externo para que esté disponible en el res.json final
    let itemsRestantes = [];

    if (esUltimoItem) {
      // Treat as a complete cancelation of the comanda!
      await prisma.pedido.update({
        where: { id },
        data: {
          estado: 'Cancelado',
          canceladoPor: canceladoPor || 'Sin especificar',
          motivoCancela: motivo || 'Cancelación completa de ítems',
          canceladoEn: new Date(),
        },
      });
      // itemsRestantes queda [] — el pedido se canceló por completo
    } else {
      if (nuevaCantidad === 0) {
        // Eliminar el ítem del pedido
        await prisma.itemPedido.delete({ where: { id: item.id } });
      } else {
        // Actualizar cantidad
        await prisma.itemPedido.update({
          where: { id: item.id },
          data: { cantidad: nuevaCantidad },
        });
      }

      // Recalcular total del pedido
      itemsRestantes = await prisma.itemPedido.findMany({
        where: { pedidoId: id },
      });

      const nuevoTotal = itemsRestantes.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);

      if (itemsRestantes.length === 0) {
        // Fallback: Si no quedan ítems, cancelamos todo el pedido
        await prisma.pedido.update({
          where: { id },
          data: {
            estado: 'Cancelado',
            canceladoPor: canceladoPor || 'Sin especificar',
            motivoCancela: motivo || 'Cancelación completa de ítems',
            canceladoEn: new Date(),
            total: 0,
          },
        });
      } else {
        // Actualizar total
        await prisma.pedido.update({
          where: { id },
          data: { total: nuevoTotal },
        });
      }
    }

    let mesaLiberada = false;
    let nuevoEstadoMesa = 'Libre';

    if (pedido.mesaId) {
      const activos = await prisma.pedido.findMany({
        where: { mesaId: pedido.mesaId, estado: { in: ['Cocina', 'Servido'] } },
      });

      if (activos.length === 0) {
        const mObj = await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Libre' },
        });
        // Liberar automáticamente las mesas que estaban unidas a esta
        await prisma.mesa.updateMany({
          where: { estado: `Unida a Mesa ${mObj.numero}` },
          data: { estado: 'Libre' },
        });
        mesaLiberada = true;
      } else {
        const hayEnCocina = activos.some(p => p.estado === 'Cocina');
        nuevoEstadoMesa = hayEnCocina ? 'Cocina' : 'Servido';
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: nuevoEstadoMesa },
        });
      }
    }

    res.json({ ok: true, mesaLiberada, nuevoEstadoMesa, pedidoVacio: itemsRestantes.length === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
