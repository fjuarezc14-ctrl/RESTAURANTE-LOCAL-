// Rutas de compras y gastos (RCE)
const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// ============================================================
// COMPRAS (RCE)
// ============================================================

router.get('/api/compras', async (req, res) => {
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
router.get('/api/compras/stats', async (req, res) => {
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
router.post('/api/compras/sincronizar-sunat', async (req, res) => {
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

router.post('/api/compras', async (req, res) => {
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
router.patch('/api/compras/:id/categoria', async (req, res) => {
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
router.put('/api/compras/:id', async (req, res) => {
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
router.delete('/api/compras/:id', async (req, res) => {
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

module.exports = router;
