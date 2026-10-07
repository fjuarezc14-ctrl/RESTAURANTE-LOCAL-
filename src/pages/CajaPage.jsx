import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, X, Banknote, Search, Clock, CreditCard, Wallet, Truck, PackageCheck, Gift, Users, Layers, Ban, Lock, History, ChevronDown, ChevronRight, ShoppingCart, ShoppingBag, UtensilsCrossed, Smartphone, Eye, EyeOff, Bike, Unlock, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

import { api } from '../api';
import { getComboConfig, tieneComplementos } from '../utils/combos';

import { useCompany } from '../context/CompanyContext';
import { ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';
import { ordenarCategorias } from '../utils/busquedaProductos';
import { generateOfflineQrUrl } from '../utils/qrOffline';
import { numeroALetras } from '../utils/numeroALetras';
import { cobro as cobroEsquema } from '@shared/esquemas/ventas.js';
import { pedidoLlevar as pedidoLlevarEsquema } from '@shared/esquemas/pedidos.js';
import { useAviso, useConfirmar, usePedirDato } from '../components/ui';
import {
  ModalAperturaCaja,
  ModalRetiroCaja,
  ModalCierreCaja,
  ModalHistorialCierres,
  ModalReimpresionCierre,
  ModalCorregirMetodoPago,
  ModalCorregirTipoEntrega,
  ModalCancelarLlevar,
  ModalComprobanteSunat,
  ModalAnularVenta,
  ModalConfirmacionCobro,
  ModalDetalleMesa,
  ModalDetallePedidoLlevar,
  ModalDetalleVenta,
  ModalTodasCategorias,
  ModalOpcionesProducto,
  ModalCobroMesa,
  ModalNuevoPedidoDelivery,
} from '../modulos/caja/modales';
import { useTurnoCaja, useVentasTurno } from '../modulos/caja/hooks';
import { parseDeliveryInfo, parsearCreditoSplit, parseMonto } from '../utils/ventas';
import { pasosProductoCaja } from '../modulos/caja/utils/pasosProducto';

export default function CajaPage({ currentUser }) {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const FACTURACION_ELECTRONICA = COMPANY_CONFIG?.facturacionElectronica ?? true;
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const pedirDato = usePedirDato();
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState('Ticket');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  // Nº de operación de Yape/Plin o voucher de tarjeta
  const [codigoPago, setCodigoPago] = useState('');
  const [deliveryCodigoPago, setDeliveryCodigoPago] = useState('');
  const [mixtoEfectivo, setMixtoEfectivo] = useState('');
  const [mixtoTarjeta, setMixtoTarjeta] = useState('');
  const [mixtoYape, setMixtoYape] = useState('');
  const [numDocumento, setNumDocumento] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [isBuscando, setIsBuscando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [cortesiaItemIds, setCortesiaItemIds] = useState([]);
  const [motivoCortesia, setMotivoCortesia] = useState('');
  const [deliveryMotivoCortesia, setDeliveryMotivoCortesia] = useState('');
  const [modalConfirmarCobro, setModalConfirmarCobro] = useState(false);
  const [datosConfirmacionCobro, setDatosConfirmacionCobro] = useState(null);

  // Campos para Delivery Propio y Para Llevar en modal
  const [deliveryTelefono, setDeliveryTelefono] = useState('');
  const [deliveryDireccion, setDeliveryDireccion] = useState('');
  const [deliveryMontoEnvio, setDeliveryMontoEnvio] = useState('');
  const [deliveryConCuanto, setDeliveryConCuanto] = useState('');
  const [deliveryTipoComprobante, setDeliveryTipoComprobante] = useState('Ticket');
  const [deliveryMetodoPago, setDeliveryMetodoPago] = useState('Efectivo');
  const [deliveryMixtoEfectivo, setDeliveryMixtoEfectivo] = useState('');
  const [deliveryMixtoTarjeta, setDeliveryMixtoTarjeta] = useState('');
  const [deliveryMixtoYape, setDeliveryMixtoYape] = useState('');
  const [deliveryClienteNombre, setDeliveryClienteNombre] = useState('');
  const [deliveryNumDocumento, setDeliveryNumDocumento] = useState('');


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

  const [consumoPin, setConsumoPin] = useState('');
  const [consumoPinError, setConsumoPinError] = useState('');

  // Créditos y Clientes
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [clienteCreditoSeleccionado, setClienteCreditoSeleccionado] = useState(null);
  const [clientesCreditoMixto, setClientesCreditoMixto] = useState([{ clienteId: '', monto: '', nombre: '' }]);
  const [incluirCreditoMixto, setIncluirCreditoMixto] = useState(false);
  const [deliveryMontoCredito, setDeliveryMontoCredito] = useState('');
  const [deliveryClienteCreditoSeleccionado, setDeliveryClienteCreditoSeleccionado] = useState(null);
  const [deliveryDescuentoValor, setDeliveryDescuentoValor] = useState('');
  const [deliveryDescuentoTipo, setDeliveryDescuentoTipo] = useState('porcentaje'); // 'porcentaje' | 'monto'
  const [deliveryVistaMovil, setDeliveryVistaMovil] = useState('productos'); // 'productos' | 'pedido'
  const [pagaConEfectivoMesa, setPagaConEfectivoMesa] = useState('');

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
  const [pinAdminDelivery, setPinAdminDelivery] = useState('');
  const [cortesiaDeliveryIndices, setCortesiaDeliveryIndices] = useState([]);

  // Modal de autorización de cancelación para Llevar/Delivery
  const [cancelLlevarModalOpen, setCancelLlevarModalOpen] = useState(false);
  const [pedidoACancelarLlevar, setPedidoACancelarLlevar] = useState(null);

  // Modal PedidosYa y Para Llevar
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [codigoPY, setCodigoPY] = useState('');
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

  const [deliverySearchQuery, setDeliverySearchQuery] = useState('');
  const [deliveryCategoriaFiltro, setDeliveryCategoriaFiltro] = useState('🔥 Más Pedidos');
  const [deliveryCategoriasModalOpen, setDeliveryCategoriasModalOpen] = useState(false);
  const deliverySearchInputRef = useRef(null);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [productosMenu, setProductosMenu] = useState([]);
  const [itemsDelivery, setItemsDelivery] = useState([]);
  const [editingPedidoId, setEditingPedidoId] = useState(null);
  const [enviandoDelivery, setEnviandoDelivery] = useState(false);
  const [tipoDelivery, setTipoDelivery] = useState('PedidosYa'); // 'PedidosYa' | 'ParaLlevar'
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

  const handleDocumentoChange = (val) => {
    setNumDocumento(val);
    const cleaned = val.trim();
    if (cleaned === '20613857321') {
      setClienteNombre('FIRST FISH S.A.C.');
      setClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setTipoComprobante('Factura');
    } else if (cleaned === '10404040404') {
      setClienteNombre('JUAN PEREZ SOTO');
      setClienteDireccion('CALLE SAN MARTÍN 109');
      setTipoComprobante('Boleta');
    }
  };

  const buscarClienteDelivery = async () => {
    if (!deliveryNumDocumento) return;
    setIsBuscando(true);
    const doc = deliveryNumDocumento.trim();
    
    if (doc === '20613857321') {
      setDeliveryClienteNombre('FIRST FISH S.A.C.');
      setDeliveryDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setIsBuscando(false);
      return;
    } else if (doc === '10404040404') {
      setDeliveryClienteNombre('JUAN PEREZ SOTO');
      setDeliveryDireccion('CALLE SAN MARTÍN 109');
      setIsBuscando(false);
      return;
    }

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setDeliveryClienteNombre(data.razonSocial || '');
        setDeliveryDireccion(data.direccion || '');
      } else {
        setDeliveryClienteNombre(data.nombre || '');
        if (data.direccion) setDeliveryDireccion(data.direccion);
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC en delivery:", err);
      aviso.advertencia("No se encontró el cliente o error en la consulta.");
    } finally {
      setIsBuscando(false);
    }
  };


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






  const procesarCobroYFacturar = async () => {
    if (cobrando) return;
    if (!mesaSeleccionada || !mesaSeleccionada.pedidoData) return;
    if (tipoComprobante === 'Factura') {
      if (!numDocumento || numDocumento.trim().length !== 11) {
        aviso.advertencia('Para emitir Factura, el RUC debe tener 11 dígitos.');
        return;
      }
      if (!clienteNombre || !clienteNombre.trim()) {
        aviso.advertencia('Por favor, busca y valida el RUC del cliente antes de cobrar.');
        return;
      }
      if (!clienteDireccion || !clienteDireccion.trim()) {
        aviso.advertencia('La Dirección fiscal del cliente es obligatoria para emitir una Factura. Por favor, ingrésala.');
        return;
      }
    }

    const items = mesaSeleccionada.pedidoData.items || [];
    const itemsNormales = items.filter(i => !cortesiaItemIds.includes(i.itemId));
    // Cortesía total: todos los productos van a S/ 0.00
    const total = metodoPago === 'Cortesía' ? 0 : itemsNormales.reduce((s, i) => s + (i.cant * i.precio), 0);
    const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;

    // Si es Consumo o Cortesía (total o individual), requerir PIN de supervisor/cajero en el modal
    if (metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales) {
      if (!consumoPin.trim()) {
        setConsumoPinError(`El PIN es requerido para autorizar la Cortesía / Consumo.`);
        return;
      }
      
      try {
        const auth = await api.validateAuth(consumoPin.trim());
        if (auth.error) throw new Error(auth.error);
      } catch (err) {
        setConsumoPinError("PIN de autorización incorrecto o no autorizado.");
        return;
      }
    }

    if (metodoPago === 'Crédito') {
      if (!clienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Validar y calcular montos
    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;
    let finalCreditosDetalle = [];
    let finalClienteCreditoId = null;

    if (metodoPago === 'Efectivo') {
      finalMontoEfectivo = total;
    } else if (metodoPago === 'Tarjeta') {
      finalMontoTarjeta = total;
    } else if (metodoPago === 'Yape') {
      finalMontoYape = total;
    } else if (metodoPago === 'Mixto') {
      const efecVal = parseMonto(mixtoEfectivo);
      const tarjVal = parseMonto(mixtoTarjeta);
      const yapeVal = parseMonto(mixtoYape);
      
      let credVal = 0;
      if (incluirCreditoMixto) {
        const validos = (clientesCreditoMixto || []).filter(c => c.clienteId && parseMonto(c.monto) > 0);
        if (validos.length === 0) {
          aviso.advertencia('Has marcado incluir crédito en Pago Mixto. Debes seleccionar al menos un cliente de crédito e ingresar su monto.');
          return;
        }

        credVal = validos.reduce((s, c) => s + parseMonto(c.monto), 0);
        finalCreditosDetalle = validos.map(c => {
          const found = clientes.find(cli => String(cli.id) === String(c.clienteId));
          return {
            clienteId: parseInt(c.clienteId),
            nombre: found?.nombre || c.nombre || '',
            monto: parseMonto(c.monto)
          };
        });
        finalClienteCreditoId = finalCreditosDetalle[0].clienteId;
      }

      if (tarjVal + yapeVal + credVal > (total + 0.01)) {
        aviso.advertencia('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar. El vuelto solo aplica sobre Efectivo.');
        return;
      }

      const restante = parseFloat(Math.max(0, total - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, total - (efecVal + tarjVal + yapeVal + credVal)).toFixed(2));
        aviso.error(`Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}. Faltan S/ ${faltante.toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
      finalMontoCredito = credVal;
    } else if (metodoPago === 'Crédito') {
      finalCreditosDetalle = [{
        clienteId: clienteCreditoSeleccionado.id,
        nombre: clienteCreditoSeleccionado.nombre,
        monto: total
      }];
      finalClienteCreditoId = clienteCreditoSeleccionado.id;
      finalMontoCredito = total;
    }

    let pagaConNum = total;
    let vueltoNum = 0;

    if (metodoPago === 'Efectivo') {
      pagaConNum = parseMonto(pagaConEfectivoMesa) || total;
      vueltoNum = pagaConNum > total ? Math.round((pagaConNum - total) * 100) / 100 : 0;
    } else if (metodoPago === 'Mixto') {
      const efecIngresado = parseMonto(mixtoEfectivo);
      pagaConNum = efecIngresado > 0 ? efecIngresado : finalMontoEfectivo;
      vueltoNum = efecIngresado > finalMontoEfectivo ? Math.round((efecIngresado - finalMontoEfectivo) * 100) / 100 : 0;
    }

    const payloadCobro = {
      pedidoIds: mesaSeleccionada.pedidoData.pedidoIds,
      tipoComprobante,
      numDocumento: numDocumento || null,
      nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
      total,
      metodoPago,
      montoEfectivo: finalMontoEfectivo,
      montoTarjeta: finalMontoTarjeta,
      montoYape: finalMontoYape,
      montoCredito: finalMontoCredito,
      clienteCreditoId: finalClienteCreditoId,
      creditosDetalle: finalCreditosDetalle,
      clienteDireccion: clienteDireccion || '',
      cortesiaItemIds: cortesiaItemIds,
      motivoCortesia: motivoCortesia.trim() || null,
      cajeroNombre: usuarioOperador,
      codigoPago: codigoPago.trim() || null,
    };
    // Mismas reglas que el backend (backend/shared/esquemas/ventas.js)
    const validacionCobro = cobroEsquema.safeParse(payloadCobro);
    if (!validacionCobro.success) {
      aviso.advertencia(validacionCobro.error.issues?.[0]?.message || 'Revisa los datos del cobro.');
      return;
    }

    // Guardar los datos preparados para la confirmación
    setDatosConfirmacionCobro({
      mesaNum: mesaSeleccionada.num,
      esDelivery: mesaSeleccionada.num === 'DELIVERY',
      tipoComprobante,
      nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
      numDocumento: numDocumento || null,
      clienteDireccion: clienteDireccion || '',
      metodoPago,
      total,
      pagaCon: pagaConNum,
      vuelto: vueltoNum,
      finalMontoEfectivo,
      finalMontoTarjeta,
      finalMontoYape,
      finalMontoCredito,
      finalClienteCreditoId,
      finalCreditosDetalle,
      cortesiaItemIds,
      itemsParaImpresion: items,
      payload: validacionCobro.data,
    });

    // Abrir modal de confirmación antes de ejecutar la transacción
    setModalConfirmarCobro(true);
  };

  const ejecutarCobroFinal = async () => {
    if (cobrando || !datosConfirmacionCobro) return;
    setCobrando(true);
    try {
      const { payload, total, itemsParaImpresion, mesaNum, tipoComprobante: tComp, numDocumento: nDoc, nombreCliente: nomCli, clienteDireccion: dirCli, metodoPago: mPago } = datosConfirmacionCobro;

      const response = await api.cobrar(payload);

      setModalConfirmarCobro(false);
      setDatosConfirmacionCobro(null);
      setPagaConEfectivoMesa('');
      setModalOpen(false);
      setNumDocumento('');
      setClienteNombre('');
      setClienteDireccion('');
      setConsumoPin('');
      setConsumoPinError('');
      setMixtoEfectivo('');
      setMixtoTarjeta('');
      setMixtoYape('');
      setClienteCreditoSeleccionado(null);
      setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
      setIncluirCreditoMixto(false);
      setCortesiaItemIds([]);
      setMotivoCortesia('');

      // Desencadenar la visualización e impresión del comprobante (solo si no es Consumo Personal)
      if (mPago !== 'Consumo') {
        const itemsCortesiaDescuento = (itemsParaImpresion || [])
          .filter(item => payload.cortesiaItemIds?.includes(item.itemId))
          .reduce((sum, item) => sum + (parseFloat(item.precio || 0) * parseInt(item.cant || 1)), 0);

        const itemsFormat = (itemsParaImpresion || []).map(item => {
          if (payload.cortesiaItemIds?.includes(item.itemId)) {
            return {
              ...item,
              precio: 0,
              notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
            };
          }
          return item;
        });

        const descCortesiaTicket = itemsCortesiaDescuento > 0 
          ? (payload.motivoCortesia ? `Cortesía de ítems (${payload.motivoCortesia})` : 'Cortesía de ítems')
          : (mPago === 'Cortesía' ? (payload.motivoCortesia ? `Cortesía total (${payload.motivoCortesia})` : 'Cortesía total') : null);

        abrirTicketImpresionDirecto(
          total,
          response,
          tComp,
          nDoc || null,
          nomCli || 'Consumidor Final',
          dirCli || '',
          itemsFormat,
          mesaNum,
          null,
          itemsCortesiaDescuento,
          descCortesiaTicket
        );
      } else {
        aviso.exito('Consumo Personal registrado. Mesa liberada.');
      }

      await fetchCajaData();
    } catch (err) {
      aviso.error('Error al procesar cobro: ' + err.message);
    } finally {
      setCobrando(false);
    }
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


  // --- Modal PedidosYa ---
  const abrirDeliveryModal = async () => {
    if (!cajaEstado.abierto) {
      setModalAperturaOpen(true);
      return;
    }
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(null);
    setItemsDelivery([]);
    setCodigoPY('');
    setDeliverySearchQuery('');
    setDeliveryTelefono('');
    setDeliveryDireccion('');
    setDeliveryMontoEnvio('');
    setDeliveryConCuanto('');
    setDeliveryTipoComprobante('Ticket');
    setDeliveryMetodoPago('Efectivo');
    setDeliveryCodigoPago('');
    setDeliveryClienteNombre('');
    setDeliveryNumDocumento('');
    setTipoDelivery('ParaLlevar');
    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryMotivoCortesia('');
    setDeliveryVistaMovil('productos');
    setDeliveryModal(true);
  };

  const iniciarModificarDelivery = async (p) => {
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(p.pedidoId);
    setItemsDelivery(p.items || []);
    setDeliverySearchQuery('');
    
    // Identificar el tipo de delivery
    let calculatedTipo = 'PedidosYa';
    let codePY = p.codigoPedidosYa || '';
    if (p.codigoPedidosYa?.startsWith('DELIVERY -')) {
      calculatedTipo = 'DeliveryPropio';
    } else if (p.codigoPedidosYa?.startsWith('LLEVAR -')) {
      calculatedTipo = 'ParaLlevar';
    }
    setTipoDelivery(calculatedTipo);
    setDeliveryCodigoPago('');

    // Poblar campos según tipo
    if (calculatedTipo === 'DeliveryPropio') {
      const parsed = parseDeliveryInfo(p.codigoPedidosYa);
      if (parsed) {
        setDeliveryClienteNombre(parsed.nombre);
        setDeliveryTelefono(parsed.telefono);
        setDeliveryDireccion(parsed.direccion);
        setDeliveryConCuanto(parsed.conCuanto || '');
      } else {
        setDeliveryClienteNombre(p.codigoPedidosYa.replace('DELIVERY - ', ''));
        setDeliveryTelefono('');
        setDeliveryDireccion('');
        setDeliveryConCuanto('');
      }
      setCodigoPY('');
    } else if (calculatedTipo === 'ParaLlevar') {
      setCodigoPY(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryClienteNombre(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    } else {
      setCodigoPY(codePY);
      setDeliveryClienteNombre('PEDIDOS YA');
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    }

    // Costo de delivery
    const itemsTotal = (p.items || []).reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = Math.max(0, p.total - itemsTotal);
    setDeliveryMontoEnvio(shippingFee > 0 ? String(shippingFee) : '');

    // Métodos de pago y comprobantes
    if (p.ventaData) {
      setDeliveryTipoComprobante(p.ventaData.tipoComprobante || 'Ticket');
      setDeliveryMetodoPago(p.ventaData.metodoPago || 'Efectivo');
      setDeliveryNumDocumento(p.ventaData.numDocumento || '');
      if (p.ventaData.metodoPago === 'Mixto') {
        setDeliveryMixtoEfectivo(p.ventaData.montoEfectivo ? String(p.ventaData.montoEfectivo) : '');
        setDeliveryMixtoTarjeta(p.ventaData.montoTarjeta ? String(p.ventaData.montoTarjeta) : '');
        setDeliveryMixtoYape(p.ventaData.montoYape ? String(p.ventaData.montoYape) : '');
      } else {
        setDeliveryMixtoEfectivo('');
        setDeliveryMixtoTarjeta('');
        setDeliveryMixtoYape('');
      }
    } else {
      setDeliveryTipoComprobante('Ticket');
      setDeliveryMetodoPago(calculatedTipo === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');
      setDeliveryNumDocumento('');
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
    }

    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryMotivoCortesia('');
    setDeliveryVistaMovil('productos');
    setDeliveryModal(true);
  };

  const getProductSteps = (prod, currentSelections = {}) => pasosProductoCaja(prod, currentSelections, productosMenu);

  const agregarItemDelivery = (prod) => {
    if (!prod) return;

    const hasDynamicOptions = !!prod.opcionesConfig && (() => {
      try {
        const p = typeof prod.opcionesConfig === 'string' ? JSON.parse(prod.opcionesConfig) : prod.opcionesConfig;
        return Array.isArray(p) && p.length > 0;
      } catch { return false; }
    })();

    const isVirtualGroup = !!prod.esAgrupado;
    const traeComplementos = tieneComplementos(prod);
    const isMenu = prod && (prod.categoria === 'Menú' || prod.categoria?.toLowerCase().includes('menú') || prod.categoria?.toLowerCase().includes('menu'));
    const hasLegacyCombo = !prod.opcionesConfig && prod.requiereGuarnicion && !!getComboConfig(prod.nombre);
    const isLegacyMenu = !prod.opcionesConfig && prod.requiereGuarnicion && isMenu;
    const isLegacyCategoryCombo = !prod.opcionesConfig && prod.requiereGuarnicion && (
      String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo')
    );

    if (hasDynamicOptions || isVirtualGroup || hasLegacyCombo || isLegacyMenu || isLegacyCategoryCombo || traeComplementos) {
      const steps = getProductSteps(prod, {});
      if (steps && steps.length > 0) {
        setSelectedProduct(prod);
        setOptionsModalOpen(true);
        return;
      }
    }
    
    agregarItemDeliveryDirecto(prod, null);
  };

  const agregarItemDeliveryDirecto = (prod, notas = null, extras = null) => {
    const cleanNotas = notas && String(notas).trim() ? String(notas).trim() : null;
    const opcionesElegidas = extras?.opciones || [];
    const precioExtra = extras?.precioExtra || 0;
    const idx = itemsDelivery.findIndex(i => i.id === String(prod.id) && i.notas === cleanNotas);
    
    // Contabilizar total de este producto en delivery actual (evita fuga de stock con notas distintas)
    const cantTotalEnTicket = itemsDelivery
      .filter(i => String(i.id) === String(prod.id))
      .reduce((sum, item) => sum + item.cant, 0);
    
    // Validar stock si es limitado
    if (prod.tipoStock === 'limitado' && cantTotalEnTicket >= prod.stock) {
      aviso.advertencia(`Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
      return;
    }

    const precioBase = prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio;
    const precioFinal = precioBase + precioExtra;

    if (idx >= 0) {
      const nuevo = [...itemsDelivery];
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
      setItemsDelivery(nuevo);
    } else {
      setItemsDelivery([...itemsDelivery, { 
        id: String(prod.id), 
        nombre: prod.nombre, 
        precio: precioFinal, 
        cant: 1,
        ofertaNombre: prod.ofertaNombre,
        precioOriginal: prod.precio,
        notas: cleanNotas,
        opciones: opcionesElegidas
      }]);
    }
  };

  const alterarItemDelivery = (idx, op) => {
    const nuevo = [...itemsDelivery];
    if (op === '+') {
      const prodOriginal = productosMenu.find(p => String(p.id) === String(nuevo[idx].id));
      const cantTotal = nuevo
        .filter(i => String(i.id) === String(nuevo[idx].id))
        .reduce((sum, item) => sum + item.cant, 0);
      if (prodOriginal && prodOriginal.tipoStock === 'limitado' && cantTotal >= prodOriginal.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
        return;
      }
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
    } else {
      const nuevaCant = nuevo[idx].cant - 1;
      if (nuevaCant <= 0) {
        nuevo.splice(idx, 1);
      } else {
        nuevo[idx] = { ...nuevo[idx], cant: nuevaCant };
      }
    }
    setItemsDelivery(nuevo);
  };

  const alterarNotasDelivery = (idx, value) => {
    const nuevo = [...itemsDelivery];
    nuevo[idx] = { ...nuevo[idx], notas: value };
    setItemsDelivery(nuevo);
  };

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

  const enviarDeliveryACocina = async () => {
    if (itemsDelivery.length === 0) { aviso.advertencia('Debes agregar al menos un producto.'); return; }
    // Pedidos nuevos por PedidosYa deshabilitados (versión de prueba)
    if (tipoDelivery === 'PedidosYa' && !editingPedidoId) { avisarPedidosYaPrueba(); return; }

    // Validar datos según el canal seleccionado
    if (tipoDelivery === 'PedidosYa') {
      if (!codigoPY.trim()) {
        aviso.advertencia('El código de PedidosYa es obligatorio.');
        return;
      }
    } else if (tipoDelivery === 'ParaLlevar') {
      if (!codigoPY.trim()) {
        aviso.advertencia('El nombre del cliente o número de ticket es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          aviso.advertencia('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
        if (!deliveryClienteNombre.trim()) {
          aviso.advertencia('Para emitir Factura, la Razón Social del cliente es obligatoria.');
          return;
        }
        if (!deliveryDireccion.trim()) {
          aviso.advertencia('Para emitir Factura, la Dirección fiscal del cliente es obligatoria. Por favor, ingrésala.');
          return;
        }
      }
    } else if (tipoDelivery === 'DeliveryPropio') {
      if (!deliveryClienteNombre.trim()) {
        aviso.advertencia('El nombre del cliente es obligatorio.');
        return;
      }
      if (!deliveryDireccion.trim()) {
        aviso.advertencia('La dirección del cliente es obligatoria.');
        return;
      }
      if (!deliveryTelefono.trim()) {
        aviso.advertencia('El teléfono del cliente es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          aviso.advertencia('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
      }
    }

    // Validar PIN de administrador si el método de pago es Consumo o Cortesía, o si hay ítems de cortesía
    const tieneCortesias = deliveryMetodoPago === 'Consumo' || deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0;
    if (tieneCortesias) {
      if (!pinAdminDelivery.trim()) {
        aviso.advertencia(`Debes ingresar el PIN del administrador/cajero para autorizar ${deliveryMetodoPago === "Consumo" ? "un Consumo de Personal" : "la Cortesía"}.`);
        return;
      }
      const authResult = await api.validateAuth(pinAdminDelivery.trim());
      if (!authResult || !authResult.ok) {
        aviso.error(`PIN incorrecto. Solo el administrador/cajero puede autorizar ${deliveryMetodoPago === "Consumo" ? "un Consumo de Personal" : "la Cortesía"}.`);
        setPinAdminDelivery('');
        return;
      }
    }

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Crédito') {
      if (!deliveryClienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Mapear items finales marcando a S/ 0.00 los que sean de cortesía
    const itemsFinales = itemsDelivery.map((item, idx) => {
      const esCortesia = deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx);
      if (esCortesia) {
        return {
          ...item,
          precio: 0,
          notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
        };
      }
      return item;
    });

    // Validar y calcular montos si es Pago Mixto
    let deliveryFinalMontoEfectivo = 0;
    let deliveryFinalMontoTarjeta = 0;
    let deliveryFinalMontoYape = 0;
    let deliveryFinalMontoCredito = 0;
    
    const itemsTotal = itemsFinales.reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;

    // Descuento para llevar/delivery: porcentual o monto fijo en soles
    const descVal = Math.max(0, parseFloat(deliveryDescuentoValor || 0) || 0);
    const descEsPct = deliveryDescuentoTipo === 'porcentaje';
    const descPct = descEsPct ? Math.min(100, descVal) : 0;
    const descuentoMonto = (descVal > 0 && itemsTotal > 0)
      ? parseFloat((descEsPct ? itemsTotal * (descPct / 100) : Math.min(descVal, itemsTotal)).toFixed(2))
      : 0;
    const totalConDescuento = Math.max(0, itemsTotal - descuentoMonto);
    const grandTotal = deliveryMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = descuentoMonto;
    const descuentoEtiqueta = descEsPct ? `${descPct}%` : `S/ ${descuentoMonto.toFixed(2)}`;

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Mixto') {
      const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
      const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
      const yapeVal = parseFloat(deliveryMixtoYape || 0);
      const credVal = parseFloat(deliveryMontoCredito || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0 || credVal < 0) {
        aviso.advertencia('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (credVal > 0 && !deliveryClienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente para la porción de pago a crédito.');
        return;
      }

      if (tarjVal + yapeVal + credVal > (grandTotal + 0.01)) {
        aviso.advertencia('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar.');
        return;
      }

      const restante = parseFloat(Math.max(0, grandTotal - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, restante - efecVal).toFixed(2));
        aviso.error(`Monto insuficiente. Debes cubrir el total de S/ ${grandTotal.toFixed(2)}. Faltan S/ ${faltante.toFixed(2)}`);
        return;
      }

      deliveryFinalMontoEfectivo = restante;
      deliveryFinalMontoTarjeta = tarjVal;
      deliveryFinalMontoYape = yapeVal;
      deliveryFinalMontoCredito = credVal;
    }

    setEnviandoDelivery(true);
    try {
      let codigoFormateado = '';
      const vueltoVal = (() => {
        const conC = parseFloat(deliveryConCuanto);
        return (!isNaN(conC) && conC >= grandTotal) ? (conC - grandTotal).toFixed(2) : '0.00';
      })();

      if (tipoDelivery === 'PedidosYa') {
        codigoFormateado = codigoPY.trim().toUpperCase();
      } else if (tipoDelivery === 'ParaLlevar') {
        codigoFormateado = `LLEVAR - ${codigoPY.trim().toUpperCase()}`;
      } else if (tipoDelivery === 'DeliveryPropio') {
        codigoFormateado = `DELIVERY - ${deliveryClienteNombre.trim().toUpperCase()} | TEL: ${deliveryTelefono.trim()} | DIR: ${deliveryDireccion.trim()} | PAGA: ${deliveryConCuanto || '0.00'} | VUELTO: ${vueltoVal}`;
      }

      const payload = {
        codigoPedidosYa: codigoFormateado,
        cajero: usuarioOperador,
        items: itemsFinales,
        total: grandTotal,
        tipoDelivery,
        tipoComprobante: tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante,
        metodoPago: tipoDelivery === 'PedidosYa' ? 'PedidosYa' : deliveryMetodoPago,
        montoEfectivo: deliveryMetodoPago === 'Efectivo' ? grandTotal : deliveryFinalMontoEfectivo,
        montoTarjeta: deliveryMetodoPago === 'Tarjeta' ? grandTotal : deliveryFinalMontoTarjeta,
        montoYape: deliveryMetodoPago === 'Yape' ? grandTotal : deliveryFinalMontoYape,
        montoCredito: deliveryMetodoPago === 'Crédito' ? grandTotal : deliveryFinalMontoCredito,
        clienteCreditoId: deliveryClienteCreditoSeleccionado?.id || null,
        numDocumento: tipoDelivery === 'PedidosYa' ? codigoFormateado : (deliveryNumDocumento || 'S/D'),
        nombreCliente: tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'),
        clienteDireccion: tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : (deliveryDireccion || ''),
        montoDelivery: shippingFee,
        telefono: deliveryTelefono || null,
        descuentoPorcentaje: descPct,
        descuentoMonto: descEsPct ? 0 : descuentoMonto,
        descuentoDescripcion: descuentoFinal > 0 ? `Descuento manual ${descuentoEtiqueta}` : null,
        motivoCortesia: deliveryMotivoCortesia.trim() || null,
        codigoPago: deliveryCodigoPago.trim() || null,
      };

      // Mismas reglas que el backend (backend/shared/esquemas/pedidos.js)
      const validacionPedido = pedidoLlevarEsquema.safeParse(payload);
      if (!validacionPedido.success) {
        aviso.advertencia(validacionPedido.error.issues?.[0]?.message || 'Revisa los datos del pedido.');
        return;
      }

      const result = editingPedidoId
        ? await api.actualizarDelivery(editingPedidoId, validacionPedido.data)
        : await api.crearPedidoLlevar(validacionPedido.data);

      if (result.error) throw new Error(result.error);

      // Cerrar modal y recargar datos de Caja
      setDeliveryModal(false);
      setEditingPedidoId(null);
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
      setDeliveryMontoCredito('');
      setDeliveryClienteCreditoSeleccionado(null);
      setDeliveryDescuentoValor('');
      setPinAdminDelivery('');
      setCortesiaDeliveryIndices([]);
      setDeliveryMotivoCortesia('');
      await fetchCajaData();
      
      // Si es Para Llevar o Delivery Propio con comprobante Boleta o Factura (o Ticket), activamos el ticket de impresión
      if (tipoDelivery !== 'PedidosYa') {
        // Para que en la impresión figuren los items reales del ticket
        const itemsImpresion = [...itemsFinales];
        if (shippingFee > 0) {
          itemsImpresion.push({
            id: '9999',
            nombre: 'Servicio de Delivery',
            precio: shippingFee,
            cant: 1
          });
        }
        
        const deliveryInfo = tipoDelivery === 'DeliveryPropio' ? {
          nombre: deliveryClienteNombre,
          telefono: deliveryTelefono,
          direccion: deliveryDireccion,
          montoDelivery: shippingFee,
          conCuanto: deliveryConCuanto || '0.00',
          vuelto: vueltoVal,
        } : null;

        const descCortesiaTicket = (deliveryMetodoPago === 'Cortesía')
          ? (payload.motivoCortesia ? `Cortesía total (${payload.motivoCortesia})` : 'Cortesía total del pedido')
          : (cortesiaDeliveryIndices.length > 0
              ? (payload.motivoCortesia ? `Cortesía de ítems (${payload.motivoCortesia})` : 'Cortesía de ítems')
              : (descuentoFinal > 0 ? `Descuento ${descuentoEtiqueta}` : null));

        abrirTicketImpresionDirecto(
          grandTotal, 
          result.venta, 
          tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante, 
          tipoDelivery === 'PedidosYa' ? null : (deliveryNumDocumento || null), 
          tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'), 
          tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : '', 
          itemsImpresion, 
          tipoDelivery === 'DeliveryPropio' ? 'Delivery' : 'Llevar',
          deliveryInfo,
          descuentoFinal,
          descCortesiaTicket
        );
      } else {
        aviso.exito(`Pedido ${codigoPY.toUpperCase()} enviado a Cocina. Venta registrada.`);
      }
    } catch (err) {
      aviso.error('Error: ' + err.message);
    } finally {
      setEnviandoDelivery(false);
    }
  };

  const cortesiaDeliveryItemsTotal = itemsDelivery.reduce((s, i, idx) => {
    if (deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx)) return s;
    return s + i.cant * i.precio;
  }, 0);
  const totalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : cortesiaDeliveryItemsTotal;
  const deliveryDescVal = Math.max(0, parseFloat(deliveryDescuentoValor || 0) || 0);
  const deliveryDescPct = deliveryDescuentoTipo === 'porcentaje' ? Math.min(100, deliveryDescVal) : 0;
  const deliveryDescuentoMonto = (deliveryDescVal > 0 && totalDelivery > 0)
    ? parseFloat((deliveryDescuentoTipo === 'porcentaje' ? totalDelivery * (deliveryDescPct / 100) : Math.min(deliveryDescVal, totalDelivery)).toFixed(2))
    : 0;
  const deliveryTotalConDescuento = Math.max(0, totalDelivery - deliveryDescuentoMonto);
  const deliveryShippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;
  const grandTotalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : (deliveryTotalConDescuento + deliveryShippingFee);

  // ── Vista principal de caja: helpers de presentación ──
  // Platos aún sin servir de una mesa (cocina y barra los muestran mientras no estén en historial)
  const platosEnPreparacion = (m) => (m.pedidoData?.items || []).filter(i => i && !i.historial).reduce((s, i) => s + (i.cant || 0), 0);
  // Listos en cocina/barra pero que el mozo aún no marcó como servidos en la mesa
  const itemsSinServir = (m) => (m.pedidoData?.items || []).filter(i => i && i.historial && !i.entregado);
  const platosSinServir = (m) => itemsSinServir(m).reduce((s, i) => s + (i.cant || 0), 0);
  const mesaEnPreparacion = (m) => m.estado === 'Cocina';
  // Solo se cobra una mesa con todo preparado y servido por el mozo
  const mesaCobrable = (m) => !mesaEnPreparacion(m) && platosSinServir(m) === 0;
  const textoBloqueoMesa = (m) => mesaEnPreparacion(m)
    ? (platosEnPreparacion(m) > 0 ? `${platosEnPreparacion(m)} en preparación` : 'En cocina')
    : `${platosSinServir(m)} por servir`;

  const abrirCobroMesa = (m) => {
    if (!cajaEstado.abierto) {
      setModalAperturaOpen(true);
      return;
    }
    // No se cobra una mesa con platos en preparación: se perderían de cocina y barra
    if (mesaEnPreparacion(m)) {
      const n = platosEnPreparacion(m);
      addToast(`⏳ La Mesa ${m.num} aún tiene ${n > 0 ? `${n} plato(s)` : 'pedidos'} en preparación. Podrás cobrarla cuando cocina y barra los marquen como listos.`, 'warning');
      return;
    }
    // Tampoco si hay platos listos que el mozo todavía no llevó a la mesa
    if (platosSinServir(m) > 0) {
      const detalle = itemsSinServir(m).map(i => `${i.cant}× ${i.nombre}`).join(', ');
      addToast(`🍽️ La Mesa ${m.num} tiene platos sin servir: ${detalle}. Podrás cobrarla cuando el mozo los marque como servidos.`, 'warning');
      return;
    }
    setMesaSeleccionada(m);
    setTipoComprobante('Boleta');
    setMetodoPago('Efectivo');
    setCodigoPago('');
    setPagaConEfectivoMesa('');
    setNumDocumento('');
    setClienteNombre('');
    setClienteDireccion('');
    setConsumoPin('');
    setConsumoPinError('');
    setMotivoCortesia('');
    setCortesiaItemIds([]);
    setClienteCreditoSeleccionado(null);
    setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
    setIncluirCreditoMixto(false);
    setMixtoEfectivo('');
    setMixtoTarjeta('');
    setMixtoYape('');
    setModalOpen(true);
  };

  const esPedidoListo = (p) => {
    if (!p) return false;
    const e = (p.estado || '').toUpperCase();
    return p.estado === 'Servido' || e.includes('LISTO') || e.includes('SERVIDO');
  };

  const origenPedido = (codigo = '', pedido = null) => {
    const cod = typeof codigo === 'string' ? codigo : (codigo != null ? String(codigo) : '');
    if (cod.startsWith('DELIVERY -')) {
      const info = parseDeliveryInfo(cod);
      return { tipo: 'delivery', etiqueta: 'Delivery', nombre: info ? info.nombre : cod.replace('DELIVERY - ', ''), info, Icon: Bike, color: 'bg-indigo-50 text-indigo-600' };
    }
    if (cod.startsWith('LLEVAR -')) {
      const nom = cod.replace('LLEVAR - ', '').trim();
      return { tipo: 'llevar', etiqueta: 'Para llevar', nombre: nom || 'Para Llevar', info: null, Icon: ShoppingBag, color: 'bg-cyan-50 text-cyan-700' };
    }
    if (cod) {
      return { tipo: 'pedidosya', etiqueta: 'PedidosYa', nombre: cod, info: null, Icon: Truck, color: 'bg-rose-50 text-rose-600' };
    }
    // Si no tiene código de PedidosYa, deducir por tipo de pedido o nombre de cliente
    if (pedido?.tipoEntrega === 'delivery') {
      return { tipo: 'delivery', etiqueta: 'Delivery', nombre: pedido?.ventaData?.nombreCliente || 'Delivery Local', info: null, Icon: Bike, color: 'bg-indigo-50 text-indigo-600' };
    }
    return { tipo: 'llevar', etiqueta: 'Para llevar', nombre: pedido?.ventaData?.nombreCliente || (pedido?.pedidoId ? `Pedido #${pedido.pedidoId}` : 'Para Llevar'), info: null, Icon: ShoppingBag, color: 'bg-cyan-50 text-cyan-700' };
  };

  const clienteDeVenta = (v) => {
    if (!v) return 'Consumidor Final';
    const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    if (info) return info.nombre;
    if (typeof v.nombreCliente === 'string' && v.nombreCliente.startsWith('DELIVERY -')) {
      return v.nombreCliente.replace('DELIVERY - ', '');
    }
    return v.nombreCliente || 'Consumidor Final';
  };

  const origenDeVenta = (v) => (v?.codigoPedidosYa ? origenPedido(v.codigoPedidosYa).etiqueta : (v?.mesaNum ? `Mesa ${v.mesaNum}` : 'Para Llevar'));

  const itemsDeVenta = (v) => {
    if (v.items?.length) return v.items.map(i => ({ cant: i.cant, nombre: i.nombre, subtotal: i.cant * i.precio }));
    return (v.itemsResumen ? v.itemsResumen.split(', ') : []).map(str => {
      const match = str.match(/^(\d+)x\s+(.+)$/);
      return match ? { cant: parseInt(match[1]), nombre: match[2], subtotal: null } : { cant: null, nombre: str, subtotal: null };
    });
  };

  const METODO_ESTILO = {
    Efectivo: { Icon: Banknote, chip: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', activo: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/25', icono: 'text-emerald-600' },
    Tarjeta: { Icon: CreditCard, chip: 'bg-blue-50 text-blue-700', text: 'text-blue-700', activo: 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25', icono: 'text-blue-600' },
    Yape: { Icon: Smartphone, chip: 'bg-purple-50 text-purple-700', text: 'text-purple-700', activo: 'bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/25', icono: 'text-purple-600' },
    Mixto: { Icon: Layers, chip: 'bg-amber-50 text-amber-700', text: 'text-amber-700', activo: 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/25', icono: 'text-amber-500' },
    Crédito: { Icon: Wallet, chip: 'bg-teal-50 text-teal-700', text: 'text-teal-700', activo: 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/25', icono: 'text-teal-600' },
    Consumo: { Icon: Users, chip: 'bg-violet-50 text-violet-700', text: 'text-violet-700', activo: 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/25', icono: 'text-violet-600' },
    Cortesía: { Icon: Gift, chip: 'bg-orange-50 text-orange-700', text: 'text-orange-700', activo: 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/25', icono: 'text-orange-500' },
    PedidosYa: { Icon: Truck, chip: 'bg-rose-50 text-rose-600', text: 'text-rose-600', activo: 'bg-rose-600 border-rose-600 text-white', icono: 'text-rose-600' },
  };
  const estiloMetodo = (m) => METODO_ESTILO[m] || { Icon: Receipt, chip: 'bg-slate-100 text-slate-600', text: 'text-slate-600', activo: 'bg-slate-900 border-slate-900 text-white', icono: 'text-slate-500' };

  const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

  const estadoChip = (listo, textoListo, textoPendiente) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${listo ? 'text-emerald-700' : 'text-amber-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${listo ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
      {listo ? textoListo : textoPendiente}
    </span>
  );

  // Campo del Nº de operación (Yape/Plin) o voucher (tarjeta), para verificar el pago después
  const campoCodigoPago = (valor, setValor, medio) => (
    <div className="animate-fade-in">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {medio === 'Tarjeta' ? 'Nº de voucher / operación POS' : medio === 'Yape' ? 'Código de operación Yape / Plin' : 'Código de operación (Yape / tarjeta)'}
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={60}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Ej. 01234567"
        className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition"
      />
    </div>
  );

  // ── Categorías del modal de nuevo pedido: unas pocas en la barra + "Ver todas" ──
  const CATEGORIAS_VISIBLES = 5;
  const deliveryCategoriasOrdenadas = ordenarCategorias(
    ['🔥 Más Pedidos', 'Todos', ...new Set(productosMenu.filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))],
    ORDEN_PRIORIDADES_CATEGORIAS
  );
  const deliveryCategoriasBarra = deliveryCategoriasOrdenadas.slice(0, CATEGORIAS_VISIBLES);
  if (!deliveryCategoriasBarra.includes(deliveryCategoriaFiltro) && deliveryCategoriasOrdenadas.includes(deliveryCategoriaFiltro)) {
    deliveryCategoriasBarra.push(deliveryCategoriaFiltro);
  }
  const contarProductosCategoriaDelivery = (cat) => {
    const activos = productosMenu.filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas');
    if (cat === '🔥 Más Pedidos') return Math.min(8, activos.length);
    return cat === 'Todos' ? activos.length : activos.filter(p => p.categoria === cat).length;
  };

  // ── Resumen del turno ──
  const obtenerMontosVentaFrontend = (v) => {
    if (!v || v.anulado || v.estadoPedido === 'Cancelado') return { efec: 0, tarj: 0, yape: 0 };
    if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') return { efec: 0, tarj: 0, yape: 0 };

    let efec = parseFloat(v.montoEfectivo || 0);
    let tarj = parseFloat(v.montoTarjeta || 0);
    let yape = parseFloat(v.montoYape || 0);
    const total = parseFloat(v.total || 0);

    if (total <= 0) return { efec: 0, tarj: 0, yape: 0 };
    if (v.metodoPago === 'Efectivo') return { efec: total, tarj: 0, yape: 0 };
    if (v.metodoPago === 'Tarjeta') return { efec: 0, tarj: total, yape: 0 };
    if (v.metodoPago === 'Yape') return { efec: 0, tarj: 0, yape: total };

    // Restar la parte a crédito si es mixto
    const creditAmount = parseFloat(v.montoCredito || 0);
    const totalFisico = Math.max(0, total - creditAmount);
    const suma = efec + tarj + yape;
    if (Math.abs(suma - totalFisico) > 0.01) {
      if (suma === 0) efec = totalFisico;
      else if (totalFisico > suma) efec += (totalFisico - suma);
    }
    return { efec, tarj, yape };
  };

  const ventasTurno = (ultimoCierre && !mostrarTodoElDia)
    ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
    : ventas;
  const abonosTurno = (ultimoCierre && !mostrarTodoElDia)
    ? abonos.filter(a => new Date(a.creadoEn) > new Date(ultimoCierre))
    : abonos;

  let activeEfectivo = 0;
  let activeTarjeta = 0;
  let activeYape = 0;
  ventasTurno.forEach(v => {
    const { efec, tarj, yape } = obtenerMontosVentaFrontend(v);
    activeEfectivo += efec;
    activeTarjeta += tarj;
    activeYape += yape;
  });
  // Sumar abonos a la caja real
  abonosTurno.forEach(a => {
    activeEfectivo += a.montoEfectivo || 0;
    activeTarjeta += a.montoTarjeta || 0;
    activeYape += a.montoYape || 0;
  });
  const activeIngresosCaja = activeEfectivo + activeTarjeta + activeYape;
  const activeCortesias = ventasTurno
    .filter(v => v.metodoPago === 'Cortesía' && !v.anulado && v.estadoPedido !== 'Cancelado')
    .reduce((sum, v) => sum + (parseFloat(v.descuentoAplicado || v.total) || (v.items?.reduce((s, i) => s + (i.cant * i.precio), 0) || 0)), 0);

  const clienteEsTrabajador = new Map(clientes.map(c => [c.id, c.esTrabajador]));
  let activeConsumoPlanilla = 0;
  let activeConsumoClientes = 0;
  ventasTurno.forEach(v => {
    if (v.anulado || v.estadoPedido === 'Cancelado') return;
    if (v.metodoPago === 'Consumo') {
      activeConsumoPlanilla += (v.descuentoAplicado || v.total || 0);
    } else {
      const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      if (splits.length > 0) {
        splits.forEach(s => {
          if (clienteEsTrabajador.get(s.clienteId)) activeConsumoPlanilla += s.monto;
          else activeConsumoClientes += s.monto;
        });
      } else if (v.metodoPago === 'Crédito') {
        activeConsumoClientes += (v.total || 0);
      } else if (parseFloat(v.montoCredito || 0) > 0) {
        activeConsumoClientes += parseFloat(v.montoCredito);
      }
    }
  });
  const totalCreditosTurno = activeConsumoClientes + activeConsumoPlanilla;

  // ── Lista de ventas (filtro + búsqueda) ──
  const busquedaVentasNorm = busquedaVentas.trim().toLowerCase();
  const soloSalidas = filtroMetodoPago === 'Salidas';
  const ventasFiltradas = soloSalidas ? [] : ventasTurno.filter(v => {
    if (filtroMetodoPago !== 'Todos') {
      let method = v.metodoPago;
      if (method === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) {
        method = 'Efectivo';
      }
      if (method !== filtroMetodoPago) return false;
    }
    if (!busquedaVentasNorm) return true;
    return [`vt-${v.id}`, String(v.id), clienteDeVenta(v), origenDeVenta(v), v.itemsResumen, v.serie && `${v.serie}-${v.numero}`, v.codigoPago]
      .some(s => s && String(s).toLowerCase().includes(busquedaVentasNorm));
  });

  // Salidas (y entradas) de efectivo del turno abierto, mezcladas con las ventas por hora
  const movimientosTurno = (cajaEstado?.resumenEnVivo?.movimientos || []).filter(m =>
    !(ultimoCierre && !mostrarTodoElDia) || new Date(m.creadoEn) >= new Date(ultimoCierre)
  );
  const movimientosFiltrados = (filtroMetodoPago === 'Todos' || soloSalidas)
    ? movimientosTurno.filter(m => {
        if (!busquedaVentasNorm) return true;
        return [m.motivo, m.cajeroNombre, m.tipo === 'INGRESO' ? 'ingreso de caja' : 'salida de caja']
          .some(s => s && String(s).toLowerCase().includes(busquedaVentasNorm));
      })
    : [];
  const ventasLista = [
    ...ventasFiltradas.map(v => ({ tipoFila: 'venta', fecha: new Date(v.createdAt).getTime() || 0, venta: v })),
    ...movimientosFiltrados.map(m => ({ tipoFila: 'movimiento', fecha: new Date(m.creadoEn).getTime() || 0, mov: m })),
  ].sort((a, b) => b.fecha - a.fecha);
  const ventasVisibles = ventasLista.slice(0, ventasLimite);
  const horaMovimiento = (fecha) => new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

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

        {/* ENCABEZADO + ESTADO DEL TURNO */}
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Caja</h1>
            {!cajaEstado.cargando && cajaEstado.abierto && (
              <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Turno abierto
                </span>
                <span className="text-slate-300">·</span>
                <span className="truncate">{cajaEstado.turno?.cajeroNombre || cajeroNombre}</span>
                <span className="text-slate-300">·</span>
                <span>desde {cajaEstado.turno?.fechaApertura ? new Date(cajaEstado.turno.fechaApertura).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                <span className="text-slate-300">·</span>
                <span>Fondo <span className="font-mono text-slate-700">{soles(cajaEstado.turno?.montoInicial)}</span></span>
                {(() => {
                  const notaLimpia = (cajaEstado.turno?.notaApertura || '').replace(/\[Conteo inicial:.*?\]/g, '').trim();
                  return notaLimpia ? <span className="italic text-slate-400 truncate">“{notaLimpia}”</span> : null;
                })()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
            <button
              type="button"
              onClick={abrirHistorialCierres}
              className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 whitespace-nowrap"
              title="Historial de cierres"
            >
              <History className="w-4 h-4" /> <span className="hidden sm:inline">Cierres</span>
            </button>
            {cajaEstado.abierto && (
              <button
                type="button"
                onClick={() => abrirMovimientoGaveta('RETIRO')}
                className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs active:scale-[0.98] shrink-0 whitespace-nowrap"
                title="Retirar o ingresar dinero en la gaveta física"
              >
                <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                <span>Movimiento de caja</span>
              </button>
            )}
            {cajaEstado.abierto ? (
              <button
                type="button"
                onClick={() => setCierreModalOpen(true)}
                className="h-10 px-3.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs active:scale-[0.98] shrink-0 whitespace-nowrap"
                title="Realizar arqueo físico y cerrar turno"
              >
                <Lock className="w-4 h-4 text-rose-600" /> Cerrar caja
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModalAperturaOpen(true)}
                className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition-all active:scale-[0.98] shrink-0 whitespace-nowrap"
                title="Iniciar turno y registrar fondo de sencillo"
              >
                <Unlock className="w-4 h-4" /> Abrir caja
              </button>
            )}
            <button
              type="button"
              onClick={abrirDeliveryModal}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700 shadow-sm shadow-sky-600/25 transition-colors active:scale-[0.98] shrink-0 whitespace-nowrap"
            >
              <ShoppingCart className="w-4 h-4" /> Nuevo pedido
            </button>
          </div>
        </header>

        {!cajaEstado.cargando && !cajaEstado.abierto && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white grid place-items-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-800">Caja cerrada</p>
              <p className="text-sm text-rose-700/80">Inicia un turno con el fondo de sencillo usando el botón "Abrir caja" para habilitar cobros y pedidos.</p>
            </div>
          </div>
        )}

        {/* RESUMEN DEL TURNO */}
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 ${ingresosDesglose ? 'items-start' : ''}`}>
          <div className="col-span-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-4 sm:p-5 shadow-sm shadow-emerald-600/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-emerald-50/90">Ingresos en caja</p>
              <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Banknote className="w-4 h-4" /></span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight truncate">{soles(activeIngresosCaja)}</p>
              <button
                type="button"
                onClick={() => setIngresosDesglose(v => !v)}
                className="h-7 pl-2.5 pr-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium inline-flex items-center gap-1 transition-colors shrink-0"
                aria-expanded={ingresosDesglose}
                title={ingresosDesglose ? 'Ocultar detalle' : 'Ver efectivo, tarjeta y Yape'}
              >
                Detalle <ChevronDown className={`w-4 h-4 transition-transform ${ingresosDesglose ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {ingresosDesglose && (
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-xs animate-fade-in">
              {[['Efectivo', activeEfectivo], ['Tarjeta', activeTarjeta], ['Yape', activeYape]].map(([label, monto]) => (
                <div key={label} className="min-w-0">
                  <p className="text-emerald-50/75">{label}</p>
                  <p className="font-mono tabular-nums text-white truncate">{soles(monto)}</p>
                </div>
              ))}
            </div>
            )}
          </div>
          {[
            { label: 'Ventas', valor: ventasTurno.length, hint: `${mesasPendientes.length + pedidosLlevar.length} por cobrar/entregar`, Icon: Receipt, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' },
            { label: 'Créditos', valor: soles(totalCreditosTurno), hint: `Clientes ${soles(activeConsumoClientes)} · Planilla ${soles(activeConsumoPlanilla)}`, Icon: Wallet, color: 'bg-teal-50 text-teal-600', borde: 'border-t-teal-500' },
            { label: 'Cortesías', valor: soles(activeCortesias), hint: 'Valor referencial', Icon: Gift, color: 'bg-orange-50 text-orange-600', borde: 'border-t-orange-500' },
          ].map(({ label, valor, hint, Icon, color, borde }) => (
            <div key={label} className={`rounded-2xl border border-slate-200/70 border-t-4 ${borde} bg-white p-4 min-w-0`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${color}`}><Icon className="w-4 h-4" /></span>
              </div>
              <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-900 font-mono tabular-nums truncate">{valor}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
          <div className="xl:col-span-3 space-y-5 min-w-0">

            {/* MESAS PENDIENTES POR COBRAR */}
            <section className="bg-white rounded-2xl border border-slate-200/70">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center"><UtensilsCrossed className="w-4 h-4" /></span> Mesas por cobrar
                </h2>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">{mesasPendientes.length}</span>
              </div>
              {mesasPendientes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 p-3 sm:p-4">
                  {mesasPendientes.map(m => {
                    const items = (m.pedidoData?.items || []).filter(Boolean);
                    const unidades = items.reduce((s, i) => s + (i.cant || 0), 0);
                    const listo = mesaCobrable(m);
                    return (
                      <div
                        key={m.num}
                        role="button"
                        tabIndex={0}
                        onClick={() => setMesaDetalleNum(m.num)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setMesaDetalleNum(m.num); }}
                        className={`group rounded-xl border border-slate-200 border-l-4 ${listo ? 'border-l-emerald-500' : 'border-l-amber-400'} bg-white p-3.5 flex flex-col gap-3 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 grid place-items-center text-sm font-bold shrink-0">{m.num}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-semibold text-slate-900 truncate">Mesa {m.num}</p>
                              <p className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">{soles(m.pedidoData?.total)}</p>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{m.pedidoData?.mesero || '—'} · {m.pedidoData?.hora}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-medium text-slate-700">{unidades} ítem{unidades !== 1 ? 's' : ''}</span>
                          {items.length > 0 && <> · {items.map(i => `${i.cant}× ${i.nombre}`).join(', ')}</>}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-auto">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            {estadoChip(listo, 'Listo p/ cobrar', mesaEnPreparacion(m) ? 'En preparación' : 'Por servir')}
                            {m.pedidoData?.estadoEnsalada === 'Pendiente' && <span className="text-[11px] text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">🥗 Pendiente</span>}
                            {m.pedidoData?.estadoEnsalada === 'Listo' && <span className="text-[11px] text-blue-700 bg-blue-50 rounded-md px-1.5 py-0.5">🥗 Lista</span>}
                          </div>
                          {listo ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); abrirCobroMesa(m); }}
                              className="h-8 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/25 transition-colors active:scale-95 shrink-0"
                            >
                              Cobrar
                            </button>
                          ) : (
                            <span
                              className="h-8 px-3 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-not-allowed"
                              title="Se podrá cobrar cuando el mozo marque todos los platos como servidos"
                            >
                              <Clock className="w-3.5 h-3.5" /> {textoBloqueoMesa(m)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No hay mesas pendientes por cobrar.</p>
              )}
            </section>

            {/* PEDIDOS PARA LLEVAR / DELIVERY */}
            {pedidosLlevar.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200/70">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center"><Truck className="w-4 h-4" /></span> Para llevar y delivery
                  </h2>
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-0.5">{pedidosLlevar.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {pedidosLlevar.map(p => {
                    const o = origenPedido(p.codigoPedidosYa, p);
                    const listo = esPedidoListo(p);
                    return (
                      <li
                        key={p.pedidoId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPedidoDetalleId(p.pedidoId)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setPedidoDetalleId(p.pedidoId); }}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:bg-slate-50"
                      >
                        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${o.color}`}>
                          <o.Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{o.nombre}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                            <span className="shrink-0">{o.etiqueta} · {p.hora}</span>
                            <span className="hidden sm:inline">{estadoChip(listo, 'Listo', 'En cocina')}</span>
                          </div>
                        </div>
                        <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">{soles(p.total)}</p>
                        {listo ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); confirmarEntregaDelivery(p.pedidoId, p.codigoPedidosYa); }}
                            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors active:scale-95 shrink-0 inline-flex items-center gap-1.5"
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Entregar</span>
                          </button>
                        ) : (
                          <span className="sm:hidden">{estadoChip(false, '', '')}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          {/* ÚLTIMAS VENTAS */}
          <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/70 min-w-0">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center"><Receipt className="w-4 h-4" /></span> Ventas y Salidas de Turno
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">{ventasLista.length}</span>
              </h2>
              <button
                type="button"
                onClick={() => setHistorialColapsado(prev => !prev)}
                className="p-2 -m-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title={historialColapsado ? 'Mostrar ventas' : 'Ocultar ventas'}
              >
                {historialColapsado ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {!historialColapsado ? (
              <>
                <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={busquedaVentas}
                      onChange={(e) => { setBusquedaVentas(e.target.value); setVentasLimite(20); }}
                      placeholder="Buscar venta, cliente, mesa…"
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <select
                    value={filtroMetodoPago}
                    onChange={(e) => { setFiltroMetodoPago(e.target.value); setVentasLimite(20); }}
                    className="h-9 px-2.5 rounded-lg bg-slate-100/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Yape">Yape / Plin</option>
                    <option value="PedidosYa">PedidosYa</option>
                    <option value="Cortesía">Cortesías</option>
                    <option value="Salidas">💸 Salidas de caja</option>
                  </select>
                  {ultimoCierre && (
                    <div className="inline-flex h-9 p-0.5 rounded-lg bg-slate-100/80 text-xs font-medium">
                      {[[false, 'Turno'], [true, 'Día']].map(([valor, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => { setMostrarTodoElDia(valor); setVentasLimite(20); }}
                          className={`px-3 rounded-md transition-colors ${mostrarTodoElDia === valor ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          title={valor ? 'Mostrar todas las ventas del día' : 'Solo ventas del turno activo'}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {ventasVisibles.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {ventasVisibles.map(fila => {
                      if (fila.tipoFila === 'movimiento') {
                        const m = fila.mov;
                        const esIngreso = m.tipo === 'INGRESO';
                        return (
                          <li key={`mov-${m.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                            <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${esIngreso ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              <ArrowUpRight className={`w-4 h-4 ${esIngreso ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate text-slate-900">
                                {esIngreso ? 'Ingreso de Caja' : 'Salida de Caja'} <span className="text-slate-300">·</span> {m.motivo}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {horaMovimiento(m.creadoEn)}
                                {m.cajeroNombre && <> · <span className="text-slate-600">{m.cajeroNombre}</span></>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-mono text-sm font-semibold tabular-nums ${esIngreso ? 'text-emerald-600' : 'text-red-600'}`}>
                                {esIngreso ? '+ ' : '- '}{soles(m.monto)}
                              </p>
                              <p className={`text-[11px] font-medium ${esIngreso ? 'text-emerald-600' : 'text-red-600'}`}>Efectivo</p>
                            </div>
                          </li>
                        );
                      }
                      const v = fila.venta;
                      const est = estiloMetodo(v.metodoPago);
                      const conCortesia = v.metodoPago === 'Cortesía' || v.itemsResumen?.includes('CORTESÍA');
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setVentaDetalleId(v.id)}
                            className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:bg-slate-50"
                          >
                            <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${v.anulado ? 'bg-red-50 text-red-500' : est.chip}`}>
                              {v.anulado ? <Ban className="w-4 h-4" /> : <est.Icon className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${v.anulado ? 'text-slate-400' : 'text-slate-900'}`}>
                                {origenDeVenta(v)} <span className="text-slate-300">·</span> {clienteDeVenta(v)}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                <span className="font-mono">#VT-{v.id}</span> · {v.hora}
                                {v.cajeroNombre && <> · <span className="text-slate-600">{v.cajeroNombre}</span></>}
                                {v.descuentoAplicado > 0 && !v.anulado && <span className="text-blue-600"> · Desc.</span>}
                                {conCortesia && !v.anulado && <span className="text-orange-600"> · Cortesía</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-mono text-sm font-semibold tabular-nums ${v.anulado ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {soles(v.anulado ? (v.montoOriginal ?? v.total) : v.total)}
                              </p>
                              <p className={`text-[11px] font-medium ${v.anulado ? 'text-red-600' : est.text}`}>{v.anulado ? 'Devuelto' : v.metodoPago}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    {soloSalidas && !busquedaVentasNorm
                      ? 'No hay salidas de caja en este turno.'
                      : (busquedaVentasNorm || filtroMetodoPago !== 'Todos' ? 'Nada coincide con el filtro.' : 'Aún no se registran ventas en este turno.')}
                  </p>
                )}

                {ventasLista.length > ventasVisibles.length && (
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setVentasLimite(l => l + 20)}
                      className="w-full h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      Mostrar más ({ventasLista.length - ventasVisibles.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setHistorialColapsado(false)}
                className="w-full px-5 py-8 text-sm text-slate-400 hover:text-slate-700 transition-colors"
              >
                Historial oculto · toca para mostrar
              </button>
            )}
          </section>
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
        abierto={modalOpen && !!mesaSeleccionada}
        mesa={mesaSeleccionada}
        onCerrar={() => setModalOpen(false)}
        productosMenu={productosMenu}
        metodoPago={metodoPago}
        setMetodoPago={setMetodoPago}
        cortesiaItemIds={cortesiaItemIds}
        setCortesiaItemIds={setCortesiaItemIds}
        pagaConEfectivoMesa={pagaConEfectivoMesa}
        setPagaConEfectivoMesa={setPagaConEfectivoMesa}
        mixtoEfectivo={mixtoEfectivo}
        setMixtoEfectivo={setMixtoEfectivo}
        mixtoTarjeta={mixtoTarjeta}
        setMixtoTarjeta={setMixtoTarjeta}
        mixtoYape={mixtoYape}
        setMixtoYape={setMixtoYape}
        codigoPago={codigoPago}
        setCodigoPago={setCodigoPago}
        consumoPin={consumoPin}
        setConsumoPin={setConsumoPin}
        consumoPinError={consumoPinError}
        setConsumoPinError={setConsumoPinError}
        motivoCortesia={motivoCortesia}
        setMotivoCortesia={setMotivoCortesia}
        clientes={clientes}
        clienteCreditoSeleccionado={clienteCreditoSeleccionado}
        setClienteCreditoSeleccionado={setClienteCreditoSeleccionado}
        incluirCreditoMixto={incluirCreditoMixto}
        setIncluirCreditoMixto={setIncluirCreditoMixto}
        clientesCreditoMixto={clientesCreditoMixto}
        setClientesCreditoMixto={setClientesCreditoMixto}
        tipoComprobante={tipoComprobante}
        setTipoComprobante={setTipoComprobante}
        numDocumento={numDocumento}
        setNumDocumento={setNumDocumento}
        handleDocumentoChange={handleDocumentoChange}
        clienteNombre={clienteNombre}
        setClienteNombre={setClienteNombre}
        clienteDireccion={clienteDireccion}
        setClienteDireccion={setClienteDireccion}
        procesarCobroYFacturar={procesarCobroYFacturar}
        cobrando={cobrando}
        setMesaSeleccionada={setMesaSeleccionada}
        soles={soles}
        parseMonto={parseMonto}
        campoCodigoPago={campoCodigoPago}
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
        abierto={deliveryModal}
        onCerrar={() => {
          setDeliveryModal(false);
          setCodigoPY('');
          setItemsDelivery([]);
          setEditingPedidoId(null);
        }}
        editingPedidoId={editingPedidoId}
        setEditingPedidoId={setEditingPedidoId}
        usuarioOperador={usuarioOperador}
        tipoDelivery={tipoDelivery}
        setTipoDelivery={setTipoDelivery}
        codigoPY={codigoPY}
        setCodigoPY={setCodigoPY}
        deliveryMontoEnvio={deliveryMontoEnvio}
        setDeliveryMontoEnvio={setDeliveryMontoEnvio}
        avisarPedidosYaPrueba={avisarPedidosYaPrueba}
        deliveryVistaMovil={deliveryVistaMovil}
        setDeliveryVistaMovil={setDeliveryVistaMovil}
        deliverySearchInputRef={deliverySearchInputRef}
        deliverySearchQuery={deliverySearchQuery}
        setDeliverySearchQuery={setDeliverySearchQuery}
        deliveryCategoriaFiltro={deliveryCategoriaFiltro}
        setDeliveryCategoriaFiltro={setDeliveryCategoriaFiltro}
        deliveryCategoriasBarra={deliveryCategoriasBarra}
        deliveryCategoriasOrdenadas={deliveryCategoriasOrdenadas}
        CATEGORIAS_VISIBLES={CATEGORIAS_VISIBLES}
        setDeliveryCategoriasModalOpen={setDeliveryCategoriasModalOpen}
        productosMenu={productosMenu}
        agregarItemDelivery={agregarItemDelivery}
        alterarItemDelivery={alterarItemDelivery}
        alterarNotasDelivery={alterarNotasDelivery}
        itemsDelivery={itemsDelivery}
        setItemsDelivery={setItemsDelivery}
        cortesiaDeliveryIndices={cortesiaDeliveryIndices}
        setCortesiaDeliveryIndices={setCortesiaDeliveryIndices}
        deliveryDescuentoTipo={deliveryDescuentoTipo}
        setDeliveryDescuentoTipo={setDeliveryDescuentoTipo}
        deliveryDescuentoValor={deliveryDescuentoValor}
        setDeliveryDescuentoValor={setDeliveryDescuentoValor}
        deliveryDescVal={deliveryDescVal}
        deliveryDescPct={deliveryDescPct}
        deliveryDescuentoMonto={deliveryDescuentoMonto}
        totalDelivery={totalDelivery}
        deliveryShippingFee={deliveryShippingFee}
        grandTotalDelivery={grandTotalDelivery}
        deliveryMetodoPago={deliveryMetodoPago}
        setDeliveryMetodoPago={setDeliveryMetodoPago}
        deliveryTipoComprobante={deliveryTipoComprobante}
        setDeliveryTipoComprobante={setDeliveryTipoComprobante}
        deliveryConCuanto={deliveryConCuanto}
        setDeliveryConCuanto={setDeliveryConCuanto}
        deliveryClienteNombre={deliveryClienteNombre}
        setDeliveryClienteNombre={setDeliveryClienteNombre}
        deliveryTelefono={deliveryTelefono}
        setDeliveryTelefono={setDeliveryTelefono}
        deliveryDireccion={deliveryDireccion}
        setDeliveryDireccion={setDeliveryDireccion}
        deliveryNumDocumento={deliveryNumDocumento}
        setDeliveryNumDocumento={setDeliveryNumDocumento}
        buscarClienteDelivery={buscarClienteDelivery}
        isBuscando={isBuscando}
        deliveryCodigoPago={deliveryCodigoPago}
        setDeliveryCodigoPago={setDeliveryCodigoPago}
        deliveryMixtoEfectivo={deliveryMixtoEfectivo}
        setDeliveryMixtoEfectivo={setDeliveryMixtoEfectivo}
        deliveryMixtoTarjeta={deliveryMixtoTarjeta}
        setDeliveryMixtoTarjeta={setDeliveryMixtoTarjeta}
        deliveryMixtoYape={deliveryMixtoYape}
        setDeliveryMixtoYape={setDeliveryMixtoYape}
        deliveryMontoCredito={deliveryMontoCredito}
        setDeliveryMontoCredito={setDeliveryMontoCredito}
        deliveryClienteCreditoSeleccionado={deliveryClienteCreditoSeleccionado}
        setDeliveryClienteCreditoSeleccionado={setDeliveryClienteCreditoSeleccionado}
        clientes={clientes}
        pinAdminDelivery={pinAdminDelivery}
        setPinAdminDelivery={setPinAdminDelivery}
        deliveryMotivoCortesia={deliveryMotivoCortesia}
        setDeliveryMotivoCortesia={setDeliveryMotivoCortesia}
        enviarDeliveryACocina={enviarDeliveryACocina}
        enviandoDelivery={enviandoDelivery}
        soles={soles}
        campoCodigoPago={campoCodigoPago}
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
