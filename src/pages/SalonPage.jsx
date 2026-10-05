import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChefHat, CheckCircle, PlusCircle, Receipt, X, Edit3, ShoppingBag, User, AlertTriangle, Clock, Trash, Lock, Tag, Percent, Link2, Bell, Settings, Plus, Utensils, Save, Trash2, Search, Check, ChevronRight, Wifi, WifiOff, LayoutGrid, List, Sparkles, Flame, Minus } from 'lucide-react';
import { api } from '../api';
import { parsePasosOpciones, resolverSeleccion, pasoComplementos, resolverComplementos, tieneComplementos } from '../utils/combos';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS, ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';
import { matchProductSemantic, relevanciaBusqueda, ordenarCategorias } from '../utils/busquedaProductos';
import { useAviso, useConfirmar, usePedirDato } from '../components/ui';
import {
  ModalCancelarPedido,
  ModalAutorizacionPin,
  ModalUnionMesas,
  ModalTodasCategoriasSalon,
  ModalPrecuentaMesa,
  ModalPedidoMesa,
  DrawerBandejaDespacho,
  ModalAdminMesas,
} from '../modulos/salon/modales';
import ModalOpcionesProducto from '../modulos/caja/modales/ModalOpcionesProducto';

const LIMITE_CANCELACION_MS = 5 * 60 * 1000;

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

function formatCuentaRegresiva(ms) {
  const seg = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  return `${min}:${s.toString().padStart(2, '0')}`;
}

// --- SISTEMA DE AUDIO Y VIBRACIÓN OPTIMIZADO PARA SALÓN / MOZOS ---
let globalAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

// Desbloquear AudioContext en el primer gesto del usuario (táctil, click o teclado)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });
}

// Sintetizador Web Audio API de Campana de Restaurante Premium (E5 -> G5 -> C6) + Vibración Háptica
function playChimeNotification() {
  try {
    // 1. Vibración háptica en dispositivos móviles de mozos
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250]);
      } catch (err) {}
    }

    // 2. Campana sonora Web Audio API
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const playTone = (freq, startTime, duration, gainLevel = 0.35) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(gainLevel, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Melodía de aviso de 3 notas brillantes (E5 -> G5 -> C6) con volumen audible
    playTone(659.25, now, 0.45, 0.3);
    playTone(783.99, now + 0.12, 0.55, 0.35);
    playTone(1046.50, now + 0.25, 0.85, 0.4);
  } catch (e) {
    console.error('AudioContext bloqueado/no soportado:', e);
  }
}

const PRODUCT_OPTIONS_CONFIG = {
  "Combo Criollo (Almuerzo)": {
    fondoOptions: [
      "Saltado (pollo o carne)",
      "Tallarin saltado (pollo o carne)",
      "Chaufa (pollo o carne)",
      "Trucha Frita",
      "Alitas Fritas",
      "Milanesa de Pollo",
      "Chicharron de pollo"
    ]
  },
  "Combo Parrillero (Almuerzo)": {
    fondoOptions: [
      "Chuleta de cerdo",
      "Filete de pollo",
      "Churrasco",
      "Pechuga"
    ]
  },
  "Combo Tallarines Verdes (Almuerzo)": {
    fondoOptions: [
      "Con Pollo Frito",
      "Con Bisteck",
      "Con Pechuga",
      "Con Chuleta",
      "Con Pollo Deshuesado"
    ]
  },
  "Combo Junior": {
    fondoOptions: [
      "3 unds. de chicharrones de pollo",
      "1/8 pollo a la brasa",
      "3 alitas fritas (+ ensalada fruta)"
    ]
  }
};

const getComboConfig = (nombre) => {
  if (!nombre) return null;
  const key = Object.keys(PRODUCT_OPTIONS_CONFIG).find(k => k.toLowerCase() === nombre.toLowerCase());
  return key ? { config: PRODUCT_OPTIONS_CONFIG[key], key } : null;
};

export default function SalonPage({ currentUser }) {
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const pedirDato = usePedirDato();
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaActual, setMesaActual] = useState(null);
  const [ticketActual, setTicketActual] = useState([]);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' | 'ticket'
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [meseroGlobal, setMeseroGlobal] = useState(currentUser?.nombre || 'Carlos');
  const [enviando, setEnviando] = useState(false);
  // Cancelación
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(LIMITE_CANCELACION_MS);

  // Modal de Autorización PIN
  const [authModal, setAuthModal] = useState({ open: false, pin: '', error: '', callback: null, promptText: '' });
  const [supervisorAprobador, setSupervisorAprobador] = useState(null);
  const [precuentaMesa, setPrecuentaMesa] = useState(null);

  // Estados de Notificación en Tiempo Real
  const prevMesasRef = useRef([]);
  const [toasts, setToasts] = useState([]);
  const [unionDropdownOpen, setUnionDropdownOpen] = useState(false);
  const [esReclamo, setEsReclamo] = useState(false);
  const [bandejaOpen, setBandejaOpen] = useState(false);
  const [servirConfirm, setServirConfirm] = useState(null); // { mesaNum, items, onConfirm }
  const [sirviendo, setSirviendo] = useState(false);

  // Al abrir la bandeja se quitan las notificaciones flotantes para que no la tapen
  const abrirBandeja = () => {
    setToasts([]);
    setBandejaOpen(true);
  };
  
  // Administración de Mesas (solo Admin/Cajero)
  const [adminMesasOpen, setAdminMesasOpen] = useState(false);

  // Modo de visualización (Tarjetas vs Compacto) y Semáforo Wi-Fi Local
  const [modoVista, setModoVista] = useState(() => localStorage.getItem('pos_vista_mozo') || 'tarjetas'); // 'tarjetas' | 'compacto'
  const [wifiStatus, setWifiStatus] = useState('online'); // 'online' | 'warning' | 'offline'

  useEffect(() => {
    const handleOnline = () => setWifiStatus('online');
    const handleOffline = () => setWifiStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkWifi = async () => {
      try {
        const start = Date.now();
        await api.getStatus();
        const latency = Date.now() - start;
        setWifiStatus(latency > 800 ? 'warning' : 'online');
      } catch (e) {
        setWifiStatus('offline');
      }
    };

    const wifiInterval = setInterval(checkWifi, 15000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(wifiInterval);
    };
  }, []);

  const toggleModoVista = () => {
    const nuevo = modoVista === 'tarjetas' ? 'compacto' : 'tarjetas';
    setModoVista(nuevo);
    localStorage.setItem('pos_vista_mozo', nuevo);
  };
  const [nuevaMesaNum, setNuevaMesaNum] = useState('');
  const [editandoMesas, setEditandoMesas] = useState({}); // { [mesaNum]: nuevoMesaNum }
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const [categoriasModalOpen, setCategoriasModalOpen] = useState(false);

  // Estados para el Modal de Opciones y Combos
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selections, setSelections] = useState({});
  const [additionalNotes, setAdditionalNotes] = useState('');

  const isFetchingMesasRef = useRef(false);

  // Cargar mesas desde el API real con semáforo contra ráfagas concurrentes
  const fetchMesas = useCallback(async () => {
    if (isFetchingMesasRef.current) return;
    isFetchingMesasRef.current = true;
    try {
      const data = await api.getMesas();
      setMesas(data);
    } catch (err) {
      // Si fue abort o timeout, evitar llenar la consola en bucle si ya es un sondeo recurrente
      if (err?.codigo !== 'TIEMPO_AGOTADO') {
        console.error('Error cargando mesas:', err);
      }
    } finally {
      isFetchingMesasRef.current = false;
      setLoading(false);
    }
  }, []);

  // Cargar productos activos desde el API real
  const fetchProductos = useCallback(async () => {
    try {
      const data = await api.getProductos();
      setProductos(data);
    } catch (err) {
      console.error('Error cargando productos:', err);
    }
  }, []);

  // Cargar usuarios para el listado de mozos
  const fetchUsuarios = useCallback(async () => {
    try {
      const data = await api.getUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  }, []);

  // Mesas abiertas por Cajero o Administrador quedan "compartidas": cualquier mozo
  // puede entrar a atenderlas y recibe sus avisos como si fueran suyas.
  const nombresRolElevado = useMemo(() => new Set(
    (usuarios || [])
      .filter(u => ['Administrador', 'Cajero'].includes(u.rol))
      .map(u => String(u.nombre || '').trim().toLowerCase())
  ), [usuarios]);
  const esMesaCompartida = useCallback(
    (meseroNombre) => nombresRolElevado.has(String(meseroNombre || '').trim().toLowerCase()),
    [nombresRolElevado]
  );

  // Mantener meseroGlobal sincronizado con currentUser si este se carga después
  useEffect(() => {
    if (currentUser?.nombre) {
      setMeseroGlobal(currentUser.nombre);
    }
  }, [currentUser]);

  // Carga inicial al montar salón
  useEffect(() => {
    fetchMesas();
    fetchProductos();
    fetchUsuarios();
  }, [fetchMesas, fetchProductos, fetchUsuarios]);

  // Sondeo en tiempo real de mesas (solo cuando la pestaña está activa para ahorrar red y evitar saturación)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchMesas();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMesas]);

  const handleUnirMesa = async (numToJoin) => {
    try {
      const res = await api.unirMesa(mesaActual.num, numToJoin);
      if (res.ok) {
        aviso.exito(`Mesa ${numToJoin} unida correctamente a la Mesa ${mesaActual.num}`);
        setUnionDropdownOpen(false);
        fetchMesas();
      } else {
        aviso.error(`Error: ${res.error}`);
      }
    } catch (err) {
      aviso.error(`Error: ${err.message}`);
    }
  };

  // Mesas unidas a una principal (solo las de ese grupo)
  const mesasUnidasA = (num) => mesas.filter(m => m.estado === `Unida a Mesa ${num}`);

  // numeroMesa opcional: separa solo esa mesa; sin él, todas las del grupo de la mesa actual
  const handleSepararMesas = async (numeroMesa = null, numPrincipal = mesaActual?.num) => {
    const grupo = mesasUnidasA(numPrincipal).map(m => m.num);
    const texto = numeroMesa != null
      ? `¿Separar la Mesa ${numeroMesa} de la Mesa ${numPrincipal}?`
      : `¿Separar ${grupo.length > 1 ? 'las mesas' : 'la mesa'} ${grupo.join(', ')} de la Mesa ${numPrincipal}?`;
    const okSep = await confirmar({
      titulo: 'Separar Mesas',
      mensaje: texto,
      textoConfirmar: 'Separar',
      peligro: true
    });
    if (okSep) {
      try {
        const res = await api.separarMesas(numPrincipal, numeroMesa);
        if (res.ok) {
          aviso.exito(res.mensaje || 'Mesas separadas con éxito');
          if (numeroMesa == null || grupo.length <= 1) setUnionDropdownOpen(false);
          fetchMesas();
        } else {
          aviso.error(res.error || 'Error al separar mesas');
        }
      } catch (err) {
        aviso.error('Error: ' + err.message);
      }
    }
  };

  const abrirModal = (m) => {
    // Si la mesa está unida a otra, informar al usuario y bloquear ingreso
    if (m.estado && m.estado.startsWith("Unida a ")) {
      const mesaPrincipalNum = parseInt(m.estado.replace("Unida a Mesa ", ""));
      // El consumo se registra en la principal; aquí solo se ofrece separar ESTA mesa del grupo
      confirmar({
        titulo: 'Mesa Unida',
        mensaje: `La Mesa ${m.num} está unida a la Mesa ${mesaPrincipalNum}. Todo el consumo se registra en la Mesa ${mesaPrincipalNum}.\n\n¿Deseas separar la Mesa ${m.num}?`,
        textoConfirmar: 'Separar Mesa',
      }).then(ok => {
        if (!ok) return;
        api.separarMesas(mesaPrincipalNum, m.num)
          .then(res => {
            if (res.ok) fetchMesas();
            else aviso.error(res.error || 'Error al separar mesa');
          })
          .catch(err => aviso.error('Error: ' + err.message));
      });
      return;
    }

    const activeMeseroName = currentUser?.nombre || meseroGlobal;

    // Si la mesa está ocupada y el mesero asignado no es el mesero global activo, y el usuario es un Mozo, bloquear acceso
    if (m.pedidoData && m.pedidoData.mesero && m.pedidoData.mesero !== activeMeseroName && currentUser?.rol === 'Mozo' && !esMesaCompartida(m.pedidoData.mesero)) {
      aviso.advertencia(`Esta mesa está siendo atendida por el Mozo "${m.pedidoData.mesero}". No puedes realizar modificaciones.`);
      return;
    }
    setMesaActual(m);
    const mesaNum = m.numero || m.num;
    let initialItems = [];
    if (m.pedidoData?.items?.length > 0) {
      initialItems = JSON.parse(JSON.stringify(m.pedidoData.items));
      // Cualquier producto ya existente en la mesa se considera comanda histórica
      // para evitar que al agregar items nuevos se reenvíen los antiguos.
      initialItems.forEach(i => i.yaEnviado = true);
    }
    // Helper para claves de borrador con retrocompatibilidad
    const draftKey = `${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`;
    const legacyDraftKey = `hernandez_draft_mesa_${mesaNum}`;

    // Recuperar borrador guardado en caché si se interrumpió la conexión o recargó la vista
    try {
      const savedDraft = localStorage.getItem(draftKey) || localStorage.getItem(legacyDraftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtrar únicamente los ítems que existen en la carta actual
          const validDraftItems = parsed.filter(draftItem => 
            productos.some(p => String(p.id) === String(draftItem.id) || p.nombre.toLowerCase() === (draftItem.nombre || '').toLowerCase())
          );
          if (validDraftItems.length > 0) {
            initialItems = [...initialItems, ...validDraftItems];
          } else {
            localStorage.removeItem(draftKey);
            localStorage.removeItem(legacyDraftKey);
          }
        }
      }
    } catch (err) {
      console.error("Error al leer borrador local:", err);
    }
    setTicketActual(initialItems);
    setCategoriaActiva('Todos');
    setSearchQuery('');
    setMobileTab('menu');
    setModalOpen(true);
  };

  // Auto-guardado en caché local del borrador de pedido en curso
  useEffect(() => {
    if (modalOpen && mesaActual) {
      const mesaNum = mesaActual.numero || mesaActual.num;
      if (mesaNum) {
        const draftKey = `${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`;
        const legacyDraftKey = `hernandez_draft_mesa_${mesaNum}`;
        const unsubmitted = ticketActual.filter(i => !i.yaEnviado);
        if (unsubmitted.length > 0) {
          localStorage.setItem(draftKey, JSON.stringify(unsubmitted));
        } else {
          localStorage.removeItem(draftKey);
          localStorage.removeItem(legacyDraftKey);
        }
      }
    }
  }, [ticketActual, modalOpen, mesaActual]);


  const isMenuProduct = (prod) => {
    if (!prod) return false;
    const cat = String(prod.categoria || '').toLowerCase();
    const nom = String(prod.nombre || '').toLowerCase();
    return cat === 'menú' || cat === 'menu' || cat.includes('menú') || cat.includes('menu') || nom.startsWith('menú') || nom.startsWith('menu');
  };

  const getProductSteps = (prod, currentSelections = {}) => {
    return getProductStepsBase(prod, currentSelections);
  };

  const getProductStepsBase = (prod, currentSelections = {}) => {
    if (!prod) return [];

    // 1. OPCIONES Y MODIFICADORES PERSONALIZADOS DEL CLIENTE (MÁXIMA PRIORIDAD)
    const pasoAcomp = pasoComplementos(prod);
    const pasosConfigurados = parsePasosOpciones(prod);
    if (pasosConfigurados.length > 0) return pasoAcomp ? [...pasosConfigurados, pasoAcomp] : pasosConfigurados;
    // Sin opciones configuradas, pero con acompañamientos: igual se abre el asistente
    if (pasoAcomp) return [pasoAcomp];

    // 2. Variantes agrupadas de carne (Tallarines Verdes)
    if (prod.esAgrupado && Array.isArray(prod.variantes)) {
      return [{
        name: "Elige la Variante de Carne",
        key: "producto_variante",
        options: prod.variantes.map(v => ({
          label: `${v.nombre.replace(/tallar[ií]n(es)?\s+verde(s)?\s*(con\s*)?/i, 'Con ')} (S/ ${v.precio.toFixed(2)})`,
          value: v
        }))
      }];
    }

    // 3. Blindaje de Carta: Si el producto fue configurado en la carta (tiene opcionesConfig)
    // o tiene requiereGuarnicion === false, NUNCA cae en los pasos demo/legacy hardcodeados.
    if ((prod.opcionesConfig !== null && prod.opcionesConfig !== undefined) || prod.requiereGuarnicion === false) {
      return [];
    }

    // 4. Categoría Menú (fallback legacy solo si requiereGuarnicion es true y no tiene opcionesConfig)
    if (isMenuProduct(prod) && prod.requiereGuarnicion && !prod.opcionesConfig) {
      return [
        {
          name: "Elige la Entrada",
          key: "entrada_menu",
          options: [
            { label: "Sopa del Día", value: "Sopa" },
            { label: "Ensalada Fresca", value: "Ensalada" },
            { label: "Papa a la Huancaína", value: "Papa a la Huancaína" },
            { label: "Omitir (Sin Entrada)", value: "Sin Entrada" }
          ]
        },
        {
          name: "Elige la Bebida",
          key: "bebida",
          options: [
            { label: "Chicha Morada (Vaso)", value: "Chicha Morada - Vaso" },
            { label: "Limonada (Vaso)", value: "Limonada - Vaso" },
            { label: "Gaseosa Chiki", value: "Gaseosa Chiki" },
            { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
          ]
        }
      ];
    }

    // 5. Combos demo (fallback legacy solo si requiereGuarnicion es true)
    const combo = getComboConfig(prod.nombre);
    if (combo && prod.requiereGuarnicion) {
      const baseSteps = [];
      const config = combo.config;
      const fondoOptions = config.fondoOptions || [];
      
      baseSteps.push({
        name: "Plato de Fondo",
        key: "fondo",
        options: fondoOptions.map(opt => ({ label: opt, value: opt }))
      });
      
      const selectedFondo = currentSelections["fondo"];
      if (selectedFondo && selectedFondo.toLowerCase().includes("pollo o carne")) {
        baseSteps.push({
          name: "Elige Proteína",
          key: "proteina",
          options: [
            { label: "Pollo", value: "Pollo" },
            { label: "Carne", value: "Carne" }
          ]
        });
      }
      
      baseSteps.push({
        name: "Sopa o Ensalada",
        key: "entrada",
        options: ["Sopa", "Ensalada"].map(opt => ({ label: opt, value: opt }))
      });

      baseSteps.push({
        name: "Elige la Bebida",
        key: "bebida",
        options: [
          { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
          { label: "Limonada - Vaso", value: "Limonada - Vaso" },
          { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
          { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
        ]
      });
      
      return baseSteps;
    }

    // 6. Categoría Combos (fallback si requiereGuarnicion es true)
    const isCombo = String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo');
    if (isCombo && prod.requiereGuarnicion) {
      return [
        {
          name: "Elige la Guarnición del Combo",
          key: "guarnicion_combo",
          options: [
            { label: "Papas Fritas", value: "Papas Fritas" },
            { label: "Arroz Chaufa", value: "Arroz Chaufa" },
            { label: "Arroz Blanco", value: "Arroz Blanco" },
            { label: "Ensalada Fresca", value: "Ensalada Fresca" }
          ]
        },
        {
          name: "Elige la Bebida del Combo",
          key: "bebida_combo",
          options: [
            { label: "Chicha Morada (Vaso)", value: "Chicha Morada" },
            { label: "Limonada (Vaso)", value: "Limonada" },
            { label: "Gaseosa Personal", value: "Gaseosa Personal" },
            { label: "Sin Bebida", value: "Sin Bebida" }
          ]
        }
      ];
    }

    // NINGÚN OTRO PLATO TIENE PREGUNTAS FORZADAS. Se agrega directo al ticket!
    return [];
  };

  const agregarAlTicket = (prod) => {
    if (!prod) return;

    const hasDynamicOptions = !!prod.opcionesConfig && (() => {
      try {
        const p = typeof prod.opcionesConfig === 'string' ? JSON.parse(prod.opcionesConfig) : prod.opcionesConfig;
        return Array.isArray(p) && p.length > 0;
      } catch { return false; }
    })();

    const isVirtualGroup = !!prod.esAgrupado;
    const traeComplementos = tieneComplementos(prod);
    const hasLegacyCombo = !prod.opcionesConfig && prod.requiereGuarnicion && !!getComboConfig(prod.nombre);
    const isLegacyMenu = !prod.opcionesConfig && prod.requiereGuarnicion && isMenuProduct(prod);
    const isLegacyCategoryCombo = !prod.opcionesConfig && prod.requiereGuarnicion && (
      String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo')
    );

    if (hasDynamicOptions || isVirtualGroup || hasLegacyCombo || isLegacyMenu || isLegacyCategoryCombo || traeComplementos) {
      const steps = getProductSteps(prod, {});
      if (steps && steps.length > 0) {
        setSelectedProduct(prod);
        setCurrentStepIdx(0);
        setSelections({});
        setAdditionalNotes('');
        setOptionsModalOpen(true);
        return;
      }
    }
    
    agregarAlTicketDirecto(prod, '');
  };

  const agregarAlTicketDirecto = (prod, notas = '', extras = null) => {
    const opcionesElegidas = extras?.opciones || [];
    const precioExtra = extras?.precioExtra || 0;
    setTicketActual(prevItems => {
      let nuevosItems = [...prevItems];
      const index = nuevosItems.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado && t.notas === notas);
      
      // Contabilizar la cantidad total de este producto en el ticket actual (evita fuga de stock con notas distintas)
      const cantTotalEnTicket = nuevosItems
        .filter(t => String(t.id) === String(prod.id) && !t.yaEnviado)
        .reduce((sum, item) => sum + item.cant, 0);
      
      if (prod.tipoStock === 'limitado' && cantTotalEnTicket >= prod.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
        return prevItems;
      }
      
      const precioBase = prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio;
      const precioFinal = precioBase + precioExtra;
      
      if (index >= 0) {
        nuevosItems[index] = {
          ...nuevosItems[index],
          cant: nuevosItems[index].cant + 1
        };
      } else {
        nuevosItems.push({ 
          id: String(prod.id), 
          nombre: prod.nombre, 
          precio: precioFinal, 
          cant: 1, 
          yaEnviado: false, 
          historial: false, 
          notas: notas,
          opciones: opcionesElegidas,
          ofertaNombre: prod.ofertaNombre || null,
          precioOriginal: prod.precio
        });
      }
      return nuevosItems;
    });
  };

  const alterarCantidad = (index, operacion) => {
    let nuevos = [...ticketActual];
    if (nuevos[index].yaEnviado) return;
    if (operacion === '+') {
      // Validar stock de nuevo si es limitado
      const prodOriginal = productos.find(p => String(p.id) === String(nuevos[index].id));
      if (prodOriginal && prodOriginal.tipoStock === 'limitado' && nuevos[index].cant >= prodOriginal.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
        return;
      }
      nuevos[index] = { ...nuevos[index], cant: nuevos[index].cant + 1 };
    } else {
      const nuevaCant = nuevos[index].cant - 1;
      if (nuevaCant <= 0) {
        nuevos.splice(index, 1);
      } else {
        nuevos[index] = { ...nuevos[index], cant: nuevaCant };
      }
    }
    setTicketActual(nuevos);
  };

  // Detector de pedidos y platos listos (Sonido + Vibración + Toast para personal de salón)
  useEffect(() => {
    if (mesas.length === 0) {
      if (prevMesasRef.current.length === 0) prevMesasRef.current = mesas;
      return;
    }
    if (prevMesasRef.current.length > 0) {
      const listasNuevas = [];
      const activeMeseroName = (currentUser?.nombre || meseroGlobal || '').trim().toLowerCase();

      // Avisar por cada plato o bebida que acaba de salir de su estación (Cocina o Barra)
      const reciénListos = [];
      mesas.forEach(m => {
        const ant = prevMesasRef.current.find(p => p.num === m.num);
        if (!ant || !m.pedidoData?.items) return;
        const mesaMesero = (m.pedidoData?.mesero || '').trim().toLowerCase();
        const esMiMesa = (!!activeMeseroName && mesaMesero === activeMeseroName) || esMesaCompartida(mesaMesero);
        const antesListos = new Set((ant.pedidoData?.items || []).filter(i => i.historial).map(i => i.itemId));

        m.pedidoData.items.forEach(i => {
          if (i.historial && !i.entregado && !antesListos.has(i.itemId)) {
            reciénListos.push({ 
              mesa: m.num, 
              nombre: i.nombre, 
              esBarra: BARRA_CATEGORIAS.includes(i.categoria),
              esMiMesa,
              mesero: m.pedidoData?.mesero || 'Salón'
            });
          }
        });
      });

      // Un Mozo solo recibe aviso flotante (y sonido) de sus propias mesas; lo demás
      // queda en la Bandeja de Despacho. Admin/Cajero siguen viendo todo el salón.
      const esRolMozo = currentUser?.rol === 'Mozo';
      const listosAvisar = reciénListos.filter(item => !esRolMozo || item.esMiMesa);

      if (listosAvisar.length > 0) {
        playChimeNotification();

        listosAvisar.slice(0, 4).forEach(item => {
          const toastId = Date.now() + Math.random();
          const tituloEstacion = item.esBarra ? '🍹 Bebida lista en BARRA' : '🍽️ Plato listo en COCINA';
          const detalleMesero = item.esMiMesa ? '⭐ ¡Tu Mesa!' : `Atiende: ${item.mesero}`;
          setToasts(prev => [...prev, {
            id: toastId,
            tipo: 'listo',
            mesa: item.mesa,
            esMiMesa: item.esMiMesa,
            mensaje: `${tituloEstacion}: ${item.nombre} · Mesa ${item.mesa} (${detalleMesero})`,
          }]);
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6500);
        });
      }

      // Avisar si la mesa completa cambió de estado Cocina -> Servido
      mesas.forEach(m => {
        const ant = prevMesasRef.current.find(p => p.num === m.num);
        if (ant && ant.estado === 'Cocina' && m.estado === 'Servido') {
          const mesaMesero = (m.pedidoData?.mesero || '').trim().toLowerCase();
          const esMiMesa = (!!activeMeseroName && mesaMesero === activeMeseroName) || esMesaCompartida(mesaMesero);
          listasNuevas.push({
            num: m.num,
            esMiMesa,
            mesero: m.pedidoData?.mesero || 'Salón'
          });
        }
      });

      const listasAvisar = listasNuevas.filter(info => !esRolMozo || info.esMiMesa);
      if (listasAvisar.length > 0) {
        playChimeNotification();
        listasAvisar.forEach(info => {
          const toastId = Date.now() + Math.random();
          const texto = info.esMiMesa 
            ? `🛎️ ¡Tu Mesa ${info.num} está lista para servir!` 
            : `🛎️ ¡Mesa ${info.num} lista para servir! (${info.mesero})`;
          setToasts(prev => [...prev, { id: toastId, tipo: 'listo', mesa: info.num, esMiMesa: info.esMiMesa, mensaje: texto }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 6500);
        });
      }
    }
    prevMesasRef.current = mesas;
  }, [mesas, meseroGlobal, currentUser, esMesaCompartida]);

  // Countdown timer para cancelación
  useEffect(() => {
    if (!modalOpen || !mesaActual?.pedidoData?.pedidoCreadoEn) return;
    const calcular = () => {
      const elapsed = Date.now() - new Date(mesaActual.pedidoData.pedidoCreadoEn).getTime();
      setTiempoRestante(Math.max(0, LIMITE_CANCELACION_MS - elapsed));
    };
    calcular();
    const interval = setInterval(calcular, 1000);
    return () => clearInterval(interval);
  }, [modalOpen, mesaActual?.pedidoData?.pedidoCreadoEn]);

  const handleCancelarPedido = async () => {
    if (!cancelMotivo.trim()) { aviso.advertencia('Por favor escribe o selecciona un motivo para la cancelación.'); return; }
    setCancelandoPedido(true);
    const mesaNum = mesaActual?.num;
    const pedidoId = mesaActual?.pedidoData?.pedidoId;
    const isForce = esReclamo || mesaActual?.estado === 'Servido';
    const motivoFinal = cancelMotivo.trim();
    const canceladoPor = supervisorAprobador ? `${supervisorAprobador.nombre} (${supervisorAprobador.rol}) | Mozo: ${meseroGlobal}` : meseroGlobal;

    // ⚡ Actualización optimista inmediata en la interfaz:
    // La mesa se muestra libre y los modales se cierran al instante sin colgar la UI del mozo
    setMesas(prev => prev.map(m => m.num === mesaNum ? { ...m, estado: 'Libre', pedidoData: null } : m));
    setCancelModal(false);
    setEsReclamo(false);
    setModalOpen(false);
    setMesaActual(null);
    setCancelMotivo('');

    try {
      const result = await api.cancelarPedido(pedidoId, {
        canceladoPor,
        motivo: motivoFinal,
        force: isForce,
      });
      if (result.error) throw new Error(result.error);
      
      await fetchMesas();
      
      if (result.mesaLiberada) {
        aviso.exito(`Pedido cancelado correctamente. Mesa ${mesaNum} ha sido liberada.`);
      } else {
        aviso.exito(`Pedido adicional cancelado correctamente. Mesa ${mesaNum} sigue activa con consumos previos.`);
      }
    } catch (err) {
      aviso.error('Error al cancelar: ' + err.message);
      fetchMesas(); // Revertir a la realidad de la BD si ocurrió error
    } finally {
      setCancelandoPedido(false);
    }
  };

  const handleCancelarItem = async (item, supervisor) => {
    const motivo = await pedirDato({
      titulo: 'Cancelar Ítem de Comanda',
      mensaje: `Motivo de anulación para "${item.nombre}":`,
      valorInicial: 'Error de digitación / plato equivocado',
      placeholder: 'Ej. Error de comanda, cliente desistió...',
      validar: (v) => v.trim() ? null : 'El motivo es obligatorio'
    });
    if (!motivo) return;

    let cant = item.cant;
    if (item.cant > 1) {
      const cantStr = await pedirDato({
        titulo: 'Cantidad a Cancelar',
        mensaje: `Cantidad a cancelar de "${item.nombre}" (Máximo ${item.cant}):`,
        valorInicial: item.cant.toString(),
        validar: (v) => {
          const n = parseInt(v, 10);
          return (!isNaN(n) && n > 0 && n <= item.cant) ? null : `Ingresa entre 1 y ${item.cant}`;
        }
      });
      if (!cantStr) return;
      cant = parseInt(cantStr, 10);
    }

    const isForce = mesaActual?.estado === 'Servido' || item.historial;
    const canceladoPor = supervisor ? `${supervisor.nombre} (${supervisor.rol})` : meseroGlobal;

    try {
      const res = await api.cancelarItemPedido(item.pedidoId, {
        productoId: item.id,
        cantidadACancelar: cant,
        motivo: motivo.trim(),
        canceladoPor: supervisor ? `${supervisor.nombre} (${supervisor.rol})` : meseroGlobal,
        force: isForce,
      });
      if (res.error) throw new Error(res.error);
      
      await fetchMesas();
      setModalOpen(false);
      
      if (res.pedidoVacio) {
        if (res.mesaLiberada) {
          aviso.exito(`Comanda anulada por completo. Mesa ${mesaActual.num} ahora está libre.`);
        } else {
          aviso.exito(`Comanda anulada por completo. Mesa ${mesaActual.num} sigue activa.`);
        }
      } else {
        aviso.exito(`Se cancelaron ${cant} unidades de "${item.nombre}" correctamente.`);
      }
    } catch (err) {
      aviso.error("Error al cancelar ítem: " + err.message);
    }
  };

  const submitAuthPin = async (pinToValidate) => {
    const pin = (pinToValidate || authModal.pin || '').trim();
    if (!pin) {
      setAuthModal(prev => ({ ...prev, error: 'Ingresa el PIN de autorización.' }));
      return;
    }
    try {
      const res = await api.validateAuth(pin);
      if (res.error) throw new Error(res.error);
      
      // Autorización exitosa! Ejecutar el callback
      if (typeof authModal.callback === 'function') {
        authModal.callback(res);
      }
      setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' });
    } catch (err) {
      setAuthModal(prev => ({ ...prev, pin: '', error: err.message || 'PIN no autorizado o incorrecto' }));
    }
  };

  const handleAuthPinKeyPress = async (num) => {
    const nuevoPin = (authModal.pin + num).slice(0, 6);
    setAuthModal(prev => ({ ...prev, pin: nuevoPin, error: '' }));
    if (nuevoPin.length === 4) {
      try {
        const res = await api.validateAuth(nuevoPin);
        if (!res.error) {
          if (typeof authModal.callback === 'function') {
            authModal.callback(res);
          }
          setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' });
          return;
        }
      } catch (e) {
        // Permitir seguir ingresando si el PIN tiene más dígitos
      }
    } else if (nuevoPin.length >= 6) {
      submitAuthPin(nuevoPin);
    }
  };

  const handleAuthPinBackspace = () => {
    setAuthModal(prev => ({ ...prev, pin: prev.pin.slice(0, -1), error: '' }));
  };

  const requestSupervisorAuth = (promptText, callback) => {
    setAuthModal({
      open: true,
      pin: '',
      error: '',
      callback,
      promptText
    });
  };

  const enviarACocina = async () => {
    const nuevosItems = ticketActual.filter(i => !i.yaEnviado);
    if (nuevosItems.length === 0) { aviso.advertencia('No has agregado ningún producto nuevo.'); return; }

    setEnviando(true);
    try {
      const totalNuevos = nuevosItems.reduce((acc, val) => acc + (val.cant * val.precio), 0);
      const esAdicional = mesaActual.pedidoData?.items?.length > 0;

      const mesaNum = mesaActual.numero || mesaActual.num;
      await api.enviarACocina(mesaNum, {
        mesero: meseroGlobal,
        items: nuevosItems, // Enviamos UNICAMENTE los nuevos items añadidos
        total: totalNuevos, // Enviamos el total del pedido adicional específico
        adicional: esAdicional,
      });

      if (mesaNum) {
        localStorage.removeItem(`${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`);
        localStorage.removeItem(`hernandez_draft_mesa_${mesaNum}`);
      }
      setModalOpen(false);
      await fetchMesas();

      // Feedback visual inmediato para el mozo
      const toastId = Date.now() + Math.random();
      setToasts(prev => [...prev, {
        id: toastId,
        mesa: mesaNum,
        mensaje: `✅ ¡Comanda de Mesa ${mesaNum} enviada a Cocina!`
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 4000);
    } catch (err) {
      aviso.error('Error al enviar a cocina: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleCrearMesa = async (e) => {
    e.preventDefault();
    if (!nuevaMesaNum.trim()) return;
    const num = parseInt(nuevaMesaNum);
    if (isNaN(num) || num <= 0) {
      aviso.advertencia("El número de mesa debe ser un entero positivo.");
      return;
    }
    try {
      const res = await api.crearMesa({ numero: num });
      if (res.error) throw new Error(res.error);
      setNuevaMesaNum('');
      await fetchMesas();
    } catch (err) {
      aviso.error(`Error al crear mesa: ${err.message}`);
    }
  };

  const handleEditarMesa = async (numeroActual) => {
    const nuevoNumRaw = editandoMesas[numeroActual];
    if (!nuevoNumRaw || !nuevoNumRaw.trim()) return;
    const nuevoNum = parseInt(nuevoNumRaw);
    if (isNaN(nuevoNum) || nuevoNum <= 0) {
      aviso.advertencia("El número de mesa debe ser un entero positivo.");
      return;
    }
    try {
      const res = await api.editarMesa(numeroActual, { nuevoNumero: nuevoNum });
      if (res.error) throw new Error(res.error);
      setEditandoMesas(prev => {
        const copy = { ...prev };
        delete copy[numeroActual];
        return copy;
      });
      await fetchMesas();
      aviso.exito(`Mesa ${numeroActual} modificada a Mesa ${nuevoNum} con éxito.`);
    } catch (err) {
      aviso.error(`Error al modificar mesa: ${err.message}`);
    }
  };

  const handleEliminarMesa = async (numero) => {
    const okDel = await confirmar({
      titulo: 'Eliminar Mesa',
      mensaje: `¿Estás seguro de que deseas eliminar la Mesa ${numero}? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar Mesa',
      peligro: true
    });
    if (!okDel) return;
    try {
      const res = await api.eliminarMesa(numero);
      if (res.error) throw new Error(res.error);
      await fetchMesas();
      aviso.exito(`Mesa ${numero} eliminada`);
    } catch (err) {
      aviso.error(`Error al eliminar mesa: ${err.message}`);
    }
  };

  // Top 8 productos con mayor rotación / más pedidos
  const topProductosIds = productos
    .filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas')
    .slice(0, 8)
    .map(p => p.id);

  const menuFiltradoPre = productos.filter(p => {
    if (p.categoria === 'PedidosYa / Ofertas') return false;
    if (categoriaActiva === '🔥 Más Pedidos') {
      return topProductosIds.includes(p.id) && matchProductSemantic(p, searchQuery);
    }
    if (categoriaActiva !== 'Todos' && p.categoria !== categoriaActiva) return false;
    return matchProductSemantic(p, searchQuery);
  });

  const agruparProductos = (items) => {
    const list = [];
    const esTallarin = (p) => p.categoria === 'Tallarines Verdes' || (p.nombre && /tallar[ií]n(es)?\s+verde(s)?/i.test(p.nombre));
    const tallarines = items.filter(esTallarin);
    const otros = items.filter(p => !esTallarin(p));
    
    if (tallarines.length > 1) {
      const ordenados = [...tallarines].sort((a, b) => a.precio - b.precio);
      list.push({
        id: 'group_tallarines_verdes',
        nombre: 'Tallarines Verdes (Variantes)',
        categoria: ordenados[0].categoria || 'Pastas y Tallarines',
        precioMin: ordenados[0].precio,
        precioMax: ordenados[ordenados.length - 1].precio,
        esAgrupado: true,
        variantes: tallarines,
        tipoStock: 'ilimitado',
        stock: 0,
        activo: true
      });
    } else if (tallarines.length === 1) {
      list.push(tallarines[0]);
    }
    
    return [...list, ...otros];
  };

  const menuAgrupado = agruparProductos(menuFiltradoPre);
  const menuFiltrado = searchQuery.trim()
    ? [...menuAgrupado].sort((a, b) => relevanciaBusqueda(a, searchQuery) - relevanciaBusqueda(b, searchQuery))
    : menuAgrupado;

  const categoriasOrdenadas = ordenarCategorias(
    ['🔥 Más Pedidos', 'Todos', ...new Set(productos.filter(p => p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))],
    ORDEN_PRIORIDADES_CATEGORIAS
  );
  // En el celular deslizar la barra era incómodo: solo se muestran unas pocas
  // (más la seleccionada) y el resto se abre en la ventana "Ver todas".
  const CATEGORIAS_VISIBLES = 5;
  const categoriasBarra = categoriasOrdenadas.slice(0, CATEGORIAS_VISIBLES);
  if (!categoriasBarra.includes(categoriaActiva) && categoriasOrdenadas.includes(categoriaActiva)) {
    categoriasBarra.push(categoriaActiva);
  }
  const contarProductosCategoria = (cat) => {
    if (cat === '🔥 Más Pedidos') return topProductosIds.length;
    return productos.filter(p => p.categoria !== 'PedidosYa / Ofertas' && (cat === 'Todos' || p.categoria === cat)).length;
  };

  // Cierra el teclado del celular al tocar cualquier parte fuera del buscador
  const cerrarTecladoSiTocaFuera = (e) => {
    const input = searchInputRef.current;
    if (input && document.activeElement === input && !input.contains(e.target)) input.blur();
  };
  const totalTicket = ticketActual.reduce((acc, item) => acc + (item.cant * item.precio), 0);
  const badgeEstado = mesaActual?.estado === 'Servido' && ticketActual.length > 0
    ? 'text-blue-700 bg-blue-100' : (ticketActual.length > 0 ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100');
  const badgeTexto = mesaActual?.estado === 'Servido' && ticketActual.length > 0
    ? '+ ADICIONAL' : (ticketActual.length > 0 ? 'Editando Pedido' : 'Nueva Orden');

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando mesas...</p>
      </div>
    </div>
  );

  const activeMeseroName = (currentUser?.nombre || meseroGlobal || '').trim().toLowerCase();
  const isElevatedRole = ['Administrador', 'Cajero'].includes(currentUser?.rol);

  const platosListosDespacho = mesas.flatMap(m => {
    if (!m.pedidoData || !m.pedidoData.items) return [];
    
    const mesaMesero = (m.pedidoData.mesero || '').trim().toLowerCase();
    const esMiMesa = !activeMeseroName || mesaMesero === activeMeseroName || esMesaCompartida(mesaMesero);

    // Listo para llevar a la mesa: lo despachado por cocina y también por barra
    const itemsListos = m.pedidoData.items.filter(i => i.historial && !i.entregado);

    return itemsListos.map(item => ({
      ...item,
      mesaNum: m.num,
      mesero: m.pedidoData.mesero,
      esMiMesa,
      pedidoId: item.pedidoId,
      estacion: BARRA_CATEGORIAS.includes(item.categoria) ? 'Barra' : 'Cocina',
    }));
  });

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Atención en Salón</h1>
            <p className="text-xs md:text-sm text-slate-500">Toca una mesa para tomar, editar o agregar un pedido adicional.</p>
          </div>
          {isElevatedRole && (
            <button
              onClick={() => {
                const nums = mesas.map(m => m.num).filter(n => !isNaN(n));
                const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
                setNuevaMesaNum(String(maxNum + 1));
                setAdminMesasOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-black text-[10px] md:text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all uppercase tracking-wider shrink-0"
            >
              ⚙️ Ajustes de Mesas
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Libre</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div> Cocina</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> Platos Listos</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Servido</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Sync BD Activo
          </div>
          {/* Semáforo Wi-Fi Local */}
          {wifiStatus === 'online' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap" title="Conexión Wi-Fi excelente con el servidor local">
              <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">Wi-Fi OK</span>
            </div>
          )}
          {wifiStatus === 'warning' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-700 uppercase bg-amber-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm whitespace-nowrap" title="Señal Wi-Fi inestable o lenta">
              <Wifi className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>Wi-Fi Lento</span>
            </div>
          )}
          {wifiStatus === 'offline' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-red-700 uppercase bg-red-100 px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-300 shadow-sm whitespace-nowrap animate-bounce" title="Sin señal Wi-Fi. Acércate a la barra">
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span>Sin Wi-Fi</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid-mesas-dinamico gap-3 md:gap-5 pb-20 md:pb-0">
        {mesas.map((m, idx) => {
          const esMiMesa = m.pedidoData?.mesero === activeMeseroName || isElevatedRole || esMesaCompartida(m.pedidoData?.mesero);
          const tieneListos = esMiMesa && (m.pedidoData?.items?.some(i => 
            i.historial && 
            !i.entregado
          ) || false);

          let colorBg = 'bg-white hover:bg-emerald-50', colorText = 'text-emerald-500', colorBorder = 'border-slate-200', Icon = Receipt;
          
          if (tieneListos) {
            colorBg = 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-400 shadow-lg';
            colorText = 'text-indigo-600';
            colorBorder = 'border-indigo-400';
            Icon = Bell;
          } else if (m.estado === 'Cocina') { 
            colorBg = 'bg-amber-50'; colorText = 'text-cyan-500'; colorBorder = 'border-amber-300 shadow-md'; Icon = ChefHat; 
          } else if (m.estado === 'Servido') { 
            colorBg = 'bg-blue-50'; colorText = 'text-blue-500'; colorBorder = 'border-blue-300 shadow-md'; Icon = CheckCircle; 
          } else if (m.estado && m.estado.startsWith("Unida a ")) {
            colorBg = 'bg-slate-50/70 border-dashed opacity-80'; colorText = 'text-slate-400'; colorBorder = 'border-slate-300 border-dashed'; Icon = Link2;
          }

          return (
            <div key={idx} onClick={() => abrirModal(m)} className={`relative rounded-2xl md:rounded-3xl border-2 ${colorBorder} ${colorBg} p-3 md:p-5 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 hover:-translate-y-1 aspect-square md:aspect-auto md:h-40 group`}>
              {tieneListos && (
                <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1.5 animate-bounce shadow-md" title="¡Platos listos en cocina!">
                  <Bell className="w-3.5 h-3.5 animate-ring" />
                </div>
              )}
              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center ${colorText} mb-1 md:mb-2 bg-white shadow-sm border border-slate-100`}>
                <Icon className="w-4 h-4 md:w-6 md:h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-sm md:text-lg uppercase tracking-tight">Mesa {m.num}</h3>
              {m.estado && m.estado.startsWith("Unida a ") ? (
                <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full mt-1.5">
                  🔗 {m.estado}
                </span>
              ) : null}
              {!(m.estado && m.estado.startsWith("Unida a ")) && mesasUnidasA(m.num).length > 0 && (
                <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full" title="Mesas unidas a esta">
                  🔗 +{mesasUnidasA(m.num).map(u => u.num).join(', ')}
                </span>
              )}
              {m.estado && m.estado.startsWith("Unida a ") ? null : m.pedidoData ? (
                <div className="flex flex-col items-center">
                  <p className="font-mono font-black text-sm md:text-lg mt-1 text-slate-800">S/ {m.pedidoData.total.toFixed(2)}</p>
                  <span className="text-[8px] md:text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1.5 uppercase truncate max-w-[110px] text-center">
                    👤 {m.pedidoData.mesero}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] md:text-xs mt-1 text-slate-400 font-medium">Disponible</p>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL PRINCIPAL DE PEDIDO DE MESA (PUNTOS 13 Y 23) */}
      <ModalPedidoMesa
        abierto={modalOpen && !!mesaActual}
        mesa={mesaActual}
        currentUser={currentUser}
        meseroGlobal={meseroGlobal}
        cerrarTecladoSiTocaFuera={cerrarTecladoSiTocaFuera}
        onCerrar={() => setModalOpen(false)}
        onAbrirUnion={() => setUnionDropdownOpen(true)}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        menuFiltrado={menuFiltrado}
        ticketActual={ticketActual}
        totalTicket={totalTicket}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        modoVista={modoVista}
        toggleModoVista={toggleModoVista}
        categoriaActiva={categoriaActiva}
        setCategoriaActiva={setCategoriaActiva}
        categoriasBarra={categoriasBarra}
        categoriasOrdenadas={categoriasOrdenadas}
        categoriasVisiblesCount={CATEGORIAS_VISIBLES}
        onAbrirCategoriasModal={() => setCategoriasModalOpen(true)}
        agregarAlTicket={agregarAlTicket}
        alterarCantidad={alterarCantidad}
        badgeEstado={badgeEstado}
        badgeTexto={badgeTexto}
        productos={productos}
        requestSupervisorAuth={requestSupervisorAuth}
        handleCancelarItem={handleCancelarItem}
        setTicketActual={setTicketActual}
        api={api}
        aviso={aviso}
        setSupervisorAprobador={setSupervisorAprobador}
        setEsReclamo={setEsReclamo}
        setCancelModal={setCancelModal}
        setPrecuentaMesa={setPrecuentaMesa}
        confirmar={confirmar}
        enviarACocina={enviarACocina}
        enviando={enviando}
      />

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      <ModalCancelarPedido
        abierto={cancelModal}
        mesa={mesaActual}
        mesero={meseroGlobal}
        motivo={cancelMotivo}
        onMotivoChange={setCancelMotivo}
        onCerrar={() => { setCancelModal(false); setCancelMotivo(''); }}
        onConfirmar={handleCancelarPedido}
        cancelando={cancelandoPedido}
      />

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO) */}
      <ModalOpcionesProducto
        abierto={optionsModalOpen && !!selectedProduct}
        producto={selectedProduct}
        onCerrar={() => {
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirmarItem={(item, notas, extras) => {
          agregarItemDirecto(item, notas, extras);
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        getProductSteps={getProductSteps}
      />

      {/* MODAL DE AUTORIZACIÓN POR PIN (SUPERVISOR) */}
      <ModalAutorizacionPin
        abierto={authModal.open}
        promptText={authModal.promptText}
        pin={authModal.pin}
        error={authModal.error}
        onPinChange={(val) => setAuthModal(prev => ({ ...prev, pin: val, error: '' }))}
        onCerrar={() => setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' })}
        onSubmit={(pin) => submitAuthPin(pin)}
      />

      {/* UNION DE MESAS COMPONENTE DIALOG */}
      <ModalUnionMesas
        abierto={unionDropdownOpen && !!mesaActual}
        mesaActual={mesaActual}
        mesas={mesas}
        mesasUnidas={mesaActual ? mesasUnidasA(mesaActual.num) : []}
        onCerrar={() => setUnionDropdownOpen(false)}
        onUnirMesa={(num) => handleUnirMesa(num)}
        onSepararMesas={(num) => handleSepararMesas(num)}
      />

      {/* MODAL: TODAS LAS CATEGORÍAS */}
      <ModalTodasCategoriasSalon
        abierto={categoriasModalOpen}
        onCerrar={() => setCategoriasModalOpen(false)}
        categorias={categoriasOrdenadas}
        categoriaActiva={categoriaActiva}
        onSeleccionar={(cat) => {
          setCategoriaActiva(cat);
          setCategoriasModalOpen(false);
        }}
        contarProductos={contarProductosCategoria}
      />

      {!modalOpen && !optionsModalOpen && !cancelModal && !authModal.open && (
      <button
        onClick={abrirBandeja}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[220] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm p-3 md:px-4 md:py-3 rounded-2xl shadow-2xl transition-all active:scale-95 hover:-translate-y-1 uppercase tracking-wider border border-indigo-500/30"
      >
        <Bell className={`w-5 h-5 ${platosListosDespacho.length > 0 ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">Bandeja de Despacho</span>
        {platosListosDespacho.length > 0 ? (
          <span className="bg-red-500 text-white font-black text-xs px-2 py-0.5 rounded-full border border-white shadow ml-1 animate-pulse">
            {platosListosDespacho.length}
          </span>
        ) : (
          <span className="bg-indigo-800 text-indigo-200 text-[10px] px-1.5 py-0.5 rounded-full ml-1">0</span>
        )}
      </button>
      )}

      {/* DRAWER / BANDEJA DE DESPACHO Y CONFIRMACIÓN DE ENTREGA */}
      <DrawerBandejaDespacho
        abierto={bandejaOpen}
        onCerrar={() => setBandejaOpen(false)}
        platosListosDespacho={platosListosDespacho}
        servirConfirm={servirConfirm}
        setServirConfirm={setServirConfirm}
        sirviendo={sirviendo}
        setSirviendo={setSirviendo}
        api={api}
        fetchMesas={fetchMesas}
        aviso={aviso}
      />

      {/* MODAL DE ADMINISTRACIÓN DE MESAS */}
      <ModalAdminMesas
        abierto={adminMesasOpen}
        onCerrar={() => setAdminMesasOpen(false)}
        handleCrearMesa={handleCrearMesa}
        nuevaMesaNum={nuevaMesaNum}
        setNuevaMesaNum={setNuevaMesaNum}
        mesas={mesas}
        editandoMesas={editandoMesas}
        setEditandoMesas={setEditandoMesas}
        handleEditarMesa={handleEditarMesa}
        handleEliminarMesa={handleEliminarMesa}
      />

      {/* MODAL DE PRECUENTA DE MESA (IMPRESIÓN) */}
      <ModalPrecuentaMesa
        mesa={precuentaMesa}
        onCerrar={() => setPrecuentaMesa(null)}
        currentUser={currentUser}
        meseroGlobal={meseroGlobal}
      />

      <style>{`
        .grid-mesas-dinamico {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }
        @media (max-width: 640px) {
          .grid-mesas-dinamico {
            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
          }
        }
        .animate-slide-left { animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-ring { animation: ring 1.5s ease-in-out infinite; }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-10deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(0); }
          100% { transform: rotate(0); }
        }

        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          /* Ocultar elementos de navegación y fondos */
          aside, header, #sidebar-menu, #sidebar-backdrop, button, nav, .no-print {
            display: none !important;
          }
          /* Ocultar el resto del contenido de la página excepto el modal a imprimir */
          main > *:not(section),
          section > *:not(#precuenta-print-container) {
            display: none !important;
          }
          /* Garantizar que el body y contenedores no tengan alturas fijas o desbordamientos */
          html, body, #root, main, section {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: auto !important;
          }
          /* Formatear el contenedor del ticket en 74mm en la esquina superior izquierda */
          #precuenta-print-container {
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
          #precuenta-print-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #precuenta-print-container div.bg-slate-950, 
          #precuenta-print-container div.shrink-0 {
            display: none !important;
          }
          #precuenta-ticket-print {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #precuenta-ticket-print * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #precuenta-ticket-print div {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </section>
  );
}
