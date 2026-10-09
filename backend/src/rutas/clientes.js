// Rutas de clientes y créditos: directorio, deudas y abonos
const express = require('express');
const { prisma } = require('../db');
const { consumidoPorCliente } = require('../servicios/creditos');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { abono, clienteEdicion, clienteNuevo } = require('../../shared/esquemas/clientes.js');
const { consultaDesde, consultaDirectorio } = require('../../shared/esquemas/comunes.js');
const { requierePermiso } = require('../middlewares/permisos');
const { idempotente } = require('../middlewares/idempotencia');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// CLIENTES CON CRÉDITO (MÓDULO DE CRÉDITOS)
// ============================================================

// GET /api/clientes → Listar clientes autorizados con crédito activo
router.get('/api/clientes', requierePermiso('Caja', 'Creditos', 'Reportes'), async (req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true, tieneCredito: true },
      orderBy: { nombre: 'asc' },
      include: { AbonosCredito: { select: { monto: true } } },
    });

    // Lo cargado a crédito a cada cliente (ventas no anuladas)
    const consumoPorCliente = await consumidoPorCliente(clientes.map((c) => c.id));

    const formateados = clientes.map(c => {
      const totalConsumido = Math.round((consumoPorCliente[c.id] || 0) * 100) / 100;
      const totalAbonado = Math.round((c.AbonosCredito.reduce((s, a) => s + a.monto, 0)) * 100) / 100;
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
      };
    });

    res.json(formateados);
  } catch (err) {
    next(err);
  }
});

// GET /api/clientes/directorio → Directorio general de clientes de consumo (paginado + buscador)
router.get('/api/clientes/directorio', requierePermiso('Creditos'), validar({ query: consultaDirectorio }), async (req, res, next) => {
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

    // Lo que consumió cada cliente (ventas no anuladas): su parte del crédito y, lo pagado al contado,
    // el cliente del documento (o el único cliente a crédito). Antes se sumaba el total de la venta: en un
    // reparto el primer cliente se llevaba la cuenta entera, y una venta podía contarse a dos clientes.
    const ventas = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: { in: ids } },
          { creditos: { some: { clienteId: { in: ids } } } },
          ...(docs.length > 0 ? [{ numDocumento: { in: docs } }] : []),
        ],
        anulado: false,
      },
      select: { total: true, numDocumento: true, createdAt: true, creditos: { select: { clienteId: true, monto: true } } },
    });

    const metricas = {};
    const sumar = (clienteId, monto, fecha) => {
      if (!ids.includes(clienteId)) return;
      const m = metricas[clienteId] || (metricas[clienteId] = { total: 0, visitas: 0, ultimaVisita: null });
      m.total += monto;
      m.visitas += 1;
      if (!m.ultimaVisita || new Date(fecha) > new Date(m.ultimaVisita)) m.ultimaVisita = fecha;
    };
    for (const v of ventas) {
      const porCliente = new Map();
      for (const parte of v.creditos) porCliente.set(parte.clienteId, (porCliente.get(parte.clienteId) || 0) + Number(parte.monto));
      const resto = Math.max(0, Number(v.total) - v.creditos.reduce((s, c) => s + Number(c.monto), 0));
      const delDocumento = v.numDocumento ? clientes.find(c => c.numDoc === v.numDocumento)?.id : null;
      const duenoDelResto = delDocumento || (porCliente.size === 1 ? [...porCliente.keys()][0] : null);
      if (duenoDelResto && resto > 0) porCliente.set(duenoDelResto, (porCliente.get(duenoDelResto) || 0) + resto);
      for (const [clienteId, monto] of porCliente) sumar(clienteId, monto, v.createdAt);
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
        totalConsumido: Math.round(m.total * 100) / 100,
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
    next(err);
  }
});

// POST /api/clientes → Crear un nuevo cliente
router.post('/api/clientes', requierePermiso('Creditos'), validar({ body: clienteNuevo }), async (req, res, next) => {
  try {
    const { nombre, tipoDoc, numDoc, telefono, direccion, esTrabajador, usuarioId, tieneCredito } = req.body;
    if (!nombre) {
      return next(new ErrorApp('VALIDACION', 'El nombre del cliente es obligatorio.', { campo: 'nombre' }));
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
    next(err);
  }
});

// PUT /api/clientes/:id → Editar un cliente
router.put('/api/clientes/:id', requierePermiso('Creditos'), validar({ body: clienteEdicion }), async (req, res, next) => {
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
    next(err);
  }
});

// DELETE /api/clientes/:id → Desactivar un cliente
router.delete('/api/clientes/:id', requierePermiso('Creditos'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.cliente.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/clientes/:id → Ver detalle de cuenta corriente de un cliente
router.get('/api/clientes/:id', requierePermiso('Creditos'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { AbonosCredito: { orderBy: { creadoEn: 'desc' } } },
    });
    if (!cliente) return next(new ErrorApp('NO_ENCONTRADO', 'Cliente no encontrado.'));

    // Ventas (no anuladas) con una parte cargada a este cliente
    const partes = await prisma.ventaCredito.findMany({
      where: { clienteId: id, venta: { anulado: false } },
      include: { venta: { include: { pedido: true } } },
      orderBy: { venta: { createdAt: 'desc' } },
    });
    const ventasCredito = partes.map(({ venta: v, monto }) => ({
      id: v.id,
      fecha: v.createdAt.toISOString(),
      total: v.total,
      montoCredito: Number(monto),
      estado: v.pedido?.estado || 'Pagado',
      tipoComprobante: v.tipoComprobante,
    }));

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
    next(err);
  }
});

// POST /api/clientes/:id/abonar → Registrar un abono al crédito
router.post('/api/clientes/:id/abonar', requierePermiso('Creditos'), idempotente, validar({ body: abono }), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { monto, metodoPago, montoEfectivo, montoTarjeta, montoYape, registradoPor, nota } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      return next(new ErrorApp('VALIDACION', 'El monto del abono debe ser mayor a 0.', { campo: 'monto' }));
    }

    // 1. Validar que la caja esté abierta (BUG-05)
    const turnoActivo = await prisma.cierreCaja.findFirst({ where: { estado: 'ABIERTO' } });
    if (!turnoActivo) {
      return next(new ErrorApp('CAJA_CERRADA', 'La caja se encuentra cerrada. Debe aperturar un turno de caja antes de registrar abonos.'));
    }

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return next(new ErrorApp('NO_ENCONTRADO', 'Cliente no encontrado.'));

    const montoNum = Math.round(parseFloat(monto) * 100) / 100;

    // 2. Calcular saldo adeudado del cliente para evitar saldos negativos huérfanos
    const [consumo, abonosCliente] = await Promise.all([
      consumidoPorCliente([id]),
      prisma.abonoCredito.findMany({
        where: { clienteId: id },
        select: { monto: true }
      })
    ]);
    const totalConsumido = consumo[id] || 0;

    const totalAbonado = abonosCliente.reduce((s, a) => s + a.monto, 0);
    const saldoPendiente = Math.round((totalConsumido - totalAbonado) * 100) / 100;

    if (saldoPendiente <= 0) {
      return next(new ErrorApp('VALIDACION', `El cliente "${cliente.nombre}" no tiene saldo pendiente por pagar (Saldo: S/ 0.00).`, { campo: 'monto' }));
    }

    if (montoNum > (saldoPendiente + 0.05)) {
      return next(new ErrorApp('VALIDACION', `El monto del abono (S/ ${montoNum.toFixed(2)}) supera la deuda pendiente del cliente (S/ ${saldoPendiente.toFixed(2)}).`, { campo: 'monto' }));
    }

    const finalMetodo = metodoPago || 'Efectivo';
    let finalEfectivo = 0, finalTarjeta = 0, finalYape = 0;

    if (finalMetodo === 'Mixto') {
      finalEfectivo = parseFloat(montoEfectivo || 0);
      finalTarjeta = parseFloat(montoTarjeta || 0);
      finalYape = parseFloat(montoYape || 0);
      const sumaPartes = Math.round((finalEfectivo + finalTarjeta + finalYape) * 100) / 100;
      if (Math.abs(sumaPartes - montoNum) > 0.05) {
        return next(new ErrorApp('PAGO_NO_CUADRA', `En pago mixto, la suma de Efectivo (S/ ${finalEfectivo.toFixed(2)}), Tarjeta (S/ ${finalTarjeta.toFixed(2)}) y Yape (S/ ${finalYape.toFixed(2)}) es S/ ${sumaPartes.toFixed(2)}, pero el total a abonar es S/ ${montoNum.toFixed(2)}. Deben coincidir exactamente.`, { campo: 'montoEfectivo' }));
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
    next(err);
  }
});

// GET /api/abonos → Listar todos los abonos registrados (opcional: filtrar por fecha desde)
router.get('/api/abonos', requierePermiso('Creditos', 'Reportes'), validar({ query: consultaDesde }), async (req, res, next) => {
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
    next(err);
  }
});

// GET /api/clientes/ventas/credito → Historial de ventas a crédito (para reportes)
router.get('/api/clientes/ventas/credito', requierePermiso('Creditos'), async (req, res, next) => {
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
    next(err);
  }
});

// ============================================================
// CONSULTA RUC/DNI SEGURA (APIsNetPe / Decolecta)
// ============================================================
router.get('/api/clientes/consulta/:doc', requierePermiso('Creditos'), async (req, res) => {
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

  const token = process.env.APIS_NET_PE_TOKEN;

  // Sin token configurado no se inventan datos (terminarían en el ticket y en el directorio): se escriben a mano
  if (!token || token.includes('tu_token')) {
    const esRuc = cleaned.length === 11;
    return res.json({ razonSocial: '', nombre: '', direccion: '', tipo: esRuc ? 'Factura' : 'Boleta' });
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
