// Rutas de mesas del salón: crear, unir, separar y enviar pedidos a cocina
const express = require('express');
const { prisma } = require('../db');
const { expandPedidoItemsForDb } = require('../servicios/pedidos');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { mesaNueva, mesaRenumerar, mesaSeparar, mesaUnir, pedidoMesa } = require('../../shared/esquemas/pedidos.js');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// MESAS — Consolidado con todos los pedidos activos
// ============================================================

router.get('/api/mesas', requierePermiso('Salon', 'Caja', 'Dashboard'), async (req, res, next) => {
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
        },
      };
    });

    res.json(formateadas);
  } catch (err) {
    next(err);
  }
});

// POST /api/mesas → Crear una nueva mesa
router.post('/api/mesas', requierePermiso('Salon'), validar({ body: mesaNueva }), async (req, res, next) => {
  const { numero } = req.body;
  const num = parseInt(numero);

  if (isNaN(num) || num <= 0) {
    return next(new ErrorApp('VALIDACION', 'El número de mesa debe ser un número entero positivo.', { campo: 'numero' }));
  }

  try {
    const existe = await prisma.mesa.findUnique({ where: { numero: num } });
    if (existe) {
      return next(new ErrorApp('YA_EXISTE', 'El número de mesa ya está en uso.', { campo: 'numero' }));
    }

    const nuevaMesa = await prisma.mesa.create({
      data: { numero: num, estado: 'Libre' }
    });
    res.json(nuevaMesa);
  } catch (err) {
    next(err);
  }
});

// PUT /api/mesas/:numero → Modificar el número de una mesa
router.put('/api/mesas/:numero', requierePermiso('Salon'), validar({ body: mesaRenumerar }), async (req, res, next) => {
  const numeroActual = parseInt(req.params.numero);
  const { nuevoNumero } = req.body;
  const nuevoNum = parseInt(nuevoNumero);

  if (isNaN(nuevoNum) || nuevoNum <= 0) {
    return next(new ErrorApp('VALIDACION', 'El nuevo número de mesa debe ser un número entero positivo.', { campo: 'numero' }));
  }

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero: numeroActual },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return next(new ErrorApp('NO_ENCONTRADO', 'Mesa no encontrada.'));

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return next(new ErrorApp('CONFLICTO', 'No se puede modificar el número de una mesa con comandas activas.'));
    }

    const unidasRename = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numeroActual}` } });
    if (unidasRename > 0) {
      return next(new ErrorApp('CONFLICTO', `La Mesa ${numeroActual} tiene mesas unidas. Sepáralas antes de cambiar su número.`));
    }

    if (numeroActual !== nuevoNum) {
      const existe = await prisma.mesa.findUnique({ where: { numero: nuevoNum } });
      if (existe) {
        return next(new ErrorApp('YA_EXISTE', 'El nuevo número de mesa ya está en uso.', { campo: 'numero' }));
      }
    }

    const mesaActualizada = await prisma.mesa.update({
      where: { numero: numeroActual },
      data: { numero: nuevoNum }
    });
    res.json(mesaActualizada);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/mesas/:numero → Eliminar una mesa
router.delete('/api/mesas/:numero', requierePermiso('Salon'), async (req, res, next) => {
  const numero = parseInt(req.params.numero);

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return next(new ErrorApp('NO_ENCONTRADO', 'Mesa no encontrada.'));

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return next(new ErrorApp('CONFLICTO', 'No se puede eliminar una mesa con comandas activas.'));
    }

    const unidasDelete = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numero}` } });
    if (unidasDelete > 0) {
      return next(new ErrorApp('CONFLICTO', `La Mesa ${numero} tiene mesas unidas. Sepáralas antes de eliminarla.`));
    }

    await prisma.mesa.delete({ where: { numero } });
    res.json({ ok: true, mensaje: `Mesa ${numero} eliminada correctamente.` });
  } catch (err) {
    next(err);
  }
});

// POST /api/mesas/:num/unir → Unir una mesa a otra principal
router.post('/api/mesas/:num/unir', requierePermiso('Salon'), validar({ body: mesaUnir }), async (req, res, next) => {
  try {
    const numPrincipal = parseInt(req.params.num);
    const { numeroMesaAUnir } = req.body;

    if (!numeroMesaAUnir) {
      return next(new ErrorApp('VALIDACION', 'Debe especificar el número de mesa a unir.', { campo: 'numero' }));
    }

    const numUnir = parseInt(numeroMesaAUnir);

    // Buscar ambas mesas
    const mesaPrincipal = await prisma.mesa.findUnique({ where: { numero: numPrincipal } });
    const mesaAUnir = await prisma.mesa.findUnique({ where: { numero: numUnir } });

    if (!mesaPrincipal || !mesaAUnir) {
      return next(new ErrorApp('NO_ENCONTRADO', 'Mesa principal o mesa a unir no encontrada.'));
    }

    if (numUnir === numPrincipal) {
      return next(new ErrorApp('VALIDACION', 'No se puede unir una mesa consigo misma.'));
    }

    if (mesaPrincipal.estado.startsWith('Unida a ')) {
      return next(new ErrorApp('CONFLICTO', `La Mesa ${numPrincipal} ya está unida a otra (${mesaPrincipal.estado}). Usa la mesa principal del grupo.`));
    }

    if (mesaAUnir.estado !== 'Libre') {
      return next(new ErrorApp('CONFLICTO', `La mesa ${numUnir} no está libre (estado: ${mesaAUnir.estado}).`));
    }

    // Una mesa que ya encabeza su propio grupo no puede unirse a otro (evita cadenas de grupos)
    const unidasASecundaria = await prisma.mesa.count({ where: { estado: `Unida a Mesa ${numUnir}` } });
    if (unidasASecundaria > 0) {
      return next(new ErrorApp('CONFLICTO', `La Mesa ${numUnir} ya tiene mesas unidas. Sepáralas primero.`));
    }

    // Unir mesa (cambiar estado a "Unida a Mesa X")
    await prisma.mesa.update({
      where: { id: mesaAUnir.id },
      data: { estado: `Unida a Mesa ${numPrincipal}` },
    });

    res.json({ ok: true, mensaje: `Mesa ${numUnir} unida con éxito a Mesa ${numPrincipal}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/mesas/:num/separar → Separar las mesas unidas a esta.
// Con body { numeroMesa } separa solo esa mesa; sin body separa todas las de ESTE grupo.
router.post('/api/mesas/:num/separar', requierePermiso('Salon'), validar({ body: mesaSeparar }), async (req, res, next) => {
  try {
    const numPrincipal = parseInt(req.params.num);
    const numeroMesa = req.body?.numeroMesa != null ? parseInt(req.body.numeroMesa) : null;
    const estadoGrupo = `Unida a Mesa ${numPrincipal}`;

    if (numeroMesa != null) {
      const mesa = await prisma.mesa.findUnique({ where: { numero: numeroMesa } });
      if (!mesa || mesa.estado !== estadoGrupo) {
        return next(new ErrorApp('CONFLICTO', `La Mesa ${numeroMesa} no está unida a la Mesa ${numPrincipal}.`));
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
    next(err);
  }
});

// POST /api/mesas/:num/pedido → Enviar a cocina (con descuento de stock)
router.post('/api/mesas/:num/pedido', requierePermiso('Salon'), validar({ body: pedidoMesa }), async (req, res, next) => {
  const { num } = req.params;
  const { mesero, items, total, adicional } = req.body;

  try {
    const mesa = await prisma.mesa.findUnique({ where: { numero: parseInt(num) } });
    if (!mesa) return next(new ErrorApp('NO_ENCONTRADO', 'Mesa no encontrada'));

    // Control de concurrencia: Evitar comandas adicionales en mesas que ya fueron cobradas/liberadas
    if (adicional) {
      const activeCount = await prisma.pedido.count({
        where: { mesaId: mesa.id, estado: { in: ['Cocina', 'Servido'] } }
      });
      if (activeCount === 0) {
        return next(new ErrorApp('CONFLICTO', 'Esta mesa ya ha sido cobrada y liberada por caja. Por favor, vuelve a abrir la mesa antes de comandar.'));
      }
    }

    const safeItems = Array.isArray(items) ? items : [];
    const itemsNuevos = safeItems.filter(i => i && !i.historial);
    if (itemsNuevos.length === 0) {
      return next(new ErrorApp('VALIDACION', 'No hay nuevos ítems pendientes para enviar a cocina.', { campo: 'items' }));
    }

    const safeMesero = mesero ? String(mesero).trim() : 'Mozo';
    const safeTotal = isNaN(parseFloat(total)) ? 0 : parseFloat(total);

    const expandedItems = await expandPedidoItemsForDb(itemsNuevos);

    const pedido = await prisma.$transaction(async (tx) => {
      const p = await tx.pedido.create({
        data: {
          mesaId: parseInt(mesa.id),
          mesero: safeMesero,
          total: safeTotal,
          adicional: adicional || false,
          estado: 'Cocina',
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
            throw new ErrorApp('STOCK_INSUFICIENTE', `Stock insuficiente para "${prodCheck.nombre}". Stock disponible: ${prodCheck.stock}, solicitado: ${item.cantidad}`, { datos: { disponible: prodCheck.stock } });
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
    next(err);
  }
});

module.exports = router;
