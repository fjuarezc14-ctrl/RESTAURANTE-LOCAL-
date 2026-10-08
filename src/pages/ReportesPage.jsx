import { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, XCircle, Users, Truck, Calendar, Search, Printer, Wallet, UtensilsCrossed, History, MessageCircle } from 'lucide-react';

import { api } from '../api';
import { useCompany } from '../context/CompanyContext';
import { generateOfflineQrUrl } from '../utils/qrOffline';
import { numeroALetras } from '../utils/numeroALetras';
import { exportarReporteExcel } from '../utils/exportarReporteExcel';
import { useAviso, usePedirDato } from '../components/ui';
import { ModalComprobanteSunat, ModalReimpresionCierre } from '../components/modales';
import { ModalReporteGerencial } from '../modulos/reportes/modales';
import { parseDeliveryInfo, parsearCreditoSplit } from '../utils/ventas';
import { clienteDeVenta, fechaVenta, metodoReal, origenDeVenta, soles } from '../modulos/reportes/utils';
import { modalDetalle } from '../modulos/reportes/componentes/piezas';
import { getEstiloMetodo as estiloMetodo } from '../modulos/caja/constantes/metodosPago';
import PestanaCierres from '../modulos/reportes/componentes/PestanaCierres';
import PestanaAnulaciones from '../modulos/reportes/componentes/PestanaAnulaciones';
import PestanaMozos from '../modulos/reportes/componentes/PestanaMozos';
import PestanaConsumo from '../modulos/reportes/componentes/PestanaConsumo';
import PestanaPedidosYa from '../modulos/reportes/componentes/PestanaPedidosYa';
import PestanaRotacion from '../modulos/reportes/componentes/PestanaRotacion';
import PestanaResumen from '../modulos/reportes/componentes/PestanaResumen';

// Igual que en Caja: el sistema solo emite tickets de venta
const FACTURACION_ELECTRONICA = false;


export default function ReportesPage() {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const aviso = useAviso();
  const pedirDato = usePedirDato();
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
  const [retirosCaja, setRetirosCaja] = useState([]);
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


  const reimprimirComprobante = (v) => {
    if (!v) return;
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.numero || v.id).padStart(4, '0');
    const igvSafe = Number(v.igv || 0).toFixed(2);
    const totalSafe = Number(v.total || 0).toFixed(2);
    const qrData = `${COMPANY_CONFIG.ruc}|${v.tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':'1'}|${v.numDocumento || '00000000'}`;
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
      totalLetras: numeroALetras(v.total),
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

  const enviarPorWhatsApp = async (v) => {
    if (!v) return;
    const telefono = await pedirDato({
      titulo: 'Enviar por WhatsApp',
      mensaje: 'Ingresa el número de WhatsApp del cliente (Ej. 999888777):',
      placeholder: '999888777',
      tipo: 'tel',
    });
    if (!telefono) return;
    
    // Validar celular peruano de 9 dígitos
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      aviso.advertencia("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    const totalSafe = Number(v.total || 0).toFixed(2);
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, el total de su consumo en *${COMPANY_CONFIG.name}* fue de *S/ ${totalSafe}* (ticket de venta N° ${v.id}).\n\n¡Gracias por su preferencia!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };


  const fetchReportes = useCallback(async (desde, hasta) => {
    setFiltrando(true);
    try {
      const [data, cancs, mzs, vts, rot, cmps, clients, cierresRes, cajs, movs] = await Promise.all([
        api.getReporteContable(desde, hasta),
        api.getCancelaciones(desde, hasta),
        api.getReporteMozos(desde, hasta),
        api.getHistorialVentas(desde, hasta),
        api.getRotacion(desde, hasta),
        api.getCompras(desde, hasta),
        api.getClientes().catch(() => []),
        api.getHistorialCierres(100).catch(() => []),
        api.getReporteCajeros(desde, hasta).catch(() => []),
        api.getMovimientosCaja(desde, hasta).catch(() => null),
      ]);
      setResumen(data);
      // Retiros de caja: salidas de efectivo que no son devoluciones de ventas
      setRetirosCaja((movs?.movimientos || []).filter(m =>
        m.tipo === 'RETIRO' && !String(m.motivo || '').startsWith('[DEVOLUCIÓN TICKET')
      ));
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
      aviso.advertencia('Por favor selecciona ambas fechas.');
      return;
    }
    fetchReportes(fechaDesde, fechaHasta);
  };

  const exportarLibroContableRCE = async () => {
    if (!fechaDesde || !fechaHasta) {
      aviso.advertencia('Por favor selecciona ambas fechas.');
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
      aviso.exito('Reporte contable exportado a Excel exitosamente.');
    } catch (err) {
      aviso.error('Error al generar el Excel: ' + err.message);
    } finally {
      setFiltrando(false);
    }
  };

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
      {activeTab === 'resumen' && (
        <PestanaResumen
          busquedaCompNorm={busquedaCompNorm}
          cajeros={cajeros}
          comprobantesBusqueda={comprobantesBusqueda}
          comprobantesLista={comprobantesLista}
          comprobantesMetodo={comprobantesMetodo}
          comprobantesVisibles={comprobantesVisibles}
          resumen={resumen}
          retirosCaja={retirosCaja}
          setComprobantesBusqueda={setComprobantesBusqueda}
          setComprobantesLimite={setComprobantesLimite}
          setComprobantesMetodo={setComprobantesMetodo}
          setVentaDetalleId={setVentaDetalleId}
          ventas={ventas}
        />
      )}

      {/* 2. RENDIMIENTO DE LA CARTA Y RANKING DE PLATOS */}
      {activeTab === 'rotacion' && (
        <PestanaRotacion
          rotacion={rotacion}
          rotacionBusqueda={rotacionBusqueda}
          rotacionCatFiltro={rotacionCatFiltro}
          setRotacionBusqueda={setRotacionBusqueda}
          setRotacionCatFiltro={setRotacionCatFiltro}
        />
      )}

      {/* 3. CONTROL PEDIDOSYA */}
      {activeTab === 'pedidosya' && (
        <PestanaPedidosYa
          setVentaDetalleId={setVentaDetalleId}
          ventas={ventas}
        />
      )}

      {/* 4. CONSUMO DE PERSONAL (PLANILLA) Y CRÉDITOS */}
      {activeTab === 'consumo' && (
        <PestanaConsumo
          clientes={clientes}
          reimprimirComprobante={reimprimirComprobante}
          ventas={ventas}
        />
      )}

      {/* 5. RENDIMIENTO MOZOS */}
      {activeTab === 'mozos' && (
        <PestanaMozos
          mozos={mozos}
        />
      )}

      {/* 6. AUDITORÍA DE ANULACIONES Y DEVOLUCIONES */}
      {activeTab === 'anulaciones' && (
        <PestanaAnulaciones
          cancelaciones={cancelaciones}
          filtroTipoAnulacion={filtroTipoAnulacion}
          setAnulacionDetalle={setAnulacionDetalle}
          setFiltroTipoAnulacion={setFiltroTipoAnulacion}
        />
      )}

      {/* 7. CIERRES DE CAJA (ARQUEOS) */}
      {activeTab === 'cierres' && (
        <PestanaCierres
          cierresHistorial={cierresHistorial}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          setCierreAImprimir={setCierreAImprimir}
        />
      )}

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
              <div><dt className="text-xs text-slate-400">Autorizó (PIN)</dt><dd className="text-slate-800">{c.autorizadoPor || 'No hizo falta'}</dd></div>
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

      {/* REIMPRESIÓN DEL TICKET DE CIERRE (el mismo modal que usa Caja) */}
      <ModalReimpresionCierre
        cierre={cierreAImprimir}
        onCerrar={() => setCierreAImprimir(null)}
        empresa={COMPANY_CONFIG}
      />

      {/* SUNAT Comprobante Modal Modular */}
      <ModalComprobanteSunat
        abierto={sunatModalOpen && !!activeComprobante}
        comprobante={activeComprobante}
        empresa={COMPANY_CONFIG}
        facturacionElectronica={FACTURACION_ELECTRONICA}
        onCerrar={() => setSunatModalOpen(false)}
      />

      {/* Modal Reporte Gerencial Modular */}
      <ModalReporteGerencial
        abierto={gerencialModalOpen}
        onCerrar={() => setGerencialModalOpen(false)}
        COMPANY_CONFIG={COMPANY_CONFIG}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        ventas={ventas}
        clientes={clientes}
        parsearCreditoSplit={parsearCreditoSplit}
        resumen={resumen}
        cierresHistorial={cierresHistorial}
        cajeros={cajeros}
        mozos={mozos}
        rotacion={rotacion}
        compras={compras}
        cancelaciones={cancelaciones}
        incluirBalance={incluirBalance}
        setIncluirBalance={setIncluirBalance}
        incluirRecaudacion={incluirRecaudacion}
        setIncluirRecaudacion={setIncluirRecaudacion}
        incluirCajeros={incluirCajeros}
        setIncluirCajeros={setIncluirCajeros}
        incluirMozos={incluirMozos}
        setIncluirMozos={setIncluirMozos}
        incluirRotacion={incluirRotacion}
        setIncluirRotacion={setIncluirRotacion}
        incluirGastos={incluirGastos}
        setIncluirGastos={setIncluirGastos}
        incluirPedidosYa={incluirPedidosYa}
        setIncluirPedidosYa={setIncluirPedidosYa}
        incluirPersonal={incluirPersonal}
        setIncluirPersonal={setIncluirPersonal}
        incluirAnulaciones={incluirAnulaciones}
        setIncluirAnulaciones={setIncluirAnulaciones}
        incluirCierres={incluirCierres}
        setIncluirCierres={setIncluirCierres}
      />

    </section>
  );
}

