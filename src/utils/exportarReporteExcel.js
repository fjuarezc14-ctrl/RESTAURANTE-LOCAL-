// Exportación contable a Excel (.xlsx real, multi-hoja) para la página de Reportes.
// exceljs se carga bajo demanda para no inflar el bundle principal.

const FMT_SOLES = '"S/" #,##0.00';
const FMT_FECHA = 'dd/mm/yyyy';

const COLOR = {
  titulo: 'FF0F172A',
  cabecera: 'FF1E293B',
  cabeceraCompras: 'FF9F1239',
  total: 'FFE2E8F0',
  suave: 'FFF1F5F9',
  borde: 'FFCBD5E1',
  anulado: 'FFFEF2F2',
};

const num = (n) => Number(n) || 0;

const esAnulada = (v) => !!(v.anulado || v.estadoPedido === 'Cancelado');

// PedidosYa con código de delivery/llevar propio en realidad se cobró en efectivo
export const metodoReal = (v) => {
  if (v.metodoPago === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) return 'Efectivo';
  return v.metodoPago;
};

// Reparte el total de una venta entre los medios de cobro. Las ventas devueltas no suman.
export const montosVenta = (v) => {
  const m = { efectivo: 0, tarjeta: 0, yape: 0, credito: 0, pedidosYa: 0, consumo: 0, cortesia: 0 };
  if (esAnulada(v)) return m;
  const total = num(v.total);
  switch (metodoReal(v)) {
    case 'Efectivo': m.efectivo = total; break;
    case 'Tarjeta': m.tarjeta = total; break;
    case 'Yape': m.yape = total; break;
    case 'Crédito': m.credito = total; break;
    case 'PedidosYa': m.pedidosYa = total; break;
    case 'Consumo': m.consumo = num(v.descuentoAplicado) || total; break;
    case 'Cortesía': m.cortesia = (v.items || []).reduce((s, i) => s + num(i.cant) * num(i.precio), 0); break;
    case 'Mixto': {
      m.efectivo = num(v.montoEfectivo);
      m.tarjeta = num(v.montoTarjeta);
      m.yape = num(v.montoYape);
      m.credito = num(v.montoCredito);
      // El saldo no declarado se asume en efectivo (sin tocar la parte a crédito)
      const resto = total - (m.efectivo + m.tarjeta + m.yape + m.credito);
      if (resto > 0.009) m.efectivo += resto;
      break;
    }
    default: break;
  }
  return m;
};

export const clienteDeVenta = (v, parseDeliveryInfo) => {
  const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
  if (info) return info.nombre;
  if (v.nombreCliente?.startsWith('DELIVERY -')) return v.nombreCliente.replace('DELIVERY - ', '');
  return v.nombreCliente || 'Consumidor Final';
};

export const origenDeVenta = (v) => {
  if (!v.codigoPedidosYa) return `Mesa ${v.mesaNum || 'S/M'}`;
  if (v.codigoPedidosYa.startsWith('DELIVERY -')) return 'Delivery';
  if (v.codigoPedidosYa.startsWith('LLEVAR -')) return 'Para llevar';
  return `PedidosYa ${v.codigoPedidosYa}`;
};

export const numeroComprobante = (v) => (v.serie ? `${v.serie}-${String(v.numero ?? v.id).padStart(4, '0')}` : `#${v.id}`);

// Fecha local (Lima) de una venta como Date a medianoche, para agrupar y para celdas de fecha
const fechaLocal = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const claveFecha = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

// Créditos comerciales vs. descuentos de planilla (misma regla que la pestaña "Consumos y créditos")
export const construirCreditosPlanilla = (ventas, clientes, parsearCreditoSplit) => {
  const clienteMap = new Map((clientes || []).map(c => [c.id, c]));
  const planilla = [];
  const comercial = [];
  const base = (v) => ({ id: v.id, fecha: v.fecha, createdAt: v.createdAt, hora: v.hora, itemsResumen: v.itemsResumen, rawVenta: v });

  (ventas || []).forEach(v => {
    if (esAnulada(v)) return;
    if (v.metodoPago === 'Consumo') {
      planilla.push({ ...base(v), nombre: v.nombreCliente || v.mesero || 'Consumo Personal', documento: '', monto: v.descuentoAplicado || v.total });
      return;
    }
    const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
    if (splits.length > 0) {
      splits.forEach(s => {
        const cli = clienteMap.get(s.clienteId);
        const item = {
          ...base(v),
          nombre: cli?.nombre || s.nombre || v.nombreCliente || 'Cliente Crédito',
          documento: cli?.numDoc || cli?.documento || '',
          monto: s.monto,
        };
        if (cli?.esTrabajador) planilla.push(item);
        else comercial.push(item);
      });
    } else if (v.metodoPago === 'Crédito') {
      comercial.push({ ...base(v), nombre: v.nombreCliente || 'Cliente Comercial', documento: '', monto: v.total });
    }
  });
  return { planilla, comercial };
};

// ── Helpers de hoja ──
const bordeFino = { style: 'thin', color: { argb: COLOR.borde } };
const bordes = { top: bordeFino, left: bordeFino, bottom: bordeFino, right: bordeFino };

const encabezadoHoja = (ws, empresa, titulo, desde, hasta, nCols) => {
  const filas = [
    [empresa.legalName || empresa.name || 'EMPRESA', { bold: true, size: 14, color: { argb: COLOR.titulo } }],
    [`RUC ${empresa.ruc || '—'}${empresa.address ? ` · ${empresa.address}` : ''}`, { size: 9, color: { argb: 'FF64748B' } }],
    [titulo, { bold: true, size: 12, color: { argb: 'FF334155' } }],
    [`Periodo: ${desde} al ${hasta} · Emitido: ${new Date().toLocaleString('es-PE')}`, { size: 9, color: { argb: 'FF64748B' } }],
  ];
  filas.forEach(([texto, font], i) => {
    const r = i + 1;
    ws.mergeCells(r, 1, r, nCols);
    const c = ws.getCell(r, 1);
    c.value = texto;
    c.font = font;
  });
  ws.addRow([]);
  return 6; // primera fila libre
};

// Tabla con cabecera, filas, formatos por columna, fila de totales (SUBTOTAL respeta filtros) y autofiltro
const tabla = (ws, filaInicio, columnas, filas, { colorCabecera = COLOR.cabecera, totales = true, etiquetaTotal = 'TOTALES', filaEstilo } = {}) => {
  const cab = ws.getRow(filaInicio);
  columnas.forEach((col, i) => {
    const c = cab.getCell(i + 1);
    c.value = col.titulo;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorCabecera } };
    c.alignment = { vertical: 'middle', horizontal: col.alinear || (col.tipo === 'soles' || col.tipo === 'numero' ? 'right' : 'left'), wrapText: true };
    c.border = bordes;
  });
  cab.height = 22;

  filas.forEach((fila, idx) => {
    const r = ws.getRow(filaInicio + 1 + idx);
    columnas.forEach((col, i) => {
      const c = r.getCell(i + 1);
      c.value = fila[i] ?? null;
      c.border = bordes;
      if (col.tipo === 'soles') c.numFmt = FMT_SOLES;
      if (col.tipo === 'fecha') c.numFmt = FMT_FECHA;
      if (col.tipo === 'porcentaje') c.numFmt = '0.0%';
      if (col.alinear) c.alignment = { horizontal: col.alinear };
    });
    const extra = filaEstilo?.(fila, idx);
    if (extra?.fill) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: extra.fill } }; });
    if (extra?.font) r.eachCell(c => { c.font = { ...c.font, ...extra.font }; });
  });

  const ultima = filaInicio + filas.length;
  if (filas.length > 0) {
    ws.autoFilter = { from: { row: filaInicio, column: 1 }, to: { row: ultima, column: columnas.length } };
  }

  if (totales && filas.length > 0) {
    const rt = ws.getRow(ultima + 1);
    const primeraSuma = columnas.findIndex(c => c.sumar);
    columnas.forEach((col, i) => {
      const c = rt.getCell(i + 1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.total } };
      c.font = { bold: true };
      c.border = { ...bordes, top: { style: 'medium', color: { argb: COLOR.titulo } } };
      if (col.sumar) {
        const letra = ws.getColumn(i + 1).letter;
        c.value = { formula: `SUBTOTAL(109,${letra}${filaInicio + 1}:${letra}${ultima})` };
        if (col.tipo === 'soles') c.numFmt = FMT_SOLES;
      }
    });
    if (primeraSuma > 0) {
      const c = rt.getCell(primeraSuma);
      c.value = etiquetaTotal;
      c.alignment = { horizontal: 'right' };
    }
  }

  columnas.forEach((col, i) => { ws.getColumn(i + 1).width = col.ancho || 14; });
  return ultima + (totales && filas.length > 0 ? 3 : 2);
};

const tituloSeccion = (ws, fila, texto, nCols, color = COLOR.titulo) => {
  ws.mergeCells(fila, 1, fila, nCols);
  const c = ws.getCell(fila, 1);
  c.value = texto;
  c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  ws.getRow(fila).height = 20;
  return fila + 1;
};

const nuevaHoja = (wb, nombre, color) => wb.addWorksheet(nombre, {
  properties: { tabColor: { argb: color } },
  pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
});

export async function exportarReporteExcel({
  empresa, desde, hasta,
  ventas = [], compras = [], rotacion = [], cajeros = [], cancelaciones = [], cierres = [], clientes = [],
  parseDeliveryInfo, parsearCreditoSplit,
}) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = empresa.name || 'Sistema';
  wb.created = new Date();

  // ── Cálculos base ──
  const ventasValidas = ventas.filter(v => !esAnulada(v));
  const devueltas = ventas.filter(esAnulada);
  const totalVentas = ventasValidas.reduce((s, v) => s + num(v.total), 0);
  const baseVentas = ventasValidas.reduce((s, v) => s + num(v.subtotal), 0);
  const igvVentas = ventasValidas.reduce((s, v) => s + num(v.igv), 0);
  const totalCompras = compras.reduce((s, c) => s + num(c.total), 0);
  const baseCompras = compras.reduce((s, c) => s + num(c.baseImponible), 0);
  const igvCompras = compras.reduce((s, c) => s + num(c.igv), 0);

  const recaudacion = { efectivo: 0, tarjeta: 0, yape: 0, credito: 0, pedidosYa: 0, consumo: 0, cortesia: 0 };
  ventas.forEach(v => {
    const m = montosVenta(v);
    Object.keys(recaudacion).forEach(k => { recaudacion[k] += m[k]; });
  });

  const porDia = new Map();
  ventas.forEach(v => {
    const f = fechaLocal(v.createdAt);
    const k = claveFecha(f);
    if (!porDia.has(k)) porDia.set(k, { fecha: f, n: 0, devueltas: 0, total: 0, efectivo: 0, tarjeta: 0, yape: 0, otros: 0 });
    const d = porDia.get(k);
    if (esAnulada(v)) { d.devueltas += 1; return; }
    const m = montosVenta(v);
    d.n += 1;
    d.total += num(v.total);
    d.efectivo += m.efectivo;
    d.tarjeta += m.tarjeta;
    d.yape += m.yape;
    d.otros += m.credito + m.pedidosYa + m.consumo;
  });
  const dias = [...porDia.values()].sort((a, b) => a.fecha - b.fecha);

  // ── Hoja 1: Resumen ──
  {
    const ws = nuevaHoja(wb, 'Resumen', 'FF0EA5E9');
    let f = encabezadoHoja(ws, empresa, 'REPORTE CONTABLE Y DE GESTIÓN', desde, hasta, 8);

    f = tituloSeccion(ws, f, '1. Balance del periodo', 8);
    const kpis = [
      ['Ventas (RVE) — total', totalVentas, 'Compras (RCE) — total', totalCompras],
      ['Ventas — base imponible', baseVentas, 'Compras — base imponible', baseCompras],
      ['Ventas — IGV (débito fiscal)', igvVentas, 'Compras — IGV (crédito fiscal)', igvCompras],
      ['IGV neto a liquidar', igvVentas - igvCompras, 'Margen operativo (ventas − compras)', totalVentas - totalCompras],
      ['Comprobantes válidos', ventasValidas.length, 'Ticket promedio', ventasValidas.length ? totalVentas / ventasValidas.length : 0],
      ['Ventas devueltas (excluidas)', devueltas.length, 'Monto devuelto', devueltas.reduce((s, v) => s + num(v.montoOriginal ?? v.total), 0)],
    ];
    kpis.forEach(([l1, v1, l2, v2], i) => {
      const r = ws.getRow(f + i);
      [[1, l1, v1], [5, l2, v2]].forEach(([col, label, valor]) => {
        ws.mergeCells(f + i, col, f + i, col + 1);
        const cl = r.getCell(col);
        cl.value = label;
        cl.font = { bold: true, color: { argb: 'FF475569' } };
        cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.suave } };
        cl.border = bordes;
        ws.mergeCells(f + i, col + 2, f + i, col + 3);
        const cv = r.getCell(col + 2);
        cv.value = valor;
        cv.font = { bold: true };
        cv.border = bordes;
        const esConteo = /Comprobantes|devueltas \(/.test(label);
        if (!esConteo) cv.numFmt = FMT_SOLES;
      });
    });
    f += kpis.length + 1;

    f = tituloSeccion(ws, f, '2. Recaudación por medio de cobro', 8, 'FF047857');
    f = tabla(ws, f, [
      { titulo: 'Medio', ancho: 30 },
      { titulo: 'Monto', tipo: 'soles', ancho: 16, sumar: true },
      { titulo: 'Observación', ancho: 44 },
    ], [
      ['Efectivo', recaudacion.efectivo, 'Entra al cuadre de caja'],
      ['Tarjeta / POS', recaudacion.tarjeta, 'Entra al cuadre de caja'],
      ['Yape / Plin', recaudacion.yape, 'Entra al cuadre de caja'],
      ['Crédito comercial', recaudacion.credito, 'Cuentas por cobrar'],
      ['PedidosYa', recaudacion.pedidosYa, 'Liquidación semanal del portal'],
      ['Consumo de personal', recaudacion.consumo, 'Descuento por planilla'],
      ['Cortesías (valor referencial)', recaudacion.cortesia, 'Sin cobro'],
    ], { etiquetaTotal: 'Total' });

    f = tituloSeccion(ws, f, '3. Ventas por día', 8, 'FF4338CA');
    tabla(ws, f, [
      { titulo: 'Fecha', tipo: 'fecha', ancho: 30 },
      { titulo: 'Ventas', tipo: 'numero', ancho: 16, sumar: true },
      { titulo: 'Devueltas', tipo: 'numero', ancho: 12, sumar: true },
      { titulo: 'Total', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Efectivo', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Tarjeta', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Yape', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Otros (créd./PY/planilla)', tipo: 'soles', ancho: 20, sumar: true },
    ], dias.map(d => [d.fecha, d.n, d.devueltas, d.total, d.efectivo, d.tarjeta, d.yape, d.otros]), { etiquetaTotal: 'Total' });
  }

  // ── Hoja 2: Ventas (RVE) ──
  {
    const ws = nuevaHoja(wb, 'Ventas (RVE)', 'FF2563EB');
    const cols = [
      { titulo: 'N°', tipo: 'numero', ancho: 6 },
      { titulo: 'Fecha', tipo: 'fecha', ancho: 11 },
      { titulo: 'Hora', ancho: 8 },
      { titulo: 'ID venta', ancho: 10 },
      { titulo: 'Tipo', ancho: 9 },
      { titulo: 'Comprobante', ancho: 13 },
      { titulo: 'Doc. cliente', ancho: 13 },
      { titulo: 'Cliente', ancho: 28 },
      { titulo: 'Origen', ancho: 16 },
      { titulo: 'Cajero', ancho: 16 },
      { titulo: 'Medio de pago', ancho: 13 },
      { titulo: 'Estado', ancho: 10 },
      { titulo: 'Base imp.', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'IGV', tipo: 'soles', ancho: 11, sumar: true },
      { titulo: 'Total', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Efectivo', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Tarjeta', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Yape', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Crédito', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Productos', ancho: 60 },
    ];
    const f = encabezadoHoja(ws, empresa, 'REGISTRO DE VENTAS E INGRESOS (RVE)', desde, hasta, cols.length);
    const filas = ventas.map((v, i) => {
      const anulada = esAnulada(v);
      const m = montosVenta(v);
      const doc = v.numDocumento && !v.numDocumento.startsWith('DELIVERY -') ? v.numDocumento : '';
      return [
        i + 1, fechaLocal(v.createdAt), v.hora, `VT-${v.id}`, v.tipoComprobante || 'Ticket', numeroComprobante(v),
        doc, clienteDeVenta(v, parseDeliveryInfo), origenDeVenta(v), v.cajeroNombre || 'Cajero Principal',
        metodoReal(v), anulada ? 'Devuelta' : 'Válida',
        anulada ? 0 : num(v.subtotal), anulada ? 0 : num(v.igv), anulada ? 0 : num(v.total),
        m.efectivo, m.tarjeta, m.yape, m.credito,
        v.itemsResumen || '',
      ];
    });
    tabla(ws, f, cols, filas, {
      etiquetaTotal: 'TOTALES',
      filaEstilo: (fila) => (fila[11] === 'Devuelta' ? { fill: COLOR.anulado, font: { color: { argb: 'FFB91C1C' } } } : null),
    });
    ws.views = [{ state: 'frozen', ySplit: f, xSplit: 4 }];
  }

  // ── Hoja 3: Compras (RCE) ──
  {
    const ws = nuevaHoja(wb, 'Compras (RCE)', 'FFE11D48');
    const cols = [
      { titulo: 'N°', tipo: 'numero', ancho: 6 },
      { titulo: 'Fecha', tipo: 'fecha', ancho: 11 },
      { titulo: 'Tipo', ancho: 12 },
      { titulo: 'Serie / número', ancho: 16 },
      { titulo: 'RUC proveedor', ancho: 14 },
      { titulo: 'Proveedor', ancho: 30 },
      { titulo: 'Categoría', ancho: 20 },
      { titulo: 'Forma de pago', ancho: 13 },
      { titulo: 'Base imp.', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'IGV', tipo: 'soles', ancho: 12, sumar: true },
      { titulo: 'Total', tipo: 'soles', ancho: 13, sumar: true },
    ];
    const f = encabezadoHoja(ws, empresa, 'REGISTRO DE COMPRAS Y GASTOS (RCE)', desde, hasta, cols.length);
    tabla(ws, f, cols, compras.map((c, i) => [
      i + 1, fechaLocal(c.creadoEn), c.tipoDocumento || 'Factura', c.serieNumero || '', c.ruc || '', c.proveedor || 'Sin proveedor',
      c.categoria || 'Gastos operativos', c.metodoPago || 'Efectivo', num(c.baseImponible), num(c.igv), num(c.total),
    ]), { colorCabecera: COLOR.cabeceraCompras });
    ws.views = [{ state: 'frozen', ySplit: f }];
  }

  // ── Hoja 4: Productos ──
  {
    const ws = nuevaHoja(wb, 'Productos', 'FFF59E0B');
    const totalCarta = rotacion.reduce((s, r) => s + num(r.total), 0);
    const cols = [
      { titulo: '#', tipo: 'numero', ancho: 6 },
      { titulo: 'Producto', ancho: 36 },
      { titulo: 'Categoría', ancho: 20 },
      { titulo: 'Unidades', tipo: 'numero', ancho: 11, sumar: true },
      { titulo: 'Precio prom.', tipo: 'soles', ancho: 13 },
      { titulo: 'Total', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: '% de la carta', tipo: 'porcentaje', ancho: 13 },
    ];
    const f = encabezadoHoja(ws, empresa, 'ROTACIÓN DE LA CARTA', desde, hasta, cols.length);
    tabla(ws, f, cols, rotacion.map((r, i) => [
      i + 1, r.nombre, r.categoria || 'General', num(r.cantidad),
      num(r.cantidad) > 0 ? num(r.total) / num(r.cantidad) : num(r.precio),
      num(r.total), totalCarta > 0 ? num(r.total) / totalCarta : 0,
    ]));
    ws.views = [{ state: 'frozen', ySplit: f }];
  }

  // ── Hoja 5: Cajeros ──
  if (cajeros.length > 0) {
    const ws = nuevaHoja(wb, 'Cajeros', 'FF9333EA');
    const cols = [
      { titulo: 'Cajero', ancho: 24 },
      { titulo: 'Tickets', tipo: 'numero', ancho: 10, sumar: true },
      { titulo: 'Ticket prom.', tipo: 'soles', ancho: 13 },
      { titulo: 'Efectivo', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Tarjeta', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Yape', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Total cobrado', tipo: 'soles', ancho: 14, sumar: true },
    ];
    const f = encabezadoHoja(ws, empresa, 'VENTAS POR CAJERO', desde, hasta, cols.length);
    tabla(ws, f, cols, cajeros.map(c => [c.nombre, num(c.cantidadTickets), num(c.ticketPromedio), num(c.efectivo), num(c.tarjeta), num(c.yape), num(c.totalVentas)]));
  }

  // ── Hoja 6: Créditos y planilla ──
  {
    const { planilla, comercial } = construirCreditosPlanilla(ventas, clientes, parsearCreditoSplit);
    const ws = nuevaHoja(wb, 'Créditos y planilla', 'FF0D9488');
    const cols = [
      { titulo: 'Tipo', ancho: 18 },
      { titulo: 'Fecha', tipo: 'fecha', ancho: 11 },
      { titulo: 'Hora', ancho: 8 },
      { titulo: 'ID venta', ancho: 10 },
      { titulo: 'Nombre', ancho: 28 },
      { titulo: 'Documento', ancho: 13 },
      { titulo: 'Monto', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Productos', ancho: 60 },
    ];
    const f = encabezadoHoja(ws, empresa, 'CRÉDITOS COMERCIALES Y CONSUMO DE PERSONAL', desde, hasta, cols.length);
    const fila = (tipo) => (it) => [tipo, fechaLocal(it.createdAt), it.hora, `VT-${it.id}`, it.nombre, it.documento || '', num(it.monto), it.itemsResumen || ''];
    tabla(ws, f, cols, [...comercial.map(fila('Crédito cliente')), ...planilla.map(fila('Planilla'))]);
    ws.views = [{ state: 'frozen', ySplit: f }];
  }

  // ── Hoja 7: Anulaciones ──
  {
    const ws = nuevaHoja(wb, 'Anulaciones', 'FFDC2626');
    const cols = [
      { titulo: 'Tipo', ancho: 20 },
      { titulo: 'Referencia', ancho: 12 },
      { titulo: 'Fecha', ancho: 12 },
      { titulo: 'Hora', ancho: 8 },
      { titulo: 'Origen', ancho: 16 },
      { titulo: 'Responsable', ancho: 18 },
      { titulo: 'Motivo', ancho: 36 },
      { titulo: 'Detalle', ancho: 50 },
      { titulo: 'Importe', tipo: 'soles', ancho: 13, sumar: true },
    ];
    const f = encabezadoHoja(ws, empresa, 'AUDITORÍA DE ANULACIONES Y DEVOLUCIONES', desde, hasta, cols.length);
    tabla(ws, f, cols, cancelaciones.map(c => {
      const devolucion = c.tipo === 'Devolución en Caja';
      return [
        c.tipo || 'Comanda Cancelada', devolucion && c.ventaId ? `VT-${c.ventaId}` : `#${c.id}`, c.fecha || '', c.hora || '',
        c.mesa ? `Mesa ${c.mesa}` : (c.codigoPedidosYa || 'Delivery'), c.canceladoPor || 'No registrado',
        c.motivoCancela || 'Sin motivo', c.resumenItems || '', num(c.total),
      ];
    }), { colorCabecera: 'FF991B1B' });
  }

  // ── Hoja 8: Cierres de caja ──
  {
    const cierresRango = cierres.filter(c => {
      if (!c.fechaCierre) return true;
      const k = claveFecha(fechaLocal(c.fechaCierre));
      return k >= desde && k <= hasta;
    });
    const ws = nuevaHoja(wb, 'Cierres de caja', 'FF7C3AED');
    const cols = [
      { titulo: 'ID', tipo: 'numero', ancho: 7 },
      { titulo: 'Fecha', tipo: 'fecha', ancho: 11 },
      { titulo: 'Hora', ancho: 8 },
      { titulo: 'Cajero', ancho: 20 },
      { titulo: 'Efec. esperado', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Efec. contado', tipo: 'soles', ancho: 14, sumar: true },
      { titulo: 'Diferencia', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Tarjeta', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Yape', tipo: 'soles', ancho: 13, sumar: true },
      { titulo: 'Egresos', tipo: 'soles', ancho: 13, sumar: true },
    ];
    const f = encabezadoHoja(ws, empresa, 'CIERRES DE TURNO (ARQUEOS)', desde, hasta, cols.length);
    tabla(ws, f, cols, cierresRango.map(c => [
      c.id, fechaLocal(c.fechaCierre), c.fechaCierre ? new Date(c.fechaCierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '',
      c.cajeroNombre, num(c.efectivoEsperado), num(c.efectivoContado), num(c.diferencia),
      num(c.totalTarjeta), num(c.totalYape), num(c.egresosEfectivo),
    ]), {
      filaEstilo: (fila) => (fila[6] < -0.009 ? { font: { color: { argb: 'FFBE123C' } } } : null),
    });
  }

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const marca = (empresa.brandShort || empresa.name || 'EMPRESA').replace(/\s+/g, '_');
  link.download = `Reporte_Contable_${marca}_${desde}_al_${hasta}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
