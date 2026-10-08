// Rutas de reportes
const express = require('express');
const { prisma } = require('../db');
const { obtenerMontosVenta, parsearCreditoSplit } = require('../servicios/dinero');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { rangoFechasOpcional } = require('../../shared/esquemas/comunes.js');
const { requierePermiso } = require('../middlewares/permisos');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// REPORTES
// ============================================================

// GET /api/reportes/cancelaciones → Pedidos cancelados del día o rango de fechas
router.get('/api/reportes/cancelaciones', requierePermiso('Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/reportes/mozos → Estadísticas por mozo por rango de fechas
router.get('/api/reportes/mozos', requierePermiso('Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/reportes/cajeros → Rendimiento y desglose de ventas por cajero
router.get('/api/reportes/cajeros', requierePermiso('Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/reportes/contable → Ventas y compras por rango de fechas
router.get('/api/reportes/contable', requierePermiso('Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/reportes/pollos → Reporte de pollos vendidos e inventario con conversión fraccionada
router.get('/api/reportes/pollos', requierePermiso('Reportes'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
        // Por la fecha del cobro (como el balance); los pedidos viejos sin cobradoEn, por su creación
        OR: [{ cobradoEn: filtroFecha }, { cobradoEn: null, createdAt: filtroFecha }]
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
    next(err);
  }
});

// GET /api/reportes/rotacion → Cantidad vendida de cada producto por rango de fechas
router.get('/api/reportes/rotacion', requierePermiso('Reportes', 'Dashboard'), validar({ query: rangoFechasOpcional }), async (req, res, next) => {
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
        // Por la fecha del cobro (como el balance); los pedidos viejos sin cobradoEn, por su creación
        OR: [{ cobradoEn: filtroFecha }, { cobradoEn: null, createdAt: filtroFecha }]
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
    next(err);
  }
});

module.exports = router;
