import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, CheckCircle, PlusCircle, Receipt, X, Edit3, ShoppingBag, User, AlertTriangle, Clock, Trash, Lock, Tag, Percent, Link2, Bell, Settings, Plus, Utensils, Save, Trash2, Search, Check, ChevronRight, Wifi, WifiOff, LayoutGrid, List, Sparkles, Flame, Minus } from 'lucide-react';
import { api } from '../api';
import { parsePasosOpciones, resolverSeleccion, pasoComplementos, resolverComplementos, tieneComplementos } from '../utils/combos';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS, ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';

const LIMITE_CANCELACION_MS = 5 * 60 * 1000;

// --- SISTEMA DE BÚSQUEDA INTELIGENTE Y FONÉTICA ---
const SINONIMOS = {
  gaseosa: ['cola', 'inca', 'coca', 'refresco', 'sprite', 'fanta', 'gaseosa'],
  bebida: ['chicha', 'limonada', 'gaseosa', 'cerveza', 'pisco', 'trago', 'coctel', 'jugo', 'agua'],
  chela: ['cerveza', 'cristal', 'pilsen', 'cusquena'],
  papas: ['papa', 'patata', 'fritas'],
  carne: ['lomo', 'bife', 'parrilla', 'anticucho', 'res', 'corte'],
  pollo: ['brasa', 'broaster', 'alitas', 'pechuga'],
  piqueo: ['entrada', 'porcion', 'tequenos', 'salchipapa'],
  "1/8": ['octavo', 'octavos', '1/8', 'un octavo'],
  "1/4": ['cuarto', 'cuartos', '1/4', 'un cuarto'],
  "1/2": ['medio', 'medios', '1/2', 'un medio', 'mitad'],
  entero: ['entero', 'completo', 'pollo entero', '1', 'uno']
};

const normalizePhonetic = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-z0-9]/g, " ")      // remover caracteres especiales
    .replace(/ch/g, "x")            // ch -> x
    .replace(/ll/g, "y")            // ll -> y
    .replace(/z/g, "s")             // z -> s
    .replace(/c([ei])/g, "s$1")      // ce, ci -> se, si
    .replace(/h/g, "")              // h muda
    .replace(/b/g, "v")              // b -> v equivalencia
    .replace(/k/g, "c")              // k -> c
    .replace(/q/g, "c")              // q -> c
    .replace(/\s+/g, " ")
    .trim();
};

const matchProductSemantic = (prod, query) => {
  if (!query) return true;
  const cleanQuery = query.toLowerCase().trim();
  const queryTokens = cleanQuery.split(/\s+/);
  
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const cleanProdCat = (prod.categoria || '').toLowerCase();
  
  const phoneticName = normalizePhonetic(prod.nombre);
  const phoneticCat = normalizePhonetic(prod.categoria);
  
  return queryTokens.every(qToken => {
    // 1. Coincidencia directa simple
    if (cleanProdName.includes(qToken) || cleanProdCat.includes(qToken)) return true;
    
    // 2. Coincidencia fonética
    const phoneticToken = normalizePhonetic(qToken);
    if (phoneticName.includes(phoneticToken) || phoneticCat.includes(phoneticToken)) return true;
    
    for (const [key, syns] of Object.entries(SINONIMOS)) {
      const tokenMatchesSyn = (key === qToken) || syns.some(syn => syn === qToken || normalizePhonetic(syn) === phoneticToken);
      if (tokenMatchesSyn) {
        const prodHasKeyOrSyn = cleanProdName.includes(key) || syns.some(syn => cleanProdName.includes(syn));
        if (prodHasKeyOrSyn) {
          return true;
        }
      }
    }
    
    return false;
  });
};


const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

function formatCuentaRegresiva(ms) {
  const seg = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  return `${min}:${s.toString().padStart(2, '0')}`;
}

// Sintetizador Web Audio API de Campana de Restaurante Premium (G5 -> C6)
function playChimeNotification() {
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch('/api/status', { signal: controller.signal });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        if (res.ok) {
          setWifiStatus(latency > 800 ? 'warning' : 'online');
        } else {
          setWifiStatus('warning');
        }
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

  // Estados para el Modal de Opciones y Combos
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selections, setSelections] = useState({});
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Cargar mesas desde el API real
  const fetchMesas = useCallback(async () => {
    try {
      const data = await api.getMesas();
      setMesas(data);
    } catch (err) {
      console.error('Error cargando mesas:', err);
    } finally {
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

  // Mantener meseroGlobal sincronizado con currentUser si este se carga después
  useEffect(() => {
    if (currentUser?.nombre) {
      setMeseroGlobal(currentUser.nombre);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchMesas();
    fetchProductos();
    fetchUsuarios();
    // Sincronización en tiempo real cada 3 segundos (sincroniza mesas y productos para ofertas en vivo)
    const interval = setInterval(() => {
      fetchProductos(); // <-- Traer productos para actualizar ofertas en tiempo real
      if (!modalOpen) {
        fetchMesas();
        fetchUsuarios();
      } else {
        // Si el modal está abierto, seguimos actualizando las mesas en segundo plano
        fetchMesas();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchMesas, fetchProductos, fetchUsuarios, modalOpen]);

  const handleUnirMesa = async (numToJoin) => {
    try {
      const res = await api.unirMesa(mesaActual.num, numToJoin);
      if (res.ok) {
        alert(`✅ Mesa ${numToJoin} unida correctamente a la Mesa ${mesaActual.num}.`);
        setUnionDropdownOpen(false);
        fetchMesas();
      } else {
        alert(`❌ Error: ${res.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleSepararMesas = async () => {
    if (confirm(`⚠️ ¿Estás seguro de separar todas las mesas unidas a la Mesa ${mesaActual.num}?`)) {
      try {
        const res = await api.separarMesas(mesaActual.num);
        if (res.ok) {
          alert(`✅ Mesas separadas con éxito.`);
          setUnionDropdownOpen(false);
          fetchMesas();
        } else {
          alert(`❌ Error: ${res.error}`);
        }
      } catch (err) {
        alert(`❌ Error: ${err.message}`);
      }
    }
  };

  const abrirModal = (m) => {
    // Si la mesa está unida a otra, informar al usuario y bloquear ingreso
    if (m.estado && m.estado.startsWith("Unida a ")) {
      const mesaPrincipalNum = m.estado.replace("Unida a Mesa ", "");
      alert(`⚠️ Esta mesa está UNIDA a la Mesa ${mesaPrincipalNum}. Todo el consumo y pedidos se registran directamente en la Mesa ${mesaPrincipalNum}.`);
      return;
    }

    const activeMeseroName = currentUser?.nombre || meseroGlobal;

    // Si la mesa está ocupada y el mesero asignado no es el mesero global activo, y el usuario es un Mozo, bloquear acceso
    if (m.pedidoData && m.pedidoData.mesero && m.pedidoData.mesero !== activeMeseroName && currentUser?.rol === 'Mozo') {
      alert(`⚠️ Esta mesa está ocupada y está siendo atendida por el Mozo "${m.pedidoData.mesero}". No puedes ingresar ni realizar modificaciones.`);
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

    // 3. Si el plato NO requiere guarnición explícitamente, NO genera pasos forzados. Directo al ticket!
    if (prod.requiereGuarnicion === false && !prod.opcionesConfig) {
      return [];
    }

    // 4. Categoría Menú (fallback legacy solo si requiereGuarnicion es true)
    if (isMenuProduct(prod) && prod.requiereGuarnicion) {
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
        alert(`⚠️ Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
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
        alert(`⚠️ Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
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

  // Detector de mesas listas para el mesero activo (Sonido + Toast)
  useEffect(() => {
    if (mesas.length === 0) {
      if (prevMesasRef.current.length === 0) prevMesasRef.current = mesas;
      return;
    }
    if (prevMesasRef.current.length > 0) {
      const listasNuevas = [];
      const activeMeseroName = currentUser?.nombre || meseroGlobal;

      // Avisar por cada plato o bebida que acaba de salir de su estación
      const reciénListos = [];
      mesas.forEach(m => {
        const ant = prevMesasRef.current.find(p => p.num === m.num);
        if (!ant || !m.pedidoData?.items) return;
        const esMiMesa = m.pedidoData?.mesero === activeMeseroName || ['Administrador', 'Cajero'].includes(currentUser?.rol);
        if (!esMiMesa) return;
        const antesListos = new Set((ant.pedidoData?.items || []).filter(i => i.historial).map(i => i.itemId));
        m.pedidoData.items.forEach(i => {
          if (i.historial && !i.entregado && !antesListos.has(i.itemId)) {
            reciénListos.push({ mesa: m.num, nombre: i.nombre, esBarra: BARRA_CATEGORIAS.includes(i.categoria) });
          }
        });
      });
      if (reciénListos.length > 0) {
        playChimeNotification();
        reciénListos.slice(0, 4).forEach(item => {
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, {
            id: toastId,
            mesa: item.mesa,
            mensaje: `${item.esBarra ? '🍹 Bebida lista en BARRA' : '🍽️ Plato listo en COCINA'}: ${item.nombre} · Mesa ${item.mesa}`,
          }]);
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6000);
        });
      }

      mesas.forEach(m => {
        const ant = prevMesasRef.current.find(p => p.num === m.num);
        if (ant && ant.estado === 'Cocina' && m.estado === 'Servido') {
          // Si corresponde a mi mesa, o si soy Administrador/Cajero, me alerta
          const esMiMesa = m.pedidoData?.mesero === activeMeseroName || ['Administrador', 'Cajero'].includes(currentUser?.rol);
          if (esMiMesa) {
            listasNuevas.push(m.num);
          }
        }
      });
      if (listasNuevas.length > 0) {
        playChimeNotification();
        listasNuevas.forEach(num => {
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, { id: toastId, mesa: num, mensaje: `🛎️ ¡Mesa ${num} lista para servir!` }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 6000);
        });
      }
    }
    prevMesasRef.current = mesas;
  }, [mesas, meseroGlobal, currentUser]);

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
    if (!cancelMotivo.trim()) { alert('Por favor escribe un motivo para la cancelación.'); return; }
    setCancelandoPedido(true);
    try {
      const pedidoId = mesaActual.pedidoData.pedidoId;
      const isForce = esReclamo || mesaActual.estado === 'Servido';
      const result = await api.cancelarPedido(pedidoId, {
        canceladoPor: supervisorAprobador ? `${supervisorAprobador.nombre} (${supervisorAprobador.rol}) | Mozo: ${meseroGlobal}` : meseroGlobal,
        motivo: cancelMotivo.trim(),
        force: isForce,
      });
      if (result.error) throw new Error(result.error);
      setCancelModal(false);
      setEsReclamo(false);
      setModalOpen(false);
      const mesaNum = mesaActual.num;
      setMesaActual(null);
      setCancelMotivo('');
      await fetchMesas();
      
      if (result.mesaLiberada) {
        alert(`✅ Pedido cancelado correctamente. Mesa ${mesaNum} ha sido liberada.`);
      } else {
        alert(`✅ Pedido adicional cancelado correctamente. La mesa ${mesaNum} sigue activa con consumos previos.`);
      }
    } catch (err) {
      alert('Error al cancelar: ' + err.message);
    } finally {
      setCancelandoPedido(false);
    }
  };

  const handleCancelarItem = async (item, supervisor) => {
    const motivo = prompt(`Escribe el motivo de cancelación para ${item.nombre}:`);
    if (motivo === null) return;
    if (!motivo.trim()) { alert("El motivo de cancelación es obligatorio."); return; }
    
    const cantStr = prompt(`Cantidad a cancelar (Máximo ${item.cant}):`, item.cant.toString());
    if (cantStr === null) return;
    const cant = parseInt(cantStr);
    if (isNaN(cant) || cant <= 0 || cant > item.cant) { alert("Cantidad no válida."); return; }

    const isForce = mesaActual.estado === 'Servido' || item.historial;

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
          alert(`✅ Comanda anulada por completo. Mesa ${mesaActual.num} ahora está LIBRE.`);
        } else {
          alert(`✅ Comanda anulada por completo. La mesa ${mesaActual.num} sigue activa con consumos previos.`);
        }
      } else {
        alert(`✅ Se cancelaron ${cant} unidades de "${item.nombre}" correctamente.`);
      }
    } catch (err) {
      alert("Error al cancelar ítem: " + err.message);
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
    if (nuevosItems.length === 0) { alert('No has agregado ningún producto nuevo.'); return; }

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
      alert('Error al enviar a cocina: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleCrearMesa = async (e) => {
    e.preventDefault();
    if (!nuevaMesaNum.trim()) return;
    const num = parseInt(nuevaMesaNum);
    if (isNaN(num) || num <= 0) {
      alert("El número de mesa debe ser un entero positivo.");
      return;
    }
    try {
      const res = await api.crearMesa({ numero: num });
      if (res.error) throw new Error(res.error);
      setNuevaMesaNum('');
      await fetchMesas();
    } catch (err) {
      alert(`Error al crear mesa: ${err.message}`);
    }
  };

  const handleEditarMesa = async (numeroActual) => {
    const nuevoNumRaw = editandoMesas[numeroActual];
    if (!nuevoNumRaw || !nuevoNumRaw.trim()) return;
    const nuevoNum = parseInt(nuevoNumRaw);
    if (isNaN(nuevoNum) || nuevoNum <= 0) {
      alert("El número de mesa debe ser un entero positivo.");
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
      alert(`✅ Mesa ${numeroActual} modificada a Mesa ${nuevoNum} con éxito.`);
    } catch (err) {
      alert(`Error al modificar mesa: ${err.message}`);
    }
  };

  const handleEliminarMesa = async (numero) => {
    if (!confirm(`⚠️ ¿Estás seguro de que deseas eliminar la Mesa ${numero}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await api.eliminarMesa(numero);
      if (res.error) throw new Error(res.error);
      await fetchMesas();
    } catch (err) {
      alert(`Error al eliminar mesa: ${err.message}`);
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

  const menuFiltrado = agruparProductos(menuFiltradoPre);
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

  const activeMeseroName = currentUser?.nombre || meseroGlobal;
  const isElevatedRole = ['Administrador', 'Cajero'].includes(currentUser?.rol);

  const platosListosDespacho = mesas.flatMap(m => {
    if (!m.pedidoData || !m.pedidoData.items) return [];
    
    const esMiMesa = m.pedidoData.mesero === activeMeseroName || isElevatedRole;
    if (!esMiMesa) return [];

    // Listo para llevar a la mesa: lo despachado por cocina y también por barra
    const itemsListos = m.pedidoData.items.filter(i => i.historial && !i.entregado);

    return itemsListos.map(item => ({
      ...item,
      mesaNum: m.num,
      mesero: m.pedidoData.mesero,
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
          const esMiMesa = m.pedidoData?.mesero === activeMeseroName || isElevatedRole;
          const tieneListos = esMiMesa && (m.pedidoData?.items?.some(i => 
            i.historial && 
            !i.entregado && 
            !BARRA_CATEGORIAS.includes(i.categoria)
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
              ) : m.pedidoData ? (
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

      {modalOpen && mesaActual && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[90vh] max-w-6xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-3 md:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500 rounded-lg md:rounded-xl flex items-center justify-center text-slate-900"><Edit3 className="w-4 h-4 md:w-5 md:h-5" /></div>
                <div>
                  <h2 className="font-black text-sm md:text-lg uppercase tracking-tight leading-none">Mesa <span className="text-amber-400 text-lg md:text-xl">{mesaActual.num}</span></h2>
                  <p className="text-[10px] md:text-xs text-slate-400">Punto de Venta</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setUnionDropdownOpen(true)}
                  className="flex items-center gap-1.5 bg-cyan-500 hover:bg-amber-600 active:scale-95 text-slate-955 font-black text-[10px] md:text-xs px-3 py-2 rounded-xl shadow-md transition-all uppercase tracking-wider"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Unir Mesa
                </button>
                <div className="hidden md:flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-350 text-xs font-bold font-mono">
                  <User className="w-3.5 h-3.5 text-cyan-500" />
                  <span>MOZO: <strong className="text-white uppercase">{currentUser?.nombre || meseroGlobal}</strong></span>
                </div>
                <button onClick={() => setModalOpen(false)} className="bg-slate-800 hover:bg-red-500 text-slate-300 hover:text-white p-2 md:p-2.5 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Pestañas de alternancia rápida solo en móviles */}
            <div className="md:hidden flex bg-slate-200 p-1 rounded-2xl mx-3 mt-2 mb-1 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('menu')}
                className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'menu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                Carta ({menuFiltrado.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('ticket')}
                className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mobileTab === 'ticket' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Comanda ({ticketActual.reduce((acc, item) => acc + item.cant, 0)}) · S/ {totalTicket.toFixed(2)}
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-slate-50">
              <div className={`w-full md:w-3/5 flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-200 ${mobileTab === 'menu' ? 'flex flex-1' : 'hidden md:flex'}`}>
                <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2.5 shrink-0 z-10 shadow-sm">
                  {/* Buscador de platos y selector de vista */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Buscar plato (ej: 'poyo papas', 'chela', 'parri')..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 focus:bg-white font-medium text-slate-800"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={toggleModoVista}
                      title={modoVista === 'tarjetas' ? 'Cambiar a Lista Compacta (Modo Rápido Mozo)' : 'Cambiar a Modo Tarjetas'}
                      className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-black uppercase transition-all shrink-0 active:scale-95 shadow-xs ${
                        modoVista === 'compacto' 
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {modoVista === 'tarjetas' ? (
                        <>
                          <List className="w-4 h-4 text-slate-600" />
                          <span className="hidden sm:inline">Compacto</span>
                        </>
                      ) : (
                        <>
                          <LayoutGrid className="w-4 h-4 text-slate-950" />
                          <span className="hidden sm:inline">Tarjetas</span>
                        </>
                      )}
                    </button>
                  </div>
                  {/* Categorías */}
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-0.5 whitespace-nowrap">
                    {(() => {
                      const ordenPrioridades = ORDEN_PRIORIDADES_CATEGORIAS;
                      const cats = ['🔥 Más Pedidos', 'Todos', ...new Set(productos.filter(p => p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))];
                      
                      return cats.sort((a, b) => {
                        const idxA = ordenPrioridades.indexOf(a);
                        const idxB = ordenPrioridades.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.localeCompare(b);
                      }).map(cat => {
                        const isMasPedidos = cat === '🔥 Más Pedidos';
                        return (
                          <button 
                            key={cat} 
                            onClick={() => setCategoriaActiva(cat)} 
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap shadow-xs transition-all flex items-center gap-1.5 ${
                              categoriaActiva === cat 
                                ? (isMasPedidos ? 'bg-amber-500 text-slate-950 shadow-md scale-105' : 'bg-slate-900 text-white shadow-md') 
                                : (isMasPedidos ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50')
                            }`}
                          >
                            {isMasPedidos && <Flame className="w-3.5 h-3.5 text-amber-600 animate-bounce" />}
                            {cat}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div className={`p-3 overflow-y-auto custom-scrollbar content-start flex-1 ${
                  modoVista === 'compacto' 
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' 
                    : 'grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4'
                }`}>
                  {menuFiltrado.map(prod => {
                    const isGroup = prod.esAgrupado;
                    const cantEnTicket = isGroup 
                      ? 0 
                      : ticketActual.filter(t => String(t.id) === String(prod.id) && !t.yaEnviado).reduce((sum, item) => sum + item.cant, 0);
                    const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
                    const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;
                    
                    if (modoVista === 'compacto') {
                      return (
                        <div
                          key={prod.id}
                          onClick={() => !agotado && agregarAlTicket(prod)}
                          className={`bg-white border rounded-xl p-2.5 flex items-center justify-between shadow-xs relative transition-all ${
                            agotado
                              ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50'
                              : cantEnTicket > 0
                                ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/40 cursor-pointer shadow-sm'
                                : 'cursor-pointer hover:border-amber-300 hover:bg-amber-50/20 active:bg-slate-100'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 text-xs uppercase truncate">{prod.nombre}</p>
                              {cantEnTicket > 0 && (
                                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-md shadow-xs">
                                  x{cantEnTicket}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {isGroup && (
                                <span className="text-[9px] font-black px-1 rounded bg-amber-100 text-amber-700">VARIANTES</span>
                              )}
                              {prod.tipoStock === 'limitado' && !isGroup && (
                                <span className={`text-[9px] font-bold px-1 rounded ${agotado ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                  {agotado ? 'AGOTADO' : `STK: ${stockDisponible}`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                              S/ {isGroup ? prod.precioMin.toFixed(2) : (prod.precioOferta ?? prod.precio).toFixed(2)}
                            </span>
                            {cantEnTicket > 0 && !isGroup ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                                    if (idx >= 0) alterarCantidad(idx, '-');
                                  }}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={agotado}
                                  onClick={() => !agotado && agregarAlTicket(prod)}
                                  className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={agotado}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center font-black shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={prod.id} 
                        onClick={() => !agotado && agregarAlTicket(prod)} 
                        className={`bg-white border rounded-xl p-3 md:p-4 flex flex-col justify-between shadow-sm relative overflow-hidden h-28 md:h-32 transition-all ${
                          agotado 
                            ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50' 
                            : cantEnTicket > 0
                              ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/20 cursor-pointer shadow-md'
                              : 'cursor-pointer hover:border-amber-300 hover:-translate-y-0.5 active:bg-slate-50'
                        }`}
                      >
                        {prod.precioOferta !== null && prod.precioOferta !== undefined && !agotado && (
                          <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1 animate-pulse z-15">
                            <Tag className="w-2.5 h-2.5" />
                            {prod.ofertaValor}% OFF
                          </div>
                        )}
                        {cantEnTicket > 0 && !agotado && (
                          <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 z-20">
                            <span>x{cantEnTicket}</span>
                          </div>
                        )}
                        <div className="z-10 flex flex-col justify-between h-full w-full">
                          <div>
                            <p className="font-bold text-slate-800 text-[10px] md:text-xs uppercase leading-tight pr-8">{prod.nombre}</p>
                            {isGroup && (
                              <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 bg-amber-100 text-amber-700">
                                OPCIONES DE CARNE
                              </span>
                            )}
                            {prod.tipoStock === 'limitado' && !isGroup && (
                              <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 ${
                                agotado ? 'bg-red-100 text-red-650' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {agotado ? 'AGOTADO' : `STOCK: ${stockDisponible}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {isGroup ? (
                              <p className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                                Desde S/ {prod.precioMin.toFixed(2)}
                              </p>
                            ) : prod.precioOferta !== null && prod.precioOferta !== undefined ? (
                              <div className="flex flex-col items-start leading-none -mt-1">
                                <span className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precioOferta.toFixed(2)}</span>
                                <span className="line-through text-slate-400 font-semibold text-[10px] md:text-xs mt-0.5">S/ {prod.precio.toFixed(2)}</span>
                              </div>
                            ) : (
                              <p className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precio.toFixed(2)}</p>
                            )}

                            {cantEnTicket > 0 && !isGroup && (
                              <div className="flex items-center gap-1 z-20" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                                    if (idx >= 0) alterarCantidad(idx, '-');
                                  }}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-mono font-black text-xs text-slate-900 w-4 text-center">{cantEnTicket}</span>
                                <button
                                  type="button"
                                  disabled={agotado}
                                  onClick={() => !agotado && agregarAlTicket(prod)}
                                  className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <PlusCircle className="absolute bottom-[-10px] right-[-10px] w-12 h-12 text-slate-100 opacity-50 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>

                {/* Barra rápida de acceso a comanda en móvil */}
                {ticketActual.length > 0 && (
                  <div className="md:hidden p-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-lg border-t border-slate-800">
                    <div className="flex items-center gap-2 pl-2">
                      <Receipt className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black">
                        {ticketActual.reduce((acc, item) => acc + item.cant, 0)} ítem(s) · S/ {totalTicket.toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileTab('ticket')}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow active:scale-95"
                    >
                      Ver Comanda
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className={`w-full md:w-2/5 bg-white flex-col min-h-0 ${mobileTab === 'ticket' ? 'flex flex-1' : 'hidden md:flex'}`}>
                <div className="p-3 md:p-4 border-b border-slate-100 bg-amber-50 shrink-0 flex justify-between items-center">
                  <h3 className="font-black text-amber-800 uppercase text-xs flex items-center gap-2"><Receipt className="w-4 h-4" /> Pedido Actual</h3>
                  <div className="flex items-center gap-1.5">
                    {mesaActual?.pedidoData?.estadoEnsalada === 'Pendiente' && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded uppercase animate-pulse">🥗 Ens: Pend.</span>
                    )}
                    {mesaActual?.pedidoData?.estadoEnsalada === 'Listo' && (
                      <span className="text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded uppercase">🥗 Ens: Listo</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-slate-200 uppercase ${badgeEstado} ${mesaActual?.estado === 'Servido' ? 'animate-pulse' : ''}`}>{badgeTexto}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-slate-50/50">
                  <ul className="space-y-2 md:space-y-3">
                    {ticketActual.length === 0
                      ? <div className="flex flex-col items-center justify-center h-32 opacity-50"><ShoppingBag className="w-8 h-8 mb-2" /><p className="text-center text-slate-500 font-bold text-xs">Aún no hay productos en la mesa.</p></div>
                      : ticketActual.map((item, idx) => {
                          const sub = item.cant * item.precio;
                          if (item.yaEnviado) {
                            const esCancelable = item.pedidoId === mesaActual.pedidoData?.pedidoId;
                            return (
                              <li key={idx} className="bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-xl flex flex-col gap-1.5 opacity-60 grayscale">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 pr-2">
                                    <p className={`font-bold text-[10px] md:text-xs leading-tight ${item.historial ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.nombre}</p>
                                    {(() => {
                                      const prodOriginal = productos.find(p => String(p.id) === String(item.id));
                                      const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                                      return (
                                        <div className="flex items-baseline gap-1.5 mt-1">
                                          {tieneDescuento && (
                                            <span className="line-through text-slate-400 font-semibold text-[10px]">S/ {(item.cant * prodOriginal.precio).toFixed(2)}</span>
                                          )}
                                          <span className="font-mono text-slate-400 font-bold text-xs md:text-sm">S/ {sub.toFixed(2)}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="font-black text-slate-400 text-sm px-3">
                                      {item.cant} <span className="text-[10px]">{item.historial ? '✔ Ready' : '⏳ Pendiente'}</span>
                                    </div>
                                    {esCancelable && (
                                      <button 
                                        onClick={() => {
                                          if (mesaActual.estado === 'Servido' || item.historial) {
                                            requestSupervisorAuth(`Anular "${item.nombre}"`, (supervisor) => handleCancelarItem(item, supervisor));
                                          } else {
                                            handleCancelarItem(item, null);
                                          }
                                        }} 
                                        title="Anular o reducir cantidad de este producto"
                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg hover:text-red-700 transition-colors pointer-events-auto shrink-0"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">📋 NOTA:</span>
                                  <input 
                                    type="text" 
                                    placeholder="Especificaciones (ej: Coca Cola helada)..." 
                                    value={item.notas || ''} 
                                    onChange={(e) => {
                                      let nuevos = [...ticketActual];
                                      nuevos[idx].notas = e.target.value;
                                      setTicketActual(nuevos);
                                    }}
                                    onBlur={async (e) => {
                                      if (item.itemId) {
                                        try {
                                          await api.updateItemNotas(item.itemId, e.target.value);
                                        } catch (err) {
                                          console.error("Error al actualizar nota:", err);
                                        }
                                      }
                                    }}
                                    className="flex-1 bg-white border border-slate-250 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white"
                                  />
                                </div>
                              </li>
                            );
                          }
                          return (
                            <li key={idx} className="bg-white border border-slate-200 p-2.5 md:p-3 rounded-xl flex flex-col gap-2 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 pr-2">
                                  <p className="font-bold text-slate-800 text-[10px] md:text-xs leading-tight">{item.nombre}</p>
                                  {(() => {
                                    const prodOriginal = productos.find(p => String(p.id) === String(item.id));
                                    const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                                    return (
                                      <div className="flex items-baseline gap-1.5 mt-1">
                                        {tieneDescuento && (
                                          <span className="line-through text-slate-400 font-semibold text-[10px]">S/ {(item.cant * prodOriginal.precio).toFixed(2)}</span>
                                        )}
                                        <span className="font-mono text-emerald-600 font-bold text-xs md:text-sm">S/ {sub.toFixed(2)}</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-1 md:gap-2 bg-slate-100 rounded-lg p-1 shrink-0 border border-slate-200">
                                  <button onClick={() => alterarCantidad(idx, '-')} className="w-8 h-8 md:w-7 md:h-7 bg-white rounded-md shadow-sm text-slate-600 font-black text-lg leading-none">-</button>
                                  <span className="font-bold text-slate-900 w-5 text-center text-sm">{item.cant}</span>
                                  <button onClick={() => alterarCantidad(idx, '+')} className="w-8 h-8 md:w-7 md:h-7 bg-white rounded-md shadow-sm text-slate-600 font-black text-lg leading-none">+</button>
                                </div>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Especificaciones (ej: sin cebolla)..." 
                                value={item.notas || ''} 
                                onChange={(e) => {
                                  let nuevos = [...ticketActual];
                                  nuevos[idx].notas = e.target.value;
                                  setTicketActual(nuevos);
                                }}
                                className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white"
                              />
                            </li>
                          );
                        })
                    }
                  </ul>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-end mb-3 md:mb-4 px-2">
                    <span className="font-bold text-slate-400 uppercase text-[10px] md:text-xs tracking-widest">Total Mesa</span>
                    <span className="font-black font-mono text-2xl md:text-3xl text-slate-900 leading-none">S/ {totalTicket.toFixed(2)}</span>
                  </div>

                   {/* Botón cancelar pedido */}
                  {mesaActual?.pedidoData && (
                    <div className="mb-3">
                      {mesaActual.estado === 'Cocina' ? (
                        <button
                          onClick={() => {
                            const algunItemPreparado = ticketActual.some(i => i.yaEnviado && i.historial && i.pedidoId === mesaActual.pedidoData?.pedidoId);
                            if (algunItemPreparado) {
                              alert("⚠️ No puedes realizar una cancelación normal porque algunos platos ya han sido preparados.\n\nPara cancelar platos servidos, usa el botón de 'Anulación Especial (Reclamo)'.");
                              return;
                            }
                            setSupervisorAprobador(null);
                            setEsReclamo(false);
                            setCancelModal(true);
                          }}
                          className="w-full py-2.5 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Cancelar Pedido
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            requestSupervisorAuth("Autorizar Anulación Especial / Reclamo", (supervisor) => {
                              setSupervisorAprobador(supervisor);
                              setEsReclamo(true);
                              setCancelModal(true);
                            });
                          }}
                          className="w-full py-2.5 bg-rose-900/10 hover:bg-rose-900/20 text-rose-700 border border-rose-350 border-dashed font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          Anulación Especial (Reclamo)
                        </button>
                      )}
                    </div>
                  )}
                  {mesaActual?.pedidoData && (
                    <button
                      type="button"
                      onClick={() => setPrecuentaMesa(mesaActual)}
                      className="w-full mb-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] md:text-xs tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      Imprimir Precuenta
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {ticketActual.some(i => !i.yaEnviado) ? (
                      <button 
                        onClick={() => {
                          if (confirm("⚠️ ¿Estás seguro de salir? Se descartarán los platos nuevos que aún no has enviado a la cocina.")) {
                            setModalOpen(false);
                          }
                        }} 
                        className="py-3.5 md:py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs md:text-sm uppercase tracking-wide transition-colors"
                      >
                        ❌ Descartar y Salir
                      </button>
                    ) : (
                      <button 
                        onClick={() => setModalOpen(false)} 
                        className="py-3.5 md:py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs md:text-sm uppercase tracking-wide transition-colors"
                      >
                        Cerrar Ventana
                      </button>
                    )}
                    <button onClick={enviarACocina} disabled={enviando} className="py-3.5 md:py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase tracking-tight rounded-xl text-xs md:text-sm transition-colors shadow-lg shadow-amber-500/30 flex justify-center items-center gap-2 disabled:opacity-50">
                      {enviando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <ChefHat className="w-4 h-4 md:w-5 md:h-5" />}
                      A Cocina
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      {cancelModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Cancelar Pedido</h3>
                <p className="text-xs text-slate-500 mt-1">Mesa {mesaActual?.num} · Mozo: {meseroGlobal}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
              <p className="text-xs text-red-700 font-bold">
                ⚠️ Esta acción eliminará el pedido. Si algún insumo ya fue usado, se habrá generado un desperdicio.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">Motivo de cancelación (obligatorio):</label>
              <textarea
                rows={3}
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ej: Cliente cambió de opinión, se equivocó de mesa..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none font-medium text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setCancelModal(false); setCancelMotivo(''); }}
                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm uppercase tracking-wide transition-colors"
              >
                No cancelar
              </button>
              <button
                onClick={handleCancelarPedido}
                disabled={cancelandoPedido || !cancelMotivo.trim()}
                className="py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm uppercase tracking-wide transition-colors flex justify-center items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20"
              >
                {cancelandoPedido
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  : <><AlertTriangle className="w-4 h-4" /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO) */}
      {optionsModalOpen && selectedProduct && (() => {
        const steps = getProductSteps(selectedProduct, selections);
        if (!steps || steps.length === 0) return null;
        
        const safeStepIdx = Math.max(0, Math.min(currentStepIdx, steps.length - 1));
        const currentStep = steps[safeStepIdx] || steps[0];
        if (!currentStep) return null;

        const esUltimoPaso = safeStepIdx >= steps.length - 1;
        const seleccionActual = selections[currentStep.key];
        
        const handleSelectOption = (val) => {
          setSelections(prev => ({ ...prev, [currentStep.key]: val }));
          
          if (!esUltimoPaso) {
            setTimeout(() => {
              setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1));
            }, 150);
          }
        };
        
        const handleConfirm = () => {
          const hasCustomConfig = selectedProduct.opcionesConfig && (() => {
            try {
              const p = typeof selectedProduct.opcionesConfig === 'string' 
                ? JSON.parse(selectedProduct.opcionesConfig) 
                : selectedProduct.opcionesConfig;
              return Array.isArray(p) && p.length > 0;
            } catch { return false; }
          })();

          // Acompañamientos quitados y complementos agregados por el mozo
          const compl = resolverComplementos(selectedProduct, selections);
          const soloComplementos = !hasCustomConfig && steps.length === 1 && steps[0].tipo === 'complementos';

          if (selectedProduct.esAgrupado) {
            const prodVariante = selections["producto_variante"];
            if (!prodVariante) {
              alert("Por favor, selecciona una opción de carne.");
              return;
            }
            agregarAlTicketDirecto(prodVariante, additionalNotes.trim());
          } else if (soloComplementos) {
            const notas = [...compl.notas];
            if (additionalNotes.trim()) notas.push(`(Nota: ${additionalNotes.trim()})`);
            agregarAlTicketDirecto(selectedProduct, notas.join(' · '), { opciones: [], precioExtra: compl.precioExtra });
          } else if (hasCustomConfig) {
            const notesArray = [];
            steps.forEach(step => {
              if (step.tipo === 'complementos') return;
              const val = selections[step.key];
              if (val) {
                const valLower = String(val).toLowerCase();
                if (valLower.includes('sin ') || valLower.includes('omitir')) return;
                const stepLower = step.name.toLowerCase();
                if (stepLower.includes('bebida')) {
                  notesArray.push(`[Bebida: ${val}]`);
                } else if (stepLower.includes('entrada')) {
                  notesArray.push(`[Entrada: ${val}]`);
                } else if (stepLower.includes('guarnicion') || stepLower.includes('acompañamiento')) {
                  notesArray.push(`[Guarnición: ${val}]`);
                } else {
                  notesArray.push(`${step.name}: ${val}`);
                }
              }
            });
            notesArray.push(...compl.notas);
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            const sel = resolverSeleccion(steps, selections);
            agregarAlTicketDirecto(selectedProduct, finalNotes, { ...sel, precioExtra: sel.precioExtra + compl.precioExtra });
          } else if (isMenuProduct(selectedProduct)) {
            const notesArray = [];
            const entr = selections["entrada_menu"];
            const beb = selections["bebida"];
            const guarn = selections["guarnicion_menu"];
            
            if (entr && !entr.toLowerCase().includes('sin entrada') && !entr.toLowerCase().includes('omitir')) {
              notesArray.push(`[Entrada: ${entr}]`);
            }
            if (beb && !beb.toLowerCase().includes('sin bebida') && !beb.toLowerCase().includes('omitir')) {
              notesArray.push(`[Bebida: ${beb}]`);
            }
            if (guarn && !guarn.toLowerCase().includes('estándar') && !guarn.toLowerCase().includes('sin guarnición') && !guarn.toLowerCase().includes('omitir')) {
              notesArray.push(`[Guarnición: ${guarn}]`);
            }
            
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarAlTicketDirecto(selectedProduct, finalNotes);
          } else if (getComboConfig(selectedProduct.nombre)) {
            const notesArray = [];
            const fondo = selections["fondo"];
            const proteina = selections["proteina"];
            const entrada = selections["entrada"];
            const bebida = selections["bebida"];
            
            if (fondo) {
              if (proteina) {
                const cleanFondoName = fondo.replace(' (pollo o carne)', '');
                notesArray.push(`Fondo: ${cleanFondoName} de ${proteina}`);
              } else {
                notesArray.push(`Fondo: ${fondo}`);
              }
            }
            if (entrada) {
              notesArray.push(`[Entrada: ${entrada}]`);
            }
            
            // Refresco y Postre automáticos (más cortos)
            notesArray.push(`+ refresco + postre`);

            if (bebida && !bebida.toLowerCase().includes('sin bebida') && !bebida.toLowerCase().includes('omitir')) {
              notesArray.push(`[Bebida: ${bebida}]`);
            }

            const cantidadEnsaladas = selections["cantidad_ensaladas"];
            if (cantidadEnsaladas && !cantidadEnsaladas.toLowerCase().includes('sin ensalada')) {
              notesArray.push(cantidadEnsaladas);
            }
            
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarAlTicketDirecto(selectedProduct, finalNotes);
          } else {
            const notesArray = [];
            const isParrilla2P = selectedProduct.nombre.toLowerCase().includes("2 personas") || selectedProduct.nombre.toLowerCase().includes("2p") || selectedProduct.nombre.toLowerCase().includes("2 p") || selectedProduct.nombre.toLowerCase().includes("2 pers");
            let additionalDrinkProduct = null;

            if (isParrilla2P) {
              const guarn = selections["guarnicion"];
              if (guarn && !guarn.toLowerCase().includes('sin')) notesArray.push(`[Guarnición: ${guarn}]`);
              
              const b1 = selections["bebida_1"];
              const b2 = selections["bebida_2"];
              const b_adic = selections["bebida_adicional"];
              
              if (b1 && b2 && !b1.toLowerCase().includes('sin') && !b2.toLowerCase().includes('sin')) {
                if (b1 === b2) {
                  // Agrupar dos de 1/2 Lt iguales en un solo litro para la Barra (ej: Gaseosa 1/2 Lt + Gaseosa 1/2 Lt => Gaseosa 1 Lt)
                  const cleanName = b1.replace(" 1/2 Lt", " 1 Lt").replace(" - 1/2 Lt", " - 1 Lt");
                  notesArray.push(`[Bebida: ${cleanName}]`);
                } else {
                  notesArray.push(`[Bebida 1: ${b1}]`);
                  notesArray.push(`[Bebida 2: ${b2}]`);
                }
              } else {
                if (b1 && !b1.toLowerCase().includes('sin')) notesArray.push(`[Bebida 1: ${b1}]`);
                if (b2 && !b2.toLowerCase().includes('sin')) notesArray.push(`[Bebida 2: ${b2}]`);
              }
              
              if (b_adic && b_adic !== "Sin Bebida Adicional") {
                // Buscamos el producto en la lista de productos cargada de la base de datos
                additionalDrinkProduct = productos.find(p => p.nombre === b_adic);
              }
            } else {
              steps.forEach(step => {
                const val = selections[step.key];
                if (val) {
                  const valLower = String(val).toLowerCase();
                  if (valLower.includes('sin bebida') || valLower.includes('sin ensalada') || valLower.includes('omitir') || valLower.includes('sin acompañamiento') || valLower.includes('sin guarnicion')) {
                    return;
                  }
                  const stepLower = step.name.toLowerCase();
                  if (stepLower.includes('bebida')) {
                    notesArray.push(`[Bebida: ${val}]`);
                  } else if (stepLower.includes('ensalada')) {
                    notesArray.push(val);
                  } else if (stepLower.includes('guarnicion') || stepLower.includes('acompañamiento')) {
                    notesArray.push(`[Guarnición: ${val}]`);
                  } else if (stepLower.includes('fondo')) {
                    notesArray.push(`Fondo: ${val}`);
                  } else if (stepLower.includes('entrada')) {
                    notesArray.push(`[Entrada: ${val}]`);
                  } else {
                    notesArray.push(`${step.name}: ${val}`);
                  }
                }
              });
            }
            
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            
            // 1. Agregar el producto base (Combo)
            agregarAlTicketDirecto(selectedProduct, finalNotes);
            
            // 2. Si hay bebida adicional seleccionada, la agregamos como un producto separado e independiente
            // Esto asegura que se sume al precio total de la boleta y descuente stock correctamente
            if (additionalDrinkProduct) {
              agregarAlTicketDirecto(additionalDrinkProduct);
            }
          }
          
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        };
        
        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center md:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-lg md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[100vh] md:h-auto md:max-h-[90vh] animate-slide-up">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div>
                  <h3 className="text-white font-black text-base uppercase tracking-tight leading-none">
                    {selectedProduct.esAgrupado ? "Seleccionar Variante" : "Personalizar Plato"}
                  </h3>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1">
                    {selectedProduct.nombre}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setOptionsModalOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {steps.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Paso {safeStepIdx + 1} de {steps.length}</span>
                      <span className="text-amber-400">{currentStep.name}</span>
                    </div>
                    <div className="h-1.5 bg-slate-850 rounded-full overflow-hidden flex border border-slate-800">
                      {steps.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`h-full flex-1 border-r border-slate-900 last:border-0 transition-all ${
                            idx <= safeStepIdx ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {currentStep.name}:
                  </h4>
                  {currentStep.tipo === 'complementos' ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-400">
                        Toca para quitar lo que el cliente no quiere o agregar un extra. Quitar algo incluido no cambia el precio.
                      </p>
                      {currentStep.complementos.map(c => {
                        const sel = selections.complementos || { quitados: [], agregados: [] };
                        const quitado = (sel.quitados || []).includes(c.nombre);
                        const agregado = (sel.agregados || []).includes(c.nombre);
                        const activo = c.incluido ? !quitado : agregado;
                        const alternar = () => setSelections(prev => {
                          const actual = prev.complementos || { quitados: [], agregados: [] };
                          const quitados = [...(actual.quitados || [])];
                          const agregados = [...(actual.agregados || [])];
                          if (c.incluido) {
                            const i = quitados.indexOf(c.nombre);
                            if (i >= 0) quitados.splice(i, 1); else quitados.push(c.nombre);
                          } else {
                            const i = agregados.indexOf(c.nombre);
                            if (i >= 0) agregados.splice(i, 1); else agregados.push(c.nombre);
                          }
                          return { ...prev, complementos: { quitados, agregados } };
                        });
                        return (
                          <button
                            key={c.nombre}
                            onClick={alternar}
                            className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                              activo
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 line-through decoration-rose-500/70'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${activo ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-500'}`}>
                              {activo ? <Check className="w-3.5 h-3.5 stroke-[3px]" /> : <X className="w-3.5 h-3.5 stroke-[3px]" />}
                            </span>
                            <span className="font-black text-xs uppercase flex-1">{c.nombre}</span>
                            {!c.incluido && (
                              <span className={`text-[11px] font-black ${activo ? 'text-emerald-300' : 'text-slate-500'}`}>
                                + S/ {c.precio.toFixed(2)}
                              </span>
                            )}
                            {c.incluido && <span className="text-[10px] font-bold text-slate-500 uppercase">Incluido</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentStep.options.map((opt, oIdx) => {
                      const isSelected = selectedProduct.esAgrupado 
                        ? (seleccionActual && seleccionActual.id === opt.value.id)
                        : (seleccionActual === opt.value);
                        
                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectOption(opt.value)}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden min-h-[75px] ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[0.98]'
                              : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750 hover:border-slate-600'
                          }`}
                        >
                          <span className="font-black text-xs leading-snug pr-6 uppercase">{opt.label}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-slate-950 absolute top-4 right-4 stroke-[3px]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
                
                {esUltimoPaso && (
                  <div className="border-t border-slate-800 pt-5 space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Especificaciones Especiales / Notas
                    </label>
                    <textarea
                      placeholder="Ejemplo: sin cebolla, papas bien doradas, etc."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl p-4 text-xs font-bold text-slate-100 focus:outline-none focus:bg-slate-950 custom-scrollbar h-20 resize-none"
                    ></textarea>
                  </div>
                )}
              </div>
              
              <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex justify-between gap-3 shrink-0">
                <button
                  onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
                  disabled={safeStepIdx === 0}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    safeStepIdx === 0
                      ? 'bg-slate-850 text-slate-600 border border-slate-850 opacity-40 cursor-not-allowed shadow-none'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                  }`}
                >
                  Atrás
                </button>
                
                {esUltimoPaso ? (
                  <button
                    onClick={handleConfirm}
                    disabled={currentStep.key === "producto_variante" && !seleccionActual}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (currentStep.key !== "producto_variante" || seleccionActual)
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20'
                        : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Agregar Pedido
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
                    disabled={currentStep.key === "producto_variante" && !seleccionActual}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (currentStep.key !== "producto_variante" || seleccionActual)
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Siguiente
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE AUTORIZACIÓN POR PIN (SUPERVISOR) */}
      {authModal.open && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center animate-slide-up">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 mb-3 shadow-lg shadow-amber-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-black text-white text-base uppercase tracking-tight text-center leading-none">Autorización de Supervisor</h3>
            <p className="text-[10px] text-amber-400 font-mono uppercase tracking-widest text-center mt-2 font-bold bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/20">Acción: {authModal.promptText}</p>

            {/* Textbox Input para PIN con Teclado Físico y Móvil */}
            <div className="w-full mt-4 mb-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 text-center mb-1.5">
                Ingresa el PIN de Admin / Cajero:
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={authModal.pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setAuthModal(prev => ({ ...prev, pin: val, error: '' }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAuthPin(authModal.pin);
                  if (e.key === 'Escape') setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' });
                }}
                placeholder="••••"
                className="w-full bg-slate-800 border-2 border-amber-500/40 focus:border-amber-500 rounded-2xl px-4 py-3 text-center text-2xl font-mono font-black tracking-[0.4em] text-white focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
              />
            </div>

            {/* Error */}
            <div className="min-h-[24px] mb-2 text-center w-full">
              {authModal.error && (
                <p className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-xl">
                  {authModal.error}
                </p>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button 
                  key={num}
                  type="button"
                  onClick={() => handleAuthPinKeyPress(num)}
                  className="aspect-square bg-slate-800 hover:bg-slate-700 text-white font-black text-xl rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button"
                onClick={() => setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' })}
                className="aspect-square bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center uppercase tracking-wider border border-slate-800"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleAuthPinKeyPress(0)}
                className="aspect-square bg-slate-800 hover:bg-slate-700 text-white font-black text-xl rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center shadow-sm"
              >
                0
              </button>
              <button 
                type="button"
                onClick={handleAuthPinBackspace}
                className="aspect-square bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center uppercase tracking-wider border border-slate-800"
              >
                Borrar
              </button>
            </div>

            {/* Botón Validar */}
            <button
              type="button"
              onClick={() => submitAuthPin(authModal.pin)}
              disabled={!authModal.pin}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black uppercase tracking-wider text-xs rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Validar y Autorizar
            </button>
          </div>
        </div>
      )}
      {/* UNION DE MESAS COMPONENTE DIALOG */}
      {unionDropdownOpen && mesaActual && (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-fade-in">
            <h3 className="font-black uppercase text-sm border-b border-slate-100 pb-2 mb-3 flex items-center gap-2 text-slate-800"><Link2 className="w-5 h-5 text-amber-500" /> Unir Mesas con Mesa {mesaActual.num}</h3>
            
            {/* List of mesas unidas currently */}
            {mesas.filter(m => m.estado === `Unida a Mesa ${mesaActual.num}`).length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200/50 p-3 rounded-xl">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">Mesas Unidas Actualmente:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {mesas.filter(m => m.estado === `Unida a Mesa ${mesaActual.num}`).map(m => (
                    <span key={m.num} className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-lg">Mesa {m.num}</span>
                  ))}
                </div>
                <button 
                  onClick={handleSepararMesas}
                  className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-xs uppercase transition-colors"
                >
                  🔓 Separar Todas las Mesas
                </button>
              </div>
            )}
            
            <p className="text-xs text-slate-500 font-bold mb-2">Selecciona una mesa libre para unirla:</p>
            <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar p-1 mb-4">
              {mesas.filter(m => m.estado === 'Libre' && m.num !== mesaActual.num).length === 0 ? (
                <p className="col-span-4 text-center text-xs text-slate-400 py-3">No hay mesas libres disponibles.</p>
              ) : (
                mesas
                  .filter(m => m.estado === 'Libre' && m.num !== mesaActual.num)
                  .map(m => (
                    <button 
                      key={m.num}
                      onClick={() => handleUnirMesa(m.num)}
                      className="bg-slate-55 hover:bg-amber-100 border border-slate-200 text-slate-800 text-xs font-black py-2 rounded-xl transition-colors shadow-sm"
                    >
                      Mesa {m.num}
                    </button>
                  ))
              )}
            </div>
            
            <button 
              onClick={() => setUnionDropdownOpen(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase transition-colors"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}
      {/* FLOATING TOASTS NOTIFICATIONS SYSTEM */}
      <div className="fixed top-20 right-6 z-[250] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto bg-slate-900 border border-emerald-500/20 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-lg animate-bounce shrink-0 shadow-lg shadow-emerald-500/20">
              🛎️
            </div>
            <div className="flex-1 pr-2 relative z-10">
              <h4 className="font-black text-xs text-emerald-400 uppercase tracking-widest leading-none mb-1">¡Pedido Listo!</h4>
              <p className="font-bold text-sm text-slate-100">{t.mensaje}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors relative z-10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Botón flotante para Bandeja de Despacho (Platos Listos).
          En el celular se oculta mientras haya una ventana abierta: antes tapaba sus botones. */}
      {!modalOpen && !optionsModalOpen && !cancelModal && !authModal.open && (
      <button
        onClick={() => setBandejaOpen(true)}
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

      {/* DRAWER / MODAL DE BANDEJA DE DESPACHO */}
      {bandejaOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[230] flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-sm md:text-base uppercase tracking-tight leading-none">Bandeja de Despacho</h2>
                  <p className="text-[10px] text-indigo-200 mt-1 uppercase tracking-wider">Platos listos para servir</p>
                </div>
              </div>
              <button onClick={() => setBandejaOpen(false)} className="bg-indigo-700 hover:bg-red-500 p-2 rounded-xl transition-colors text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
              {platosListosDespacho.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                  <CheckCircle className="w-16 h-16 text-slate-300 mb-3" />
                  <p className="font-black uppercase tracking-wider text-sm">Bandeja Vacía</p>
                  <p className="text-xs text-slate-400 text-center mt-1">No hay platos ni bebidas pendientes de llevar a las mesas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    platosListosDespacho.reduce((groups, item) => {
                      const key = item.mesaNum;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(item);
                      return groups;
                    }, {})
                  ).map(([mesaNum, items]) => {
                    const primerItem = items[0];
                    return (
                      <div key={mesaNum} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                          <div>
                            <h3 className="font-black text-slate-900 text-sm md:text-base uppercase tracking-tight">Mesa {mesaNum}</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Mozo: {primerItem.mesero}</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.entregarTodoPedido(primerItem.pedidoId);
                                if (res.error) throw new Error(res.error);
                                await fetchMesas();
                              } catch (err) {
                                alert("Error al entregar: " + err.message);
                              }
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors uppercase tracking-wider active:scale-95"
                          >
                            Servir Todo
                          </button>
                        </div>
                        <ul className="space-y-2">
                          {items.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-800 uppercase flex-1 pr-2 flex items-center gap-2 flex-wrap">
                                <span className="font-black text-indigo-600">{item.cant}x</span> {item.nombre}
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider ${
                                  item.estacion === 'Barra' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {item.estacion === 'Barra' ? '🍹 BARRA' : '🔥 COCINA'}
                                </span>
                              </span>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await api.entregarItem(item.itemId);
                                    if (res.error) throw new Error(res.error);
                                    await fetchMesas();
                                  } catch (err) {
                                    alert("Error al entregar: " + err.message);
                                  }
                                }}
                                className="p-1.5 bg-white hover:bg-emerald-500 hover:text-white border border-slate-200 rounded-lg text-slate-400 hover:border-emerald-500 transition-all active:scale-90"
                                title="Marcar como Servido"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {adminMesasOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[230] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in max-h-[85vh]">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-base uppercase tracking-tight leading-none">Administrar Mesas</h2>
                  <p className="text-xs text-slate-400 mt-1">Crear, editar o eliminar mesas del salón</p>
                </div>
              </div>
              <button 
                onClick={() => setAdminMesasOpen(false)} 
                className="bg-slate-800 hover:bg-red-500 hover:text-white text-slate-300 p-2.5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
              {/* Crear nueva mesa */}
              <form onSubmit={handleCrearMesa} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-amber-500" /> Agregar Nueva Mesa
                </h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      value={nuevaMesaNum}
                      onChange={(e) => setNuevaMesaNum(e.target.value)}
                      placeholder="Número de mesa" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                      min="1"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase text-xs tracking-wider rounded-xl transition-colors shadow-md shadow-amber-500/10 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>
              </form>
              
              {/* Listado de mesas */}
              <div>
                <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-3 px-1">Mesas Existentes</h3>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                  {mesas.map((m) => {
                    const ocupada = m.estado !== 'Libre';
                    const numActual = m.num;
                    const valEdit = editandoMesas[numActual] !== undefined ? editandoMesas[numActual] : numActual;
                    
                    return (
                      <div key={numActual} className="flex items-center justify-between p-3 bg-white border border-slate-150 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${ocupada ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500'} flex items-center justify-center text-xs font-bold`}>
                            {ocupada ? <ChefHat className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Mesa:</span>
                            <input 
                              type="number" 
                              value={valEdit}
                              disabled={ocupada}
                              onChange={(e) => {
                                setEditandoMesas(prev => ({
                                  ...prev,
                                  [numActual]: e.target.value
                                }));
                              }}
                              min="1" 
                              className={`w-20 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:outline-none ${
                                ocupada 
                                  ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed' 
                                  : 'bg-white border border-slate-200 text-slate-800 focus:border-amber-500'
                              }`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ocupada ? (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-250 uppercase mr-1 animate-pulse">Ocupada</span>
                          ) : (
                            <>
                              <button 
                                type="button"
                                onClick={() => handleEditarMesa(numActual)}
                                className="p-2 text-emerald-600 hover:text-white hover:bg-emerald-500 border border-emerald-250 hover:border-emerald-500 rounded-lg transition-colors cursor-pointer"
                                title="Guardar Número"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleEliminarMesa(numActual)}
                                className="p-2 text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar Mesa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
       )}

      {/* MODAL DE PRECUENTA DE MESA (IMPRESIÓN) */}
      {precuentaMesa && (() => {
        const items = precuentaMesa.pedidoData?.items || [];
        const subtotal = items.reduce((s, i) => s + (i.cant * i.precio), 0);
        const subtotalBase = parseFloat((subtotal / 1.105).toFixed(2));
        const igv = parseFloat((subtotal - subtotalBase).toFixed(2));

        return (
          <div id="precuenta-print-container" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Receipt className="w-6 h-6 shrink-0" />
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Precuenta Mesa {precuentaMesa.num}</h3>
                </div>
                <button onClick={() => setPrecuentaMesa(null)} className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"><X className="w-5 h-5" /></button>
              </div>

              {/* Vista del ticket térmico */}
              <div id="precuenta-ticket-print" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-6 flex flex-col">
                <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4">
                  <h4 className="font-black text-sm text-slate-900 uppercase">{COMPANY_CONFIG.legalName}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{COMPANY_CONFIG.address} · RUC: {COMPANY_CONFIG.ruc}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">PRECUENTA DE CONSUMO (NO VALIDO COMO COMPROBANTE)</p>
                </div>

                <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
                  <div className="flex justify-between"><span>MESA:</span><span className="text-slate-900 text-sm font-black">{precuentaMesa.num}</span></div>
                  <div className="flex justify-between"><span>FECHA:</span><span>{new Date().toLocaleDateString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>HORA:</span><span>{new Date().toLocaleTimeString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>MOZO:</span><span className="uppercase">{currentUser?.nombre || meseroGlobal}</span></div>
                </div>

                {/* Detalle de productos */}
                <div className="border-b border-dashed border-slate-300 pb-3 mb-4">
                  <div className="grid grid-cols-12 gap-1 font-black text-slate-900 text-[10px] uppercase tracking-wider mb-2">
                    <span className="col-span-2 text-center">CANT</span>
                    <span className="col-span-7">PRODUCTO</span>
                    <span className="col-span-3 text-right">TOTAL</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1 text-[11px] font-bold text-slate-700 leading-tight">
                        <span className="col-span-2 text-center font-black">{item.cant}</span>
                        <span className="col-span-7 uppercase">{item.nombre}</span>
                        <span className="col-span-3 text-right font-black">S/ {(item.cant * item.precio).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totales */}
                <div className="space-y-1.5 font-bold text-slate-700 border-b border-dashed border-slate-300 pb-3 mb-3">
                  <div className="flex justify-between">
                    <span>OP. GRAVADA:</span>
                    <span>S/ {subtotalBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>I.G.V. (10%):</span>
                    <span>S/ {igv.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
                  <span>💰 TOTAL A PAGAR:</span>
                  <span className="text-base text-indigo-700">S/ {subtotal.toFixed(2)}</span>
                </div>

                <div className="text-center text-[9px] text-slate-400 font-bold mt-6 border-t border-dashed border-slate-200 pt-3">
                  {COMPANY_CONFIG.ticketFooter}
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <button
                  onClick={() => setPrecuentaMesa(null)}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                >
                  Imprimir Precuenta
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
