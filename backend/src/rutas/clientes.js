// Rutas de clientes y créditos: directorio, deudas y abonos
const express = require('express');
const { prisma } = require('../db');
const { parsearCreditoSplit } = require('../servicios/dinero');

const router = express.Router();

// ============================================================
// CLIENTES CON CRÉDITO (MÓDULO DE CRÉDITOS)
// ============================================================

// GET /api/clientes → Listar clientes autorizados con crédito activo
router.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true, tieneCredito: true },
      orderBy: { nombre: 'asc' },
      include: { AbonosCredito: { orderBy: { creadoEn: 'desc' } } },
    });

    // Obtener todas las ventas con crédito o split de crédito
    const ventasCredito = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: { not: null } },
          { metodoPago: 'Crédito' },
          { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } }
        ],
        anulado: false
      },
      select: { clienteCreditoId: true, montoCredito: true, total: true, ofertaDescripcion: true, metodoPago: true },
    });

    const consumoPorCliente = {};
    ventasCredito.forEach(v => {
      const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      if (splits.length > 0) {
        splits.forEach(s => {
          consumoPorCliente[s.clienteId] = (consumoPorCliente[s.clienteId] || 0) + s.monto;
        });
      } else if (v.clienteCreditoId) {
        const monto = v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0);
        consumoPorCliente[v.clienteCreditoId] = (consumoPorCliente[v.clienteCreditoId] || 0) + monto;
      }
    });

    const formateados = clientes.map(c => {
      const totalConsumido = Math.round((consumoPorCliente[c.id] || 0) * 100) / 100;
      const totalAbonado = c.AbonosCredito.reduce((s, a) => s + a.monto, 0);
      const saldo = Math.round((totalConsumido - totalAbonado) * 100) / 100;
      return {
        id: c.id,
        nombre: c.nombre,
        tipoDoc: c.tipoDoc,
        numDoc: c.numDoc,
        telefono: c.telefono,
        direccion: c.direccion,
        esTrabajador: c.esTrabajador,
        tieneCredito: c.tieneCredito,
        usuarioId: c.usuarioId,
        activo: c.activo,
        totalAbonado,
        totalConsumido,
        saldo,
        abonos: c.AbonosCredito,
      };
    });

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/directorio → Directorio general de clientes de consumo (paginado + buscador)
router.get('/api/clientes/directorio', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    const whereClause = {
      activo: true,
      ...(search ? {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { numDoc: { contains: search, mode: 'insensitive' } },
          { telefono: { contains: search, mode: 'insensitive' } },
        ]
      } : {})
    };

    const [total, clientes] = await Promise.all([
      prisma.cliente.count({ where: whereClause }),
      prisma.cliente.findMany({
        where: whereClause,
        orderBy: { creadoEn: 'desc' },
        skip,
        take: limit,
      })
    ]);

    const docs = clientes.map(c => c.numDoc).filter(Boolean);
    const ids = clientes.map(c => c.id);

    // Calcular métricas históricas de consumo
    const ventas = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: { in: ids } },
          ...(docs.length > 0 ? [{ numDocumento: { in: docs } }] : []),
        ],
        anulado: false,
      },
      select: {
        total: true,
        clienteCreditoId: true,
        numDocumento: true,
        createdAt: true,
      }
    });

    const metricas = {};
    for (const v of ventas) {
      if (v.clienteCreditoId) {
        if (!metricas[v.clienteCreditoId]) metricas[v.clienteCreditoId] = { total: 0, visitas: 0, ultimaVisita: null };
        metricas[v.clienteCreditoId].total += Number(v.total) || 0;
        metricas[v.clienteCreditoId].visitas += 1;
        if (!metricas[v.clienteCreditoId].ultimaVisita || new Date(v.createdAt) > new Date(metricas[v.clienteCreditoId].ultimaVisita)) {
          metricas[v.clienteCreditoId].ultimaVisita = v.createdAt;
        }
      }
      if (v.numDocumento) {
        const cMatch = clientes.find(c => c.numDoc === v.numDocumento);
        if (cMatch && cMatch.id !== v.clienteCreditoId) {
          if (!metricas[cMatch.id]) metricas[cMatch.id] = { total: 0, visitas: 0, ultimaVisita: null };
          metricas[cMatch.id].total += Number(v.total) || 0;
          metricas[cMatch.id].visitas += 1;
          if (!metricas[cMatch.id].ultimaVisita || new Date(v.createdAt) > new Date(metricas[cMatch.id].ultimaVisita)) {
            metricas[cMatch.id].ultimaVisita = v.createdAt;
          }
        }
      }
    }

    const items = clientes.map(c => {
      const m = metricas[c.id] || { total: 0, visitas: 0, ultimaVisita: c.creadoEn };
      return {
        id: c.id,
        nombre: c.nombre,
        tipoDoc: c.tipoDoc,
        numDoc: c.numDoc,
        telefono: c.telefono,
        direccion: c.direccion,
        esTrabajador: c.esTrabajador,
        tieneCredito: c.tieneCredito,
        totalConsumido: m.total,
        visitas: m.visitas,
        ultimaVisita: m.ultimaVisita || c.creadoEn,
        creadoEn: c.creadoEn,
      };
    });

    res.json({
      ok: true,
      clientes: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes → Crear un nuevo cliente
router.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, tipoDoc, numDoc, telefono, direccion, esTrabajador, usuarioId, tieneCredito } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }
    const cliente = await prisma.cliente.create({
      data: {
        nombre: String(nombre),
        tipoDoc: tipoDoc ? String(tipoDoc) : 'DNI',
        numDoc: numDoc ? String(numDoc) : null,
        telefono: telefono ? String(telefono) : null,
        direccion: direccion ? String(direccion) : null,
        esTrabajador: Boolean(esTrabajador),
        tieneCredito: tieneCredito !== undefined ? Boolean(tieneCredito) : true,
        usuarioId: usuarioId ? parseInt(usuarioId) : null,
      },
    });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clientes/:id → Editar un cliente
router.put('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.tipoDoc !== undefined) data.tipoDoc = String(req.body.tipoDoc);
    if (req.body.numDoc !== undefined) data.numDoc = req.body.numDoc ? String(req.body.numDoc) : null;
    if (req.body.telefono !== undefined) data.telefono = req.body.telefono ? String(req.body.telefono) : null;
    if (req.body.direccion !== undefined) data.direccion = req.body.direccion ? String(req.body.direccion) : null;
    if (req.body.esTrabajador !== undefined) data.esTrabajador = Boolean(req.body.esTrabajador);
    if (req.body.usuarioId !== undefined) data.usuarioId = req.body.usuarioId ? parseInt(req.body.usuarioId) : null;
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    const cliente = await prisma.cliente.update({ where: { id }, data });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clientes/:id → Desactivar un cliente
router.delete('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.cliente.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/:id → Ver detalle de cuenta corriente de un cliente
router.get('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { AbonosCredito: { orderBy: { creadoEn: 'desc' } } },
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    // Buscar todas las ventas que contengan crédito para este cliente (directo o por split)
    const ventasPosibles = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: id },
          { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } }
        ],
        anulado: false
      },
      include: { pedido: true },
      orderBy: { createdAt: 'desc' },
    });

    const ventasCredito = [];
    ventasPosibles.forEach(v => {
      const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      const miSplit = splits.find(s => s.clienteId === id);
      if (miSplit) {
        ventasCredito.push({
          id: v.id,
          fecha: v.createdAt.toISOString(),
          total: v.total,
          montoCredito: miSplit.monto,
          estado: v.pedido?.estado || 'Pagado',
          tipoComprobante: v.tipoComprobante,
        });
      } else if (v.clienteCreditoId === id && splits.length === 0) {
        ventasCredito.push({
          id: v.id,
          fecha: v.createdAt.toISOString(),
          total: v.total,
          montoCredito: v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0),
          estado: v.pedido?.estado || 'Pagado',
          tipoComprobante: v.tipoComprobante,
        });
      }
    });

    const totalConsumido = Math.round(ventasCredito.reduce((s, v) => s + v.montoCredito, 0) * 100) / 100;
    const totalAbonado = Math.round((cliente.AbonosCredito || []).reduce((s, a) => s + a.monto, 0) * 100) / 100;
    const saldo = Math.round((totalConsumido - totalAbonado) * 100) / 100;

    res.json({
      ...cliente,
      totalConsumido,
      totalAbonado,
      saldo,
      ventasCredito,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes/:id/abonar → Registrar un abono al crédito
router.post('/api/clientes/:id/abonar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { monto, metodoPago, montoEfectivo, montoTarjeta, montoYape, registradoPor, nota } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a 0.' });
    }

    // 1. Validar que la caja esté abierta (BUG-05)
    const turnoActivo = await prisma.cierreCaja.findFirst({ where: { estado: 'ABIERTO' } });
    if (!turnoActivo) {
      return res.status(400).json({
        error: 'La caja se encuentra cerrada. Debe aperturar un turno de caja antes de registrar abonos.',
        cajaCerrada: true,
      });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    const montoNum = Math.round(parseFloat(monto) * 100) / 100;

    // 2. Calcular saldo adeudado del cliente para evitar saldos negativos huérfanos
    const [ventasCliente, abonosCliente] = await Promise.all([
      prisma.venta.findMany({
        where: {
          OR: [
            { clienteCreditoId: id },
            { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } }
          ],
          anulado: false
        },
        select: { clienteCreditoId: true, montoCredito: true, total: true, ofertaDescripcion: true, metodoPago: true }
      }),
      prisma.abonoCredito.findMany({
        where: { clienteId: id },
        select: { monto: true }
      })
    ]);

    let totalConsumido = 0;
    ventasCliente.forEach(v => {
      const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      const miSplit = splits.find(s => s.clienteId === id);
      if (miSplit) {
        totalConsumido += miSplit.monto;
      } else if (v.clienteCreditoId === id && splits.length === 0) {
        totalConsumido += (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0));
      }
    });

    const totalAbonado = abonosCliente.reduce((s, a) => s + a.monto, 0);
    const saldoPendiente = Math.round((totalConsumido - totalAbonado) * 100) / 100;

    if (saldoPendiente <= 0) {
      return res.status(400).json({
        error: `El cliente "${cliente.nombre}" no tiene saldo pendiente por pagar (Saldo: S/ 0.00).`
      });
    }

    if (montoNum > (saldoPendiente + 0.05)) {
      return res.status(400).json({
        error: `El monto del abono (S/ ${montoNum.toFixed(2)}) supera la deuda pendiente del cliente (S/ ${saldoPendiente.toFixed(2)}).`
      });
    }

    const finalMetodo = metodoPago || 'Efectivo';
    let finalEfectivo = 0, finalTarjeta = 0, finalYape = 0;

    if (finalMetodo === 'Mixto') {
      finalEfectivo = parseFloat(montoEfectivo || 0);
      finalTarjeta = parseFloat(montoTarjeta || 0);
      finalYape = parseFloat(montoYape || 0);
      const sumaPartes = Math.round((finalEfectivo + finalTarjeta + finalYape) * 100) / 100;
      if (Math.abs(sumaPartes - montoNum) > 0.05) {
        return res.status(400).json({
          error: `En pago mixto, la suma de Efectivo (S/ ${finalEfectivo.toFixed(2)}), Tarjeta (S/ ${finalTarjeta.toFixed(2)}) y Yape (S/ ${finalYape.toFixed(2)}) es S/ ${sumaPartes.toFixed(2)}, pero el total a abonar es S/ ${montoNum.toFixed(2)}. Deben coincidir exactamente.`
        });
      }
    } else if (finalMetodo === 'Efectivo') {
      finalEfectivo = montoNum;
    } else if (finalMetodo === 'Tarjeta') {
      finalTarjeta = montoNum;
    } else if (finalMetodo === 'Yape') {
      finalYape = montoNum;
    }

    const abono = await prisma.abonoCredito.create({
      data: {
        clienteId: id,
        monto: montoNum,
        metodoPago: finalMetodo,
        montoEfectivo: finalEfectivo,
        montoTarjeta: finalTarjeta,
        montoYape: finalYape,
        registradoPor: registradoPor ? String(registradoPor) : 'Cajero',
        nota: nota ? String(nota) : null,
      },
    });

    res.json({ ok: true, abono });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/abonos → Listar todos los abonos registrados (opcional: filtrar por fecha desde)
router.get('/api/abonos', async (req, res) => {
  const { desde } = req.query;
  try {
    const where = {};
    if (desde) {
      where.creadoEn = { gte: new Date(desde) };
    }
    const abonos = await prisma.abonoCredito.findMany({
      where,
      include: { cliente: true },
      orderBy: { creadoEn: 'desc' },
    });
    res.json(abonos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/ventas/credito → Historial de ventas a crédito (para reportes)
router.get('/api/clientes/ventas/credito', async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { clienteCreditoId: { not: null }, anulado: false },
      include: {
        pedido: { include: { mesa: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formateadas = ventas.map(v => ({
      id: v.id,
      clienteId: v.clienteCreditoId,
      total: v.total,
      montoCredito: v.montoCredito || 0,
      nombreCliente: v.nombreCliente,
      fecha: v.createdAt.toISOString(),
      mesaNum: v.pedido?.mesa?.numero || null,
    }));

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CONSULTA RUC/DNI SEGURA (APIsNetPe / Decolecta)
// ============================================================
router.get('/api/clientes/consulta/:doc', async (req, res) => {
  const { doc } = req.params;
  const cleaned = doc.trim();

  // 1. Prioridad: Buscar primero en la base de datos local (Modo 100% Offline)
  try {
    const clienteLocal = await prisma.cliente.findFirst({
      where: { numDoc: cleaned, activo: true }
    });
    if (clienteLocal) {
      const isRUC = cleaned.length === 11;
      return res.json({
        nombre: isRUC ? '' : clienteLocal.nombre,
        razonSocial: isRUC ? clienteLocal.nombre : '',
        direccion: clienteLocal.direccion || '',
        tipo: isRUC ? 'Factura' : 'Boleta'
      });
    }
  } catch (errDb) {
    console.warn("[Consulta Offline BD Local]:", errDb.message);
  }

  // Fallbacks rápidos locales para pruebas rápidas en desarrollo
  if (cleaned === '20613857321') {
    return res.json({
      razonSocial: 'FIRST FISH S.A.C.',
      direccion: 'LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS',
      tipo: 'Factura'
    });
  } else if (cleaned === '10404040404') {
    return res.json({
      nombre: 'JUAN PEREZ SOTO',
      direccion: 'CALLE SAN MARTÍN 109',
      tipo: 'Boleta'
    });
  }

  const token = process.env.APIS_NET_PE_TOKEN;

  // Si no hay token configurado, proveemos fallbacks dinámicos inteligentes para simulación
  if (!token || token.includes('tu_token') || token === '') {
    const esRuc = cleaned.length === 11;
    if (esRuc) {
      return res.json({
        razonSocial: `CLIENTE RUC ${cleaned}`,
        direccion: `DIRECCIÓN LOCAL N° ${cleaned.substring(4, 7)}`,
        tipo: 'Factura'
      });
    } else {
      return res.json({
        nombre: `CLIENTE DNI ${cleaned}`,
        direccion: `CALLE LOCAL N° ${cleaned.substring(3, 6)}`,
        tipo: 'Boleta'
      });
    }
  }

  try {
    const isRUC = cleaned.length === 11;
    const apiURL = isRUC
      ? `https://api.decolecta.com/v1/sunat/ruc?numero=${cleaned}`
      : `https://api.decolecta.com/v1/reniec/dni?numero=${cleaned}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(apiURL, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Referer': 'https://apis.net.pe/',
        'Content-Type': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // Mapear al formato consistente que espera el frontend
      if (isRUC) {
        return res.json({
          razonSocial: data.razon_social || '',
          direccion: data.direccion || '',
          tipo: 'Factura'
        });
      } else {
        return res.json({
          nombre: data.full_name || `${data.first_name || ''} ${data.first_last_name || ''} ${data.second_last_name || ''}`.trim() || '',
          direccion: '', // DNI de RENIEC no devuelve dirección de forma pública
          tipo: 'Boleta'
        });
      }
    } else {
      const errorText = await response.text();
      console.warn(`[Proxy Decolecta] Error de respuesta de API (${response.status}): ${errorText}`);
      throw new Error(`API responded with status ${response.status}`);
    }
  } catch (err) {
    console.error("Error en proxy de consulta RUC/DNI:", err);
    const esRuc = cleaned.length === 11;
    res.json({
      razonSocial: '',
      nombre: '',
      direccion: '',
      tipo: esRuc ? 'Factura' : 'Boleta'
    });
  }
});

module.exports = router;
