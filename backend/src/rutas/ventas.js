// Rutas de ventas: cobro, anulación, cambios de una venta y resumen
const express = require('express');
const { prisma } = require('../db');
const { calcularSubtotalEIgv, limpiarCodigoPago, obtenerMontosVenta, parsearCreditoSplit } = require('../servicios/dinero');
const { ErrorApp } = require('../middlewares/errores');
const { buscarUsuarioPorPin } = require('../servicios/auth');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { anulacion, cobro, correccionDatosCliente, correccionMetodoPago, correccionTipoEntrega } = require('../../shared/esquemas/ventas.js');
const { consultaDesde, rangoFechasOpcional } = require('../../shared/esquemas/comunes.js');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// CAJA / VENTAS
// ============================================================

// PATCH /api/ventas/:ventaId/metodo-pago → Corregir método de pago (requiere PIN Administrador)
router.patch('/api/ventas/:ventaId/metodo-pago', requierePermiso('Caja'), validar({ body: correccionMetodoPago }), async (req, res, next) => {
  const { ventaId } = req.params;
  const { metodoPago, pin, montoEfectivo, montoTarjeta, montoYape, montoCredito, clienteCreditoId } = req.body;

  const metodosPermitidos = ['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto', 'Crédito'];
  if (!metodoPago || !metodosPermitidos.includes(metodoPago)) {
    return next(new ErrorApp('VALIDACION', `Método de pago inválido. Opciones: ${metodosPermitidos.join(', ')}`, { campo: 'metodoPago' }));
  }
  if (!pin) {
    return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'Se requiere PIN de Administrador.', { campo: 'pin' }));
  }

  try {
    // Validar PIN
    const admin = await buscarUsuarioPorPin(pin);
    if (!admin) return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    if (admin.rol !== 'Administrador') {
      return next(new ErrorApp('SIN_PERMISO', 'Solo el Administrador puede cambiar el método de pago.'));
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return next(new ErrorApp('NO_ENCONTRADO', 'Venta no encontrada.'));

    const pedido = venta.pedido;
    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido asociado no encontrado.'));

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
      return next(new ErrorApp('VALIDACION', 'Debe seleccionar un cliente para registrar la venta a crédito.', { campo: 'clienteCreditoId' }));
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
    next(err);
  }
});

// PATCH /api/ventas/:ventaId/tipo-entrega → Corregir tipo de entrega (PedidosYa, Para Llevar, Delivery)
router.patch('/api/ventas/:ventaId/tipo-entrega', requierePermiso('Caja'), validar({ body: correccionTipoEntrega }), async (req, res, next) => {
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
    return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'Se requiere PIN de Administrador.', { campo: 'pin' }));
  }

  try {
    // Validar PIN
    const admin = await buscarUsuarioPorPin(pin);
    if (!admin) return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    if (admin.rol !== 'Administrador') {
      return next(new ErrorApp('SIN_PERMISO', 'Solo el Administrador puede cambiar el tipo de entrega.'));
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return next(new ErrorApp('NO_ENCONTRADO', 'Venta no encontrada.'));

    const pedido = venta.pedido;
    if (!pedido) return next(new ErrorApp('NO_ENCONTRADO', 'Pedido asociado no encontrado.'));

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
      return next(new ErrorApp('VALIDACION', 'Tipo de entrega inválido.', { campo: 'tipoEntrega' }));
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
    next(err);
  }
});

// PATCH /api/ventas/:ventaId/datos-cliente → Corregir datos de facturación / datos de cliente de una venta
router.patch('/api/ventas/:ventaId/datos-cliente', requierePermiso('Caja'), validar({ body: correccionDatosCliente }), async (req, res, next) => {
  const { ventaId } = req.params;
  const {
    numDocumento,
    nombreCliente,
    clienteDireccion,
    pin
  } = req.body;

  if (!pin) {
    return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'Se requiere PIN de Administrador.', { campo: 'pin' }));
  }

  try {
    // Validar PIN
    const admin = await buscarUsuarioPorPin(pin);
    if (!admin) return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    if (admin.rol !== 'Administrador') {
      return next(new ErrorApp('SIN_PERMISO', 'Solo el Administrador puede cambiar los datos del cliente.'));
    }

    // Obtener la venta
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) }
    });
    if (!venta) return next(new ErrorApp('NO_ENCONTRADO', 'Venta no encontrada.'));

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
    next(err);
  }
});

// PATCH /api/ventas/:ventaId/anular → Anular / Registrar devolución de un pedido entregado
router.patch('/api/ventas/:ventaId/anular', requierePermiso('Caja'), validar({ body: anulacion }), async (req, res, next) => {
  const { ventaId } = req.params;
  const { pin, motivo } = req.body;

  if (!pin) {
    return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'Se requiere PIN de Administrador.', { campo: 'pin' }));
  }

  try {
    const admin = await buscarUsuarioPorPin(pin);
    if (!admin) return next(new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' }));
    if (admin.rol !== 'Administrador') {
      return next(new ErrorApp('SIN_PERMISO', 'Solo el Administrador puede anular o registrar devolución de ventas.'));
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
    if (!venta) return next(new ErrorApp('NO_ENCONTRADO', 'Venta no encontrada.'));

    if (venta.anulado || venta.pedido?.estado === 'Cancelado') {
      return next(new ErrorApp('CONFLICTO', 'Esta venta ya se encuentra anulada / devuelta.'));
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
    next(err);
  }
});

// POST /api/ventas → Cobrar mesa (acepta pedidoIds array o pedidoId simple)
router.post('/api/ventas', requierePermiso('Caja'), validar({ body: cobro }), async (req, res, next) => {
  const {
    pedidoId,
    pedidoIds,
    numDocumento,
    nombreCliente,
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
      return next(new ErrorApp('CAJA_CERRADA', 'La caja se encuentra cerrada. Debe aperturar un turno de caja antes de realizar cobros.'));
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
      return next(new ErrorApp('PEDIDO_NO_SERVIDO', `La mesa todavía tiene ${pendientes > 0 ? `${pendientes} plato(s)` : 'pedidos'} en preparación. Cóbrala cuando cocina y barra marquen todo como listo.`));
    }

    // 1.0b Tampoco se cobra si hay platos listos que el mozo aún no llevó a la mesa
    const porServir = await prisma.itemPedido.findMany({
      where: { pedidoId: { in: idsAPagar }, historial: true, entregado: false, pedido: { tipoEntrega: 'salon' } },
      select: { nombre: true, cantidad: true },
    });
    if (porServir.length > 0) {
      const detalle = porServir.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
      return next(new ErrorApp('PEDIDO_NO_SERVIDO', `La mesa tiene platos que el mozo aún no ha servido: ${detalle}. Cóbrala cuando el mozo los marque como servidos.`));
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
        // Solo ítems de los pedidos que se cobran (antes se podía dejar en 0 un plato de otra mesa)
        const itemsAActualizar = await tx.itemPedido.findMany({
          where: { id: { in: itemIds }, pedidoId: { in: idsAPagar } }
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

      // Las partes de un pago mixto o de un crédito repartido tienen que sumar el total cobrado
      const sumaPartes = finalMontoEfectivo + finalMontoTarjeta + finalMontoYape + finalMontoCredito;
      if (metodoPago === 'Mixto' && Math.abs(sumaPartes - finalTotal) > 0.05) {
        throw new ErrorApp('PAGO_NO_CUADRA', `La suma de los medios de pago (S/ ${sumaPartes.toFixed(2)}) no coincide con el total (S/ ${finalTotal.toFixed(2)}).`, { campo: 'montoEfectivo' });
      }
      if (metodoPago === 'Crédito' && validCreditosSplits.length > 0 && Math.abs(finalMontoCredito - finalTotal) > 0.05) {
        throw new ErrorApp('PAGO_NO_CUADRA', `La suma de los créditos (S/ ${finalMontoCredito.toFixed(2)}) no coincide con el total (S/ ${finalTotal.toFixed(2)}).`, { campo: 'creditosDetalle' });
      }

      if (finalMontoCredito > 0 && !finalClienteCreditoId) {
        throw new ErrorApp('VALIDACION', 'Debe seleccionar al menos un cliente para registrar la venta a crédito.', { campo: 'clienteCreditoId' });
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
    next(err);
  }
});

// GET /api/ventas → Historial detallado de las ventas del día o rango de fechas (hora Perú)
router.get('/api/ventas', requierePermiso('Caja', 'Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/ventas/resumen → Estadísticas del día (hora Perú)
router.get('/api/ventas/resumen', requierePermiso('Caja', 'Dashboard'), validar({ query: consultaDesde }), async (req, res, next) => {
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
    next(err);
  }
});

module.exports = router;
