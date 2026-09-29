import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, X, Save, RefreshCw, Download, Tag, ExternalLink,
  AlertCircle, CheckCircle, ChevronDown, Trash2, Edit3, Printer,
  Search, Calendar, Filter, PlusCircle, DollarSign, Wallet,
  CreditCard, Smartphone, Check, HelpCircle, ArrowDownRight, ArrowUpRight, Scale
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
  'Insumos y Alimentos': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', bar: 'bg-amber-500' },
  'Bebidas':             { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   bar: 'bg-blue-500' },
  'Gas y Carbón':        { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', bar: 'bg-orange-500' },
  'Limpieza e Higiene':  { bg: 'bg-emerald-100',text: 'text-emerald-800',border: 'border-emerald-200',bar: 'bg-emerald-500' },
  'Personal':            { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', bar: 'bg-purple-500' },
  'Otros':               { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200',  bar: 'bg-slate-400' },
  'Sin Categoría':       { bg: 'bg-slate-100',  text: 'text-slate-400',  border: 'border-slate-200',  bar: 'bg-slate-300' },
};

const ORIGEN_BADGE = {
  sunat:  { label: 'SUNAT', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  demo:   { label: 'DEMO',  cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  manual: { label: 'Manual',cls: 'bg-slate-100 border-slate-200 text-slate-600' },
  xml:    { label: 'XML',   cls: 'bg-violet-50 border-violet-200 text-violet-700' },
};

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

export default function ComprasPage() {
  const [compras, setCompras] = useState([]);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);
  
  // Modales
  const [modalManual, setModalManual] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);
  const [compraEliminando, setCompraEliminando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [editCatId, setEditCatId] = useState(null);

  // Filtros en hora de Lima
  const hoyStr = useMemo(() => getFechaPeru(), []);
  const [fechaDesde, setFechaDesde] = useState(hoyStr);
  const [fechaHasta, setFechaHasta] = useState(hoyStr);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  const hoy = new Date();
  const [periodoMes, setPeriodoMes] = useState(
    `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}`
  );

  const [formCompra, setFormCompra] = useState({
    proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
    baseImponible: '', igv: '', total: '', categoria: 'Insumos y Alimentos',
    fechaEmision: hoyStr,
    metodoPago: 'Efectivo',
    montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: '',
  });

  const [apiStatus, setApiStatus] = useState({ modoDemo: true, apisunatActivo: false });

  const showToast = (msg, tipo = 'ok') => {
    setToastMsg({ msg, tipo });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchTodo = useCallback(async () => {
    setCargando(true);
    try {
      const [cs, st, stApi] = await Promise.all([
        api.getCompras(fechaDesde, fechaHasta, {
          categoria: filtroCategoria !== 'Todas' ? filtroCategoria : undefined,
          metodoPago: filtroMetodoPago !== 'Todos' ? filtroMetodoPago : undefined,
          busqueda: busquedaTexto || undefined,
        }),
        api.getComprasStats(),
        api.getStatus().catch(() => null),
      ]);
      setCompras(cs || []);
      setStats(st);
      if (stApi && stApi.ok) {
        setApiStatus({ modoDemo: stApi.modoDemo, apisunatActivo: stApi.apisunatActivo });
      }
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

  // Accesos rápidos de fechas (en hora local de Lima America/Lima)
  const setRangoPreset = (preset) => {
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
      const sDesde = getFechaPeru(d);
      const sHasta = getFechaPeru(new Date());
      setFechaDesde(sDesde);
      setFechaHasta(sHasta);
    } else if (preset === 'mes') {
      const d = new Date();
      const sDesde = getFechaPeru(new Date(d.getFullYear(), d.getMonth(), 1));
      const sHasta = getFechaPeru(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      setFechaDesde(sDesde);
      setFechaHasta(sHasta);
    }
  };

  // ── AUTOCOMPLETAR CONCEPTO RÁPIDO ───────────────────────────────────────
  const aplicarConceptoRapido = (concepto) => {
    setFormCompra(prev => ({
      ...prev,
      proveedor: prev.proveedor ? prev.proveedor : concepto.nombre,
      categoria: concepto.cat,
    }));
  };

  // ── GUARDAR NUEVO GASTO / COMPRA ─────────────────────────────────────────
  const guardarCompraManual = async () => {
    if (!formCompra.proveedor || !formCompra.total || parseFloat(formCompra.total) <= 0) {
      showToast('Ingresa el nombre/descripción del gasto y un monto válido.', 'error');
      return;
    }

    const tot = parseFloat(formCompra.total);
    let finalMetodoPago = formCompra.metodoPago;

    if (formCompra.metodoPago === 'Mixto') {
      const efec = parseFloat(formCompra.montoEfectivoMixto) || 0;
      const yape = parseFloat(formCompra.montoYapeMixto) || 0;
      const tarj = parseFloat(formCompra.montoTarjetaMixto) || 0;
      const suma = efec + yape + tarj;

      if (Math.abs(suma - tot) > 0.01) {
        showToast(`⚠️ La suma del pago mixto (S/ ${suma.toFixed(2)}) no coincide con el total de S/ ${tot.toFixed(2)}.`, 'error');
        return;
      }
      finalMetodoPago = `Mixto (Efec: S/ ${efec.toFixed(2)}, Yape: S/ ${yape.toFixed(2)}${tarj > 0 ? `, Tarj: S/ ${tarj.toFixed(2)}` : ''})`;
    }

    setGuardando(true);
    try {
      let base = parseFloat(formCompra.baseImponible) || tot;
      let igv = parseFloat(formCompra.igv) || 0;
      
      if (formCompra.tipoDocumento === 'Factura' && base === tot) {
        base = parseFloat((tot / 1.18).toFixed(2));
        igv = parseFloat((tot - base).toFixed(2));
      }

      await api.crearCompra({
        proveedor: formCompra.proveedor,
        ruc: formCompra.ruc || null,
        tipoDocumento: formCompra.tipoDocumento || 'Recibo Interno',
        serieNumero: formCompra.serieNumero || null,
        baseImponible: base,
        igv: igv,
        total: tot,
        origenCarga: 'manual',
        categoria: formCompra.categoria || 'Otros',
        fechaEmision: formCompra.fechaEmision || null,
        metodoPago: finalMetodoPago,
      });
      await fetchTodo();
      setModalManual(false);
      setFormCompra({
        proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
        baseImponible: '', igv: '', total: '', categoria: 'Insumos y Alimentos',
        fechaEmision: hoyStr, metodoPago: 'Efectivo',
        montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: ''
      });
      showToast('✅ Gasto registrado correctamente.');
    } catch (err) {
      showToast('❌ Error al guardar: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── EDITAR COMPRA EXISTENTE ─────────────────────────────────────────────
  const abrirModalEditar = (compra) => {
    const parsed = parsearGastoMetodos(compra.metodoPago, compra.total);
    setCompraEditando({
      id: compra.id,
      proveedor: compra.proveedor || '',
      ruc: compra.ruc || '',
      tipoDocumento: compra.tipoDocumento || 'Recibo Interno',
      serieNumero: compra.serieNumero || '',
      baseImponible: compra.baseImponible || 0,
      igv: compra.igv || 0,
      total: compra.total || 0,
      categoria: compra.categoria || 'Otros',
      fechaEmision: compra.fechaEmision ? compra.fechaEmision.split('T')[0] : (compra.creadoEn ? compra.creadoEn.split('T')[0] : hoyStr),
      metodoPago: parsed.esMixto ? 'Mixto' : (compra.metodoPago || 'Efectivo'),
      montoEfectivoMixto: parsed.esMixto ? String(parsed.efec) : '',
      montoYapeMixto: parsed.esMixto ? String(parsed.yape) : '',
      montoTarjetaMixto: parsed.esMixto ? String(parsed.tarj) : '',
    });
    setModalEditar(true);
  };

  const guardarEdicionCompra = async () => {
    if (!compraEditando || !compraEditando.proveedor || !compraEditando.total) {
      showToast('Ingresa la descripción y el monto total.', 'error');
      return;
    }

    const tot = parseFloat(compraEditando.total);
    let finalMetodoPago = compraEditando.metodoPago;

    if (compraEditando.metodoPago === 'Mixto') {
      const efec = parseFloat(compraEditando.montoEfectivoMixto) || 0;
      const yape = parseFloat(compraEditando.montoYapeMixto) || 0;
      const tarj = parseFloat(compraEditando.montoTarjetaMixto) || 0;
      const suma = efec + yape + tarj;

      if (Math.abs(suma - tot) > 0.01) {
        showToast(`⚠️ La suma del pago mixto (S/ ${suma.toFixed(2)}) no coincide con el total de S/ ${tot.toFixed(2)}.`, 'error');
        return;
      }
      finalMetodoPago = `Mixto (Efec: S/ ${efec.toFixed(2)}, Yape: S/ ${yape.toFixed(2)}${tarj > 0 ? `, Tarj: S/ ${tarj.toFixed(2)}` : ''})`;
    }

    setGuardando(true);
    try {
      let base = parseFloat(compraEditando.baseImponible) || tot;
      let igv = parseFloat(compraEditando.igv) || 0;

      if (compraEditando.tipoDocumento === 'Factura' && base === tot) {
        base = parseFloat((tot / 1.18).toFixed(2));
        igv = parseFloat((tot - base).toFixed(2));
      }

      await api.editarCompra(compraEditando.id, {
        proveedor: compraEditando.proveedor,
        ruc: compraEditando.ruc || null,
        tipoDocumento: compraEditando.tipoDocumento,
        serieNumero: compraEditando.serieNumero || null,
        baseImponible: base,
        igv: igv,
        total: tot,
        categoria: compraEditando.categoria || null,
        fechaEmision: compraEditando.fechaEmision || null,
        metodoPago: finalMetodoPago,
      });
      await fetchTodo();
      setModalEditar(false);
      setCompraEditando(null);
      showToast('✅ Gasto actualizado correctamente.');
    } catch (err) {
      showToast('❌ Error al actualizar: ' + err.message, 'error');
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
      showToast('✅ Registro eliminado correctamente.');
    } catch (err) {
      showToast('❌ Error al eliminar: ' + err.message, 'error');
    }
  };

  // ── CALCULAR BASE / IGV ──────────────────────────────────────────────────
  const calcularPorTotal = (valTotal, isEditing = false) => {
    const total = parseFloat(valTotal);
    if (isNaN(total)) return;
    const base = parseFloat((total / 1.18).toFixed(2));
    const igv = parseFloat((total - base).toFixed(2));
    if (isEditing) {
      setCompraEditando(f => ({ ...f, total: String(total), baseImponible: String(base), igv: String(igv) }));
    } else {
      setFormCompra(f => ({ ...f, total: String(total), baseImponible: String(base), igv: String(igv) }));
    }
  };

  // ── ACTUALIZAR CATEGORÍA INLINE ─────────────────────────────────────────
  const actualizarCategoria = async (id, categoria) => {
    try {
      await api.actualizarCategoriaCompra(id, categoria);
      setCompras(prev => prev.map(c => c.id === id ? { ...c, categoria } : c));
      const st = await api.getComprasStats();
      setStats(st);
      setEditCatId(null);
    } catch (err) {
      showToast('Error al actualizar categoría', 'error');
    }
  };

  // ── SINCRONIZAR CON SUNAT ───────────────────────────────────────────────
  const sincronizarConSunat = async () => {
    setSincronizando(true);
    try {
      const result = await api.sincronizarSunat({ periodo: periodoMes });
      setUltimaSync(new Date());
      await fetchTodo();
      showToast(result.mensaje || '✅ Sincronización completada', result.modoDemo ? 'demo' : 'ok');
    } catch (err) {
      showToast('❌ Error al sincronizar: ' + err.message, 'error');
    } finally {
      setSincronizando(false);
    }
  };

  // ── CÁLCULO DETALLADO DE EGRESOS POR GASTOS DEL PERIODO ───────────────────
  const gastosDetalle = useMemo(() => {
    let efec = 0, tarj = 0, yape = 0, total = 0;
    (compras || []).forEach(c => {
      const tot = parseFloat(c.total) || 0;
      total += tot;
      const p = parsearGastoMetodos(c.metodoPago, tot);
      efec += p.efec;
      tarj += p.tarj;
      yape += p.yape;
    });
    return { total, efec, tarj, yape };
  }, [compras]);

  // ── EXPORTAR GASTOS Y COMPRAS A EXCEL (.XLS) ──────────────────────
  const exportarGastosExcel = () => {
    if (compras.length === 0) {
      showToast('No hay gastos registrados en el periodo seleccionado.', 'error');
      return;
    }

    let tableRows = '';
    compras.forEach((c, idx) => {
      const comprobante = c.serieNumero ? `${c.tipoDocumento} ${c.serieNumero}` : (c.tipoDocumento || 'Recibo Interno');
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const fechaFormat = c.fechaEmision ? new Date(c.fechaEmision).toLocaleDateString('es-PE') : (c.fecha ? new Date(c.fecha).toLocaleDateString('es-PE') : '');
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
          .total-row { background-color: #FEF3C7; font-weight: 900; font-size: 12px; }
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
    showToast('✅ Archivo Excel descargado con éxito.');
  };
  const exportarControlCajaExcel = exportarGastosExcel;

  // ── EXPORTAR CSV SIRE (ORIGINAL) ────────────────────────────────────────
  const exportarCSV = () => {
    if (compras.length === 0) { showToast('No hay compras para exportar.', 'error'); return; }
    const encabezado = ['Periodo', 'Nro Correlativo', 'Fecha Emisión', 'Tipo Comprobante', 'Serie-Número', 'RUC Proveedor', 'Razón Social', 'Moneda', 'Base Imponible', 'IGV (10.5%)', 'Total', 'Categoría Interna', 'Origen'];
    const filas = compras.map((c, i) => {
      const fechaEm = c.fechaEmision ? new Date(c.fechaEmision).toLocaleDateString('es-PE') : new Date(c.creadoEn).toLocaleDateString('es-PE');
      return [
        periodoMes,
        String(i + 1).padStart(4, '0'),
        fechaEm,
        c.tipoDocumento,
        c.serieNumero || 'S/N',
        c.ruc || '',
        `"${c.proveedor}"`,
        'PEN',
        c.baseImponible.toFixed(2),
        c.igv.toFixed(2),
        c.total.toFixed(2),
        c.categoria || 'Sin Categoría',
        c.origenCarga,
      ].join(',');
    });
    const csv = '\uFEFF' + [encabezado.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const marca = (COMPANY_CONFIG.brandShort || 'EMPRESA').replace(/\s+/g, '_');
    a.download = `RCE_Compras_${periodoMes}_${marca}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV exportado para SIRE / Siscont.');
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50 relative">

      {/* TOAST NOTIFICACIÓN */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-[300] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl max-w-sm animate-slide-up border ${
          toastMsg.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          toastMsg.tipo === 'demo'  ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          {toastMsg.tipo === 'error'
            ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            : <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />}
          <p className="text-sm font-semibold leading-snug">{toastMsg.msg}</p>
          <button onClick={() => setToastMsg(null)} className="ml-2 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-amber-500" /> Control de Gastos y Compras
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Registro y control contable de compras, egresos operativos y facturas de proveedores.
          </p>
        </div>

        {/* BOTONES PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setModalManual(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> + Registrar Gasto
          </button>
          <button
            onClick={exportarGastosExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer"
            title="Descargar reporte detallado en Excel"
          >
            <Download className="w-4 h-4" /> Exportar a Excel
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANZADOS */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4 md:p-5 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Rangos rápidos de fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Rango:</span>
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'ayer', label: 'Ayer' },
              { id: 'semana', label: 'Esta Semana' },
              { id: 'mes', label: 'Este Mes' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setRangoPreset(p.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 transition-all cursor-pointer active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector personalizado Desde - Hasta */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Buscador y Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaTexto}
              onChange={e => setBusquedaTexto(e.target.value)}
              placeholder="Buscar gasto, proveedor, RUC..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Categoría */}
          <div>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="Todas">📂 Todas las categorías</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Método de Pago */}
          <div>
            <select
              value={filtroMetodoPago}
              onChange={e => setFiltroMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="Todos">💳 Todos los medios de pago</option>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="Yape">📱 Yape / Plin</option>
              <option value="Tarjeta">💳 Tarjeta</option>
              <option value="Mixto">🔄 Mixto</option>
            </select>
          </div>

          {/* Botón Exportar SIRE */}
          <div>
            <button
              onClick={exportarCSV}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              title="Exportar CSV formato SIRE"
            >
              <Download className="w-3.5 h-3.5" /> Exportar SIRE (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          PANEL DE RESUMEN DE GASTOS Y COMPRAS
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* TARJETA 1: TOTAL GASTOS Y COMPRAS */}
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Total Gastos del Periodo
            </span>
            <span className="text-[10px] font-bold text-slate-400">{compras.length} registros</span>
          </div>
          <p className="text-3xl font-black font-mono text-rose-600">
            S/ {gastosDetalle.total.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            Monto acumulado en facturas, recibos y egresos operativos
          </p>
        </div>

        {/* TARJETA 2: DESGLOSE POR FORMA DE PAGO */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" /> Formas de Pago
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">100% Egresos</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-700 font-bold">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
              <span className="flex items-center gap-1">💵 Efectivo:</span>
              <span className="font-mono font-black text-slate-900">S/ {gastosDetalle.efec.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
              <span className="flex items-center gap-1">📱 Yape / Plin:</span>
              <span className="font-mono font-black text-slate-900">S/ {gastosDetalle.yape.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="flex items-center gap-1">💳 Tarjeta / Banco:</span>
              <span className="font-mono font-black text-slate-900">S/ {gastosDetalle.tarj.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* TARJETA 3: PROMEDIO Y PERIODO */}
        <div className="bg-slate-900 rounded-3xl shadow-lg p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" /> Promedio por Comprobante
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{compras.length} gastos</span>
            </div>
            <p className="text-3xl font-black font-mono text-amber-400">
              S/ {compras.length > 0 ? (gastosDetalle.total / compras.length).toFixed(2) : '0.00'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Promedio por factura o recibo en este rango
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-400">Rango seleccionado:</span>
            <span className="font-mono text-slate-300 font-black">
              {fechaDesde} al {fechaHasta}
            </span>
          </div>
        </div>

      </div>

      {/* TABLA PRINCIPAL DE GASTOS Y COMPRAS */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center flex-wrap gap-2">
          <h2 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Registro Detallado de Gastos y Facturas
          </h2>
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {compras.length} Registro{compras.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">Nº</th>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Descripción / Proveedor</th>
                  <th className="px-5 py-4">Categoría</th>
                  <th className="px-5 py-4">Comprobante</th>
                  <th className="px-5 py-4 text-right">Monto (S/)</th>
                  <th className="px-5 py-4 text-center">Medio Pago</th>
                  <th className="px-5 py-4 text-center">Origen</th>
                  <th className="px-5 py-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm bg-white">
                {compras.length > 0 ? compras.map((c, idx) => {
                  const fechaEm = c.fechaEmision
                    ? new Date(c.fechaEmision).toLocaleDateString('es-PE')
                    : new Date(c.creadoEn).toLocaleDateString('es-PE');
                  const origen = ORIGEN_BADGE[c.origenCarga] || ORIGEN_BADGE['manual'];
                  const colores = COLORES_CATEGORIA[c.categoria] || COLORES_CATEGORIA['Sin Categoría'];

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 text-xs">{fechaEm}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-black text-slate-900 text-xs leading-tight">{c.proveedor}</div>
                        {c.ruc && c.ruc !== '00000000000' && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">RUC: {c.ruc}</div>
                        )}
                      </td>

                      {/* CATEGORÍA INLINE */}
                      <td className="px-5 py-3.5">
                        {editCatId === c.id ? (
                          <div className="relative">
                            <select
                              autoFocus
                              defaultValue={c.categoria || ''}
                              onBlur={e => {
                                if (e.target.value !== c.categoria) {
                                  actualizarCategoria(c.id, e.target.value || null);
                                } else {
                                  setEditCatId(null);
                                }
                              }}
                              onChange={e => actualizarCategoria(c.id, e.target.value || null)}
                              className="border border-amber-400 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-amber-500 w-full"
                            >
                              <option value="">Sin categoría</option>
                              {CATEGORIAS.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditCatId(c.id)}
                            title="Click para editar categoría"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all hover:opacity-80 cursor-pointer ${colores.bg} ${colores.text} ${colores.border}`}
                          >
                            {c.categoria || 'Sin categoría'}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-600 text-xs">{c.tipoDocumento || 'Recibo'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.serieNumero || 'S/N'}</div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-black text-slate-950 text-sm">
                        S/ {parseFloat(c.total || 0).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          c.metodoPago === 'Efectivo' ? 'bg-amber-100 text-amber-800' :
                          c.metodoPago === 'Yape' ? 'bg-purple-100 text-purple-800' :
                          c.metodoPago?.startsWith('Mixto') ? 'bg-indigo-100 text-indigo-800' :
                          'bg-blue-100 text-blue-800'
                        }`} title={c.metodoPago}>
                          {c.metodoPago || 'Efectivo'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${origen.cls}`}>
                          {origen.label}
                        </span>
                      </td>

                      {/* ACCIONES: EDITAR Y ELIMINAR */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => abrirModalEditar(c)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 cursor-pointer"
                            title="Editar este gasto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setCompraEliminando(c)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all active:scale-90 cursor-pointer"
                            title="Eliminar este gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="9" className="text-center py-16 text-slate-400">
                      <RefreshCw className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="font-black uppercase text-xs tracking-wider mb-1">No hay gastos en este rango</p>
                      <p className="text-xs">Registra un nuevo gasto manual o amplía las fechas de búsqueda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL DE REGISTRO MANUAL DE GASTO (ÁGIL + MIXTO)
      ═══════════════════════════════════════════════════ */}
      {modalManual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-tight text-sm">
                <PlusCircle className="w-5 h-5 text-amber-500" /> Registrar Nuevo Gasto / Compra
              </h3>
              <button onClick={() => setModalManual(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-50 max-h-[80vh] overflow-y-auto custom-scrollbar">

              {/* CHIPS DE CONCEPTOS RÁPIDOS */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Conceptos Frecuentes (Autollenado Rápido)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CONCEPTOS_RAPIDOS.map((cp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => aplicarConceptoRapido(cp)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white hover:bg-amber-100 hover:text-amber-900 border border-slate-200 text-slate-700 transition-all cursor-pointer active:scale-95"
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                
                {/* Nombre / Descripción */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Nombre / Descripción del Gasto *
                  </label>
                  <input
                    type="text"
                    value={formCompra.proveedor}
                    onChange={e => setFormCompra(f => ({ ...f, proveedor: e.target.value }))}
                    placeholder="Ej. Pollo para caldo, Fluorescentes (2), Martha Silva Sueldo, Gas..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>

                {/* Monto Total */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Monto Total (S/) *
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={formCompra.total}
                    onChange={e => calcularPorTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:border-amber-500 bg-white font-mono font-black text-slate-900"
                  />
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Medio de Pago *
                  </label>
                  <select
                    value={formCompra.metodoPago}
                    onChange={e => {
                      const nuevoMetodo = e.target.value;
                      setFormCompra(f => {
                        const tot = parseFloat(f.total) || 0;
                        return {
                          ...f,
                          metodoPago: nuevoMetodo,
                          montoEfectivoMixto: nuevoMetodo === 'Mixto' ? String(tot) : '',
                          montoYapeMixto: '',
                          montoTarjetaMixto: '',
                        };
                      });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white font-bold text-slate-800"
                  >
                    <option value="Efectivo">💵 Efectivo (Caja)</option>
                    <option value="Yape">📱 Yape / Plin</option>
                    <option value="Tarjeta">💳 Tarjeta / Banco</option>
                    <option value="Mixto">🔄 Pago Mixto (Desglosar)</option>
                  </select>
                </div>

                {/* PANEL DESGLOSE PAGO MIXTO */}
                {formCompra.metodoPago === 'Mixto' && (() => {
                  const tot = parseFloat(formCompra.total) || 0;
                  const efec = parseFloat(formCompra.montoEfectivoMixto) || 0;
                  const yape = parseFloat(formCompra.montoYapeMixto) || 0;
                  const tarj = parseFloat(formCompra.montoTarjetaMixto) || 0;
                  const suma = efec + yape + tarj;
                  const dif = tot - suma;
                  return (
                    <div className="col-span-2 bg-amber-50/70 border border-amber-300 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          🔄 Desglose de Pago Mixto
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">Total: S/ {tot.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💵 Efectivo (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoEfectivoMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoEfectivoMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">📱 Yape / Plin (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoYapeMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoYapeMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💳 Tarjeta (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoTarjetaMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoTarjetaMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-xs font-black px-3 py-2 rounded-xl ${
                        Math.abs(dif) < 0.01 ? 'bg-emerald-100 text-emerald-800' :
                        dif > 0 ? 'bg-amber-200 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span>Suma Asignada: S/ {suma.toFixed(2)}</span>
                        <span>
                          {Math.abs(dif) < 0.01 ? '✅ Cuadrado Exacto' :
                           dif > 0 ? `⚠️ Falta asignar: S/ ${dif.toFixed(2)}` :
                           `⚠️ Excede por: S/ ${Math.abs(dif).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Categoría */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS.map(cat => {
                      const activa = formCompra.categoria === cat;
                      const colores = COLORES_CATEGORIA[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCompra(f => ({ ...f, categoria: cat }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-black border transition-all cursor-pointer ${
                            activa ? `${colores.bg} ${colores.text} ${colores.border} scale-105 shadow-sm` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Fecha del Gasto</label>
                  <input
                    type="date"
                    value={formCompra.fechaEmision}
                    onChange={e => setFormCompra(f => ({ ...f, fechaEmision: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

                {/* Tipo de Comprobante */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Comprobante</label>
                  <select
                    value={formCompra.tipoDocumento}
                    onChange={e => setFormCompra(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="Recibo Interno">Recibo Interno / Sin Comprobante</option>
                    <option value="Boleta">Boleta de Venta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket">Ticket</option>
                  </select>
                </div>

                {/* Serie y Número / RUC Opcionales */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nº Comprobante / Recibo</label>
                  <input
                    type="text"
                    value={formCompra.serieNumero}
                    onChange={e => setFormCompra(f => ({ ...f, serieNumero: e.target.value }))}
                    placeholder="Ej. REC-045, F001-124"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">RUC (Opcional)</label>
                  <input
                    type="text" maxLength={11}
                    value={formCompra.ruc}
                    onChange={e => setFormCompra(f => ({ ...f, ruc: e.target.value }))}
                    placeholder="11 dígitos"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setModalManual(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={guardarCompraManual}
                disabled={guardando}
                className="px-6 py-2.5 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL DE EDICIÓN COMPLETA DE GASTO (ÁGIL + MIXTO)
      ═══════════════════════════════════════════════════ */}
      {modalEditar && compraEditando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-tight text-sm">
                <Edit3 className="w-5 h-5 text-amber-500" /> Editar Gasto / Compra # {compraEditando.id}
              </h3>
              <button onClick={() => setModalEditar(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-50 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre / Descripción *</label>
                  <input
                    type="text"
                    value={compraEditando.proveedor}
                    onChange={e => setCompraEditando(f => ({ ...f, proveedor: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Monto Total (S/) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={compraEditando.total}
                    onChange={e => calcularPorTotal(e.target.value, true)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-base font-mono font-black text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Medio de Pago</label>
                  <select
                    value={compraEditando.metodoPago}
                    onChange={e => setCompraEditando(f => ({ ...f, metodoPago: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
                  >
                    <option value="Efectivo">💵 Efectivo (Caja)</option>
                    <option value="Yape">📱 Yape / Plin</option>
                    <option value="Tarjeta">💳 Tarjeta / Banco</option>
                    <option value="Mixto">🔄 Pago Mixto (Desglosar)</option>
                  </select>
                </div>

                {/* PANEL DESGLOSE PAGO MIXTO EN EDICIÓN */}
                {compraEditando.metodoPago === 'Mixto' && (() => {
                  const tot = parseFloat(compraEditando.total) || 0;
                  const efec = parseFloat(compraEditando.montoEfectivoMixto) || 0;
                  const yape = parseFloat(compraEditando.montoYapeMixto) || 0;
                  const tarj = parseFloat(compraEditando.montoTarjetaMixto) || 0;
                  const suma = efec + yape + tarj;
                  const dif = tot - suma;
                  return (
                    <div className="col-span-2 bg-amber-50/70 border border-amber-300 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                          🔄 Desglose Pago Mixto
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">Total: S/ {tot.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💵 Efectivo (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoEfectivoMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoEfectivoMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">📱 Yape (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoYapeMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoYapeMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💳 Tarjeta (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoTarjetaMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoTarjetaMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-xs font-black px-3 py-2 rounded-xl ${
                        Math.abs(dif) < 0.01 ? 'bg-emerald-100 text-emerald-800' :
                        dif > 0 ? 'bg-amber-200 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span>Suma Asignada: S/ {suma.toFixed(2)}</span>
                        <span>
                          {Math.abs(dif) < 0.01 ? '✅ Cuadrado' :
                           dif > 0 ? `⚠️ Falta: S/ ${dif.toFixed(2)}` :
                           `⚠️ Excede: S/ ${Math.abs(dif).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría</label>
                  <select
                    value={compraEditando.categoria || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    value={compraEditando.fechaEmision}
                    onChange={e => setCompraEditando(f => ({ ...f, fechaEmision: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo Comprobante</label>
                  <select
                    value={compraEditando.tipoDocumento}
                    onChange={e => setCompraEditando(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="Recibo Interno">Recibo Interno</option>
                    <option value="Boleta">Boleta de Venta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket">Ticket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Serie / Número</label>
                  <input
                    type="text"
                    value={compraEditando.serieNumero || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, serieNumero: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">RUC</label>
                  <input
                    type="text" maxLength={11}
                    value={compraEditando.ruc || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, ruc: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setModalEditar(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={guardarEdicionCompra}
                disabled={guardando}
                className="px-6 py-2.5 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ═══════════════════════════════════════════════════ */}
      {compraEliminando && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2 uppercase">¿Eliminar este registro de gasto?</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Vas a eliminar <strong>"{compraEliminando.proveedor}"</strong> por el monto de <strong>S/ {parseFloat(compraEliminando.total || 0).toFixed(2)}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCompraEliminando(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEliminarCompra}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm shadow-lg shadow-red-500/20 transition-all cursor-pointer active:scale-95"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      </section>
  );
}
