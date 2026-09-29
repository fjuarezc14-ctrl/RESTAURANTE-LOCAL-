import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Save, Download, AlertCircle, CheckCircle, Trash2, Pencil, Search, Plus,
  Banknote, CreditCard, Smartphone, Layers, ArrowUpRight, ChevronDown, Receipt,
  FileText, PieChart, Tag, Calendar
} from 'lucide-react';
import { api } from '../api';
import { COMPANY_CONFIG } from '../config/company';

const CATEGORIAS = [
  'Insumos y Alimentos',
  'Bebidas',
  'Gas y Carbón',
  'Limpieza e Higiene',
  'Personal',
  'Otros',
];

const COLORES_CATEGORIA = {
  'Insumos y Alimentos': { chip: 'bg-amber-50 text-amber-700 border-amber-200', activo: 'bg-amber-500 text-white border-amber-500', bar: 'bg-amber-500' },
  'Bebidas':             { chip: 'bg-sky-50 text-sky-700 border-sky-200',       activo: 'bg-sky-600 text-white border-sky-600',     bar: 'bg-sky-500' },
  'Gas y Carbón':        { chip: 'bg-orange-50 text-orange-700 border-orange-200', activo: 'bg-orange-500 text-white border-orange-500', bar: 'bg-orange-500' },
  'Limpieza e Higiene':  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', activo: 'bg-emerald-600 text-white border-emerald-600', bar: 'bg-emerald-500' },
  'Personal':            { chip: 'bg-violet-50 text-violet-700 border-violet-200', activo: 'bg-violet-600 text-white border-violet-600', bar: 'bg-violet-500' },
  'Otros':               { chip: 'bg-slate-100 text-slate-600 border-slate-200', activo: 'bg-slate-700 text-white border-slate-700', bar: 'bg-slate-400' },
  'Sin Categoría':       { chip: 'bg-slate-50 text-slate-400 border-slate-200', activo: 'bg-slate-400 text-white border-slate-400', bar: 'bg-slate-300' },
};
const coloresDe = (cat) => COLORES_CATEGORIA[cat] || COLORES_CATEGORIA['Sin Categoría'];

// Conceptos rápidos inspirados en el cuaderno de Control Caja
const CONCEPTOS_RAPIDOS = [
  { label: '🐔 Pollo / Carnes', nombre: 'Pollo para caldo', cat: 'Insumos y Alimentos' },
  { label: '🥔 Verduras / Papa', nombre: 'Papa Amarilla / Verduras', cat: 'Insumos y Alimentos' },
  { label: '🔥 Gas / Carbón', nombre: 'Carbón / Gas', cat: 'Gas y Carbón' },
  { label: '🛢️ Aceite', nombre: 'Aceite', cat: 'Insumos y Alimentos' },
  { label: '🧃 Gaseosa / Bebidas', nombre: 'Gaseosas / Bebidas', cat: 'Bebidas' },
  { label: '👤 Adelanto de Sueldo', nombre: 'Adelanto de Sueldo', cat: 'Personal' },
  { label: '👥 Apoyo Personal', nombre: 'Apoyo Personal', cat: 'Personal' },
  { label: '🧻 Descartables / Bolsas', nombre: 'Descartables / Bolsas', cat: 'Limpieza e Higiene' },
  { label: '🛍️ Compras Mercado', nombre: 'Mercado General', cat: 'Insumos y Alimentos' },
  { label: '🛠️ Mantenimiento / Luz', nombre: 'Mantenimiento / Fluorescentes', cat: 'Otros' },
];

const METODOS_PAGO = [
  { id: 'Efectivo', label: 'Efectivo', Icon: Banknote, activo: 'bg-emerald-600 border-emerald-600 text-white', icono: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700' },
  { id: 'Yape', label: 'Yape / Plin', Icon: Smartphone, activo: 'bg-violet-600 border-violet-600 text-white', icono: 'text-violet-600', chip: 'bg-violet-50 text-violet-600', text: 'text-violet-700' },
  { id: 'Tarjeta', label: 'Tarjeta', Icon: CreditCard, activo: 'bg-sky-600 border-sky-600 text-white', icono: 'text-sky-600', chip: 'bg-sky-50 text-sky-600', text: 'text-sky-700' },
  { id: 'Mixto', label: 'Mixto', Icon: Layers, activo: 'bg-slate-800 border-slate-800 text-white', icono: 'text-slate-600', chip: 'bg-slate-100 text-slate-600', text: 'text-slate-600' },
];
const estiloMetodo = (metodoPago) => {
  const id = String(metodoPago || 'Efectivo').startsWith('Mixto') ? 'Mixto' : metodoPago;
  return METODOS_PAGO.find(m => m.id === id) || METODOS_PAGO[0];
};

const TIPOS_DOCUMENTO = ['Recibo Interno', 'Boleta', 'Factura', 'Ticket'];

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// Helper para obtener fecha local de Perú en formato YYYY-MM-DD (America/Lima)
export const getFechaPeru = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
};

// Helper para parsear métodos de pago (incluyendo desglose mixto)
export function parsearGastoMetodos(metodoPagoStr, totalMonto = 0) {
  if (!metodoPagoStr) return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  const str = String(metodoPagoStr).trim();

  if (str === 'Efectivo') return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  if (str === 'Yape') return { efec: 0, yape: totalMonto, tarj: 0, esMixto: false };
  if (str === 'Tarjeta') return { efec: 0, yape: 0, tarj: totalMonto, esMixto: false };

  if (str.startsWith('Mixto')) {
    let efec = 0, yape = 0, tarj = 0;
    const efecMatch = str.match(/Efec:\s*(?:S\/\s*)?([0-9.]+)/i);
    const yapeMatch = str.match(/Yape:\s*(?:S\/\s*)?([0-9.]+)/i);
    const tarjMatch = str.match(/Tarj:\s*(?:S\/\s*)?([0-9.]+)/i);

    if (efecMatch) efec = parseFloat(efecMatch[1]) || 0;
    if (yapeMatch) yape = parseFloat(yapeMatch[1]) || 0;
    if (tarjMatch) tarj = parseFloat(tarjMatch[1]) || 0;

    if (efec === 0 && yape === 0 && tarj === 0) {
      efec = totalMonto;
    }
    return { efec, yape, tarj, esMixto: true };
  }

  return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
}

// Día del gasto en formato YYYY-MM-DD. fechaEmision es un día de calendario: se guarda a las
// 12:00 de Lima (y los registros antiguos a las 00:00 UTC), así que su día UTC es el correcto.
// Sin fechaEmision solo queda la hora real de registro, que se lee en hora de Lima.
const diaDeCompra = (c) => {
  if (c.fechaEmision) return String(c.fechaEmision).slice(0, 10);
  const f = c.fecha || c.creadoEn;
  return f ? getFechaPeru(new Date(f)) : null;
};
const formatearDia = (dia, opciones = { day: '2-digit', month: 'short' }) => dia
  ? new Date(`${dia}T12:00:00.000Z`).toLocaleDateString('es-PE', { timeZone: 'UTC', ...opciones })
  : '—';

const formVacio = (fecha) => ({
  proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
  total: '', categoria: 'Insumos y Alimentos', fechaEmision: fecha,
  metodoPago: 'Efectivo', montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: '',
});

export default function ComprasPage() {
  const [compras, setCompras] = useState([]);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);

  // Modales
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null); // null = nuevo gasto
  const [form, setForm] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [compraEliminando, setCompraEliminando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [desgloseAbierto, setDesgloseAbierto] = useState(false);

  // Filtros en hora de Lima
  const hoyStr = useMemo(() => getFechaPeru(), []);
  const [fechaDesde, setFechaDesde] = useState(hoyStr);
  const [fechaHasta, setFechaHasta] = useState(hoyStr);
  const [rangoActivo, setRangoActivo] = useState('hoy');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  const showToast = (msg, tipo = 'ok') => {
    setToastMsg({ msg, tipo });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchTodo = useCallback(async () => {
    setCargando(true);
    try {
      const [cs, st] = await Promise.all([
        api.getCompras(fechaDesde, fechaHasta, {
          categoria: filtroCategoria !== 'Todas' ? filtroCategoria : undefined,
          metodoPago: filtroMetodoPago !== 'Todos' ? filtroMetodoPago : undefined,
          busqueda: busquedaTexto || undefined,
        }),
        api.getComprasStats().catch(() => null),
      ]);
      setCompras(cs || []);
      setStats(st);
    } catch (e) {
      console.error(e);
      showToast('Error cargando datos: ' + e.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, filtroCategoria, filtroMetodoPago, busquedaTexto]);

  useEffect(() => {
    fetchTodo();
  }, [fetchTodo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setDetalleId(null);
      setFormAbierto(false);
      setCompraEliminando(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Accesos rápidos de fechas (en hora local de Lima America/Lima)
  const setRangoPreset = (preset) => {
    setRangoActivo(preset);
    if (preset === 'hoy') {
      const hoy = getFechaPeru();
      setFechaDesde(hoy);
      setFechaHasta(hoy);
    } else if (preset === 'ayer') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const ayer = getFechaPeru(d);
      setFechaDesde(ayer);
      setFechaHasta(ayer);
    } else if (preset === 'semana') {
      const d = new Date();
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      setFechaDesde(getFechaPeru(d));
      setFechaHasta(getFechaPeru(new Date()));
    } else if (preset === 'mes') {
      const d = new Date();
      setFechaDesde(getFechaPeru(new Date(d.getFullYear(), d.getMonth(), 1)));
      setFechaHasta(getFechaPeru(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
    }
  };

  // ── ABRIR FORMULARIO (NUEVO / EDITAR) ────────────────────────────────────
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio(hoyStr));
    setFormAbierto(true);
  };

  const abrirEditar = (compra) => {
    const parsed = parsearGastoMetodos(compra.metodoPago, compra.total);
    setEditandoId(compra.id);
    setForm({
      proveedor: compra.proveedor || '',
      ruc: compra.ruc || '',
      tipoDocumento: compra.tipoDocumento || 'Recibo Interno',
      serieNumero: compra.serieNumero || '',
      total: String(compra.total || ''),
      categoria: compra.categoria || 'Otros',
      fechaEmision: diaDeCompra(compra) || hoyStr,
      metodoPago: parsed.esMixto ? 'Mixto' : (compra.metodoPago || 'Efectivo'),
      montoEfectivoMixto: parsed.esMixto ? String(parsed.efec) : '',
      montoYapeMixto: parsed.esMixto ? String(parsed.yape) : '',
      montoTarjetaMixto: parsed.esMixto ? String(parsed.tarj) : '',
    });
    setDetalleId(null);
    setFormAbierto(true);
  };

  const aplicarConceptoRapido = (concepto) => {
    setForm(prev => ({
      ...prev,
      proveedor: prev.proveedor ? prev.proveedor : concepto.nombre,
      categoria: concepto.cat,
    }));
  };

  // Base imponible e IGV: solo una factura desglosa IGV (18%)
  const calcularBaseIgv = (tot, tipoDocumento) => {
    if (tipoDocumento !== 'Factura') return { base: tot, igv: 0 };
    const base = parseFloat((tot / 1.18).toFixed(2));
    return { base, igv: parseFloat((tot - base).toFixed(2)) };
  };

  // ── GUARDAR GASTO (NUEVO O EDICIÓN) ──────────────────────────────────────
  const guardarGasto = async () => {
    const tot = parseFloat(form.total);
    if (!form.proveedor.trim() || !tot || tot <= 0) {
      showToast('Ingresa la descripción del gasto y un monto válido.', 'error');
      return;
    }

    let finalMetodoPago = form.metodoPago;
    if (form.metodoPago === 'Mixto') {
      const efec = parseFloat(form.montoEfectivoMixto) || 0;
      const yape = parseFloat(form.montoYapeMixto) || 0;
      const tarj = parseFloat(form.montoTarjetaMixto) || 0;
      const suma = efec + yape + tarj;
      if (Math.abs(suma - tot) > 0.01) {
        showToast(`La suma del pago mixto (${soles(suma)}) no coincide con el total de ${soles(tot)}.`, 'error');
        return;
      }
      finalMetodoPago = `Mixto (Efec: S/ ${efec.toFixed(2)}, Yape: S/ ${yape.toFixed(2)}${tarj > 0 ? `, Tarj: S/ ${tarj.toFixed(2)}` : ''})`;
    }

    const { base, igv } = calcularBaseIgv(tot, form.tipoDocumento);
    const payload = {
      proveedor: form.proveedor.trim(),
      ruc: form.ruc || null,
      tipoDocumento: form.tipoDocumento || 'Recibo Interno',
      serieNumero: form.serieNumero || null,
      baseImponible: base,
      igv,
      total: tot,
      categoria: form.categoria || 'Otros',
      fechaEmision: form.fechaEmision || null,
      metodoPago: finalMetodoPago,
    };

    setGuardando(true);
    try {
      if (editandoId) {
        await api.editarCompra(editandoId, payload);
      } else {
        await api.crearCompra({ ...payload, origenCarga: 'manual' });
      }
      await fetchTodo();
      setFormAbierto(false);
      showToast(editandoId ? 'Gasto actualizado correctamente.' : 'Gasto registrado correctamente.');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── ELIMINAR COMPRA ──────────────────────────────────────────────────────
  const ejecutarEliminarCompra = async () => {
    if (!compraEliminando) return;
    try {
      await api.eliminarCompra(compraEliminando.id);
      await fetchTodo();
      setCompraEliminando(null);
      setDetalleId(null);
      showToast('Registro eliminado correctamente.');
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  };

  // ── CAMBIO RÁPIDO DE CATEGORÍA ───────────────────────────────────────────
  const actualizarCategoria = async (id, categoria) => {
    try {
      await api.actualizarCategoriaCompra(id, categoria);
      setCompras(prev => prev.map(c => c.id === id ? { ...c, categoria } : c));
      api.getComprasStats().then(setStats).catch(() => {});
    } catch {
      showToast('Error al actualizar categoría', 'error');
    }
  };

  // ── TOTALES DEL PERIODO ──────────────────────────────────────────────────
  const gastosDetalle = useMemo(() => {
    let efec = 0, tarj = 0, yape = 0, total = 0, igv = 0, conComprobante = 0;
    const porCategoria = {};
    (compras || []).forEach(c => {
      const tot = parseFloat(c.total) || 0;
      total += tot;
      igv += parseFloat(c.igv) || 0;
      if (c.tipoDocumento === 'Factura' || c.tipoDocumento === 'Boleta') conComprobante += 1;
      const p = parsearGastoMetodos(c.metodoPago, tot);
      efec += p.efec;
      tarj += p.tarj;
      yape += p.yape;
      const cat = c.categoria || 'Sin Categoría';
      porCategoria[cat] = (porCategoria[cat] || 0) + tot;
    });
    const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
    return { total, efec, tarj, yape, igv, conComprobante, categorias };
  }, [compras]);

  // ── EXPORTAR GASTOS Y COMPRAS A EXCEL (.XLS) ─────────────────────────────
  const exportarGastosExcel = () => {
    if (compras.length === 0) {
      showToast('No hay gastos registrados en el periodo seleccionado.', 'error');
      return;
    }

    let tableRows = '';
    compras.forEach((c, idx) => {
      const comprobante = c.serieNumero ? `${c.tipoDocumento} ${c.serieNumero}` : (c.tipoDocumento || 'Recibo Interno');
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const fechaFormat = formatearDia(diaDeCompra(c), { day: '2-digit', month: '2-digit', year: 'numeric' });
      tableRows += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${fechaFormat}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px; font-weight: bold;">${c.proveedor || 'Sin descripción'}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px;">${c.categoria || 'Otros'}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${comprobante}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; font-weight: bold;">S/ ${parseFloat(c.total || 0).toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${c.metodoPago || 'Efectivo'}</td>
        </tr>
      `;
    });

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1E293B; }
          .header-title { font-size: 16px; font-weight: 900; text-align: center; color: #0F172A; }
          .sub-header { font-size: 11px; font-weight: 800; color: #475569; text-align: center; }
          .table-header { background-color: #0F172A; color: #FFFFFF; font-weight: 800; text-align: center; border: 1px solid #0F172A; padding: 6px; }
          .egreso-row { background-color: #FFF1F2; font-weight: 800; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="7" class="header-title">REPORTE DETALLADO DE GASTOS Y COMPRAS</td></tr>
          <tr><td colspan="7" class="sub-header">Rango: ${fechaDesde} al ${fechaHasta}</td></tr>
          <tr><td colspan="7"></td></tr>
          <tr class="egreso-row">
            <td colspan="4" style="border: 1px solid #000; padding: 6px;"><b>TOTAL GENERAL GASTOS:</b></td>
            <td style="border: 1px solid #000; text-align: right; padding: 6px; font-weight: bold;">S/ ${gastosDetalle.total.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;">${compras.length} comprobantes</td>
          </tr>
          <tr>
            <td colspan="4" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Efectivo:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.efec.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="4" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Yape / Plin:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.yape.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="4" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Tarjeta / POS:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.tarj.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr>
            <th class="table-header">#</th>
            <th class="table-header">FECHA</th>
            <th class="table-header">DESCRIPCIÓN / PROVEEDOR</th>
            <th class="table-header">CATEGORÍA</th>
            <th class="table-header">COMPROBANTE</th>
            <th class="table-header">TOTAL (S/)</th>
            <th class="table-header">MÉTODO PAGO</th>
          </tr>
          ${tableRows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const marca = (COMPANY_CONFIG.brandShort || 'EMPRESA').replace(/\s+/g, '_');
    a.download = `Reporte_Gastos_${fechaDesde}_${fechaHasta}_${marca}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo Excel descargado.');
  };

  // ── ESTILOS COMPARTIDOS (mismo lenguaje visual que Caja) ─────────────────
  const lbl = 'block text-xs font-medium text-slate-500 mb-1.5';
  const inp = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
  const selectFiltro = 'h-9 px-2.5 rounded-lg bg-slate-100/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10';

  const modalBase = (onClose, header, body, footer, ancho = 'sm:max-w-lg') => (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${ancho} max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">{header}</div>
          <button type="button" onClick={onClose} className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">{body}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">{footer}</div>}
      </div>
    </div>
  );

  const compraDetalle = detalleId != null ? compras.find(c => c.id === detalleId) : null;
  const categoriaMayor = gastosDetalle.categorias[0];
  const rangoTexto = fechaDesde === fechaHasta ? formatearDia(fechaDesde) : `${formatearDia(fechaDesde)} – ${formatearDia(fechaHasta)}`;
  const hayFiltros = filtroCategoria !== 'Todas' || filtroMetodoPago !== 'Todos' || busquedaTexto.trim();

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 space-y-5">

        {/* ENCABEZADO */}
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Compras y gastos</h1>
            <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {rangoTexto}</span>
              <span className="text-slate-300">·</span>
              <span>{compras.length} registro{compras.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportarGastosExcel}
              className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
              title="Descargar el reporte del periodo en Excel"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              type="button"
              onClick={abrirNuevo}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white shadow-sm shadow-rose-600/25 transition-colors active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Registrar gasto
            </button>
          </div>
        </header>

        {/* RESUMEN DEL PERIODO */}
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 ${desgloseAbierto ? 'items-start' : ''}`}>
          <div className="col-span-2 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-500 text-white p-4 sm:p-5 shadow-sm shadow-rose-600/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-rose-50/90">Gastos del periodo</p>
              <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><ArrowUpRight className="w-4 h-4" /></span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight truncate">{soles(gastosDetalle.total)}</p>
              <button
                type="button"
                onClick={() => setDesgloseAbierto(v => !v)}
                className="h-7 pl-2.5 pr-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium inline-flex items-center gap-1 transition-colors shrink-0"
                aria-expanded={desgloseAbierto}
              >
                Detalle <ChevronDown className={`w-4 h-4 transition-transform ${desgloseAbierto ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {desgloseAbierto && (
              <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-xs animate-fade-in">
                {[['Efectivo', gastosDetalle.efec], ['Yape', gastosDetalle.yape], ['Tarjeta', gastosDetalle.tarj]].map(([label, monto]) => (
                  <div key={label} className="min-w-0">
                    <p className="text-rose-50/75">{label}</p>
                    <p className="font-mono tabular-nums text-white truncate">{soles(monto)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {[
            { label: 'Pagado en efectivo', valor: soles(gastosDetalle.efec), hint: `Digital ${soles(gastosDetalle.yape + gastosDetalle.tarj)}`, Icon: Banknote, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' },
            { label: 'Mayor categoría', valor: categoriaMayor ? categoriaMayor[0] : '—', hint: categoriaMayor ? `${soles(categoriaMayor[1])} · ${gastosDetalle.total > 0 ? Math.round((categoriaMayor[1] / gastosDetalle.total) * 100) : 0}% del total` : 'Sin gastos', Icon: Tag, color: 'bg-amber-50 text-amber-600', borde: 'border-t-amber-500', texto: true },
            { label: 'IGV de facturas', valor: soles(gastosDetalle.igv), hint: `${gastosDetalle.conComprobante} con boleta o factura`, Icon: FileText, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' },
          ].map(({ label, valor, hint, Icon, color, borde, texto }) => (
            <div key={label} className={`rounded-2xl border border-slate-200/70 border-t-4 ${borde} bg-white p-4 min-w-0`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${color}`}><Icon className="w-4 h-4" /></span>
              </div>
              <p className={`mt-1 font-semibold text-slate-900 truncate ${texto ? 'text-base sm:text-lg' : 'text-lg sm:text-xl font-mono tabular-nums'}`}>{valor}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

          {/* LISTA DE GASTOS */}
          <section className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/70 min-w-0">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 grid place-items-center"><Receipt className="w-4 h-4" /></span> Registro de gastos
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 rounded-full px-2.5 py-0.5">{compras.length}</span>
              </h2>
            </div>

            {/* Filtros */}
            <div className="px-4 sm:px-5 py-3 space-y-2 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex h-9 p-0.5 rounded-lg bg-slate-100/80 text-xs font-medium">
                  {[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Semana'], ['mes', 'Mes']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRangoPreset(id)}
                      className={`px-3 rounded-md transition-colors ${rangoActivo === id ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => { setFechaDesde(e.target.value); setRangoActivo(null); }}
                    className={`${selectFiltro} font-mono text-xs`}
                    aria-label="Desde"
                  />
                  <span className="text-slate-300 text-xs">–</span>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => { setFechaHasta(e.target.value); setRangoActivo(null); }}
                    className={`${selectFiltro} font-mono text-xs`}
                    aria-label="Hasta"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={busquedaTexto}
                    onChange={e => setBusquedaTexto(e.target.value)}
                    placeholder="Buscar gasto, proveedor, RUC…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className={selectFiltro}>
                  <option value="Todas">Todas las categorías</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filtroMetodoPago} onChange={e => setFiltroMetodoPago(e.target.value)} className={selectFiltro}>
                  <option value="Todos">Todos los pagos</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape">Yape / Plin</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Mixto">Mixto</option>
                </select>
              </div>
            </div>

            {cargando ? (
              <div className="py-16 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : compras.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {compras.map(c => {
                  const est = estiloMetodo(c.metodoPago);
                  const colores = coloresDe(c.categoria);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setDetalleId(c.id)}
                        className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:bg-slate-50"
                      >
                        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${est.chip}`}>
                          <est.Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-slate-900">{c.proveedor}</p>
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                            <span>{formatearDia(diaDeCompra(c))}</span>
                            <span className="text-slate-300">·</span>
                            <span className={`inline-flex px-1.5 rounded-md border text-[10px] font-medium ${colores.chip}`}>{c.categoria || 'Sin categoría'}</span>
                            {c.serieNumero && <><span className="text-slate-300">·</span><span className="font-mono">{c.tipoDocumento} {c.serieNumero}</span></>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-semibold tabular-nums text-rose-600">- {soles(c.total)}</p>
                          <p className={`text-[11px] font-medium ${est.text}`}>{est.id === 'Mixto' ? 'Mixto' : est.label}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-slate-400">{hayFiltros ? 'Ningún gasto coincide con el filtro.' : 'No hay gastos en este periodo.'}</p>
                {!hayFiltros && (
                  <button type="button" onClick={abrirNuevo} className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Registrar el primero
                  </button>
                )}
              </div>
            )}
          </section>

          {/* PANEL LATERAL: DISTRIBUCIÓN */}
          <div className="xl:col-span-2 space-y-5 min-w-0">
            <section className="bg-white rounded-2xl border border-slate-200/70">
              <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100">
                <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center"><PieChart className="w-4 h-4" /></span>
                <h2 className="text-sm font-semibold text-slate-800">Por categoría</h2>
              </div>
              {gastosDetalle.categorias.length > 0 ? (
                <ul className="px-4 sm:px-5 py-4 space-y-3">
                  {gastosDetalle.categorias.map(([cat, monto]) => {
                    const pct = gastosDetalle.total > 0 ? (monto / gastosDetalle.total) * 100 : 0;
                    const activa = filtroCategoria === cat;
                    return (
                      <li key={cat}>
                        <button
                          type="button"
                          onClick={() => setFiltroCategoria(activa || cat === 'Sin Categoría' ? 'Todas' : cat)}
                          className="w-full text-left group"
                          title={activa ? 'Quitar filtro' : 'Ver solo esta categoría'}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className={`truncate ${activa ? 'font-semibold text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>{cat}</span>
                            <span className="font-mono tabular-nums text-slate-900 shrink-0">{soles(monto)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${coloresDe(cat).bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-slate-400 tabular-nums w-9 text-right">{Math.round(pct)}%</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-slate-400">Sin gastos para mostrar.</p>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200/70">
              <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 grid place-items-center"><Calendar className="w-4 h-4" /></span>
                <h2 className="text-sm font-semibold text-slate-800">Este mes</h2>
              </div>
              <dl className="px-4 sm:px-5 py-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Total gastado</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">{soles(stats?.totalGastado)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Registros</dt>
                  <dd className="font-mono tabular-nums text-slate-900">{stats?.numFacturas ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">IGV de compras</dt>
                  <dd className="font-mono tabular-nums text-slate-900">{soles(stats?.totalIGV)}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-2.5 border-t border-slate-100">
                  <dt className="text-slate-500 shrink-0">Mayor proveedor</dt>
                  <dd className="text-right min-w-0">
                    <p className="text-slate-900 truncate">{stats?.topProveedor?.nombre || '—'}</p>
                    {stats?.topProveedor && <p className="text-xs font-mono text-slate-400">{soles(stats.topProveedor.total)}</p>}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      {/* MODAL: DETALLE DE GASTO */}
      {compraDetalle && (() => {
        const c = compraDetalle;
        const est = estiloMetodo(c.metodoPago);
        const p = parsearGastoMetodos(c.metodoPago, c.total);
        return modalBase(
          () => setDetalleId(null),
          <>
            <p className="text-lg font-semibold text-slate-900 break-words">{c.proveedor}</p>
            <p className="text-sm text-slate-500">{formatearDia(diaDeCompra(c))} · Registro #{c.id}</p>
          </>,
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Monto</p>
                <p className="text-2xl font-semibold font-mono tabular-nums text-rose-600">{soles(c.total)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium ${est.chip}`}>
                <est.Icon className="w-4 h-4" /> {est.id === 'Mixto' ? 'Pago mixto' : est.label}
              </span>
            </div>
            {p.esMixto && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[['Efectivo', p.efec], ['Yape', p.yape], ['Tarjeta', p.tarj]].map(([label, monto]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">{label}</p>
                    <p className="font-mono tabular-nums text-slate-900">{soles(monto)}</p>
                  </div>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">Comprobante</dt><dd className="text-slate-800">{c.tipoDocumento || 'Recibo Interno'}</dd></div>
              <div><dt className="text-xs text-slate-400">Número</dt><dd className="font-mono text-slate-800">{c.serieNumero || 'S/N'}</dd></div>
              <div><dt className="text-xs text-slate-400">RUC</dt><dd className="font-mono text-slate-800">{c.ruc && c.ruc !== '00000000000' ? c.ruc : '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">IGV</dt><dd className="font-mono text-slate-800">{soles(c.igv)}</dd></div>
            </dl>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Categoría · toca para cambiarla</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS.map(cat => {
                  const activa = c.categoria === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => !activa && actualizarCategoria(c.id, cat)}
                      className={`h-8 px-3 rounded-full border text-xs font-medium transition active:scale-95 ${activa ? coloresDe(cat).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompraEliminando(c)}
              className="h-11 px-4 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
            <button
              type="button"
              onClick={() => abrirEditar(c)}
              className="ml-auto h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Editar
            </button>
          </div>
        );
      })()}

      {/* MODAL: REGISTRAR / EDITAR GASTO */}
      {formAbierto && form && (() => {
        const tot = parseFloat(form.total) || 0;
        const { base, igv } = calcularBaseIgv(tot, form.tipoDocumento);
        return modalBase(
          () => setFormAbierto(false),
          <>
            <p className="text-lg font-semibold text-slate-900">{editandoId ? 'Editar gasto' : 'Registrar gasto'}</p>
            <p className="text-sm text-slate-500">{editandoId ? `Registro #${editandoId}` : 'Compra, pago o egreso del negocio'}</p>
          </>,
          <>
            {!editandoId && (
              <div>
                <p className={lbl}>Conceptos frecuentes</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONCEPTOS_RAPIDOS.map((cp) => (
                    <button
                      key={cp.label}
                      type="button"
                      onClick={() => aplicarConceptoRapido(cp)}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95"
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={lbl}>Descripción del gasto *</label>
              <input
                type="text"
                value={form.proveedor}
                onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                placeholder="Ej. Pollo para caldo, Gas, Sueldo Martha…"
                className={inp}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={form.total}
                    onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                    placeholder="0.00"
                    className={`${inp} h-11 pl-9 font-mono text-lg font-semibold tabular-nums`}
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Fecha</label>
                <input
                  type="date"
                  value={form.fechaEmision}
                  onChange={e => setForm(f => ({ ...f, fechaEmision: e.target.value }))}
                  className={`${inp} h-11 font-mono`}
                />
              </div>
            </div>

            <div>
              <p className={lbl}>Medio de pago</p>
              <div className="grid grid-cols-4 gap-2">
                {METODOS_PAGO.map(m => {
                  const activo = form.metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        metodoPago: m.id,
                        montoEfectivoMixto: m.id === 'Mixto' && !f.montoEfectivoMixto ? String(parseFloat(f.total) || '') : f.montoEfectivoMixto,
                      }))}
                      className={`h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium transition-all active:scale-[0.97] ${activo ? m.activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                    >
                      <m.Icon className={`w-4 h-4 ${activo ? '' : m.icono}`} />
                      {m.id === 'Yape' ? 'Yape' : m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.metodoPago === 'Mixto' && (() => {
              const efec = parseFloat(form.montoEfectivoMixto) || 0;
              const yape = parseFloat(form.montoYapeMixto) || 0;
              const tarj = parseFloat(form.montoTarjetaMixto) || 0;
              const dif = tot - (efec + yape + tarj);
              return (
                <div className="rounded-xl bg-slate-50 p-3 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2">
                    {[['montoEfectivoMixto', 'Efectivo'], ['montoYapeMixto', 'Yape'], ['montoTarjetaMixto', 'Tarjeta']].map(([campo, label]) => (
                      <div key={campo}>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={form[campo]}
                          onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
                          placeholder="0.00"
                          className={`${inp} font-mono tabular-nums`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs font-medium px-3 py-2 rounded-lg ${
                    Math.abs(dif) < 0.01 ? 'bg-emerald-50 text-emerald-700' : dif > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {Math.abs(dif) < 0.01 ? 'Cuadra con el total' : dif > 0 ? `Falta asignar ${soles(dif)}` : `Excede por ${soles(Math.abs(dif))}`}
                  </p>
                </div>
              );
            })()}

            <div>
              <p className={lbl}>Categoría</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS.map(cat => {
                  const activa = form.categoria === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, categoria: cat }))}
                      className={`h-8 px-3 rounded-full border text-xs font-medium transition active:scale-95 ${activa ? coloresDe(cat).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className={lbl}>Comprobante</p>
              <div className="grid grid-cols-4 p-1 rounded-xl bg-slate-100">
                {TIPOS_DOCUMENTO.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipoDocumento: t }))}
                    className={`h-8 rounded-lg text-xs font-medium transition-all ${form.tipoDocumento === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {t === 'Recibo Interno' ? 'Sin comp.' : t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Número</label>
                  <input
                    type="text"
                    value={form.serieNumero}
                    onChange={e => setForm(f => ({ ...f, serieNumero: e.target.value }))}
                    placeholder="Ej. F001-124"
                    className={`${inp} font-mono`}
                  />
                </div>
                <div>
                  <label className={lbl}>RUC del proveedor</label>
                  <input
                    type="text" maxLength={11} inputMode="numeric"
                    value={form.ruc}
                    onChange={e => setForm(f => ({ ...f, ruc: e.target.value.replace(/\D/g, '') }))}
                    placeholder="Opcional"
                    className={`${inp} font-mono`}
                  />
                </div>
              </div>
              {form.tipoDocumento === 'Factura' && tot > 0 && (
                <p className="text-xs text-slate-500 bg-sky-50 rounded-lg px-3 py-2">
                  Base imponible <span className="font-mono text-slate-800">{soles(base)}</span> · IGV (18%) <span className="font-mono text-slate-800">{soles(igv)}</span>
                </p>
              )}
            </div>
          </>,
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFormAbierto(false)} className="h-11 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarGasto}
              disabled={guardando}
              className="ml-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {guardando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {editandoId ? 'Guardar cambios' : 'Guardar gasto'}
            </button>
          </div>,
          'sm:max-w-xl'
        );
      })()}

      {/* MODAL: CONFIRMAR ELIMINACIÓN */}
      {compraEliminando && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setCompraEliminando(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 text-center animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-900">¿Eliminar este gasto?</p>
            <p className="mt-1 text-sm text-slate-500">
              <span className="text-slate-800">{compraEliminando.proveedor}</span> por <span className="font-mono text-slate-800">{soles(compraEliminando.total)}</span>. No se puede deshacer.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={() => setCompraEliminando(null)} className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={ejecutarEliminarCompra} className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors active:scale-[0.98]">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-[250] animate-slide-up">
          <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${
            toastMsg.tipo === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {toastMsg.tipo === 'error'
              ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              : <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />}
            <p className="text-sm font-medium leading-snug flex-1">{toastMsg.msg}</p>
            <button type="button" onClick={() => setToastMsg(null)} className="shrink-0 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </section>
  );
}
