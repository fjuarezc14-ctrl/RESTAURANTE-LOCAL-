import React, { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign, XCircle, Users, Truck, Calendar, Search, Receipt, Printer, X, Wallet, Briefcase, Award, Flame, UtensilsCrossed, PieChart, Layers, History, AlertTriangle, Filter, Banknote, CreditCard, Smartphone, Gift, Ban, MessageCircle, Scale } from 'lucide-react';

import { api } from '../api';
import { useCompany } from '../context/CompanyContext';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS } from '../config/company';
import { generateOfflineQrUrl } from '../utils/qrOffline';
import { exportarReporteExcel, construirCreditosPlanilla, montosVenta } from '../utils/exportarReporteExcel';

// Igual que en Caja: el sistema solo emite tickets de venta
const FACTURACION_ELECTRONICA = false;

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;


const parseDeliveryInfo = (code) => {
  if (!code || !code.startsWith('DELIVERY -')) return null;
  const parts = code.split(' | ');
  const namePart = parts[0] ? parts[0].replace('DELIVERY - ', '') : '';
  const telPart = parts[1] ? parts[1].replace('TEL: ', '') : '';
  const dirPart = parts[2] ? parts[2].replace('DIR: ', '') : '';
  const pagaPart = parts[3] ? parts[3].replace('PAGA: ', '') : '';
  const vueltoPart = parts[4] ? parts[4].replace('VUELTO: ', '') : '';
  
  return {
    nombre: namePart,
    telefono: telPart,
    direccion: dirPart,
    conCuanto: pagaPart,
    vuelto: vueltoPart,
  };
};

const parsearCreditoSplit = (ofertaDescripcion, defaultClienteId, defaultMonto) => {
  if (ofertaDescripcion && typeof ofertaDescripcion === 'string') {
    const match = ofertaDescripcion.match(/\[CREDITO_SPLIT:(\[.*?\])\]/) || ofertaDescripcion.match(/\[CREDITO_SPLIT:(.*?)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            clienteId: parseInt(item.clienteId || item.id),
            nombre: item.nombre || '',
            monto: parseFloat(item.monto || 0)
          })).filter(item => !isNaN(item.clienteId) && item.monto > 0);
        }
      } catch (e) {
        console.error('Error parseando CREDITO_SPLIT:', e);
      }
    }
  }
  const defId = parseInt(defaultClienteId);
  const defM = parseFloat(defaultMonto || 0);
  if (!isNaN(defId) && defId > 0 && defM > 0) {
    return [{ clienteId: defId, monto: defM, nombre: '' }];
  }
  return [];
};

export default function ReportesPage() {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const getPrimerDiaMes = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const getHoyString = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fechaDesde, setFechaDesde] = useState(getHoyString());
  const [fechaHasta, setFechaHasta] = useState(getHoyString());
  const [resumen, setResumen] = useState({ 
    ventasTotal: 0, 
    ventasBase: 0, 
    ventasIGV: 0, 
    comprasTotal: 0, 
    comprasBase: 0, 
    comprasIGV: 0, 
    igvAPagar: 0 
  });
  const [cancelaciones, setCancelaciones] = useState([]);
  const [mozos, setMozos] = useState([]);
  const [cajeros, setCajeros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrando, setFiltrando] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [rotacion, setRotacion] = useState([]);
  const [compras, setCompras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [gerencialModalOpen, setGerencialModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [cierresHistorial, setCierresHistorial] = useState([]);
  const [cierreAImprimir, setCierreAImprimir] = useState(null);
  const [rotacionCatFiltro, setRotacionCatFiltro] = useState('Todos');
  const [rotacionBusqueda, setRotacionBusqueda] = useState('');
  const [filtroTipoAnulacion, setFiltroTipoAnulacion] = useState('Todos');

  // Filtros de secciones para el Reporte Gerencial PDF
  const [incluirBalance, setIncluirBalance] = useState(true);
  const [incluirMozos, setIncluirMozos] = useState(true);
  const [incluirRotacion, setIncluirRotacion] = useState(true);
  const [incluirGastos, setIncluirGastos] = useState(true);
  const [incluirPedidosYa, setIncluirPedidosYa] = useState(true);
  const [incluirPersonal, setIncluirPersonal] = useState(true);
  const [incluirRecaudacion, setIncluirRecaudacion] = useState(true);
  const [incluirCajeros, setIncluirCajeros] = useState(true);
  const [incluirAnulaciones, setIncluirAnulaciones] = useState(true);
  const [incluirCierres, setIncluirCierres] = useState(true);

  // Vista: comprobantes y detalle en modal
  const [ventaDetalleId, setVentaDetalleId] = useState(null);
  const [anulacionDetalle, setAnulacionDetalle] = useState(null);
  const [comprobantesBusqueda, setComprobantesBusqueda] = useState('');
  const [comprobantesMetodo, setComprobantesMetodo] = useState('Todos');
  const [comprobantesLimite, setComprobantesLimite] = useState(25);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setVentaDetalleId(null);
      setAnulacionDetalle(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  const numeroALetras = (num) => {
    const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
    const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    let entero = Math.floor(num);
    let decimales = Math.round((num - entero) * 100);
    let decimalStr = decimales < 10 ? "0" + decimales : decimales;

    if (entero === 0) return "CERO CON " + decimalStr + "/100 SOLES";
    if (entero === 100) return "CIEN CON " + decimalStr + "/100 SOLES";

    let letras = "";

    if (entero >= 100) {
      let c = Math.floor(entero / 100);
      letras += centenas[c] + " ";
      entero %= 100;
    }

    if (entero >= 10 && entero <= 19) {
      letras += especiales[entero - 10] + " ";
    } else if (entero >= 20 || entero > 0) {
      let d = Math.floor(entero / 10);
      let u = entero % 10;
      if (d > 0) {
        letras += decenas[d];
        if (u > 0) letras += " Y ";
      }
      if (u > 0) {
        letras += unidades[u];
      }
      letras += " ";
    }

    return letras.trim() + " CON " + decimalStr + "/100 SOLES";
  };

  const reimprimirComprobante = (v) => {
    if (!v) return;
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.id % 10000).padStart(4, '0');
    const igvSafe = Number(v.igv || 0).toFixed(2);
    const totalSafe = Number(v.total || 0).toFixed(2);
    const qrData = `${rucEmpresa}|03|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':'1'}|${v.numDocumento || '00000000'}`;
    const qrImageUrl = generateOfflineQrUrl(qrData);

    // Reconstruir items si vienen del backend o parsear de itemsResumen
    let items = v.items || [];
    if (items.length === 0 && v.itemsResumen) {
      items = v.itemsResumen.split(', ').map(str => {
        const match = str.match(/^(\d+)x\s+(.+)$/);
        if (match) {
          const cant = parseInt(match[1]);
          const nombre = match[2];
          const precio = v.total / cant; // fallback estimate
          return { cant, nombre, precio };
        }
        return { cant: 1, nombre: str, precio: v.total };
      });
    }

    const parsedDelivery = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    const cleanDoc = (() => {
      if (v.numDocumento && v.numDocumento.startsWith('DELIVERY -')) return 'S/D';
      return v.numDocumento || 'S/D';
    })();
    const cleanNombre = (() => {
      if (parsedDelivery) return parsedDelivery.nombre;
      if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
        return v.nombreCliente.replace('DELIVERY - ', '');
      }
      return v.nombreCliente || 'Consumidor Final';
    })();

    setActiveComprobante({
      tipo: v.tipoComprobante,
      serie,
      correlativo: correlativoStr,
      fecha: v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE'),
      hora: v.hora,
      mesaNum: v.mesaNum || (parsedDelivery ? 'Delivery' : 'Llevar'),
      clienteNombre: cleanNombre,
      clienteDoc: cleanDoc,
      clienteDireccion: parsedDelivery ? parsedDelivery.direccion : (v.clienteDireccion || ''),
      items,
      subtotal: v.subtotal,
      igv: v.igv,
      total: v.total,
      descuentoAplicado: v.descuentoAplicado || 0,
      ofertaDescripcion: v.ofertaDescripcion || null,
      totalLetras,
      hashResumen: "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=",
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo || 0,
      montoTarjeta: v.montoTarjeta || 0,
      montoYape: v.montoYape || 0,
      qrImageUrl,
      deliveryInfo: parsedDelivery,
    });

    setSunatModalOpen(true);
    
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const enviarPorWhatsApp = (v) => {
    if (!v) return;
    const telefono = prompt("Ingresa el número de WhatsApp del cliente (Ej. 999888777):");
    if (!telefono) return;
    
    // Validar celular peruano de 9 dígitos
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      alert("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const totalSafe = Number(v.total || 0).toFixed(2);
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, el total de su consumo en *${COMPANY_CONFIG.name}* fue de *S/ ${totalSafe}* (ticket de venta N° ${v.id}).\n\n¡Gracias por su preferencia!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };


  const fetchReportes = useCallback(async (desde, hasta) => {
    setFiltrando(true);
    try {
      const [data, cancs, mzs, vts, rot, cmps, clients, cierresRes, cajs] = await Promise.all([
        api.getReporteContable(desde, hasta),
        api.getCancelaciones(desde, hasta),
        api.getReporteMozos(desde, hasta),
        api.getHistorialVentas(desde, hasta),
        api.getRotacion(desde, hasta),
        api.getCompras(desde, hasta),
        api.getClientes().catch(() => []),
        api.getHistorialCierres(100).catch(() => []),
        api.getReporteCajeros(desde, hasta).catch(() => []),
      ]);
      setResumen(data);
      setCancelaciones(cancs || []);
      setMozos(mzs || []);
      setVentas(vts || []);
      setRotacion(rot || []);
      setCompras(cmps || []);
      setClientes(clients || []);
      const listCierres = Array.isArray(cierresRes) ? cierresRes : (cierresRes?.cierres || []);
      setCierresHistorial(listCierres);
      setCajeros(cajs || []);
    } catch(err) {
      console.error('Error cargando reportes:', err);
    } finally {
      setLoading(false);
      setFiltrando(false);
    }
  }, []);


  useEffect(() => {
    fetchReportes(fechaDesde, fechaHasta);
  }, []);

  const handleFiltrar = () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Por favor selecciona ambas fechas.');
      return;
    }
    fetchReportes(fechaDesde, fechaHasta);
  };

  const exportarLibroContableRCE = async () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Por favor selecciona ambas fechas.');
      return;
    }
    try {
      setFiltrando(true);
      // Datos frescos del rango elegido (aunque aún no se haya pulsado "Filtrar")
      const [vts, cmps, rot, cajs, cancs, cierresRes, clients] = await Promise.all([
        api.getHistorialVentas(fechaDesde, fechaHasta),
        api.getCompras(fechaDesde, fechaHasta),
        api.getRotacion(fechaDesde, fechaHasta).catch(() => []),
        api.getReporteCajeros(fechaDesde, fechaHasta).catch(() => []),
        api.getCancelaciones(fechaDesde, fechaHasta).catch(() => []),
        api.getHistorialCierres(500).catch(() => []),
        api.getClientes().catch(() => []),
      ]);
      await exportarReporteExcel({
        empresa: COMPANY_CONFIG,
        desde: fechaDesde,
        hasta: fechaHasta,
        ventas: vts || [],
        compras: cmps || [],
        rotacion: rot || [],
        cajeros: cajs || [],
        cancelaciones: cancs || [],
        cierres: Array.isArray(cierresRes) ? cierresRes : (cierresRes?.cierres || []),
        clientes: clients || [],
        parseDeliveryInfo,
        parsearCreditoSplit,
      });
    } catch (err) {
      alert('Error al generar el Excel: ' + err.message);
    } finally {
      setFiltrando(false);
    }
  };

  // ── Helpers de presentación ──
  const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

  const METODO_ESTILO = {
    Efectivo: { Icon: Banknote, chip: 'bg-emerald-50 text-emerald-700' },
    Tarjeta: { Icon: CreditCard, chip: 'bg-blue-50 text-blue-700' },
    Yape: { Icon: Smartphone, chip: 'bg-purple-50 text-purple-700' },
    Mixto: { Icon: Layers, chip: 'bg-amber-50 text-amber-700' },
    Crédito: { Icon: Wallet, chip: 'bg-teal-50 text-teal-700' },
    Consumo: { Icon: Users, chip: 'bg-violet-50 text-violet-700' },
    Cortesía: { Icon: Gift, chip: 'bg-orange-50 text-orange-700' },
    PedidosYa: { Icon: Truck, chip: 'bg-rose-50 text-rose-600' },
  };
  const estiloMetodo = (m) => METODO_ESTILO[m] || { Icon: Receipt, chip: 'bg-slate-100 text-slate-600' };

  // PedidosYa con código de delivery/llevar propio se cobra en efectivo
  const metodoReal = (v) => {
    if (v.metodoPago === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) return 'Efectivo';
    return v.metodoPago;
  };

  const clienteDeVenta = (v) => {
    const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    if (info) return info.nombre;
    if (v.nombreCliente?.startsWith('DELIVERY -')) return v.nombreCliente.replace('DELIVERY - ', '');
    return v.nombreCliente || 'Consumidor Final';
  };

  const origenDeVenta = (v) => {
    if (!v.codigoPedidosYa) return `Mesa ${v.mesaNum || 'S/M'}`;
    if (v.codigoPedidosYa.startsWith('DELIVERY -')) return 'Delivery';
    if (v.codigoPedidosYa.startsWith('LLEVAR -')) return 'Para llevar';
    return `PedidosYa · ${v.codigoPedidosYa}`;
  };

  const esPedidosYa = (v) => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -');

  const fechaVenta = (v) => v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE');

  const panel = ({ titulo, subtitulo, Icon, color, derecha, children, sinPadding }) => (
    <section className="bg-white rounded-2xl border border-slate-200/70 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${color}`}><Icon className="w-4 h-4" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">{titulo}</h2>
            {subtitulo && <p className="text-xs text-slate-400 truncate">{subtitulo}</p>}
          </div>
        </div>
        {derecha}
      </div>
      <div className={sinPadding ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  );

  const kpi = ({ label, valor, hint, Icon, color, borde, valorClase = 'text-slate-900', extra }) => (
    <div key={label} className={`rounded-2xl border border-slate-200/70 border-t-4 ${borde} bg-white p-4 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${color}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className={`mt-1 text-lg sm:text-xl font-semibold font-mono tabular-nums truncate ${valorClase}`}>{valor}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>}
      {extra}
    </div>
  );

  const chipCount = (n, color) => (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 shrink-0 ${color}`}>{n}</span>
  );

  const vacio = (texto) => <p className="px-5 py-10 text-center text-sm text-slate-400">{texto}</p>;

  const botonTicket = (onClick, label = 'Ticket') => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors shrink-0"
    >
      <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const modalDetalle = (onClose, header, body, footer) => (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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

  const hoyStr = getHoyString();
  const ayerStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const primerDiaMes = getPrimerDiaMes();
  const rangos = [
    { label: 'Hoy', desde: hoyStr, hasta: hoyStr },
    { label: 'Ayer', desde: ayerStr, hasta: ayerStr },
    { label: 'Este mes', desde: primerDiaMes, hasta: hoyStr },
  ];

  const TABS = [
    { id: 'resumen', label: 'Balance', Icon: TrendingUp, activo: 'bg-sky-600 text-white shadow-sm shadow-sky-600/25' },
    { id: 'rotacion', label: 'Carta y platos', Icon: UtensilsCrossed, activo: 'bg-amber-500 text-white shadow-sm shadow-amber-500/25' },
    { id: 'mozos', label: 'Mozos', Icon: Users, activo: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25' },
    { id: 'anulaciones', label: 'Anulaciones', Icon: XCircle, activo: 'bg-rose-600 text-white shadow-sm shadow-rose-600/25' },
    { id: 'consumo', label: 'Consumos y créditos', Icon: Wallet, activo: 'bg-teal-600 text-white shadow-sm shadow-teal-600/25' },
    { id: 'pedidosya', label: 'PedidosYa', Icon: Truck, activo: 'bg-rose-500 text-white shadow-sm shadow-rose-500/25' },
    { id: 'cierres', label: 'Cierres de turno', Icon: History, activo: 'bg-purple-600 text-white shadow-sm shadow-purple-600/25' },
  ];

  // Comprobantes: búsqueda y filtro
  const busquedaCompNorm = comprobantesBusqueda.trim().toLowerCase();
  const comprobantesLista = ventas.filter(v => {
    if (comprobantesMetodo !== 'Todos' && metodoReal(v) !== comprobantesMetodo) return false;
    if (!busquedaCompNorm) return true;
    return [`vt-${v.id}`, String(v.id), clienteDeVenta(v), origenDeVenta(v), v.itemsResumen, v.cajeroNombre, v.serie && `${v.serie}-${v.numero}`]
      .some(s => s && String(s).toLowerCase().includes(busquedaCompNorm));
  });
  const comprobantesVisibles = comprobantesLista.slice(0, comprobantesLimite);
  const ventaDetalle = ventaDetalleId != null ? ventas.find(v => v.id === ventaDetalleId) : null;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando reporte contable...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 space-y-5">

      {/* ENCABEZADO Y FILTRO DE FECHAS */}
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Reportes</h1>
            <p className="mt-1 text-sm text-slate-500">Balance, IGV, rotación de carta, anulaciones y arqueos del periodo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportarLibroContableRCE}
              disabled={filtrando}
              className="h-10 px-3.5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Excel RCE / RVE
            </button>
            <button
              type="button"
              onClick={() => setGerencialModalOpen(true)}
              disabled={filtrando}
              className="h-10 px-3.5 inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-sm font-semibold text-white shadow-sm shadow-sky-600/25 transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Reporte PDF
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 lg:w-auto shrink-0">
            {rangos.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => { setFechaDesde(r.desde); setFechaHasta(r.hasta); fetchReportes(r.desde, r.hasta); }}
                className={`h-8 px-4 rounded-lg text-sm font-medium transition-all ${fechaDesde === r.desde && fechaHasta === r.hasta ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1">
            <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white flex-1 min-w-[150px]">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">Desde</span>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="flex-1 min-w-0 bg-transparent text-sm font-mono text-slate-800 focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white flex-1 min-w-[150px]">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">Hasta</span>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="flex-1 min-w-0 bg-transparent text-sm font-mono text-slate-800 focus:outline-none" />
            </label>
            <button
              type="button"
              onClick={handleFiltrar}
              disabled={filtrando}
              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 w-full sm:w-auto shrink-0"
            >
              {filtrando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
              Filtrar
            </button>
          </div>
        </div>
      </header>

      {/* PESTAÑAS */}
      <nav className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-10 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-all shrink-0 ${
              activeTab === tab.id ? tab.activo : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <tab.Icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </nav>

      {/* 1. BALANCE Y COMPROBANTES */}
      {activeTab === 'resumen' && (() => {
        const margen = resumen.ventasTotal - resumen.comprasTotal;
        const dc = resumen.desgloseCaja;
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpi({ label: 'Ventas del periodo', valor: soles(resumen.ventasTotal), hint: `Base ${soles(resumen.ventasBase)} · IGV ${soles(resumen.ventasIGV)}`, Icon: TrendingUp, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
              {kpi({ label: 'Compras RCE', valor: soles(resumen.comprasTotal), hint: `Base ${soles(resumen.comprasBase)} · IGV ${soles(resumen.comprasIGV)}`, Icon: TrendingDown, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
              {kpi({ label: 'Margen operativo', valor: soles(margen), valorClase: margen >= 0 ? 'text-emerald-600' : 'text-rose-600', hint: `Rentabilidad ${resumen.ventasTotal > 0 ? ((margen / resumen.ventasTotal) * 100).toFixed(1) : '0.0'}%`, Icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
              {kpi({ label: 'Ticket promedio', valor: soles(ventas.length > 0 ? resumen.ventasTotal / ventas.length : 0), hint: `${ventas.length} comandas cobradas`, Icon: Receipt, color: 'bg-amber-50 text-amber-600', borde: 'border-t-amber-500' })}
            </div>

            {dc && panel({
              titulo: 'Recaudación por método',
              subtitulo: 'Periodo seleccionado',
              Icon: Wallet,
              color: 'bg-emerald-50 text-emerald-600',
              children: (
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
                  {[
                    ['Efectivo', dc.efectivo, Banknote, 'bg-emerald-50 text-emerald-700'],
                    ['Tarjeta / POS', dc.tarjeta, CreditCard, 'bg-blue-50 text-blue-700'],
                    ['Yape / Plin', dc.yape, Smartphone, 'bg-purple-50 text-purple-700'],
                    ['PedidosYa', dc.pedidosYa, Truck, 'bg-rose-50 text-rose-600'],
                    ['Consumo planilla', dc.consumos ?? dc.consumoPlanilla, Users, 'bg-violet-50 text-violet-700'],
                    ['Crédito comercial', dc.credito ?? dc.consumoClientes, Briefcase, 'bg-teal-50 text-teal-700'],
                    ['Cortesías', dc.cortesias, Gift, 'bg-orange-50 text-orange-700'],
                  ].map(([label, monto, Icon, color]) => (
                    <div key={label} className={`rounded-xl px-3 py-2.5 ${color}`}>
                      <p className="text-[11px] font-medium flex items-center gap-1.5 opacity-90"><Icon className="w-3.5 h-3.5" /> {label}</p>
                      <p className="mt-0.5 font-mono font-semibold tabular-nums text-base">{soles(monto)}</p>
                    </div>
                  ))}
                </div>
              ),
            })}

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
              {/* Comprobantes */}
              <div className="xl:col-span-3 min-w-0">
                {panel({
                  titulo: 'Comprobantes emitidos',
                  subtitulo: 'Registro de ventas del periodo · toca uno para ver el detalle',
                  Icon: Receipt,
                  color: 'bg-indigo-50 text-indigo-600',
                  derecha: chipCount(comprobantesLista.length, 'bg-indigo-50 text-indigo-700'),
                  sinPadding: true,
                  children: (
                    <>
                      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
                        <div className="relative flex-1 min-w-[160px]">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="search"
                            value={comprobantesBusqueda}
                            onChange={(e) => { setComprobantesBusqueda(e.target.value); setComprobantesLimite(25); }}
                            placeholder="Buscar venta, cliente, cajero…"
                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                          />
                        </div>
                        <select
                          value={comprobantesMetodo}
                          onChange={(e) => { setComprobantesMetodo(e.target.value); setComprobantesLimite(25); }}
                          className="h-9 px-2.5 rounded-lg bg-slate-100/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        >
                          <option value="Todos">Todos</option>
                          {['Efectivo', 'Tarjeta', 'Yape', 'Mixto', 'Crédito', 'Consumo', 'Cortesía', 'PedidosYa'].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      {comprobantesVisibles.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                          {comprobantesVisibles.map(v => {
                            const metodo = metodoReal(v);
                            const est = estiloMetodo(metodo);
                            return (
                              <li key={v.id}>
                                <button
                                  type="button"
                                  onClick={() => setVentaDetalleId(v.id)}
                                  className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                                >
                                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${v.anulado ? 'bg-red-50 text-red-500' : est.chip}`}>
                                    {v.anulado ? <Ban className="w-4 h-4" /> : <est.Icon className="w-4 h-4" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate ${v.anulado ? 'text-slate-400' : 'text-slate-900'}`}>
                                      {origenDeVenta(v)} <span className="text-slate-300">·</span> {clienteDeVenta(v)}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                      <span className="font-mono">#VT-{v.id}</span> · {fechaVenta(v)} {v.hora} · {v.cajeroNombre || 'Cajero principal'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`font-mono text-sm font-semibold tabular-nums ${v.anulado ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                      {soles(v.anulado ? (v.montoOriginal ?? v.total) : v.total)}
                                    </p>
                                    <p className={`text-[11px] font-medium ${v.anulado ? 'text-red-600' : est.chip.split(' ')[1]}`}>{v.anulado ? 'Devuelto' : metodo}</p>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : vacio(busquedaCompNorm || comprobantesMetodo !== 'Todos' ? 'Ningún comprobante coincide con el filtro.' : 'No hay comprobantes en este rango de fechas.')}
                      {comprobantesLista.length > comprobantesVisibles.length && (
                        <div className="px-4 py-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setComprobantesLimite(l => l + 25)}
                            className="w-full h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          >
                            Mostrar más ({comprobantesLista.length - comprobantesVisibles.length})
                          </button>
                        </div>
                      )}
                    </>
                  ),
                })}
              </div>

              {/* Cajeros */}
              <div className="xl:col-span-2 min-w-0">
                {panel({
                  titulo: 'Ventas por cajero',
                  subtitulo: 'Recaudación del personal de caja',
                  Icon: Users,
                  color: 'bg-purple-50 text-purple-600',
                  derecha: chipCount(cajeros.length, 'bg-purple-50 text-purple-700'),
                  sinPadding: true,
                  children: cajeros.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {cajeros.map((c, i) => (
                        <li key={i} className="px-4 sm:px-5 py-3.5 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white grid place-items-center text-sm font-semibold shrink-0">{(c.nombre || 'C')[0].toUpperCase()}</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{c.nombre}</p>
                              <p className="text-xs text-slate-500">{c.cantidadTickets} tickets · prom. {soles(c.ticketPromedio)}</p>
                            </div>
                            <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 shrink-0">{soles(c.totalVentas)}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-12 text-[11px] font-mono">
                            <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5">Efec. {soles(c.efectivo)}</span>
                            <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5">Tarj. {soles(c.tarjeta)}</span>
                            <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5">Yape {soles(c.yape)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : vacio('Sin cobros de cajeros en este periodo.'),
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. RENDIMIENTO DE LA CARTA Y RANKING DE PLATOS */}
      {activeTab === 'rotacion' && (() => {
        const totalPlatosVendidos = rotacion.reduce((sum, item) => sum + (item.cantidad || 0), 0);
        const totalFacturacionCarta = rotacion.reduce((sum, item) => sum + (item.total || 0), 0);
        const platoEstrella = rotacion.length > 0 ? rotacion[0] : null;
        const platoMayorIngreso = rotacion.length > 0 ? [...rotacion].sort((a, b) => (b.total || 0) - (a.total || 0))[0] : null;

        // Agrupación por categoría gastronómica
        const catMap = {};
        rotacion.forEach(item => {
          const cat = item.categoria || 'Sin Categoría';
          if (!catMap[cat]) {
            catMap[cat] = { categoria: cat, cantidad: 0, total: 0 };
          }
          catMap[cat].cantidad += item.cantidad || 0;
          catMap[cat].total += item.total || 0;
        });
        const categoriasRanking = Object.values(catMap).sort((a, b) => b.total - a.total);
        const categoriasDisponibles = ['Todos', ...categoriasRanking.map(c => c.categoria)];

        const top5 = rotacion.slice(0, 5);

        const rotacionFiltrada = rotacion.filter(item => {
          const matchCat = rotacionCatFiltro === 'Todos' || item.categoria === rotacionCatFiltro;
          const matchNom = !rotacionBusqueda.trim() ||
            item.nombre.toLowerCase().includes(rotacionBusqueda.toLowerCase()) ||
            (item.categoria && item.categoria.toLowerCase().includes(rotacionBusqueda.toLowerCase()));
          return matchCat && matchNom;
        });
        const maxTotal = Math.max(1, ...rotacionFiltrada.map(r => r.total || 0));

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 shadow-sm shadow-amber-500/20 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-amber-50/90">Plato más vendido</p>
                  <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Award className="w-4 h-4" /></span>
                </div>
                <p className="mt-1 text-base font-semibold truncate" title={platoEstrella?.nombre}>{platoEstrella ? platoEstrella.nombre : 'Sin ventas'}</p>
                <p className="text-xs text-amber-50/90">{platoEstrella ? `${platoEstrella.cantidad} raciones · ${soles(platoEstrella.total)}` : '—'}</p>
              </div>
              {kpi({ label: 'Mayor ingreso', valor: soles(platoMayorIngreso?.total), valorClase: 'text-emerald-600', hint: platoMayorIngreso ? `${platoMayorIngreso.nombre} · ${platoMayorIngreso.cantidad} unid.` : 'Sin ventas', Icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
              {kpi({ label: 'Raciones vendidas', valor: totalPlatosVendidos, hint: `${rotacion.length} platos distintos`, Icon: UtensilsCrossed, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
              {kpi({ label: 'Total recaudado carta', valor: soles(totalFacturacionCarta), hint: `${categoriasRanking.length} categorías activas`, Icon: TrendingUp, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
              {categoriasRanking.length > 0 && panel({
                titulo: 'Participación por categoría',
                subtitulo: `100% = ${soles(totalFacturacionCarta)}`,
                Icon: PieChart,
                color: 'bg-amber-50 text-amber-600',
                children: (
                  <ul className="space-y-3">
                    {categoriasRanking.map((catItem, cIdx) => {
                      const pct = totalFacturacionCarta > 0 ? ((catItem.total / totalFacturacionCarta) * 100) : 0;
                      return (
                        <li key={cIdx}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-slate-800 truncate">{catItem.categoria}</span>
                            <span className="font-mono tabular-nums text-slate-900 shrink-0">{soles(catItem.total)} <span className="text-xs text-amber-700 ml-1">{pct.toFixed(1)}%</span></span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{catItem.cantidad} unidades</p>
                        </li>
                      );
                    })}
                  </ul>
                ),
              })}

              {top5.length > 0 && panel({
                titulo: 'Top 5 más pedidos',
                Icon: Flame,
                color: 'bg-orange-50 text-orange-600',
                sinPadding: true,
                children: (
                  <ol className="divide-y divide-slate-100">
                    {top5.map((item, idx) => {
                      const pct = totalPlatosVendidos > 0 ? ((item.cantidad / totalPlatosVendidos) * 100) : 0;
                      const medalla = ['bg-amber-400 text-white', 'bg-slate-300 text-slate-700', 'bg-orange-300 text-orange-900', 'bg-slate-100 text-slate-500', 'bg-slate-100 text-slate-500'][idx];
                      return (
                        <li key={idx} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                          <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold shrink-0 ${medalla}`}>{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.nombre}</p>
                            <p className="text-xs text-slate-500 truncate">{item.categoria} · {item.cantidad} platos · {pct.toFixed(1)}%</p>
                          </div>
                          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 shrink-0">{soles(item.total)}</p>
                        </li>
                      );
                    })}
                  </ol>
                ),
              })}
            </div>

            {panel({
              titulo: 'Rotación de la carta',
              subtitulo: 'Platos ordenados por volumen de venta',
              Icon: TrendingUp,
              color: 'bg-sky-50 text-sky-600',
              derecha: (
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={rotacionBusqueda}
                    onChange={e => setRotacionBusqueda(e.target.value)}
                    placeholder="Buscar plato o categoría…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              ),
              sinPadding: true,
              children: (
                <>
                  <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 flex gap-1.5 overflow-x-auto custom-scrollbar">
                    {categoriasDisponibles.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setRotacionCatFiltro(cat)}
                        className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                          rotacionCatFiltro === cat ? 'bg-sky-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {rotacionFiltrada.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {rotacionFiltrada.map((r, i) => {
                        const pct = totalFacturacionCarta > 0 ? ((r.total / totalFacturacionCarta) * 100) : 0;
                        const precioProm = r.cantidad > 0 ? (r.total / r.cantidad) : r.precio;
                        return (
                          <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                            <span className="w-6 text-right font-mono text-xs text-slate-400 shrink-0">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="text-sm font-medium text-slate-900 truncate">{r.nombre}</p>
                                <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 shrink-0">{soles(r.total)}</p>
                              </div>
                              <div className="mt-1 flex items-center gap-3">
                                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(2, ((r.total || 0) / maxTotal) * 100)}%` }} />
                                </div>
                                <p className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                                  <span className="hidden sm:inline">{r.categoria || 'General'} · </span>{r.cantidad} u · prom. {soles(precioProm)} · {pct.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : vacio('No se encontraron platos que coincidan con los filtros.')}
                </>
              ),
            })}
          </div>
        );
      })()}

      {/* 3. CONTROL PEDIDOSYA */}
      {activeTab === 'pedidosya' && (() => {
        const itemsPY = ventas.filter(esPedidosYa);
        const totalPY = itemsPY.reduce((s, v) => s + v.total, 0);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpi({ label: 'Total PedidosYa', valor: soles(totalPY), hint: 'Para conciliar la liquidación semanal', Icon: Truck, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
              {kpi({ label: 'Pedidos', valor: itemsPY.length, hint: `Prom. ${soles(itemsPY.length ? totalPY / itemsPY.length : 0)}`, Icon: Receipt, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
            </div>
            {panel({
              titulo: 'Ventas de PedidosYa',
              subtitulo: 'Detalle para conciliar con el portal',
              Icon: Truck,
              color: 'bg-rose-50 text-rose-600',
              derecha: chipCount(itemsPY.length, 'bg-rose-50 text-rose-700'),
              sinPadding: true,
              children: itemsPY.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {itemsPY.map(v => (
                    <li key={v.id}>
                      <button type="button" onClick={() => setVentaDetalleId(v.id)} className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                        <span className="h-7 px-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-mono font-semibold grid place-items-center shrink-0">{v.codigoPedidosYa || 'N/A'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 truncate">{v.itemsResumen}</p>
                          <p className="text-xs text-slate-500"><span className="font-mono">#VT-{v.id}</span> · {fechaVenta(v)} {v.hora}</p>
                        </div>
                        <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 shrink-0">{soles(v.total)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : vacio('No se registraron ventas de PedidosYa en este periodo.'),
            })}
          </div>
        );
      })()}

      {/* 4. CONSUMO DE PERSONAL (PLANILLA) Y CRÉDITOS */}
      {activeTab === 'consumo' && (() => {
        const clienteMap = new Map(clientes.map(c => [c.id, c]));

        const listadoPlanilla = [];
        const listadoComercial = [];

        ventas.forEach(v => {
          if (v.anulado || v.estadoPedido === 'Cancelado') return;

          if (v.metodoPago === 'Consumo') {
            listadoPlanilla.push({
              id: v.id,
              fecha: v.fecha,
              createdAt: v.createdAt,
              hora: v.hora,
              nombre: v.nombreCliente || v.mesero || 'Consumo Personal',
              documento: '',
              itemsResumen: v.itemsResumen,
              monto: v.descuentoAplicado || v.total,
              rawVenta: v
            });
          } else {
            const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
            if (splits.length > 0) {
              splits.forEach(s => {
                const cli = clienteMap.get(s.clienteId);
                const esTrab = cli?.esTrabajador || false;
                const nombre = cli?.nombre || s.nombre || v.nombreCliente || 'Cliente Crédito';
                const doc = cli?.numDoc || cli?.documento || '';
                const item = {
                  id: v.id,
                  fecha: v.fecha,
                  createdAt: v.createdAt,
                  hora: v.hora,
                  nombre,
                  documento: doc,
                  itemsResumen: v.itemsResumen,
                  monto: s.monto,
                  rawVenta: v
                };
                if (esTrab) listadoPlanilla.push(item);
                else listadoComercial.push(item);
              });
            } else if (v.metodoPago === 'Crédito') {
              listadoComercial.push({
                id: v.id,
                fecha: v.fecha,
                createdAt: v.createdAt,
                hora: v.hora,
                nombre: v.nombreCliente || 'Cliente Comercial',
                documento: '',
                itemsResumen: v.itemsResumen,
                monto: v.total,
                rawVenta: v
              });
            }
          }
        });

        const planillaPorColaborador = {};
        listadoPlanilla.forEach(item => {
          planillaPorColaborador[item.nombre] = (planillaPorColaborador[item.nombre] || 0) + item.monto;
        });

        const clientesPorComercial = {};
        listadoComercial.forEach(item => {
          const key = item.documento ? `${item.nombre} (${item.documento})` : item.nombre;
          clientesPorComercial[key] = (clientesPorComercial[key] || 0) + item.monto;
        });

        const totalPlanilla = listadoPlanilla.reduce((sum, item) => sum + item.monto, 0);
        const totalComercial = listadoComercial.reduce((sum, item) => sum + item.monto, 0);

        const acumulado = (entries, color) => entries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entries.map(([nombre, total]) => (
              <span key={nombre} className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${color}`}>
                <span className="truncate max-w-[12rem]" title={nombre}>{nombre}</span>
                <span className="font-mono font-semibold">{soles(total)}</span>
              </span>
            ))}
          </div>
        ) : null;

        const listado = (items, colorMonto, etiqueta, textoVacio) => items.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <li key={`${item.id}-${idx}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {item.nombre}
                    {item.documento && <span className="ml-2 text-[11px] font-mono font-normal text-slate-400">{item.documento}</span>}
                    {etiqueta}
                  </p>
                  <p className="text-xs text-slate-500 truncate"><span className="font-mono">#VT-{item.id}</span> · {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} {item.hora} · {item.itemsResumen}</p>
                </div>
                <p className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${colorMonto}`}>{soles(item.monto)}</p>
                {botonTicket(() => reimprimirComprobante(item.rawVenta))}
              </li>
            ))}
          </ul>
        ) : vacio(textoVacio);

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpi({ label: 'Créditos comerciales', valor: soles(totalComercial), hint: `${listadoComercial.length} ventas a crédito`, Icon: Briefcase, color: 'bg-teal-50 text-teal-600', borde: 'border-t-teal-500', valorClase: 'text-teal-700' })}
              {kpi({ label: 'Consumo de planilla', valor: soles(totalPlanilla), hint: `${listadoPlanilla.length} consumos de personal`, Icon: Users, color: 'bg-violet-50 text-violet-600', borde: 'border-t-violet-500', valorClase: 'text-violet-700' })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
              {panel({
                titulo: 'Cuentas por cobrar · Clientes',
                subtitulo: 'Ventas a crédito comercial',
                Icon: Briefcase,
                color: 'bg-teal-50 text-teal-600',
                derecha: chipCount(soles(totalComercial), 'bg-teal-50 text-teal-700 font-mono'),
                sinPadding: true,
                children: (
                  <>
                    {Object.keys(clientesPorComercial).length > 0 && (
                      <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
                        <p className="text-xs font-medium text-slate-400 mb-2">Acumulado por cliente</p>
                        {acumulado(Object.entries(clientesPorComercial), 'bg-teal-50 text-teal-800')}
                      </div>
                    )}
                    {listado(listadoComercial, 'text-teal-700', null, 'No se registraron ventas a crédito comercial en este periodo.')}
                  </>
                ),
              })}

              {panel({
                titulo: 'Descuentos de planilla · Personal',
                subtitulo: 'Consumos de colaboradores internos',
                Icon: Users,
                color: 'bg-violet-50 text-violet-600',
                derecha: chipCount(soles(totalPlanilla), 'bg-violet-50 text-violet-700 font-mono'),
                sinPadding: true,
                children: (
                  <>
                    {Object.keys(planillaPorColaborador).length > 0 && (
                      <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
                        <p className="text-xs font-medium text-slate-400 mb-2">Acumulado por colaborador</p>
                        {acumulado(Object.entries(planillaPorColaborador), 'bg-violet-50 text-violet-800')}
                      </div>
                    )}
                    {listado(listadoPlanilla, 'text-violet-700', <span className="ml-2 text-[10px] font-medium text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">Planilla</span>, 'No se registraron consumos de personal en este periodo.')}
                  </>
                ),
              })}
            </div>
          </div>
        );
      })()}

      {/* 5. RENDIMIENTO MOZOS */}
      {activeTab === 'mozos' && (() => {
        const maxAtendidas = Math.max(1, ...mozos.map(m => m.mesasAtendidas || 0));
        return panel({
          titulo: 'Rendimiento de mozos',
          subtitulo: 'Mesas atendidas y activas en el periodo',
          Icon: Users,
          color: 'bg-indigo-50 text-indigo-600',
          derecha: chipCount(`${mozos.length} con comanda`, 'bg-indigo-50 text-indigo-700'),
          sinPadding: true,
          children: mozos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {mozos.map((m, i) => (
                <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 grid place-items-center text-sm font-bold shrink-0">{m.nombre[0]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 truncate">{m.nombre}</p>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                        <span className={`rounded-full px-2.5 py-0.5 ${m.mesasActivas > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>{m.mesasActivas} activa{m.mesasActivas !== 1 ? 's' : ''}</span>
                        <span className="rounded-full px-2.5 py-0.5 bg-emerald-50 text-emerald-700">{m.mesasAtendidas} atendida{m.mesasAtendidas !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full" style={{ width: `${Math.max(2, ((m.mesasAtendidas || 0) / maxAtendidas) * 100)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : vacio('Sin actividad de mozos en este rango de fechas.'),
        });
      })()}

      {/* 6. AUDITORÍA DE ANULACIONES Y DEVOLUCIONES */}
      {activeTab === 'anulaciones' && (() => {
        const cancelacionesFiltradas = cancelaciones.filter(c => {
          if (filtroTipoAnulacion === 'Todos') return true;
          return (c.tipo || 'Comanda Cancelada') === filtroTipoAnulacion;
        });

        const totalPerdida = cancelacionesFiltradas.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const devolucionesList = cancelaciones.filter(c => c.tipo === 'Devolución en Caja');
        const montoDevoluciones = devolucionesList.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const comandasList = cancelaciones.filter(c => c.tipo !== 'Devolución en Caja');
        const montoComandas = comandasList.reduce((s, c) => s + (Number(c.total) || 0), 0);

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpi({ label: 'Incidencias', valor: cancelacionesFiltradas.length, hint: 'Cancelaciones y devoluciones', Icon: XCircle, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
              {kpi({ label: 'Monto impactado', valor: `−${soles(totalPerdida)}`, valorClase: 'text-rose-600', hint: 'Según el filtro actual', Icon: DollarSign, color: 'bg-red-50 text-red-600', borde: 'border-t-red-500' })}
              {kpi({ label: 'Devoluciones en caja', valor: devolucionesList.length, hint: `Reembolsos ${soles(montoDevoluciones)}`, Icon: Receipt, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
              {kpi({ label: 'Comandas de salón', valor: comandasList.length, hint: `Anuladas antes del pago ${soles(montoComandas)}`, Icon: AlertTriangle, color: 'bg-amber-50 text-amber-600', borde: 'border-t-amber-500' })}
            </div>

            {panel({
              titulo: 'Registro de anulaciones',
              subtitulo: 'Toca un registro para ver motivo y detalle',
              Icon: XCircle,
              color: 'bg-rose-50 text-rose-600',
              derecha: (
                <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0 self-start sm:self-auto">
                  {[
                    { id: 'Todos', label: 'Todos', count: cancelaciones.length, activo: 'bg-slate-900 text-white' },
                    { id: 'Devolución en Caja', label: 'Devoluciones', count: devolucionesList.length, activo: 'bg-purple-600 text-white' },
                    { id: 'Comanda Cancelada', label: 'Comandas', count: comandasList.length, activo: 'bg-amber-500 text-white' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltroTipoAnulacion(f.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all ${filtroTipoAnulacion === f.id ? `${f.activo} shadow-sm` : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {f.label} <span className="opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              ),
              sinPadding: true,
              children: (
                <>
                  {cancelacionesFiltradas.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {cancelacionesFiltradas.map((c, i) => {
                        const isDevolucion = c.tipo === 'Devolución en Caja';
                        return (
                          <li key={i}>
                            <button type="button" onClick={() => setAnulacionDetalle(c)} className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                              <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${isDevolucion ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                                {isDevolucion ? <Receipt className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {c.mesa ? `Mesa ${c.mesa}` : (c.codigoPedidosYa || 'Delivery')} <span className="text-slate-300">·</span> <span className="font-normal italic text-slate-600">“{c.motivoCancela || 'Sin motivo'}”</span>
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {c.tipo || 'Comanda cancelada'} · {c.fecha || 'Hoy'} {c.hora} · {c.canceladoPor || 'No registrado'}
                                </p>
                              </div>
                              <p className="font-mono text-sm font-semibold tabular-nums text-rose-600 shrink-0">−{soles(c.total)}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : vacio(`No hay registros de ${filtroTipoAnulacion.toLowerCase()} en este rango de fechas.`)}
                  {cancelacionesFiltradas.length > 0 && (
                    <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">{cancelacionesFiltradas.length} de {cancelaciones.length} eventos</span>
                      <span className="font-mono font-semibold text-rose-600">−{soles(totalPerdida)}</span>
                    </div>
                  )}
                </>
              ),
            })}
          </div>
        );
      })()}

      {/* 7. CIERRES DE CAJA (ARQUEOS) */}
      {activeTab === 'cierres' && (() => {
        const cierresFiltrados = cierresHistorial.filter(c => {
          if (!c.fechaCierre) return true;
          const fStr = new Date(c.fechaCierre).toISOString().slice(0, 10);
          return fStr >= fechaDesde && fStr <= fechaHasta;
        });

        const totalEsperado = cierresFiltrados.reduce((s, c) => s + (Number(c.efectivoEsperado) || 0), 0);
        const totalDif = cierresFiltrados.reduce((s, c) => s + (Number(c.diferencia) || 0), 0);
        const totalElec = cierresFiltrados.reduce((s, c) => s + (Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)), 0);
        const difTexto = (d) => (d > 0.01 ? `+${soles(d)}` : soles(d));
        const difColor = (d) => (Math.abs(d) < 0.01 ? 'bg-emerald-50 text-emerald-700' : d > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700');

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {kpi({ label: 'Turnos cerrados', valor: cierresFiltrados.length, hint: 'Arqueos archivados', Icon: History, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
              {kpi({ label: 'Efectivo esperado', valor: soles(totalEsperado), hint: 'Ventas + abonos − egresos', Icon: Banknote, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
              {kpi({ label: 'Tarjetas y Yape', valor: soles(totalElec), hint: 'Cobros electrónicos', Icon: CreditCard, color: 'bg-blue-50 text-blue-600', borde: 'border-t-blue-500' })}
              {kpi({ label: 'Diferencia acumulada', valor: difTexto(totalDif), valorClase: totalDif < -0.01 ? 'text-rose-600' : (totalDif > 0.01 ? 'text-blue-600' : 'text-emerald-600'), hint: 'Físico vs calculado', Icon: Scale, color: 'bg-slate-100 text-slate-600', borde: 'border-t-slate-400' })}
            </div>

            {panel({
              titulo: 'Historial de arqueos',
              subtitulo: 'Cierres de turno por cajero',
              Icon: History,
              color: 'bg-purple-50 text-purple-600',
              derecha: chipCount(cierresFiltrados.length, 'bg-purple-50 text-purple-700'),
              sinPadding: true,
              children: cierresFiltrados.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {cierresFiltrados.map(c => {
                    const dif = Number(c.diferencia || 0);
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 grid place-items-center text-xs font-semibold shrink-0">#{c.id}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900 truncate">{c.cajeroNombre}</p>
                            <span className={`text-[11px] font-mono font-semibold rounded-md px-1.5 py-0.5 ${difColor(dif)}`}>{difTexto(dif)}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {new Date(c.fechaCierre).toLocaleDateString('es-PE')} {new Date(c.fechaCierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            <span className="hidden sm:inline"> · Esperado {soles(c.efectivoEsperado)} · Contado {soles(c.efectivoContado)} · Elec. {soles(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0))} · Egresos {soles(c.egresosEfectivo)}</span>
                          </p>
                          <p className="sm:hidden text-xs text-slate-500 font-mono">Contado {soles(c.efectivoContado)} / {soles(c.efectivoEsperado)}</p>
                        </div>
                        {botonTicket(() => setCierreAImprimir(c))}
                      </li>
                    );
                  })}
                </ul>
              ) : vacio('No hay cierres de caja registrados en este rango de fechas.'),
            })}
          </div>
        );
      })()}

      </div>

      {/* MODAL: DETALLE DE ANULACIÓN */}
      {anulacionDetalle && (() => {
        const c = anulacionDetalle;
        const isDevolucion = c.tipo === 'Devolución en Caja';
        return modalDetalle(
          () => setAnulacionDetalle(null),
          <>
            <p className={`text-xs font-medium ${isDevolucion ? 'text-purple-600' : 'text-amber-600'}`}>{c.tipo || 'Comanda cancelada'}</p>
            <p className="text-lg font-semibold text-slate-900">{c.mesa ? `Mesa ${c.mesa}` : (c.codigoPedidosYa || 'Delivery')}</p>
            <p className="text-sm text-slate-500 font-mono">{isDevolucion && c.ventaId ? `Ticket #${c.ventaId}` : `Ref #${c.id}`} · {c.fecha || 'Hoy'} {c.hora}</p>
          </>,
          <>
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-rose-700">Importe</span>
              <span className="text-xl font-semibold font-mono tabular-nums text-rose-600">−{soles(c.total)}</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">Responsable</dt><dd className="text-slate-800">{c.canceladoPor || 'No registrado'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-400">Motivo</dt><dd className="text-slate-800 italic">“{c.motivoCancela || 'Sin motivo especificado'}”</dd></div>
            </dl>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Detalle del consumo</p>
              {c.resumenItems ? (
                <ul className="divide-y divide-slate-100">
                  {c.resumenItems.split(', ').map((it, idx) => <li key={idx} className="py-2 text-sm text-slate-700">{it}</li>)}
                </ul>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>
          </>
        );
      })()}

      {/* MODAL: DETALLE DE COMPROBANTE */}
      {ventaDetalle && (() => {
        const v = ventaDetalle;
        const metodo = metodoReal(v);
        const est = estiloMetodo(metodo);
        const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
        return modalDetalle(
          () => setVentaDetalleId(null),
          <>
            <p className="text-xs font-medium text-slate-400 font-mono">#VT-{v.id} · {fechaVenta(v)} {v.hora}</p>
            <p className="text-lg font-semibold text-slate-900">{v.tipoComprobante} {v.serie ? `${v.serie}-${String(v.numero).padStart(4, '0')}` : ''}</p>
            <div className="mt-2">
              {v.anulado
                ? <span className="text-xs font-medium text-red-700 bg-red-50 rounded-md px-2 py-0.5">Devuelto</span>
                : <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 ${est.chip}`}><est.Icon className="w-3 h-3" /> {metodo}</span>}
            </div>
          </>,
          <>
            {v.anulado && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
                <p className="font-medium">Venta devuelta</p>
                {v.motivoAnulacion && <p className="text-red-600/90">Motivo: {v.motivoAnulacion} ({v.anuladoPor || 'Admin'})</p>}
              </div>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="min-w-0"><dt className="text-xs text-slate-400">Cliente</dt><dd className="text-slate-800 break-words">{clienteDeVenta(v)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-400">Origen</dt><dd className="text-slate-800">{origenDeVenta(v)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-400">Cajero</dt><dd className="text-slate-800">{v.cajeroNombre || 'Cajero principal'}</dd></div>
              {metodo === 'Mixto' && (
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Pago mixto</dt>
                  <dd className="text-xs font-mono text-slate-600 space-y-0.5">
                    {(v.montoEfectivo || 0) > 0 && <p>Efectivo {soles(v.montoEfectivo)}</p>}
                    {(v.montoTarjeta || 0) > 0 && <p>Tarjeta {soles(v.montoTarjeta)}</p>}
                    {(v.montoYape || 0) > 0 && <p>Yape {soles(v.montoYape)}</p>}
                    {(v.montoCredito || 0) > 0 && <p>Crédito {soles(v.montoCredito)}</p>}
                  </dd>
                </div>
              )}
              {info?.telefono && <div className="min-w-0"><dt className="text-xs text-slate-400">Teléfono</dt><dd className="text-slate-800">{info.telefono}</dd></div>}
              {info?.direccion && <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-slate-400">Dirección</dt><dd className="text-slate-800 break-words">{info.direccion}</dd></div>}
            </dl>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Productos</p>
              {v.itemsResumen ? (
                <ul className="divide-y divide-slate-100">
                  {v.itemsResumen.split(', ').map((it, idx) => <li key={idx} className="py-2 text-sm text-slate-700">{it}</li>)}
                </ul>
              ) : <p className="text-sm text-slate-400">Sin ítems</p>}
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-sm text-slate-500">Total</span>
              {v.anulado ? (
                <span className="text-right">
                  <span className="block text-xl font-semibold font-mono tabular-nums text-red-600">S/ 0.00</span>
                  {v.montoOriginal != null && <span className="block text-xs font-mono line-through text-slate-400">{soles(v.montoOriginal)}</span>}
                </span>
              ) : (
                <span className="text-xl font-semibold font-mono tabular-nums text-slate-900">{soles(v.total)}</span>
              )}
            </div>
          </>,
          !v.anulado && (
            <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => enviarPorWhatsApp(v)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => reimprimirComprobante(v)}
                className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Reimprimir
              </button>
            </div>
          )
        );
      })()}

      {/* MODAL REIMPRESIÓN TICKET DE CIERRE (REPORTES) */}
      {cierreAImprimir && (
        <div id="modal-cierre-reporte" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-purple-700">
                <Printer className="w-5 h-5 shrink-0" />
                <h3 className="font-black text-slate-900 text-base uppercase tracking-tight leading-none">Ticket de Cierre #{cierreAImprimir.id}</h3>
              </div>
              <button onClick={() => setCierreAImprimir(null)} className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vista del ticket térmico */}
            <div id="cierre-imprimible-reporte" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-5 flex flex-col">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4 flex flex-col items-center">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain mb-1 filter grayscale" />
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">{COMPANY_CONFIG.legalName}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{COMPANY_CONFIG.address} · RUC: {COMPANY_CONFIG.ruc}</p>
                <p className="text-[10px] text-purple-700 font-black mt-1 uppercase">COPIA DE CIERRE DE TURNO · #{cierreAImprimir.id}</p>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
                <div className="flex justify-between"><span>FECHA APERTURA:</span><span>{new Date(cierreAImprimir.fechaApertura).toLocaleString('es-PE')}</span></div>
                <div className="flex justify-between"><span>FECHA CIERRE:</span><span>{new Date(cierreAImprimir.fechaCierre).toLocaleString('es-PE')}</span></div>
                <div className="flex justify-between"><span>CAJERO:</span><span className="uppercase">{cierreAImprimir.cajeroNombre}</span></div>
                <div className="flex justify-between"><span>ESTADO:</span><span className="text-emerald-700 font-black">CERRADO</span></div>
              </div>

              <div className="space-y-2.5 mb-4 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>💵 EFECTIVO VENTAS:</span>
                  <span className="font-black text-slate-900">S/ {Number(cierreAImprimir.efectivoVentas || 0).toFixed(2)}</span>
                </div>
                {Number(cierreAImprimir.egresosEfectivo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>🔻 GASTOS EFECTIVO:</span>
                    <span className="font-black">- S/ {Number(cierreAImprimir.egresosEfectivo || 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(cierreAImprimir.abonosEfectivo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>➕ ABONOS EFECTIVO:</span>
                    <span className="font-black">+ S/ {Number(cierreAImprimir.abonosEfectivo || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 bg-amber-100/60 p-2 rounded-lg">
                  <span>EFECTIVO ESPERADO:</span>
                  <span>S/ {Number(cierreAImprimir.efectivoEsperado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>EFECTIVO CONTADO:</span>
                  <span className="font-black text-slate-900">S/ {Number(cierreAImprimir.efectivoContado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black">
                  <span>DIFERENCIA:</span>
                  <span className={Number(cierreAImprimir.diferencia || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    S/ {Number(cierreAImprimir.diferencia || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mb-3 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>💳 TARJETA:</span>
                  <span>S/ {Number(cierreAImprimir.totalTarjeta || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>📱 YAPE / PLIN:</span>
                  <span>S/ {Number(cierreAImprimir.totalYape || 0).toFixed(2)}</span>
                </div>
                {Number(cierreAImprimir.totalPedidosYa || 0) > 0 && (
                  <div className="flex justify-between font-bold text-rose-500">
                    <span>🛵 PEDIDOS YA:</span>
                    <span>S/ {Number(cierreAImprimir.totalPedidosYa || 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(cierreAImprimir.totalConsumo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-purple-600">
                    <span>🍽️ CONSUMO / CRÉDITO:</span>
                    <span>S/ {Number(cierreAImprimir.totalConsumo || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {cierreAImprimir.nota && (
                <div className="text-[10px] text-slate-500 italic mb-3">
                  <strong>Nota:</strong> {cierreAImprimir.nota}
                </div>
              )}

              <div className="text-center text-[10px] text-slate-400 font-bold">
                *** Reimpresión de Arqueo de Turno ***
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCierreAImprimir(null)}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUNAT Comprobante Susii Style Modal */}
      {sunatModalOpen && activeComprobante && (
        <div id="modal-comprobante-sunat-print-container" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
            <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" /> {
                  activeComprobante.metodoPago === 'Consumo' ? '👤 CONSUMO PERSONAL 👤' :
                  activeComprobante.metodoPago === 'Cortesía' ? '🎁 TICKET DE CORTESÍA 🎁' :
                  'TICKET DE VENTA'
                }
              </h3>
              <button onClick={() => setSunatModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div id="comprobante-sunat-ticket-print" className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-mono text-xs leading-relaxed">
              <div className="text-center font-bold" style={{ fontSize: '14px', marginBottom: '2px' }}>{COMPANY_CONFIG.legalName}</div>
              <div className="text-center text-[10px] leading-tight mb-2">
                {COMPANY_CONFIG.address}<br />
                R.U.C. N° {COMPANY_CONFIG.ruc}
              </div>
              
              <div className="text-center font-bold mb-1" style={{ fontSize: '11px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? '👤 VALE DE CONSUMO PERSONAL' :
                activeComprobante.metodoPago === 'Cortesía' ? '🎁 CORTESÍA / CONSUMO INTERNO' :
                activeComprobante.tipo === 'Factura' ? 'FACTURA ELECTRÓNICA' :
                activeComprobante.tipo === 'Ticket' ? 'TICKET DE VENTA' : 'BOLETA ELECTRÓNICA'
              }</div>
              <div className="text-center font-bold mb-3" style={{ fontSize: '13px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? `CONS-00${activeComprobante.mesaNum || 'SM'}-${activeComprobante.correlativo}` :
                activeComprobante.metodoPago === 'Cortesía' ? `COR-00${activeComprobante.mesaNum || 'SM'}` :
                `N° ${activeComprobante.correlativo}`
              }</div>
              
              <div className="flex justify-between border-t border-b border-dashed border-slate-300 py-1.5 mb-2 font-bold">
                <span>{activeComprobante.fecha} {activeComprobante.hora}</span>
                <span>Mesa {activeComprobante.mesaNum}</span>
              </div>
              
              {(() => {
                const itemsImprimibles = (activeComprobante.items || []).filter(item => item && (item.precio > 0 || (item.categoria && BARRA_CATEGORIAS.includes(item.categoria)) || (item.notas && item.notas.includes('CORTESÍA')) || (item.nombre && item.nombre.includes('CORTESÍA'))));

                return (
                  <>
                    <div className="space-y-1 mb-3">
                      <div><strong>Cliente:</strong> <span className="uppercase">{activeComprobante.clienteNombre}</span></div>
                      {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                        <div><strong>{activeComprobante.tipo === 'Factura' ? 'RUC' : 'DNI'}:</strong> <span>{activeComprobante.clienteDoc}</span></div>
                      )}
                      {activeComprobante.clienteDireccion && (
                        <div><strong>Dirección:</strong> <span className="uppercase text-[9px] leading-none block mt-0.5">{activeComprobante.clienteDireccion}</span></div>
                      )}
                      <div><strong>Items:</strong> <span>{itemsImprimibles.length}</span></div>
                    </div>

                    {/* Box de Datos de Despacho para Delivery */}
                    {activeComprobante.deliveryInfo && (
                      <div style={{ border: '1px dashed black', padding: '6px', margin: '8px 0', fontSize: '10px', lineHeight: '1.3' }} className="space-y-1 bg-slate-50 rounded-lg">
                        <div className="text-center font-bold uppercase mb-1" style={{ fontSize: '11px' }}>🛵 DATOS DE DESPACHO / DELIVERY 🛵</div>
                        <div><strong>DIRECCIÓN:</strong> <span className="uppercase font-bold">{activeComprobante.deliveryInfo.direccion}</span></div>
                        <div className="flex justify-between">
                          <div><strong>TELÉFONO:</strong> <span>{activeComprobante.deliveryInfo.telefono}</span></div>
                          <div><strong>ENVÍO:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.montoDelivery || 0).toFixed(2)}</span></div>
                        </div>
                        {activeComprobante.deliveryInfo.conCuanto && parseFloat(activeComprobante.deliveryInfo.conCuanto) > 0 && (
                          <div className="border-t border-slate-300 pt-1 mt-1 flex justify-between font-bold">
                            <div><strong>PAGA CON:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.conCuanto).toFixed(2)}</span></div>
                            <div><strong>VUELTO:</strong> <span className="text-emerald-700">S/ {parseFloat(activeComprobante.deliveryInfo.vuelto).toFixed(2)}</span></div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
                    
                    {/* Items Table Header */}
                    <div className="flex font-bold border-b border-dashed border-slate-350 pb-1 mb-1">
                      <span className="w-8 shrink-0">Cant</span>
                      <span className="flex-1 pl-1">DESCRIPCIÓN</span>
                      <span className="w-14 text-right shrink-0">P.Unit</span>
                      <span className="w-18 text-right shrink-0">TOTAL</span>
                    </div>
                    
                    {itemsImprimibles.map((item, idx) => {
                      const subTotalItem = item.cant * item.precio;
                      const cantStr = item.cant % 1 === 0 ? item.cant.toFixed(0) : item.cant.toFixed(2);
                      return (
                        <div key={idx} className="flex flex-col mb-1.5">
                          <div className="flex items-start">
                            <span className="w-8 shrink-0 font-bold">{cantStr}x</span>
                            <span className="flex-1 uppercase pl-1">{item.nombre}</span>
                            <span className="w-14 text-right shrink-0">{item.precio.toFixed(2)}</span>
                            <span className="w-18 text-right shrink-0">{subTotalItem.toFixed(2)}</span>
                          </div>
                          {item.notas && (
                            <div className="pl-8 text-[9px] text-slate-500 font-bold leading-tight uppercase text-left break-all">
                              {item.notas}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              <div className="space-y-1 text-right font-bold" style={{ fontSize: '11px' }}>
                {activeComprobante.descuentoAplicado > 0 && (
                  <>
                    <div className="flex justify-between text-slate-700">
                      <span>IMPORTE BRUTO</span> 
                      <span>S/ {(activeComprobante.total + activeComprobante.descuentoAplicado).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900">
                      <span>{activeComprobante.ofertaDescripcion ? activeComprobante.ofertaDescripcion.toUpperCase() : 'DESCUENTO'}</span> 
                      <span>- S/ {activeComprobante.descuentoAplicado.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between" style={{ fontSize: '12px', fontWeight: '900' }}><span>TOTAL</span> <span>S/ {activeComprobante.total.toFixed(2)}</span></div>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="mb-4">
                  <strong className="block text-[10px]">IMPORTE EN LETRAS:</strong>
                  <span className="uppercase text-[10px] leading-tight block">{activeComprobante.totalLetras}</span>
                </div>
              )}
              
              
              <div>
                <strong>FORMA DE PAGO:</strong> <span className="uppercase">{
                  activeComprobante.metodoPago === 'Consumo' ? 'DESCUENTO PLANILLA (PERSONAL)' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'CORTESÍA / CONSUMO INTERNO' :
                  activeComprobante.metodoPago === 'Mixto' ? 'PAGO MIXTO' :
                  activeComprobante.metodoPago === 'Efectivo' ? 'CONTADO' : 'CONTADO (' + activeComprobante.metodoPago + ')'
                }</span>
              </div>
              
              {activeComprobante.metodoPago === 'Mixto' && (
                <div className="mt-1.5 border-t border-dashed border-black pt-1.5 space-y-0.5 text-[10px]">
                  {activeComprobante.montoEfectivo > 0 && (
                    <div className="flex justify-between"><span>- EFECTIVO:</span> <span>S/ {activeComprobante.montoEfectivo.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoTarjeta > 0 && (
                    <div className="flex justify-between"><span>- TARJETA:</span> <span>S/ {activeComprobante.montoTarjeta.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoYape > 0 && (
                    <div className="flex justify-between"><span>- YAPE/PLIN:</span> <span>S/ {activeComprobante.montoYape.toFixed(2)}</span></div>
                  )}
                </div>
              )}
              
              {FACTURACION_ELECTRONICA && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' ? (
                <div className="flex justify-center my-5">
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                    style={{ width: '120px', height: '120px' }} 
                    className="border p-1 bg-white"
                  />
                </div>
              ) : (
                <div style={{ display: 'none' }}>
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                  />
                </div>
              )}

              {(activeComprobante.metodoPago === 'Consumo' || activeComprobante.metodoPago === 'Cortesía') && (
                <div className="mt-8 mb-4 border-t border-slate-400 pt-6 text-center">
                  <p className="border-t border-dashed border-slate-350 mx-auto w-3/4 mb-1"></p>
                  <p className="text-[10px] font-black uppercase tracking-wider">FIRMA COLABORADOR</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-medium">{activeComprobante.clienteNombre}</p>
                </div>
              )}
              
              <div className="text-center font-bold mt-4" style={{ fontSize: '10px' }}>¡Gracias por su preferencia!</div>
              <div className="text-center text-[9px] leading-tight text-slate-500 mt-1">
                {
                  activeComprobante.metodoPago === 'Consumo' ? 'VALE INTERNO AUTORIZADO DE COLABORADOR' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'TICKET DE CONSUMO INTERNO AUTORIZADO' :
                  'Documento interno de control. No es comprobante de pago: solicite su boleta o factura en caja.'
                }
              </div>

              {activeComprobante.enlacePdf && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="text-center text-[10px] mt-4 font-bold no-print pt-2 border-t border-slate-100">
                  <a href={activeComprobante.enlacePdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 flex items-center justify-center gap-1.5">
                    📄 Descargar Comprobante SUNAT (PDF)
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest rounded-xl text-xs flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20">
                <Receipt className="w-4 h-4" /> Imprimir 80mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reporte Gerencial */}
      {gerencialModalOpen && (() => {
        const secciones = [
          ['balance', 'Balance / IGV', incluirBalance, setIncluirBalance],
          ['recaudacion', 'Recaudación', incluirRecaudacion, setIncluirRecaudacion],
          ['cajeros', 'Cajeros', incluirCajeros, setIncluirCajeros],
          ['mozos', 'Mozos', incluirMozos, setIncluirMozos],
          ['rotacion', 'Rotación de carta', incluirRotacion, setIncluirRotacion],
          ['gastos', 'Compras y gastos', incluirGastos, setIncluirGastos],
          ['pedidosya', 'PedidosYa', incluirPedidosYa, setIncluirPedidosYa],
          ['personal', 'Créditos y planilla', incluirPersonal, setIncluirPersonal],
          ['anulaciones', 'Anulaciones', incluirAnulaciones, setIncluirAnulaciones],
          ['cierres', 'Cierres de caja', incluirCierres, setIncluirCierres],
        ];

        const recaudacion = { efectivo: 0, tarjeta: 0, yape: 0, credito: 0, pedidosYa: 0, consumo: 0, cortesia: 0 };
        ventas.forEach(v => {
          const m = montosVenta(v);
          Object.keys(recaudacion).forEach(k => { recaudacion[k] += m[k]; });
        });
        const devueltas = ventas.filter(v => v.anulado || v.estadoPedido === 'Cancelado');
        const { planilla, comercial } = construirCreditosPlanilla(ventas, clientes, parsearCreditoSplit);
        const agrupar = (items) => Object.entries(items.reduce((acc, it) => {
          const k = it.documento ? `${it.nombre} (${it.documento})` : it.nombre;
          acc[k] = (acc[k] || 0) + it.monto;
          return acc;
        }, {})).sort((a, b) => b[1] - a[1]);
        const totalPY = ventas.filter(esPedidosYa).reduce((s, v) => s + v.total, 0);
        const nPY = ventas.filter(esPedidosYa).length;
        const cierresRango = cierresHistorial.filter(c => {
          if (!c.fechaCierre) return true;
          const fStr = new Date(c.fechaCierre).toISOString().slice(0, 10);
          return fStr >= fechaDesde && fStr <= fechaHasta;
        });

        let n = 0;
        const titulo = (texto, color) => {
          n += 1;
          return (
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b-2 pb-1.5 mb-3 flex items-center gap-2" style={{ borderColor: color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {n}. {texto}
            </h2>
          );
        };
        const th = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500';
        const td = 'px-3 py-1.5';

        return (
          <div id="modal-reporte-gerencial-container" className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[250] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
            <div className="bg-white w-full max-w-4xl h-[96dvh] sm:h-auto sm:max-h-[94dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 no-print">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">Reporte gerencial</h3>
                  <p className="text-sm text-slate-500">Vista previa · {fechaDesde} al {fechaHasta}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => window.print()} className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm shadow-sky-600/25 transition-colors">
                    <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir / Guardar PDF</span><span className="sm:hidden">PDF</span>
                  </button>
                  <button type="button" onClick={() => setGerencialModalOpen(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 no-print shrink-0">
                <p className="text-xs font-medium text-slate-500 mb-2">Secciones a incluir</p>
                <div className="flex flex-wrap gap-1.5">
                  {secciones.map(([id, label, activo, set]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set(!activo)}
                      className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${activo ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'}`}
                    >
                      {activo && <span className="text-[10px]">✓</span>} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 text-xs">
                <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-6">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">{COMPANY_CONFIG.name}</h1>
                    <p className="text-[11px] text-slate-500">{COMPANY_CONFIG.legalName} · RUC {COMPANY_CONFIG.ruc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-700">Reporte de gestión</p>
                    <p className="text-[11px] font-mono text-slate-500">Periodo: {fechaDesde} al {fechaHasta}</p>
                    <p className="text-[10px] font-mono text-slate-400">Generado: {new Date().toLocaleString('es-PE')}</p>
                  </div>
                </div>

                {incluirBalance && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Balance del periodo', '#0284c7')}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        ['Ventas', resumen.ventasTotal, `Base ${soles(resumen.ventasBase)} · IGV ${soles(resumen.ventasIGV)}`],
                        ['Compras / gastos', resumen.comprasTotal, `Base ${soles(resumen.comprasBase)} · IGV ${soles(resumen.comprasIGV)}`],
                        ['IGV neto a liquidar', resumen.igvAPagar, 'Débito fiscal − crédito fiscal'],
                        ['Margen operativo', resumen.ventasTotal - resumen.comprasTotal, `${ventas.length - devueltas.length} ventas · ticket prom. ${soles((ventas.length - devueltas.length) ? resumen.ventasTotal / (ventas.length - devueltas.length) : 0)}`],
                      ].map(([label, valor, hint]) => (
                        <div key={label} className="border border-slate-200 rounded-xl p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{soles(valor)}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{hint}</p>
                        </div>
                      ))}
                    </div>
                    {devueltas.length > 0 && (
                      <p className="mt-2 text-[10px] text-rose-600">{devueltas.length} venta(s) devuelta(s) por {soles(devueltas.reduce((s, v) => s + (v.montoOriginal ?? v.total ?? 0), 0))} excluidas de la recaudación.</p>
                    )}
                  </div>
                )}

                {incluirRecaudacion && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Recaudación por medio de cobro', '#059669')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr><th className={th}>Medio</th><th className={`${th} text-right`}>Monto</th><th className={th}>Observación</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ['Efectivo', recaudacion.efectivo, 'Cuadre de caja'],
                          ['Tarjeta / POS', recaudacion.tarjeta, 'Cuadre de caja'],
                          ['Yape / Plin', recaudacion.yape, 'Cuadre de caja'],
                          ['Crédito comercial', recaudacion.credito, 'Cuentas por cobrar'],
                          ['PedidosYa', recaudacion.pedidosYa, 'Liquidación semanal'],
                          ['Consumo de personal', recaudacion.consumo, 'Descuento por planilla'],
                          ['Cortesías', recaudacion.cortesia, 'Valor referencial, sin cobro'],
                        ].map(([m, monto, obs]) => (
                          <tr key={m}><td className={`${td} font-medium`}>{m}</td><td className={`${td} text-right font-mono`}>{soles(monto)}</td><td className={`${td} text-slate-500`}>{obs}</td></tr>
                        ))}
                        <tr className="bg-slate-100 font-bold"><td className={td}>Ingresos en caja (efectivo + tarjeta + Yape)</td><td className={`${td} text-right font-mono`}>{soles(recaudacion.efectivo + recaudacion.tarjeta + recaudacion.yape)}</td><td className={td} /></tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {incluirCajeros && cajeros.length > 0 && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Ventas por cajero', '#9333ea')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr>
                        <th className={th}>Cajero</th><th className={`${th} text-center`}>Tickets</th><th className={`${th} text-right`}>Efectivo</th><th className={`${th} text-right`}>Tarjeta</th><th className={`${th} text-right`}>Yape</th><th className={`${th} text-right`}>Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {cajeros.map((c, i) => (
                          <tr key={i}>
                            <td className={`${td} font-medium`}>{c.nombre}</td><td className={`${td} text-center`}>{c.cantidadTickets}</td>
                            <td className={`${td} text-right font-mono`}>{soles(c.efectivo)}</td><td className={`${td} text-right font-mono`}>{soles(c.tarjeta)}</td>
                            <td className={`${td} text-right font-mono`}>{soles(c.yape)}</td><td className={`${td} text-right font-mono font-bold`}>{soles(c.totalVentas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {incluirMozos && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Rendimiento de mozos', '#4f46e5')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr><th className={th}>Mozo</th><th className={`${th} text-center`}>Mesas activas</th><th className={`${th} text-center`}>Mesas atendidas</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {mozos.length > 0 ? mozos.map((m, idx) => (
                          <tr key={idx}><td className={`${td} font-medium`}>{m.nombre}</td><td className={`${td} text-center`}>{m.mesasActivas}</td><td className={`${td} text-center font-bold text-emerald-700`}>{m.mesasAtendidas}</td></tr>
                        )) : <tr><td colSpan="3" className={`${td} text-center text-slate-400`}>Sin registros en el periodo</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                {incluirRotacion && (
                  <div className="mb-7">
                    {titulo('Rotación de productos por categoría', '#d97706')}
                    {(() => {
                      const grouped = {};
                      rotacion.forEach(r => {
                        const cat = r.categoria || 'Otros';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(r);
                      });
                      const categories = Object.keys(grouped).sort();
                      if (categories.length === 0) return <p className="text-slate-400 text-center py-3">Sin datos de rotación en el periodo.</p>;
                      return (
                        <table className="w-full text-left border border-slate-200">
                          <thead className="bg-slate-50 border-b border-slate-200"><tr><th className={th}>Producto</th><th className={`${th} text-center`}>Cantidad</th><th className={`${th} text-right`}>Precio prom.</th><th className={`${th} text-right`}>Total</th></tr></thead>
                          {categories.map(cat => {
                            const items = grouped[cat].sort((a, b) => b.cantidad - a.cantidad);
                            return (
                              <tbody key={cat} className="divide-y divide-slate-100 break-inside-avoid">
                                <tr className="bg-amber-50/70">
                                  <td className={`${td} font-bold uppercase text-amber-900`}>{cat}</td>
                                  <td className={`${td} text-center font-bold`}>{items.reduce((s, i) => s + i.cantidad, 0)}</td>
                                  <td className={td} />
                                  <td className={`${td} text-right font-mono font-bold`}>{soles(items.reduce((s, i) => s + i.total, 0))}</td>
                                </tr>
                                {items.map((r, idx) => (
                                  <tr key={idx}>
                                    <td className={`${td} pl-6`}>{r.nombre}</td>
                                    <td className={`${td} text-center`}>{r.cantidad}</td>
                                    <td className={`${td} text-right font-mono text-slate-600`}>{soles(r.cantidad > 0 ? r.total / r.cantidad : r.precio)}</td>
                                    <td className={`${td} text-right font-mono`}>{soles(r.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            );
                          })}
                        </table>
                      );
                    })()}
                  </div>
                )}

                {incluirGastos && (
                  <div className="mb-7">
                    {titulo('Compras y gastos', '#e11d48')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr>
                        <th className={th}>Fecha</th><th className={th}>Comprobante</th><th className={th}>Proveedor</th><th className={`${th} text-right`}>Base</th><th className={`${th} text-right`}>IGV</th><th className={`${th} text-right`}>Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {compras.length > 0 ? compras.map((c, idx) => (
                          <tr key={idx}>
                            <td className={`${td} font-mono`}>{c.creadoEn ? c.creadoEn.split('T')[0] : ''}</td>
                            <td className={td}>{c.tipoDocumento || 'Factura'} {c.serieNumero || ''}</td>
                            <td className={td}><span className="font-medium">{c.proveedor}</span> <span className="text-slate-400 font-mono">{c.ruc || ''}</span></td>
                            <td className={`${td} text-right font-mono`}>{soles(c.baseImponible)}</td>
                            <td className={`${td} text-right font-mono`}>{soles(c.igv)}</td>
                            <td className={`${td} text-right font-mono font-bold`}>{soles(c.total)}</td>
                          </tr>
                        )) : <tr><td colSpan="6" className={`${td} text-center text-slate-400`}>Sin compras en el periodo</td></tr>}
                        {compras.length > 0 && (
                          <tr className="bg-slate-100 font-bold">
                            <td colSpan="3" className={`${td} text-right`}>Total</td>
                            <td className={`${td} text-right font-mono`}>{soles(resumen.comprasBase)}</td>
                            <td className={`${td} text-right font-mono`}>{soles(resumen.comprasIGV)}</td>
                            <td className={`${td} text-right font-mono`}>{soles(resumen.comprasTotal)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {incluirPedidosYa && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Conciliación PedidosYa', '#e11d48')}
                    <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-slate-600">{nPY} pedido(s) para conciliar con la liquidación semanal</span>
                      <span className="text-lg font-bold font-mono">{soles(totalPY)}</span>
                    </div>
                  </div>
                )}

                {incluirPersonal && (
                  <div className="mb-7 break-inside-avoid">
                    {titulo('Créditos comerciales y consumo de personal', '#0d9488')}
                    <div className="grid grid-cols-2 gap-4">
                      {[['Créditos a clientes', comercial, '#0f766e'], ['Planilla (personal)', planilla, '#6d28d9']].map(([label, items, color]) => (
                        <table key={label} className="w-full text-left border border-slate-200 self-start">
                          <thead className="bg-slate-50 border-b border-slate-200"><tr><th className={th}>{label}</th><th className={`${th} text-right`}>Monto</th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.length > 0 ? agrupar(items).map(([nombre, total]) => (
                              <tr key={nombre}><td className={td}>{nombre}</td><td className={`${td} text-right font-mono`} style={{ color }}>{soles(total)}</td></tr>
                            )) : <tr><td colSpan="2" className={`${td} text-center text-slate-400`}>Sin registros</td></tr>}
                            {items.length > 0 && (
                              <tr className="bg-slate-100 font-bold"><td className={td}>Total</td><td className={`${td} text-right font-mono`}>{soles(items.reduce((s, i) => s + i.monto, 0))}</td></tr>
                            )}
                          </tbody>
                        </table>
                      ))}
                    </div>
                  </div>
                )}

                {incluirAnulaciones && (
                  <div className="mb-7">
                    {titulo('Anulaciones y devoluciones', '#dc2626')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr>
                        <th className={th}>Fecha</th><th className={th}>Tipo</th><th className={th}>Origen</th><th className={th}>Responsable</th><th className={th}>Motivo</th><th className={`${th} text-right`}>Importe</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {cancelaciones.length > 0 ? cancelaciones.map((c, i) => (
                          <tr key={i}>
                            <td className={`${td} font-mono whitespace-nowrap`}>{c.fecha || ''} {c.hora}</td>
                            <td className={td}>{c.tipo || 'Comanda cancelada'}</td>
                            <td className={td}>{c.mesa ? `Mesa ${c.mesa}` : (c.codigoPedidosYa || 'Delivery')}</td>
                            <td className={td}>{c.canceladoPor || '—'}</td>
                            <td className={`${td} italic text-slate-600`}>{c.motivoCancela || 'Sin motivo'}</td>
                            <td className={`${td} text-right font-mono text-rose-600`}>−{soles(c.total)}</td>
                          </tr>
                        )) : <tr><td colSpan="6" className={`${td} text-center text-slate-400`}>Sin anulaciones en el periodo</td></tr>}
                        {cancelaciones.length > 0 && (
                          <tr className="bg-slate-100 font-bold"><td colSpan="5" className={`${td} text-right`}>Total</td><td className={`${td} text-right font-mono text-rose-600`}>−{soles(cancelaciones.reduce((s, c) => s + (Number(c.total) || 0), 0))}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {incluirCierres && (
                  <div className="mb-7">
                    {titulo('Cierres de caja (arqueos)', '#7c3aed')}
                    <table className="w-full text-left border border-slate-200">
                      <thead className="bg-slate-50 border-b border-slate-200"><tr>
                        <th className={th}>Fecha</th><th className={th}>Cajero</th><th className={`${th} text-right`}>Esperado</th><th className={`${th} text-right`}>Contado</th><th className={`${th} text-right`}>Diferencia</th><th className={`${th} text-right`}>Tarjeta + Yape</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {cierresRango.length > 0 ? cierresRango.map(c => {
                          const dif = Number(c.diferencia || 0);
                          return (
                            <tr key={c.id}>
                              <td className={`${td} font-mono whitespace-nowrap`}>{new Date(c.fechaCierre).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                              <td className={td}>{c.cajeroNombre}</td>
                              <td className={`${td} text-right font-mono`}>{soles(c.efectivoEsperado)}</td>
                              <td className={`${td} text-right font-mono`}>{soles(c.efectivoContado)}</td>
                              <td className={`${td} text-right font-mono font-bold ${dif < -0.01 ? 'text-rose-600' : dif > 0.01 ? 'text-blue-600' : 'text-emerald-600'}`}>{dif > 0.01 ? '+' : ''}{soles(dif)}</td>
                              <td className={`${td} text-right font-mono`}>{soles(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0))}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan="6" className={`${td} text-center text-slate-400`}>Sin cierres en el periodo</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-14 flex justify-around break-inside-avoid">
                  <div className="text-center w-48">
                    <div className="border-b border-slate-400 h-10 mb-2" />
                    <p className="font-semibold text-slate-700">Firma administrador</p>
                  </div>
                  <div className="text-center w-48">
                    <div className="border-b border-slate-400 h-10 mb-2" />
                    <p className="font-semibold text-slate-700">Firma propietario</p>
                    <p className="text-[10px] text-slate-400">{COMPANY_CONFIG.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @page {
          size: auto;
          margin: 15mm 20mm !important;
        }
        @media print {
          /* Ocultar elementos de navegación y fondos */
          aside, header, #sidebar-menu, #sidebar-backdrop, button, nav, .no-print {
            display: none !important;
          }
          /* Ocultar el resto del contenido de la página excepto el modal a imprimir */
          main > *:not(section),
          section > *:not(#modal-comprobante-sunat-print-container):not(#modal-reporte-gerencial-container):not(#modal-cierre):not(#modal-cierre-reporte) {
            display: none !important;
          }
           /* Garantizar que el body y todos los contenedores padre fluyan libremente sin alturas fijas */
          html, body, #root, #root > div, #root > div > main, #root > div > main > section {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: auto !important;
            display: block !important;
            position: static !important;
          }
          /* Formatear el contenedor del ticket en 74mm en la esquina superior izquierda */
          #modal-comprobante-sunat-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container div.bg-slate-950, 
          #modal-comprobante-sunat-print-container div.shrink-0 {
            display: none !important;
          }
          #comprobante-sunat-ticket-print {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print div,
          #comprobante-sunat-ticket-print blockquote {
            page-break-inside: avoid !important;
          }
          #modal-cierre-reporte {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre-reporte > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre-reporte button {
            display: none !important;
          }
          #cierre-imprimible-reporte {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible-reporte * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible-reporte div {
            page-break-inside: avoid !important;
          }
          #modal-reporte-gerencial-container {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          #modal-reporte-gerencial-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
          }
          #modal-reporte-gerencial-container .overflow-y-auto {
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-inside-avoid-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </section>
  );
}

