// Rutas de pedidos para llevar y delivery
const express = require('express');
const { prisma } = require('../db');
const { calcularSubtotalEIgv, limpiarCodigoPago } = require('../servicios/dinero');
const { evaluarEstadoEnsalada, expandPedidoItemsForDb } = require('../servicios/pedidos');
const { ErrorApp } = require('../middlewares/errores');
const { validarIdsEnUrl } = require('../middlewares/validar');

const router = express.Router();
validarIdsEnUrl(router);

router.post('/api/pedidos/llevar', async (req, res, next) => {
  const {
    codigoPedidosYa,
    cajero,
    items,
    total,
    tipoDelivery,
    tipoComprobante,
    metodoPago,
    numDocumento,
    nombreCliente,
    clienteDireccion,
    montoDelivery,
    telefono,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    descuentoPorcentaje,
    descuentoMonto: descuentoMontoFijo,
    descuentoDescripcion,
    motivoCortesia,
    codigoPago
  } = req.body;

  try {
    // 0. Validar si la caja se encuentra abierta (BUG-05)
    const turnoActivo = await prisma.cierreCaja.findFirst({ where: { estado: 'ABIERTO' } });
    if (!turnoActivo) {
      return next(new ErrorApp('CAJA_CERRADA', 'La caja se encuentra cerrada. Debe aperturar un turno de caja antes de registrar pedidos para llevar o delivery.'));
    }

    const isTakeout = tipoDelivery === 'ParaLlevar';
    const isOwnDelivery = tipoDelivery === 'DeliveryPropio';

    // Validación defensiva: no crear pedidos sin ítems
    if (!items || items.length === 0) {
      return next(new ErrorApp('VALIDACION', 'No se puede crear un pedido sin ítems.', { campo: 'items' }));
    }

    const shippingFee = parseFloat(montoDelivery || 0);
    const finalMetodoPago = metodoPago || (tipoDelivery === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');

    // Calcular monto bruto de items y aplicar descuento porcentual una sola vez
    const itemsBruto = (items || []).reduce((acc, item) => acc + (parseFloat(item.precio || 0) * parseInt(item.cant || item.cantidad || 1)), 0);
    const descPct = parseFloat(descuentoPorcentaje || 0);
    // Descuento en soles (monto fijo) tiene prioridad sobre el porcentual
    const descFijo = parseFloat(descuentoMontoFijo || 0);
    const descuentoMonto = (descFijo > 0 && itemsBruto > 0)
      ? parseFloat(Math.min(descFijo, itemsBruto).toFixed(2))
      : (descPct > 0 && itemsBruto > 0) ? parseFloat((itemsBruto * (descPct / 100)).toFixed(2)) : 0;
    const totalConDescuento = Math.max(0, itemsBruto - descuentoMonto);
    let grandTotal = finalMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = finalMetodoPago === 'Cortesía' ? itemsBruto : descuentoMonto;

    // Validar crédito antes de crear el pedido para no dejar comandas huérfanas sin venta
    const tieneCredito = finalMetodoPago === 'Crédito' || (finalMetodoPago === 'Mixto' && parseFloat(montoCredito || 0) > 0);
    if (tieneCredito && !clienteCreditoId) {
      return next(new ErrorApp('VALIDACION', 'Debe seleccionar un cliente para registrar la venta a crédito.', { campo: 'clienteCreditoId' }));
    }

    const expandedItems = await expandPedidoItemsForDb(items);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(items);

    const { subtotal, igv } = calcularSubtotalEIgv(grandTotal);

    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;

    if (finalMetodoPago === 'Mixto') {
      finalMontoEfectivo = parseFloat(montoEfectivo || 0);
      finalMontoTarjeta = parseFloat(montoTarjeta || 0);
      finalMontoYape = parseFloat(montoYape || 0);
      finalMontoCredito = parseFloat(montoCredito || 0);
    } else if (finalMetodoPago === 'Efectivo') {
      finalMontoEfectivo = grandTotal;
    } else if (finalMetodoPago === 'Tarjeta') {
      finalMontoTarjeta = grandTotal;
    } else if (finalMetodoPago === 'Yape') {
      finalMontoYape = grandTotal;
    } else if (finalMetodoPago === 'Crédito') {
      finalMontoCredito = grandTotal;
    }

    if (finalMontoCredito > 0 && !clienteCreditoId) {
      return next(new ErrorApp('VALIDACION', 'Debe seleccionar un cliente para registrar la venta a crédito.', { campo: 'clienteCreditoId' }));
    }

    let finalNombreCliente = nombreCliente;
    if (!finalNombreCliente) {
      if (tipoDelivery === 'PedidosYa') finalNombreCliente = 'PEDIDOS YA';
      else finalNombreCliente = 'CONSUMIDOR FINAL';
    }

    const finalTipoComprobante = 'Ticket';
    const initEstadoSunat = 'NO_APLICA';

    // Transacción atómica completa: Pedido + Stock Decrement + Venta (BUG-04)
    const resultado = await prisma.$transaction(async (tx) => {
      const pedidoCreado = await tx.pedido.create({
        data: {
          mesaId: null,
          mesero: String(cajero),
          total: grandTotal,
          estado: 'Cocina', // Todos van a Cocina primero para que la cocina/barra los prepare
          estadoEnsalada: finalEstadoEnsalada,
          tipoEntrega: isOwnDelivery ? 'delivery' : 'llevar',
          codigoPedidosYa: codigoPedidosYa ? String(codigoPedidosYa) : null,
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

      // Descontar stock limitado con guardia atómica dentro de la transacción
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

      const ventaCreada = await tx.venta.create({
        data: {
          pedidoId: pedidoCreado.id,
          tipoComprobante: finalTipoComprobante,
          nombreCliente: finalNombreCliente,
          numDocumento: numDocumento || codigoPedidosYa || 'S/D',
          clienteDireccion: clienteDireccion || '',
          total: grandTotal,
          igv,
          subtotal,
          metodoPago: finalMetodoPago,
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
          montoCredito: finalMontoCredito,
          clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null,
          codigoPago: limpiarCodigoPago(codigoPago, finalMetodoPago, finalMontoTarjeta, finalMontoYape),
          estadoNubefact: initEstadoSunat,
          estadoSunat: initEstadoSunat,
          serie: null,
          numero: null,
          cajeroNombre: cajero ? String(cajero).trim() : null,
          descuentoAplicado: descuentoFinal,
          ofertaDescripcion: (() => {
            const motivoStr = motivoCortesia && String(motivoCortesia).trim() ? ` (${String(motivoCortesia).trim()})` : '';
            if (finalMetodoPago === 'Cortesía') {
              return `Cortesía total${motivoStr}`;
            }
            const hasCortesiaItems = Array.isArray(items) && items.some(i => i.notas && String(i.notas).includes('[CORTESÍA]'));
            if (hasCortesiaItems) {
              return `Cortesía de ítems${motivoStr}`;
            }
            return descuentoFinal > 0 ? (descuentoDescripcion || `Descuento manual ${descPct}%`) : null;
          })(),
        },
      });

      return { pedido: pedidoCreado, venta: ventaCreada };
    });

    res.json({
      ok: true,
      pedidoId: resultado.pedido.id,
      serie: resultado.venta.serie,
      numero: resultado.venta.numero,
      contingencia: false,
      estadoNubefact: resultado.venta.estadoNubefact,
      venta: resultado.venta
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/pedidos/llevar → Pedidos de delivery activos para CajaPage
router.get('/api/pedidos/llevar', async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { tipoEntrega: { in: ['llevar', 'delivery'] }, estado: { in: ['Cocina', 'Servido'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        Venta: true
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      codigoPedidosYa: p.codigoPedidosYa || null,
      tipoEntrega: p.tipoEntrega || 'llevar',
      cajero: (p.mesero && p.mesero !== 'undefined') ? p.mesero : 'Cajero',
      estado: p.estado,
      total: p.total,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      // Excluir items expandidos con precio 0 para evitar duplicidad al modificar en el frontend
      items: (p.items || []).filter(i => !i.esComponente).map(i => ({
        id: String(i.productoId),
        nombre: i.nombre,
        cant: i.cantidad,
        precio: i.precio,
        notas: i.notas
      })),
      ventaData: p.Venta ? {
        id: p.Venta.id,
        tipoComprobante: p.Venta.tipoComprobante,
        nombreCliente: p.Venta.nombreCliente,
        numDocumento: p.Venta.numDocumento,
        metodoPago: p.Venta.metodoPago,
        montoEfectivo: p.Venta.montoEfectivo,
        montoTarjeta: p.Venta.montoTarjeta,
        montoYape: p.Venta.montoYape
      } : null
    }));

    res.json(formateados);
  } catch (err) {
    next(err);
  }
});

// PUT /api/pedidos/llevar/:id → Modificar un pedido de llevar/delivery activo
router.put('/api/pedidos/llevar/:id', async (req, res, next) => {
  const id = parseInt(req.params.id);
  const {
    codigoPedidosYa,
    cajero,
    items,
    total,
    tipoDelivery,
    montoDelivery,
    telefono,
    nombreCliente,
    clienteDireccion,
    metodoPago,
    numDocumento,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    descuentoPorcentaje,
    descuentoMonto: descuentoMontoFijo,
    descuentoDescripcion,
    codigoPago
  } = req.body;

  try {
    const isTakeout = tipoDelivery === 'ParaLlevar';
    const isOwnDelivery = tipoDelivery === 'DeliveryPropio';

    const shippingFee = parseFloat(montoDelivery || 0);
    const finalMetodoPago = metodoPago || (tipoDelivery === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');

    // Calcular monto bruto de items y aplicar descuento porcentual una sola vez
    const itemsBruto = (items || []).reduce((acc, item) => acc + (parseFloat(item.precio || 0) * parseInt(item.cant || item.cantidad || 1)), 0);
    const descPct = parseFloat(descuentoPorcentaje || 0);
    // Descuento en soles (monto fijo) tiene prioridad sobre el porcentual
    const descFijo = parseFloat(descuentoMontoFijo || 0);
    const descuentoMonto = (descFijo > 0 && itemsBruto > 0)
      ? parseFloat(Math.min(descFijo, itemsBruto).toFixed(2))
      : (descPct > 0 && itemsBruto > 0) ? parseFloat((itemsBruto * (descPct / 100)).toFixed(2)) : 0;
    const totalConDescuento = Math.max(0, itemsBruto - descuentoMonto);
    let grandTotal = finalMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = finalMetodoPago === 'Cortesía' ? itemsBruto : descuentoMonto;

    const expandedItems = await expandPedidoItemsForDb(items);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(items);

    // 1. Obtener pedido actual
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!pedido) {
      return next(new ErrorApp('NO_ENCONTRADO', 'Pedido no encontrado.'));
    }

    if (pedido.estado !== 'Cocina' && pedido.estado !== 'Servido') {
      return next(new ErrorApp('CONFLICTO', 'No se puede modificar un pedido que ya fue cobrado o cancelado.'));
    }

    // 2. Ejecutar actualización en una transacción
    await prisma.$transaction(async (tx) => {
      // Devolver stock de productos limitados antiguos para evitar pérdidas/errores
      const oldItems = pedido.items;
      for (const oldItem of oldItems) {
        if (oldItem.productoId) {
          await tx.producto.updateMany({
            where: { id: oldItem.productoId, tipoStock: 'limitado' },
            data: { stock: { increment: oldItem.cantidad } }
          });
        }
      }

      // Eliminar ítems antiguos
      await tx.itemPedido.deleteMany({
        where: { pedidoId: id }
      });

      // Crear nuevos ítems expandidos
      await tx.itemPedido.createMany({
        data: expandedItems.map(i => ({
          pedidoId: id,
          productoId: i.productoId,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad,
          historial: i.historial,
          entregado: i.entregado || false,
          notas: i.notas,
          esComponente: i.esComponente || false,
        }))
      });

      // Descontar stock de lo nuevo (incluye los componentes de un combo)
      for (const item of expandedItems) {
        await tx.producto.updateMany({
          where: { id: item.productoId, tipoStock: 'limitado' },
          data: { stock: { decrement: item.cantidad } }
        });
      }

      // Actualizar pedido
      await tx.pedido.update({
        where: { id },
        data: {
          mesero: String(cajero),
          total: grandTotal,
          estado: 'Cocina', // Al modificarlo, debe volver a cocina para preparación/validación
          estadoEnsalada: finalEstadoEnsalada,
          tipoEntrega: isOwnDelivery ? 'delivery' : 'llevar',
          codigoPedidosYa: codigoPedidosYa ? String(codigoPedidosYa) : null
        }
      });

      // Calcular subtotal e IGV para actualizar la Venta asociada
      const { subtotal, igv } = calcularSubtotalEIgv(grandTotal);
      let finalMontoEfectivo = 0;
      let finalMontoTarjeta = 0;
      let finalMontoYape = 0;
      let finalMontoCredito = 0;

      if (finalMetodoPago === 'Mixto') {
        finalMontoEfectivo = parseFloat(montoEfectivo || 0);
        finalMontoTarjeta = parseFloat(montoTarjeta || 0);
        finalMontoYape = parseFloat(montoYape || 0);
        finalMontoCredito = parseFloat(montoCredito || 0);
      } else if (finalMetodoPago === 'Efectivo') {
        finalMontoEfectivo = grandTotal;
      } else if (finalMetodoPago === 'Tarjeta') {
        finalMontoTarjeta = grandTotal;
      } else if (finalMetodoPago === 'Yape') {
        finalMontoYape = grandTotal;
      } else if (finalMetodoPago === 'Crédito') {
        finalMontoCredito = grandTotal;
      }

      if (finalMontoCredito > 0 && !clienteCreditoId) {
        throw new ErrorApp('VALIDACION', 'Debe seleccionar un cliente para registrar la venta a crédito.', { campo: 'clienteCreditoId' });
      }

      let finalNombreCliente = nombreCliente;
      if (!finalNombreCliente) {
        if (tipoDelivery === 'PedidosYa') finalNombreCliente = 'PEDIDOS YA';
        else finalNombreCliente = 'CONSUMIDOR FINAL';
      }

      await tx.venta.updateMany({
        where: { pedidoId: id },
        data: {
          nombreCliente: finalNombreCliente,
          numDocumento: numDocumento || codigoPedidosYa || 'S/D',
          total: grandTotal,
          subtotal,
          igv,
          metodoPago: finalMetodoPago,
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
          montoCredito: finalMontoCredito,
          clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null,
          // Al modificar un pedido sin reescribir el código, se conserva el que ya tenía
          codigoPago: limpiarCodigoPago(codigoPago, finalMetodoPago, finalMontoTarjeta, finalMontoYape) ?? undefined,
          descuentoAplicado: descuentoFinal,
          ofertaDescripcion: descuentoFinal > 0 ? (descuentoDescripcion || `Descuento manual ${descPct}%`) : null
        }
      });
    });

    const venta = await prisma.venta.findFirst({
      where: { pedidoId: id }
    });

    res.json({ ok: true, venta });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pedidos/:id/entregar → Caja confirma entrega del delivery
router.patch('/api/pedidos/:id/entregar', async (req, res, next) => {
  try {
    await prisma.pedido.update({
      where: { id: parseInt(req.params.id) },
      data: { estado: 'Cobrado' },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
