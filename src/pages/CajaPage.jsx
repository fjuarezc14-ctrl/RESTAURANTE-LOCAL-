import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

import { api } from '../api';

import { useCompany } from '../context/CompanyContext';
import { generateOfflineQrUrl } from '../utils/qrOffline';
import { numeroALetras } from '../utils/numeroALetras';
import { useAviso, useConfirmar, usePedirDato } from '../components/ui';
import {
  ModalAperturaCaja,
  ModalRetiroCaja,
  ModalCierreCaja,
  ModalHistorialCierres,
  ModalCorregirMetodoPago,
  ModalCorregirTipoEntrega,
  ModalCancelarLlevar,
  ModalAnularVenta,
  ModalConfirmacionCobro,
  ModalDetalleMesa,
  ModalDetallePedidoLlevar,
  ModalDetalleVenta,
  ModalTodasCategorias,
  ModalCobroMesa,
  ModalNuevoPedidoDelivery,
} from '../modulos/caja/modales';
import {
  ModalComprobanteSunat,
  ModalOpcionesProducto,
  ModalReimpresionCierre,
} from '../components/modales';
import { useTurnoCaja, useVentasTurno, useCobroMesa, usePedidoDelivery } from '../modulos/caja/hooks';
import { parseDeliveryInfo, parsearCreditoSplit, parseMonto } from '../utils/ventas';
import { mesaCobrable, mesaEnPreparacion, platosEnPreparacion, platosSinServir } from '../modulos/caja/utils/mesas';
import { clienteDeVenta, esPedidoListo, itemsDeVenta, listaVentasTurno, origenDeVenta, origenPedido, resumenTurno, soles } from '../modulos/caja/utils/ventasTurno';
import { getEstiloMetodo as estiloMetodo } from '../modulos/caja/constantes/metodosPago';
import PanelVentasTurno from '../modulos/caja/componentes/PanelVentasTurno';
import PanelPedidosLlevar from '../modulos/caja/componentes/PanelPedidosLlevar';
import PanelMesasPorCobrar from '../modulos/caja/componentes/PanelMesasPorCobrar';
import ResumenTurnoCaja from '../modulos/caja/componentes/ResumenTurnoCaja';
import EncabezadoCaja from '../modulos/caja/componentes/EncabezadoCaja';

export default function CajaPage({ currentUser }) {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const FACTURACION_ELECTRONICA = COMPANY_CONFIG?.facturacionElectronica ?? true;
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const pedirDato = usePedirDato();
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [loading, setLoading] = useState(true);
  // Nº de operación de Yape/Plin o voucher de tarjeta
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);

  // Campos para Delivery Propio y Para Llevar en modal


  // Gestión de Turnos de Caja (Hook modular desacoplado)
  const {
    cajaEstado,
    setCajaEstado,
    ultimoCierre,
    setUltimoCierre,
    modalAperturaOpen,
    setModalAperturaOpen,
    cierreModalOpen,
    setCierreModalOpen,
    modalSalidaCajaOpen,
    setModalSalidaCajaOpen,
    tipoMovimientoCaja,
    historialCierresModalOpen,
    setHistorialCierresModalOpen,
    historialCierres,
    cargandoHistorialCierres,
    cierreAImprimir,
    setCierreAImprimir,
    abrirHistorialCierres,
    abrirMovimientoGaveta,
  } = useTurnoCaja({ onNotificar: (msg, tipo) => aviso[tipo] ? aviso[tipo](msg) : aviso.info(msg) });

  // Gestión de Ventas del Turno y Modales de Corrección/Anulación (Hook modular desacoplado)
  const {
    ventas,
    setVentas,
    filtroMetodoPago,
    setFiltroMetodoPago,
    anularVentaModal,
    setAnularVentaModal,
    ventaAAnular,
    cambioMetodoModal,
    setCambioMetodoModal,
    ventaACambiar,
    cambioTipoEntregaModal,
    setCambioTipoEntregaModal,
    ventaATipoCambiar,
    abrirAnulacionVenta,
    abrirCambioMetodo,
    abrirCambioTipoEntrega,
  } = useVentasTurno();


  // Créditos y Clientes
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState([]);

  // Mostrar solo las ventas del turno activo por defecto (false = Turno, true = Día)
  const [mostrarTodoElDia, setMostrarTodoElDia] = useState(false);
  const [historialColapsado, setHistorialColapsado] = useState(false);

  // Detalle en modal (se guarda el id para leer siempre los datos más recientes del polling)
  const [ventaDetalleId, setVentaDetalleId] = useState(null);
  const [mesaDetalleNum, setMesaDetalleNum] = useState(null);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);
  const [busquedaVentas, setBusquedaVentas] = useState('');
  const [ventasLimite, setVentasLimite] = useState(20);
  const [ingresosDesglose, setIngresosDesglose] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setVentaDetalleId(null);
      setMesaDetalleNum(null);
      setPedidoDetalleId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // PIN y Cortesías en modal de Delivery/Para Llevar

  // Modal de autorización de cancelación para Llevar/Delivery
  const [cancelLlevarModalOpen, setCancelLlevarModalOpen] = useState(false);
  const [pedidoACancelarLlevar, setPedidoACancelarLlevar] = useState(null);

  // Modal PedidosYa y Para Llevar
  // cajeroNombre = responsable del turno (apertura/cierre). Las ventas, retiros y
  // cancelaciones se registran con quien tiene la sesión iniciada (usuarioOperador).
  const [cajeroNombre, setCajeroNombre] = useState(currentUser?.nombre || 'María');
  const usuarioOperador = currentUser?.nombre || cajeroNombre || 'Cajero';
  const [usuariosSistema, setUsuariosSistema] = useState([]);

  const cajerosDisponibles = React.useMemo(() => {
    if (!usuariosSistema || usuariosSistema.length === 0) return [];
    const activos = usuariosSistema.filter(u => u.activo !== false);
    return [...activos].sort((a, b) => {
      const peso = (rol) => (rol === 'Cajero' ? 1 : rol === 'Administrador' ? 2 : 3);
      return peso(a.rol) - peso(b.rol) || a.nombre.localeCompare(b.nombre);
    });
  }, [usuariosSistema]);

  useEffect(() => {
    if (currentUser?.nombre) {
      setCajeroNombre(currentUser.nombre);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!cajaEstado.abierto && cajerosDisponibles.length > 0) {
      const match = cajerosDisponibles.find(u => u.nombre.toLowerCase() === (cajeroNombre || '').toLowerCase());
      if (!match) {
        const defaultUser = cajerosDisponibles.find(u => u.rol === 'Cajero') || cajerosDisponibles[0];
        if (defaultUser) setCajeroNombre(defaultUser.nombre);
      }
    }
  }, [cajerosDisponibles, cajaEstado.abierto]);


  const [productosMenu, setProductosMenu] = useState([]);
  const [toasts, setToasts] = useState([]);
  const addToast = (mensaje, tipo = 'info') => {
    const toastId = Date.now() + Math.random();
    setToasts(prev => [...prev, { id: toastId, mensaje, tipo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 5000);
  };
  const avisarPedidosYaPrueba = () => addToast('🔒 PedidosYa está en versión de prueba. Contacta con VALETEC para activarlo.', 'warning');
  const prevPedidosLlevarRef = useRef([]);


  // Campana de Restaurante Premium (G5 -> C6)
  const playChimeNotification = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playTone(784, audioCtx.currentTime, 0.6);
      playTone(1046.5, audioCtx.currentTime + 0.12, 0.8);
    } catch (e) {
      console.error('AudioContext no soportado:', e);
    }
  };

  const isFetchingCajaRef = useRef(false);

  const fetchCajaData = useCallback(async (options = { full: true }) => {
    if (isFetchingCajaRef.current) return;
    isFetchingCajaRef.current = true;

    try {
      if (options?.full) {
        const [mesasData, llevarData, ventasData, prods, clientsList, abonosList, ultimoCierreRes, estadoCajaRes, usuariosList] = await Promise.all([
          api.getMesas().catch(() => null),
          api.getPedidosLlevar().catch(() => null),
          api.getHistorialVentas().catch(() => null),
          api.getProductos().catch(() => null),
          api.getClientes().catch(() => []),
          api.getAbonos().catch(() => []),
          api.getUltimoCierre().catch(() => null),
          api.getEstadoCaja().catch(() => null),
          api.getUsuarios().catch(() => []),
        ]);
        if (mesasData) setMesas(mesasData);
        if (llevarData) setPedidosLlevar(llevarData);
        if (ventasData) setVentas(ventasData);
        if (prods) setProductosMenu(prods);
        if (usuariosList && Array.isArray(usuariosList)) setUsuariosSistema(usuariosList);
        setClientes(clientsList || []);
        setAbonos(abonosList || []);

        if (estadoCajaRes && typeof estadoCajaRes.abierto === 'boolean') {
          setCajaEstado(estadoCajaRes);
          if (estadoCajaRes.abierto && estadoCajaRes.turno?.cajeroNombre) {
            setCajeroNombre(estadoCajaRes.turno.cajeroNombre);
          }
          if (estadoCajaRes.abierto && estadoCajaRes.turno?.fechaApertura) {
            const fAperturaISO = new Date(estadoCajaRes.turno.fechaApertura).toISOString();
            setUltimoCierre(fAperturaISO);
          } else if (estadoCajaRes.ultimoCierre?.fechaCierre) {
            const fCierreISO = new Date(estadoCajaRes.ultimoCierre.fechaCierre).toISOString();
            setUltimoCierre(fCierreISO);
          }
        } else if (ultimoCierreRes?.ultimoCierre?.fechaCierre) {
          const fechaDbISO = new Date(ultimoCierreRes.ultimoCierre.fechaCierre).toISOString();
          setUltimoCierre(prev => (prev !== fechaDbISO ? fechaDbISO : prev));
          localStorage.setItem('ultimoCierre', fechaDbISO);
        }
      } else {
        // Sondeo ligero de alta frecuencia: solo mesas, delivery activo y estado de caja
        const [mesasData, llevarData, estadoCajaRes] = await Promise.all([
          api.getMesas().catch(() => null),
          api.getPedidosLlevar().catch(() => null),
          api.getEstadoCaja().catch(() => null),
        ]);
        if (mesasData) setMesas(mesasData);
        if (llevarData) setPedidosLlevar(llevarData);
        if (estadoCajaRes && typeof estadoCajaRes.abierto === 'boolean') {
          setCajaEstado(estadoCajaRes);
        }
      }
    } catch (err) {
      console.debug('[CajaPage] Micro-latencia en sondeo:', err?.message);
    } finally {
      isFetchingCajaRef.current = false;
      setLoading(false);
    }
  }, []);

  const abrirTicketImpresionDirecto = (total, response, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items, mesaNum = 'Delivery', deliveryInfo = null, descuentoAplicado = 0, ofertaDescripcion = null) => {
    if (!response) response = {};
    const fecha = new Date().toLocaleDateString('es-PE');
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    let serie = response.serie || (tipoComprobante === 'Factura' ? 'F001' : (tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    // Los tickets no llevan correlativo SUNAT: se numeran con el ID de la venta (único e incremental)
    let correlativoStr = String(response.numero || response.ventaId || response.id || '').padStart(4, '0');
    let subtotal = total / 1.105;
    let igv = total - subtotal;
    let totalLetras = numeroALetras(total);
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = COMPANY_CONFIG.ruc; // el QR de SUNAT lleva solo el número
    const igvSafe = Number(igv || 0).toFixed(2);
    const totalSafe = Number(total || 0).toFixed(2);
    let qrData = `${rucEmpresa}|${tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${fecha}|${tipoComprobante === 'Factura' ? '6' : (numDocumento?.length === 8 ? '1' : '0')}|${numDocumento || '00000000'}`;
    let enlacePdf = null;
    let contingencia = false;

    const qrImageUrl = generateOfflineQrUrl(qrData);

    setActiveComprobante({
      tipo: tipoComprobante,
      serie,
      correlativo: correlativoStr,
      fecha,
      hora,
      mesaNum,
      clienteNombre: clienteNombre || 'Consumidor Final',
      clienteDoc: numDocumento || 'S/D',
      clienteDireccion: clienteDireccion || '',
      items: items.map(i => ({ cant: i.cant, nombre: i.nombre, precio: i.precio, notas: i.notas, categoria: i.categoria || '' })),
      subtotal,
      igv,
      total,
      descuentoAplicado: descuentoAplicado || response.descuentoAplicado || 0,
      ofertaDescripcion: ofertaDescripcion || response.ofertaDescripcion || null,
      totalLetras,
      hashResumen,
      metodoPago: response.metodoPago || metodoPago,
      montoEfectivo: response.montoEfectivo || 0,
      montoTarjeta: response.montoTarjeta || 0,
      montoYape: response.montoYape || 0,
      qrImageUrl,
      enlacePdf,
      contingencia,
      deliveryInfo,
      shouldAutoPrint: true,
    });

    setSunatModalOpen(true);
  };

  // Cobro de mesas (formulario, confirmación y registro de la venta)
  const cobro = useCobroMesa({
    aviso,
    addToast,
    clientes,
    cajaEstado,
    setModalAperturaOpen,
    usuarioOperador,
    fetchCajaData,
    abrirTicketImpresionDirecto,
  });
  const {
    modalOpen,
    mesaSeleccionada,
    metodoPago,
    cobrando,
    modalConfirmarCobro,
    datosConfirmacionCobro,
    setModalOpen,
    setModalConfirmarCobro,
    ejecutarCobroFinal,
    abrirCobroMesa,
  } = cobro;

  // Pedido para llevar / delivery / PedidosYa (estado, productos, pago y envío a cocina)
  const delivery = usePedidoDelivery({
    aviso,
    usuarioOperador,
    cajaEstado,
    setModalAperturaOpen,
    productosMenu,
    setProductosMenu,
    fetchCajaData,
    avisarPedidosYaPrueba,
    abrirTicketImpresionDirecto,
  });
  const {
    deliveryModal,
    deliveryCategoriaFiltro,
    deliveryCategoriasModalOpen,
    optionsModalOpen,
    selectedProduct,
    setDeliveryModal,
    setCodigoPY,
    setDeliveryCategoriaFiltro,
    setDeliveryCategoriasModalOpen,
    setOptionsModalOpen,
    setSelectedProduct,
    setItemsDelivery,
    setEditingPedidoId,
    abrirDeliveryModal,
    iniciarModificarDelivery,
    getProductSteps,
    agregarItemDeliveryDirecto,
    deliveryCategoriasOrdenadas,
    deliveryCategoriasBarra,
    contarProductosCategoriaDelivery,
  } = delivery;



  useEffect(() => {
    // Carga inicial completa de todo el turno
    fetchCajaData({ full: true });

    // Sondeo ligero de alta frecuencia (solo mesas y delivery) cada 6 segundos
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (!modalOpen && !deliveryModal && !cierreModalOpen && !historialCierresModalOpen) {
        fetchCajaData({ full: false });
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchCajaData, modalOpen, deliveryModal, cierreModalOpen, historialCierresModalOpen]);

  // Alerta sonora y visual en tiempo real al estar listos
  useEffect(() => {
    if (pedidosLlevar.length === 0) {
      if (prevPedidosLlevarRef.current.length === 0) prevPedidosLlevarRef.current = pedidosLlevar;
      return;
    }
    if (prevPedidosLlevarRef.current.length > 0) {
      pedidosLlevar.forEach(p => {
        const ant = prevPedidosLlevarRef.current.find(prev => prev.pedidoId === p.pedidoId);
        if (ant && ant.estado === 'Cocina' && p.estado === 'Servido') {
          playChimeNotification();
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, { id: toastId, mensaje: `🛎️ ¡Pedido "${p.codigoPedidosYa}" está LISTO para entregar!` }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 9000);
        }
      });
    }
    prevPedidosLlevarRef.current = pedidosLlevar;
  }, [pedidosLlevar]);

  const mesasPendientes = mesas.filter(m => m.estado !== 'Libre' && m.pedidoData);




  const reimprimirComprobante = (v) => {
    if (!v) return;
    const rucEmpresa = COMPANY_CONFIG.ruc; // el QR de SUNAT lleva solo el número
    
    let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : (v.tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    let correlativoStr = String(v.numero || v.id).padStart(4, '0');
    const igvSafe = Number(v.igv || 0).toFixed(2);
    const totalSafe = Number(v.total || 0).toFixed(2);
    let qrData = `${rucEmpresa}|${v.tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':(v.numDocumento?.length === 8 ? '1' : '0')}|${v.numDocumento || '00000000'}`;
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    let enlacePdf = null;
    let contingencia = false;

    const qrImageUrl = generateOfflineQrUrl(qrData);
    const totalLetras = numeroALetras(v.total);

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

    // Sumar items y agregar servicio de delivery si hay descuadre
    const sumItems = items.reduce((s, i) => s + (i.cant * i.precio), 0);
    const diff = v.total - sumItems;
    if (diff > 0.05 && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.nombreCliente?.startsWith('DELIVERY -'))) {
      items = [...items, { cant: 1, nombre: 'Servicio de Delivery', precio: diff }];
    }

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
      hashResumen,
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo || 0,
      montoTarjeta: v.montoTarjeta || 0,
      montoYape: v.montoYape || 0,
      qrImageUrl,
      enlacePdf,
      contingencia,
      deliveryInfo: parsedDelivery,
      shouldAutoPrint: true,
    });

    setSunatModalOpen(true);
  };



  const enviarPorWhatsApp = async (v) => {
    if (!v) return;
    const telefono = await pedirDato({
      titulo: 'Enviar Comprobante por WhatsApp',
      mensaje: 'Ingresa el número de WhatsApp del cliente:',
      placeholder: '999888777',
      validar: (val) => val.replace(/\D/g, '').length === 9 ? null : 'Ingresa un número de celular válido de 9 dígitos',
    });
    if (!telefono) return;
    const cleanedPhone = telefono.replace(/\D/g, '');
    
    const detalle = (v.itemsResumen || '').trim();
    const totalSafe = Number(v.total || 0).toFixed(2);
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, le enviamos el detalle de su consumo en *${COMPANY_CONFIG.name}*:\n\n${detalle ? detalle + '\n\n' : ''}Total: *S/ ${totalSafe}*\nTicket de venta N° ${v.id}\n\n¡Gracias por su preferencia!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };











  const confirmarEntregaDelivery = async (pedidoId, codigo) => {
    const ok = await confirmar({
      titulo: 'Confirmar Entrega',
      mensaje: `¿Confirmas la entrega del pedido ${codigo}?`,
      textoConfirmar: 'Confirmar Entrega',
    });
    if (!ok) return;
    try {
      await api.confirmarEntrega(pedidoId);
      await fetchCajaData();
      aviso.exito(`Entrega del pedido ${codigo} confirmada`);
    } catch (err) {
      aviso.error('Error: ' + err.message);
    }
  };

  // --- Cambiar método de pago de una venta existente ---













  if (!deliveryCategoriasBarra.includes(deliveryCategoriaFiltro) && deliveryCategoriasOrdenadas.includes(deliveryCategoriaFiltro)) {
    deliveryCategoriasBarra.push(deliveryCategoriaFiltro);
  }

  const {
    ventasTurno,
    activeEfectivo,
    activeTarjeta,
    activeYape,
    activeIngresosCaja,
    activeCortesias,
    activeConsumoPlanilla,
    activeConsumoClientes,
    totalCreditosTurno,
  } = resumenTurno({ ventas, abonos, clientes, ultimoCierre, mostrarTodoElDia });

  const {
    busquedaVentasNorm,
    soloSalidas,
    ventasLista,
    ventasVisibles,
  } = listaVentasTurno({
    ventasTurno,
    movimientos: cajaEstado?.resumenEnVivo?.movimientos,
    ultimoCierre,
    mostrarTodoElDia,
    busquedaVentas,
    filtroMetodoPago,
    ventasLimite,
  });

  const ventaDetalle = ventaDetalleId != null ? ventas.find(v => v.id === ventaDetalleId) : null;
  const mesaDetalle = mesaDetalleNum != null ? mesasPendientes.find(m => m.num === mesaDetalleNum) : null;
  const pedidoDetalle = pedidoDetalleId != null ? pedidosLlevar.find(p => p.pedidoId === pedidoDetalleId) : null;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando cuentas de caja...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 space-y-5">
        <EncabezadoCaja
          abrirDeliveryModal={abrirDeliveryModal}
          abrirHistorialCierres={abrirHistorialCierres}
          abrirMovimientoGaveta={abrirMovimientoGaveta}
          cajaEstado={cajaEstado}
          cajeroNombre={cajeroNombre}
          setCierreModalOpen={setCierreModalOpen}
          setModalAperturaOpen={setModalAperturaOpen}
        />

        <ResumenTurnoCaja
          activeConsumoClientes={activeConsumoClientes}
          activeConsumoPlanilla={activeConsumoPlanilla}
          activeCortesias={activeCortesias}
          activeEfectivo={activeEfectivo}
          activeIngresosCaja={activeIngresosCaja}
          activeTarjeta={activeTarjeta}
          activeYape={activeYape}
          ingresosDesglose={ingresosDesglose}
          mesasPendientes={mesasPendientes}
          pedidosLlevar={pedidosLlevar}
          setIngresosDesglose={setIngresosDesglose}
          totalCreditosTurno={totalCreditosTurno}
          ventasTurno={ventasTurno}
        />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
          <div className="xl:col-span-3 space-y-5 min-w-0">

            <PanelMesasPorCobrar
              abrirCobroMesa={abrirCobroMesa}
              mesasPendientes={mesasPendientes}
              setMesaDetalleNum={setMesaDetalleNum}
            />

            <PanelPedidosLlevar
              confirmarEntregaDelivery={confirmarEntregaDelivery}
              pedidosLlevar={pedidosLlevar}
              setPedidoDetalleId={setPedidoDetalleId}
            />
          </div>

          <PanelVentasTurno
            busquedaVentas={busquedaVentas}
            busquedaVentasNorm={busquedaVentasNorm}
            filtroMetodoPago={filtroMetodoPago}
            historialColapsado={historialColapsado}
            mostrarTodoElDia={mostrarTodoElDia}
            setBusquedaVentas={setBusquedaVentas}
            setFiltroMetodoPago={setFiltroMetodoPago}
            setHistorialColapsado={setHistorialColapsado}
            setMostrarTodoElDia={setMostrarTodoElDia}
            setVentaDetalleId={setVentaDetalleId}
            setVentasLimite={setVentasLimite}
            soloSalidas={soloSalidas}
            ultimoCierre={ultimoCierre}
            ventasLista={ventasLista}
            ventasVisibles={ventasVisibles}
          />
        </div>
      </div>

      {/* MODAL: DETALLE DE MESA */}
      <ModalDetalleMesa
        mesa={mesaDetalle}
        onCerrar={() => setMesaDetalleNum(null)}
        onCobrar={(m) => { setMesaDetalleNum(null); abrirCobroMesa(m); }}
        esCobrable={mesaDetalle ? mesaCobrable(mesaDetalle) : false}
        enPreparacion={mesaDetalle ? mesaEnPreparacion(mesaDetalle) : false}
        cantPlatosEnPreparacion={mesaDetalle ? platosEnPreparacion(mesaDetalle) : 0}
        cantPlatosSinServir={mesaDetalle ? platosSinServir(mesaDetalle) : 0}
      />

      {/* MODAL: DETALLE DE PEDIDO PARA LLEVAR / DELIVERY */}
      <ModalDetallePedidoLlevar
        pedido={pedidoDetalle}
        onCerrar={() => setPedidoDetalleId(null)}
        origen={pedidoDetalle ? origenPedido(pedidoDetalle.codigoPedidosYa, pedidoDetalle) : {}}
        listo={pedidoDetalle ? esPedidoListo(pedidoDetalle) : false}
        onCancelar={(p) => {
          setPedidoDetalleId(null);
          setPedidoACancelarLlevar(p);
          setCancelLlevarModalOpen(true);
        }}
        onModificar={(p) => {
          setPedidoDetalleId(null);
          iniciarModificarDelivery(p);
        }}
        onConfirmarEntrega={(pedidoId, codigoPY) => {
          setPedidoDetalleId(null);
          confirmarEntregaDelivery(pedidoId, codigoPY);
        }}
      />

      {/* MODAL: DETALLE DE VENTA */}
      <ModalDetalleVenta
        venta={ventaDetalle}
        onCerrar={() => setVentaDetalleId(null)}
        onAbrirAnulacion={(v) => abrirAnulacionVenta(v)}
        onEnviarWhatsApp={(v) => enviarPorWhatsApp(v)}
        onReimprimir={(v) => reimprimirComprobante(v)}
        onEditarMetodoPago={(v) => abrirCambioMetodo(v)}
        onEditarTipoEntrega={(v) => abrirCambioTipoEntrega(v)}
        estiloMetodo={estiloMetodo}
        itemsDeVenta={itemsDeVenta}
        clienteDeVenta={clienteDeVenta}
        origenDeVenta={origenDeVenta}
        parseDeliveryInfo={parseDeliveryInfo}
      />

      {/* MODAL DE COBRO (MESAS) */}
      <ModalCobroMesa
        {...cobro}
        abierto={modalOpen && !!mesaSeleccionada}
        mesa={mesaSeleccionada}
        onCerrar={() => setModalOpen(false)}
        productosMenu={productosMenu}
        clientes={clientes}
        soles={soles}
        parseMonto={parseMonto}
        estiloMetodo={estiloMetodo}
      />

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      <ModalConfirmacionCobro
        abierto={modalConfirmarCobro}
        datos={datosConfirmacionCobro}
        cobrando={cobrando}
        onCerrar={() => setModalConfirmarCobro(false)}
        onConfirmar={ejecutarCobroFinal}
      />

      {/* MODAL: TODAS LAS CATEGORÍAS DEL NUEVO PEDIDO */}
      <ModalTodasCategorias
        abierto={deliveryModal && deliveryCategoriasModalOpen}
        onCerrar={() => setDeliveryCategoriasModalOpen(false)}
        categorias={deliveryCategoriasOrdenadas}
        categoriaFiltro={deliveryCategoriaFiltro}
        onSeleccionar={(cat) => {
          setDeliveryCategoriaFiltro(cat);
          setDeliveryCategoriasModalOpen(false);
        }}
        contarProductos={contarProductosCategoriaDelivery}
      />

      {/* MODAL PEDIDOS YA */}
      <ModalNuevoPedidoDelivery
        {...delivery}
        abierto={deliveryModal}
        onCerrar={() => {
          setDeliveryModal(false);
          setCodigoPY('');
          setItemsDelivery([]);
          setEditingPedidoId(null);
        }}
        usuarioOperador={usuarioOperador}
        avisarPedidosYaPrueba={avisarPedidosYaPrueba}
        productosMenu={productosMenu}
        clientes={clientes}
        soles={soles}
        estiloMetodo={estiloMetodo}
      />

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO PARA DELIVERY) */}
      <ModalOpcionesProducto
        abierto={optionsModalOpen && !!selectedProduct}
        producto={selectedProduct}
        onCerrar={() => {
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirmarItem={(item, notas, extras) => {
          agregarItemDeliveryDirecto(item, notas, extras);
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        getProductSteps={getProductSteps}
      />

      {/* MODAL DE CIERRE DE CAJA (ARQUEO DE TURNO) */}
      <ModalCierreCaja
        abierto={cierreModalOpen}
        onCerrar={() => setCierreModalOpen(false)}
        onCierreExitoso={async (newCierreISO) => {
          setUltimoCierre(newCierreISO);
          setMostrarTodoElDia(false);
          setCajaEstado({ abierto: false, turno: null, cargando: false });
          await fetchCajaData();
        }}
        cajaEstado={cajaEstado}
        ventas={ventas}
        abonos={abonos}
        clientes={clientes}
        mesas={mesas}
        ultimoCierre={ultimoCierre}
        empresa={COMPANY_CONFIG}
        cajeroNombre={cajeroNombre || currentUser?.nombre || 'Cajero'}
        parsearCreditoSplit={parsearCreditoSplit}
      />

      {/* MODAL DE APERTURA DE CAJA / INICIO DE TURNO */}
      <ModalAperturaCaja
        abierto={modalAperturaOpen}
        onCerrar={() => setModalAperturaOpen(false)}
        onAperturaExitosa={async () => {
          await fetchCajaData();
          aviso.exito('Turno de caja aperturado exitosamente');
        }}
        cajerosDisponibles={cajerosDisponibles}
        cajeroNombrePorDefecto={cajeroNombre || currentUser?.nombre || ''}
      />

      {/* MODAL DE SALIDA / RETIRO DE EFECTIVO DE CAJA */}
      <ModalRetiroCaja
        abierto={modalSalidaCajaOpen}
        onCerrar={() => setModalSalidaCajaOpen(false)}
        onMovimientoExitoso={async ({ tipo, monto }) => {
          await fetchCajaData();
          aviso.exito(tipo === 'INGRESO'
            ? `Ingreso de S/ ${monto.toFixed(2)} registrado en caja`
            : `Retiro de S/ ${monto.toFixed(2)} registrado correctamente`);
        }}
        cajeroNombre={usuarioOperador}
        tipoInicial={tipoMovimientoCaja}
      />

      {/* MODAL DE HISTORIAL DE CIERRES DE CAJA (POSTGRESQL) */}
      <ModalHistorialCierres
        abierto={historialCierresModalOpen}
        onCerrar={() => setHistorialCierresModalOpen(false)}
        cargandoHistorialCierres={cargandoHistorialCierres}
        historialCierres={historialCierres}
        onReimprimir={(cierre) => setCierreAImprimir(cierre)}
      />

      {/* MODAL DE REIMPRESIÓN DE TICKET DE CIERRE HISTÓRICO */}
      <ModalReimpresionCierre
        cierre={cierreAImprimir}
        onCerrar={() => setCierreAImprimir(null)}
        empresa={COMPANY_CONFIG}
      />

      {/* Modal: Corregir Método de Pago */}
      <ModalCorregirMetodoPago
        abierto={cambioMetodoModal}
        venta={ventaACambiar}
        onCerrar={() => setCambioMetodoModal(false)}
        onGuardar={async ({ ventaId, nuevoMetodo, pin, desgloseMixto }) => {
          const res = await api.cambiarMetodoPago(ventaId, nuevoMetodo, pin, desgloseMixto);
          if (res?.error) {
            throw new Error(res.error);
          }
          await fetchCajaData();
          aviso.exito('Método de pago actualizado exitosamente');
        }}
      />

      {/* Modal: Corregir Tipo de Entrega */}
      <ModalCorregirTipoEntrega
        abierto={cambioTipoEntregaModal}
        venta={ventaATipoCambiar}
        onCerrar={() => setCambioTipoEntregaModal(false)}
        onGuardar={async ({ ventaId, datos }) => {
          const res = await api.cambiarTipoEntrega(ventaId, datos);
          if (res?.error) {
            throw new Error(res.error);
          }
          await fetchCajaData();
          aviso.exito('Tipo de entrega corregido exitosamente');
        }}
      />

      {/* Modal: Autorizar Cancelación de Llevar/Delivery */}
      <ModalCancelarLlevar
        abierto={cancelLlevarModalOpen}
        pedido={pedidoACancelarLlevar}
        onCerrar={() => setCancelLlevarModalOpen(false)}
        onCanceladoExitoso={async () => {
          aviso.exito('Pedido cancelado. Cocina ha sido notificada.');
          await fetchCajaData();
        }}
        usuarioOperador={usuarioOperador}
      />

      {/* Modal Comprobante / Ticket SUNAT */}
      <ModalComprobanteSunat
        abierto={sunatModalOpen}
        comprobante={activeComprobante}
        empresa={COMPANY_CONFIG}
        facturacionElectronica={FACTURACION_ELECTRONICA}
        onCerrar={() => setSunatModalOpen(false)}
      />

      {/* Modal: Anular / Registrar Devolución de Venta */}
      <ModalAnularVenta
        abierto={anularVentaModal}
        venta={ventaAAnular}
        onCerrar={() => setAnularVentaModal(false)}
        onAnulacionExitosa={async () => {
          await fetchCajaData();
          aviso.exito('Devolución / Anulación registrada con éxito');
        }}
      />

      {/* FLOATING TOASTS NOTIFICATIONS SYSTEM FOR CAJA */}
      <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const isError = t.tipo === 'error';
          const isSuccess = t.tipo === 'success';
          const isWarning = t.tipo === 'warning';
          const borderClass = isError ? 'border-red-500/20' : isSuccess ? 'border-emerald-500/20' : isWarning ? 'border-amber-500/30' : 'border-blue-500/20';
          const gradientClass = isError ? 'from-red-500/10' : isSuccess ? 'from-emerald-500/10' : isWarning ? 'from-amber-500/10' : 'from-blue-500/10';
          const bgClass = isError ? 'bg-red-500 shadow-red-500/20' : isSuccess ? 'bg-emerald-500 shadow-emerald-500/20' : isWarning ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-500 shadow-blue-500/20';
          const icon = isError ? '🗑️' : isSuccess ? '✅' : isWarning ? '⏳' : '🛎️';
          const textTitle = isError ? 'Pedido Cancelado' : isSuccess ? 'Operación Exitosa' : isWarning ? 'Atención' : '¡Pedido Listo!';
          const titleColor = isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-blue-400';
          return (
            <div key={t.id} className={`pointer-events-auto bg-slate-900 border ${borderClass} text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-r ${gradientClass} to-transparent`}></div>
              <div className={`w-10 h-10 ${bgClass} rounded-xl flex items-center justify-center font-bold text-lg animate-bounce shrink-0 shadow-lg`}>
                {icon}
              </div>
              <div className="flex-1 pr-2 relative z-10">
                <h4 className={`font-black text-xs ${titleColor} uppercase tracking-widest leading-none mb-1`}>{textTitle}</h4>
                <p className="font-bold text-sm text-slate-100">{t.mensaje}</p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors relative z-10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
