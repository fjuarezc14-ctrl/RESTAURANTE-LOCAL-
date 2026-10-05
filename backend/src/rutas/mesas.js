// Rutas de mesas del salón: crear, unir, separar y enviar pedidos a cocina
const express = require('express');
const { prisma } = require('../db');
const { evaluarEstadoEnsalada, expandPedidoItemsForDb } = require('../servicios/pedidos');

const router = express.Router();

// ============================================================
// MESAS — Consolidado con todos los pedidos activos
// ============================================================

router.get('/api/mesas', async (req, res) => {
  try {
    const mesas = await prisma.mesa.findMany({
      orderBy: { numero: 'asc' },
      include: {
        Pedidos: {
          where: { estado: { in: ['Cocina', 'Servido'] } },
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              include: { producto: { select: { categoria: true } } },
            },
          },
        },
      },
    });

    const formateadas = mesas.map(m => {
      const pedidosActivos = m.Pedidos;
      if (pedidosActivos.length === 0) {
        return { num: m.numero, estado: m.estado, pedidoData: null };
      }

      // Consolidar items de TODOS los pedidos activos (fix bug adicional)
      const todosLosItems = pedidosActivos.flatMap(p =>
        p.items.map(i => ({
          id: String(i.productoId),
          itemId: i.id,
          nombre: i.nombre,
          precio: i.precio,
          cant: i.cantidad,
          historial: i.historial,
          entregado: i.entregado,
          categoria: i.producto?.categoria || '',
          pedidoId: p.id,
          notas: i.notas || null,
        }))
      );

      const totalConsolidado = pedidosActivos.reduce((sum, p) => sum + p.total, 0);
      const pedidoIds = pedidosActivos.map(p => p.id);
      const primerPedido = pedidosActivos[0];
      const ultimoPedido = pedidosActivos[pedidosActivos.length - 1];

      let consolidadoEstadoEnsalada = 'No Aplica';
      const estadosEnsaladas = pedidosActivos.map(p => p.estadoEnsalada);
      if (estadosEnsaladas.includes('Pendiente')) {
        consolidadoEstadoEnsalada = 'Pendiente';
      } else if (estadosEnsaladas.includes('Listo')) {
        consolidadoEstadoEnsalada = 'Listo';
      }

      return {
        num: m.numero,
        estado: m.estado,
        pedidoData: {
          pedidoIds,
          pedidoId: ultimoPedido.id,
          mesero: primerPedido.mesero,
          total: totalConsolidado,
          hora: primerPedido.createdAt.toLocaleTimeString('es-PE', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
          }),
          pedidoCreadoEn: ultimoPedido.createdAt.toISOString(),
          adicional: pedidosActivos.length > 1,
          items: todosLosItems,
          estadoEnsalada: consolidadoEstadoEnsalada,
        },
      };
    });

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas → Crear una nueva mesa
router.post('/api/mesas', async (req, res) => {
  const { numero } = req.body;
  const num = parseInt(numero);

  if (isNaN(num) || num <= 0) {
    return res.status(400).json({ error: 'El número de mesa debe ser un número entero positivo.' });
  }

  try {
    const existe = await prisma.mesa.findUnique({ where: { numero: num } });
    if (existe) {
      return res.status(400).json({ error: 'El número de mesa ya está en uso.' });
    }

    const nuevaMesa = await prisma.mesa.create({
      data: { numero: num, estado: 'Libre' }
    });
    res.json(nuevaMesa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/mesas/:numero → Modificar el número de una mesa
router.put('/api/mesas/:numero', async (req, res) => {
  const numeroActual = parseInt(req.params.numero);
  const { nuevoNumero } = req.body;
  const nuevoNum = parseInt(nuevoNumero);

  if (isNaN(nuevoNum) || nuevoNum <= 0) {
    return res.status(400).json({ error: 'El nuevo número de mesa debe ser un número entero positivo.' });
  }

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero: numeroActual },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return res.status(400).json({ error: 'No se puede modificar el número de una mesa con comandas activas.' });
    }

    const unidasRename = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numeroActual}` } });
    if (unidasRename > 0) {
      return res.status(400).json({ error: `La Mesa ${numeroActual} tiene mesas unidas. Sepáralas antes de cambiar su número.` });
    }

    if (numeroActual !== nuevoNum) {
      const existe = await prisma.mesa.findUnique({ where: { numero: nuevoNum } });
      if (existe) {
        return res.status(400).json({ error: 'El nuevo número de mesa ya está en uso.' });
      }
    }

    const mesaActualizada = await prisma.mesa.update({
      where: { numero: numeroActual },
      data: { numero: nuevoNum }
    });
    res.json(mesaActualizada);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mesas/:numero → Eliminar una mesa
router.delete('/api/mesas/:numero', async (req, res) => {
  const numero = parseInt(req.params.numero);

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una mesa con comandas activas.' });
    }

    const unidasDelete = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numero}` } });
    if (unidasDelete > 0) {
      return res.status(400).json({ error: `La Mesa ${numero} tiene mesas unidas. Sepáralas antes de eliminarla.` });
    }

    await prisma.mesa.delete({ where: { numero } });
    res.json({ ok: true, mensaje: `Mesa ${numero} eliminada correctamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/unir → Unir una mesa a otra principal
router.post('/api/mesas/:num/unir', async (req, res) => {
  try {
    const numPrincipal = parseInt(req.params.num);
    const { numeroMesaAUnir } = req.body;

    if (!numeroMesaAUnir) {
      return res.status(400).json({ error: 'Debe especificar el número de mesa a unir.' });
    }

    const numUnir = parseInt(numeroMesaAUnir);

    // Buscar ambas mesas
    const mesaPrincipal = await prisma.mesa.findUnique({ where: { numero: numPrincipal } });
    const mesaAUnir = await prisma.mesa.findUnique({ where: { numero: numUnir } });

    if (!mesaPrincipal || !mesaAUnir) {
      return res.status(404).json({ error: 'Mesa principal o mesa a unir no encontrada.' });
    }

    if (numUnir === numPrincipal) {
      return res.status(400).json({ error: 'No se puede unir una mesa consigo misma.' });
    }

    if (mesaPrincipal.estado.startsWith('Unida a ')) {
      return res.status(400).json({ error: `La Mesa ${numPrincipal} ya está unida a otra (${mesaPrincipal.estado}). Usa la mesa principal del grupo.` });
    }

    if (mesaAUnir.estado !== 'Libre') {
      return res.status(400).json({ error: `La mesa ${numUnir} no está libre (estado: ${mesaAUnir.estado}).` });
    }

    // Una mesa que ya encabeza su propio grupo no puede unirse a otro (evita cadenas de grupos)
    const unidasASecundaria = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numUnir}` } });
    if (unidasASecundaria > 0) {
      return res.status(400).json({ error: `La Mesa ${numUnir} ya tiene mesas unidas. Sepáralas primero.` });
    }

    // Unir mesa (cambiar estado a "Unida a Mesa X")
    await prisma.mesa.update({
      where: { id: mesaAUnir.id },
      data: { estado: `Unida a Mesa ${numPrincipal}` },
    });

    res.json({ ok: true, mensaje: `Mesa ${numUnir} unida con éxito a Mesa ${numPrincipal}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/separar → Separar las mesas unidas a esta.
// Con body { numeroMesa } separa solo esa mesa; sin body separa todas las de ESTE grupo.
router.post('/api/mesas/:num/separar', async (req, res) => {
  try {
    const numPrincipal = parseInt(req.params.num);
    const numeroMesa = req.body?.numeroMesa != null ? parseInt(req.body.numeroMesa) : null;
    const estadoGrupo = `Unida a Mesa ${numPrincipal}`;

    if (numeroMesa != null) {
      const mesa = await prisma.mesa.findUnique({ where: { numero: numeroMesa } });
      if (!mesa || mesa.estado !== estadoGrupo) {
        return res.status(400).json({ error: `La Mesa ${numeroMesa} no está unida a la Mesa ${numPrincipal}.` });
      }
      await prisma.mesa.update({ where: { id: mesa.id }, data: { estado: 'Libre' } });
      return res.json({ ok: true, separadas: [numeroMesa], mensaje: `Mesa ${numeroMesa} separada de la Mesa ${numPrincipal}.` });
    }

    const unidas = await prisma.mesa.findMany({ where: { estado: estadoGrupo }, select: { numero: true } });
    await prisma.mesa.updateMany({
      where: { estado: estadoGrupo },
      data: { estado: 'Libre' },
    });

    res.json({ ok: true, separadas: unidas.map(m => m.numero), mensaje: `Mesas unidas a la Mesa ${numPrincipal} han sido separadas.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/pedido → Enviar a cocina (con descuento de stock)
router.post('/api/mesas/:num/pedido', async (req, res) => {
  const { num } = req.params;
  const { mesero, items, total, adicional } = req.body;

  try {
    const mesa = await prisma.mesa.findUnique({ where: { numero: parseInt(num) } });
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    // Control de concurrencia: Evitar comandas adicionales en mesas que ya fueron cobradas/liberadas
    if (adicional) {
      const activeCount = await prisma.pedido.count({
        where: { mesaId: mesa.id, estado: { in: ['Cocina', 'Servido'] } }
      });
      if (activeCount === 0) {
        return res.status(400).json({
          error: 'Esta mesa ya ha sido cobrada y liberada por caja. Por favor, vuelve a abrir la mesa antes de comandar.'
        });
      }
    }

    const safeItems = Array.isArray(items) ? items : [];
    const itemsNuevos = safeItems.filter(i => i && !i.historial);
    if (itemsNuevos.length === 0) {
      return res.status(400).json({ error: 'No hay nuevos ítems pendientes para enviar a cocina.' });
    }

    const safeMesero = mesero ? String(mesero).trim() : 'Mozo';
    const safeTotal = isNaN(parseFloat(total)) ? 0 : parseFloat(total);

    const expandedItems = await expandPedidoItemsForDb(itemsNuevos);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(itemsNuevos);

    const pedido = await prisma.$transaction(async (tx) => {
      const p = await tx.pedido.create({
        data: {
          mesaId: parseInt(mesa.id),
          mesero: safeMesero,
          total: safeTotal,
          adicional: adicional || false,
          estado: 'Cocina',
          estadoEnsalada: finalEstadoEnsalada,
          items: {
            create: expandedItems.map(i => ({
              productoId: i.productoId,
              nombre: i.nombre,
              precio: i.precio,
              cantidad: i.cantidad,
              historial: i.historial,
              entregado: i.entregado || false,
              notas: i.notas,
              esComponente: i.esComponente || false,
            })),
          },
        },
      });

      // Descontar stock de todo lo comandado, incluidos los componentes de un combo con guardia atómica
      for (const item of expandedItems) {
        const updateResult = await tx.producto.updateMany({
          where: { id: item.productoId, tipoStock: 'limitado', stock: { gte: item.cantidad } },
          data: { stock: { decrement: item.cantidad } },
        });
        if (updateResult.count === 0) {
          const prodCheck = await tx.producto.findUnique({ where: { id: item.productoId } });
          if (prodCheck && prodCheck.tipoStock === 'limitado' && prodCheck.stock < item.cantidad) {
            throw new Error(`Stock insuficiente para "${prodCheck.nombre}". Stock disponible: ${prodCheck.stock}, solicitado: ${item.cantidad}`);
          }
        }
      }

      await tx.mesa.update({
        where: { id: mesa.id },
        data: { estado: 'Cocina' },
      });

      return p;
    });

    res.json({ ok: true, pedidoId: pedido.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
