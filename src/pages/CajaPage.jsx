import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, X, Banknote, Search, CheckCircle, Clock, CreditCard, Wallet, Truck, PackageCheck, Plus, Calculator, Printer, Gift, Percent, Check, Users, Layers, Ban, AlertTriangle, Trash2, Lock, Flame, FileText, History, ExternalLink, ChevronDown, ChevronRight, Pencil, ShoppingBag, UtensilsCrossed, Phone, MapPin, Smartphone, Eye, EyeOff, Bike, Unlock } from 'lucide-react';

import { api } from '../api';
import { parsePasosOpciones, resolverSeleccion, pasoComplementos, resolverComplementos, tieneComplementos } from '../utils/combos';

// El sistema solo emite TICKETS DE VENTA. La boleta o factura la emite la empresa
// directamente en el portal de SUNAT, así que aquí no se envía nada.
const FACTURACION_ELECTRONICA = false;
import { useCompany } from '../context/CompanyContext';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS, ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';
import { generateOfflineQrUrl } from '../utils/qrOffline';

// Helper para parsear la distribución de crédito en ventas con múltiples clientes
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

// Helper seguro para parsear montos ingresados por el usuario
const parseMonto = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
};

// Componente Selector de Cliente con Buscador Integrado y Card de Saldo
function SelectorClienteCreditoCombobox({
  clientes = [],
  clienteSeleccionado,
  onSelectCliente,
  label = "Cliente para Crédito:",
  placeholder = "Buscar por nombre, DNI o RUC..."
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = (clientes || []).filter(c => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase().trim();
    const nom = (c.nombre || '').toLowerCase();
    const doc = (c.numDoc || '').toLowerCase();
    return nom.includes(term) || doc.includes(term);
  });

  return (
    <div className="space-y-1 relative">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase">{label}</label>
          {clienteSeleccionado && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
              (clienteSeleccionado.saldo || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {(clienteSeleccionado.saldo || 0) > 0 ? `Debe S/ ${(clienteSeleccionado.saldo || 0).toFixed(2)}` : 'Al día'}
            </span>
          )}
        </div>
      )}

      {clienteSeleccionado ? (
        <div className="bg-amber-50/60 border-2 border-amber-300 rounded-xl p-2 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              clienteSeleccionado.esTrabajador ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">
                  {clienteSeleccionado.nombre}
                </p>
                <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded shrink-0 ${
                  clienteSeleccionado.esTrabajador ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {clienteSeleccionado.esTrabajador ? 'STAFF' : 'CLIENTE'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 truncate">
                {clienteSeleccionado.tipoDoc || 'DOC'}: {clienteSeleccionado.numDoc || 'S/D'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCliente(null);
              setBusqueda('');
              setAbierto(true);
            }}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 shrink-0"
            title="Cambiar cliente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={placeholder}
              value={busqueda}
              onFocus={() => setAbierto(true)}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {abierto && (
            <>
              <div 
                className="fixed inset-0 z-[120]" 
                onClick={() => setAbierto(false)} 
              />
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[130] max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {filtrados.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold">
                    No se encontraron clientes
                  </div>
                ) : (
                  filtrados.map(c => {
                    const debe = (c.saldo || 0) > 0;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCliente(c);
                          setAbierto(false);
                          setBusqueda('');
                        }}
                        className="w-full text-left p-1.5 rounded-xl hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2 border border-transparent hover:border-amber-200"
                      >
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 uppercase truncate">
                              {c.nombre}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                              c.esTrabajador ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {c.esTrabajador ? 'STAFF' : 'CLIENTE'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {c.tipoDoc || 'DOC'}: {c.numDoc || 'S/D'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                            debe ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {debe ? `Debe S/ ${(c.saldo).toFixed(2)}` : 'S/ 0.00'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
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

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

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
    .trim();
};

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

const matchProductSemantic = (prod, query) => {
  if (!query) return true;
  const cleanQuery = query.toLowerCase().trim();
  const queryTokens = cleanQuery.split(/\s+/);
  
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const cleanProdCat = (prod.categoria || '').toLowerCase();
  
  const phoneticName = normalizePhonetic(prod.nombre);
  const phoneticCat = normalizePhonetic(prod.categoria);
  
  return queryTokens.every(qToken => {
    if (cleanProdName.includes(qToken) || cleanProdCat.includes(qToken)) return true;
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
      categoria: ordenados[0].categoria || 'Platos Criollos y Fondos',
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

export default function CajaPage({ currentUser }) {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [stats, setStats] = useState({ atendidas: 0, ingresos: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState('Ticket');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
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


  // Modal Anular / Registrar Devolución de Venta Entregada
  const [anularVentaModal, setAnularVentaModal] = useState(false);
  const [ventaAAnular, setVentaAAnular] = useState(null);
  const [anularPin, setAnularPin] = useState('');
  const [anularMotivo, setAnularMotivo] = useState('');
  const [anularError, setAnularError] = useState('');
  const [anularCargando, setAnularCargando] = useState(false);

  // Historial de Ventas y Arqueo/Cierre de Caja
  const [ventas, setVentas] = useState([]);
  const [cierreModalOpen, setCierreModalOpen] = useState(false);

  // Control de Turno y Apertura de Caja (PostgreSQL)
  const [cajaEstado, setCajaEstado] = useState({ abierto: false, turno: null, cargando: true });
  const [modalAperturaOpen, setModalAperturaOpen] = useState(false);
  const [montoInicialInput, setMontoInicialInput] = useState('');
  const [notaAperturaInput, setNotaAperturaInput] = useState('');
  const [guardandoApertura, setGuardandoApertura] = useState(false);
  const [errorApertura, setErrorApertura] = useState('');

  const [ultimoCierre, setUltimoCierre] = useState(() => {
    const stored = localStorage.getItem('ultimoCierre');
    if (stored) {
      if (new Date(stored) <= new Date()) return stored;
      localStorage.removeItem('ultimoCierre');
    }
    const d = new Date();
    if (d.getHours() < 3) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(3, 0, 0, 0);
    return d.toISOString();
  });
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');
  const [consumoPin, setConsumoPin] = useState('');
  const [consumoPinError, setConsumoPinError] = useState('');
  const [comprasTurno, setComprasTurno] = useState([]);
  const [efectivoFisicoContado, setEfectivoFisicoContado] = useState('');
  const [historialCierresModalOpen, setHistorialCierresModalOpen] = useState(false);
  const [historialCierres, setHistorialCierres] = useState([]);
  const [cargandoHistorialCierres, setCargandoHistorialCierres] = useState(false);
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [cierreAImprimir, setCierreAImprimir] = useState(null);

  const abrirHistorialCierres = async () => {
    setHistorialCierresModalOpen(true);
    setCargandoHistorialCierres(true);
    try {
      const res = await api.getHistorialCierres(50);
      const list = Array.isArray(res) ? res : (res?.cierres || []);
      setHistorialCierres(list);
    } catch (err) {
      console.error('Error al cargar historial de cierres:', err);
    } finally {
      setCargandoHistorialCierres(false);
    }
  };

  // Créditos y Clientes
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [clienteCreditoSeleccionado, setClienteCreditoSeleccionado] = useState(null);
  const [clientesCreditoMixto, setClientesCreditoMixto] = useState([{ clienteId: '', monto: '', nombre: '' }]);
  const [incluirCreditoMixto, setIncluirCreditoMixto] = useState(false);
  const [montoCreditoMixto, setMontoCreditoMixto] = useState('');
  const [deliveryMontoCredito, setDeliveryMontoCredito] = useState('');
  const [deliveryClienteCreditoSeleccionado, setDeliveryClienteCreditoSeleccionado] = useState(null);
  const [deliveryDescuentoValor, setDeliveryDescuentoValor] = useState('');
  const [deliveryDescuentoTipo, setDeliveryDescuentoTipo] = useState('porcentaje'); // 'porcentaje' | 'monto'
  const [deliveryVistaMovil, setDeliveryVistaMovil] = useState('productos'); // 'productos' | 'pedido'
  // Búsqueda de clientes en selectores de crédito
  const [busquedaClienteCredito, setBusquedaClienteCredito] = useState('');
  const [pagaConEfectivoMesa, setPagaConEfectivoMesa] = useState('');


  // Modal cambiar método de pago
  const [cambioMetodoModal, setCambioMetodoModal] = useState(false);
  const [ventaACambiar, setVentaACambiar] = useState(null);
  const [cambioPin, setCambioPin] = useState('');
  const [cambioNuevoMetodo, setCambioNuevoMetodo] = useState('Efectivo');
  const [cambiando, setCambiando] = useState(false);
  const [cambioError, setCambioError] = useState('');

  // Modal cambiar tipo de entrega
  const [cambioTipoEntregaModal, setCambioTipoEntregaModal] = useState(false);
  const [ventaATipoCambiar, setVentaATipoCambiar] = useState(null);
  const [cambioNuevoTipo, setCambioNuevoTipo] = useState('ParaLlevar');
  const [cambioCodigoPY, setCambioCodigoPY] = useState('');
  const [cambioNombreCliente, setCambioNombreCliente] = useState('');
  const [cambioTelefono, setCambioTelefono] = useState('');
  const [cambioDireccion, setCambioDireccion] = useState('');
  const [cambioMontoDelivery, setCambioMontoDelivery] = useState('');
  const [cambioMontoConCuanto, setCambioMontoConCuanto] = useState('');
  const [cambioMetodoPago, setCambioMetodoPago] = useState('Efectivo');
  const [cambioMixtoEfectivo, setCambioMixtoEfectivo] = useState('');
  const [cambioMixtoTarjeta, setCambioMixtoTarjeta] = useState('');
  const [cambioMixtoYape, setCambioMixtoYape] = useState('');
  const [cambioTipoPin, setCambioTipoPin] = useState('');
  const [cambioTipoError, setCambioTipoError] = useState('');
  const [cambioTipoCambiando, setCambioTipoCambiando] = useState(false);

  // Mostrar todas las ventas del día ignorando el Cierre de Turno por defecto
  const [mostrarTodoElDia, setMostrarTodoElDia] = useState(true);
  const [historialColapsado, setHistorialColapsado] = useState(false);

  // Detalle en modal (se guarda el id para leer siempre los datos más recientes del polling)
  const [ventaDetalleId, setVentaDetalleId] = useState(null);
  const [mesaDetalleNum, setMesaDetalleNum] = useState(null);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);
  const [busquedaVentas, setBusquedaVentas] = useState('');
  const [ventasLimite, setVentasLimite] = useState(20);

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
  const [pinCancelLlevar, setPinCancelLlevar] = useState('');
  const [errorCancelLlevar, setErrorCancelLlevar] = useState('');

  // Modal PedidosYa y Para Llevar
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [codigoPY, setCodigoPY] = useState('');
  const [cajeroNombre, setCajeroNombre] = useState(currentUser?.nombre || 'María');
  const [usuariosSistema, setUsuariosSistema] = useState([]);
  const [modoOtroCajero, setModoOtroCajero] = useState(false);

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
    if (!cajaEstado.abierto && cajerosDisponibles.length > 0 && !modoOtroCajero) {
      const match = cajerosDisponibles.find(u => u.nombre.toLowerCase() === (cajeroNombre || '').toLowerCase());
      if (!match) {
        const defaultUser = cajerosDisponibles.find(u => u.rol === 'Cajero') || cajerosDisponibles[0];
        if (defaultUser) setCajeroNombre(defaultUser.nombre);
      }
    }
  }, [cajerosDisponibles, cajaEstado.abierto, modoOtroCajero]);

  const [deliverySearchQuery, setDeliverySearchQuery] = useState('');
  const [deliveryCategoriaFiltro, setDeliveryCategoriaFiltro] = useState('🔥 Más Pedidos');
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selections, setSelections] = useState({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState('');

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

  const fetchCajaData = useCallback(async () => {
    try {
      const [mesasData, resumenData, llevarData, ventasData, prods, clientsList, abonosList, comprasList, ultimoCierreRes, estadoCajaRes, usuariosList] = await Promise.all([
        api.getMesas().catch(() => null),
        api.getResumenVentas().catch(() => ({ atendidas: 0, ingresos: 0 })),
        api.getPedidosLlevar().catch(() => null),
        api.getHistorialVentas().catch(() => null),
        api.getProductos().catch(() => null),
        api.getClientes().catch(() => []),
        api.getAbonos().catch(() => []),
        api.getCompras().catch(() => []),
        api.getUltimoCierre().catch(() => null),
        api.getEstadoCaja().catch(() => null),
        api.getUsuarios().catch(() => []),
      ]);
      if (mesasData) setMesas(mesasData);
      if (llevarData) setPedidosLlevar(llevarData);
      if (resumenData) setStats({ atendidas: resumenData.atendidas || 0, ingresos: resumenData.ingresos || 0 });
      if (ventasData) setVentas(ventasData);
      if (prods) setProductosMenu(prods);
      if (usuariosList && Array.isArray(usuariosList)) setUsuariosSistema(usuariosList);
      setClientes(clientsList || []);
      setAbonos(abonosList || []);
      setComprasTurno(comprasList || []);

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
    } catch (err) {
      // Ignorar micro-caídas o lags de red Wi-Fi
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAbrirCaja = async (e) => {
    e?.preventDefault();
    setErrorApertura('');
    const cajero = cajeroNombre || currentUser?.nombre || 'Cajero';
    const monto = parseFloat(montoInicialInput || 0);
    if (isNaN(monto) || monto < 0) {
      setErrorApertura('El fondo inicial debe ser un número válido mayor o igual a 0.');
      return;
    }

    setGuardandoApertura(true);
    try {
      const res = await api.abrirCaja({
        cajeroNombre: cajero,
        montoInicial: monto,
        notaApertura: notaAperturaInput.trim() || null,
      });

      if (res.error) {
        setErrorApertura(res.error);
        return;
      }

      setModalAperturaOpen(false);
      setModoOtroCajero(false);
      setMontoInicialInput('');
      setNotaAperturaInput('');
      await fetchCajaData();
      addToast(`🔓 Turno iniciado exitosamente por ${cajero}. Fondo inicial: S/ ${monto.toFixed(2)}`, 'success');
    } catch (err) {
      setErrorApertura('Error al abrir caja: ' + err.message);
    } finally {
      setGuardandoApertura(false);
    }
  };

  useEffect(() => {
    fetchCajaData();
    const interval = setInterval(() => {
      if (!modalOpen && !deliveryModal && !cierreModalOpen && !historialCierresModalOpen) fetchCajaData();
    }, 4000);
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

  const buscarCliente = async () => {
    if (!numDocumento) return;
    setIsBuscando(true);
    const doc = numDocumento.trim();
    
    // Fallbacks locales rápidos de prueba en desarrollo
    if (doc === '20613857321') {
      setClienteNombre('FIRST FISH S.A.C.');
      setClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setTipoComprobante('Factura');
      setIsBuscando(false);
      return;
    } else if (doc === '10404040404') {
      setClienteNombre('JUAN PEREZ SOTO');
      setClienteDireccion('CALLE SAN MARTÍN 109');
      setTipoComprobante('Boleta');
      setIsBuscando(false);
      return;
    }

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setClienteNombre(data.razonSocial || '');
        setClienteDireccion(data.direccion || '');
        setTipoComprobante('Factura');
      } else {
        setClienteNombre(data.nombre || '');
        setClienteDireccion(data.direccion || '');
        setTipoComprobante('Boleta');
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC:", err);
      // Mantener campos vacíos en caso de error para permitir escritura manual limpia
      setClienteNombre('');
      setClienteDireccion('');
    }
 finally {
      setIsBuscando(false);
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
      alert("No se encontró el cliente o error en la consulta.");
    } finally {
      setIsBuscando(false);
    }
  };


  const reimprimirComprobante = (v) => {
    if (!v) return;
    const rucEmpresa = `R.U.C. N° ${COMPANY_CONFIG.ruc}`;
    
    let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : (v.tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    let correlativoStr = String(v.numero || (v.id % 10000)).padStart(4, '0');
    let qrData = `${rucEmpresa}|${v.tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${v.igv.toFixed(2)}|${v.total.toFixed(2)}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':(v.numDocumento?.length === 8 ? '1' : '0')}|${v.numDocumento || '00000000'}`;
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    let enlacePdf = null;
    let contingencia = v.estadoNubefact === 'PENDIENTE_REINTENTO';


    if (v.estadoNubefact && v.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(v.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        if (responseData.cadena_para_codigo_qr) {
          qrData = responseData.cadena_para_codigo_qr;
        }
        if (responseData.key) {
          hashResumen = responseData.key;
        }
        enlacePdf = responseData.enlace_del_pdf || null;
      } catch (err) {
        console.error("Error parsing Nubefact response:", err);
      }
    }

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



  const enviarPorWhatsApp = (v) => {
    if (!v) return;
    const telefono = prompt("Ingresa el número de WhatsApp del cliente (Ej. 999888777):");
    if (!telefono) return;
    
    // Validar formato básico peruano (9 dígitos)
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      alert("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    let correlativoStr = String(v.id % 10000).padStart(4, '0');
    let enlace = 'https://www.sunat.gob.pe';

    if (v.estadoNubefact && v.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(v.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        enlace = responseData.enlace_del_pdf || responseData.enlace || enlace;
      } catch (err) {
        console.error("Error parsing Nubefact response for WhatsApp:", err);
      }
    }
    
    const detalle = (v.itemsResumen || '').trim();
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, le enviamos el detalle de su consumo en *${COMPANY_CONFIG.name}*:\n\n${detalle ? detalle + '\n\n' : ''}Total: *S/ ${v.total.toFixed(2)}*\nTicket de venta N° ${v.id}\n\n¡Gracias por su preferencia!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };






  const handleComprobanteChange = (val) => {
    setTipoComprobante(val);
    setNumDocumento('');
    setClienteNombre('');
    setClienteDireccion('');
  };

  const procesarCobroYFacturar = async () => {
    if (cobrando) return;
    if (!mesaSeleccionada || !mesaSeleccionada.pedidoData) return;
    if (tipoComprobante === 'Factura') {
      if (!numDocumento || numDocumento.trim().length !== 11) {
        alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
        return;
      }
      if (!clienteNombre || !clienteNombre.trim()) {
        alert('Por favor, busca y valida el RUC del cliente antes de cobrar.');
        return;
      }
      if (!clienteDireccion || !clienteDireccion.trim()) {
        alert('La Dirección fiscal del cliente es obligatoria para emitir una Factura. Por favor, ingrésala.');
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
        alert('Debe seleccionar un cliente con línea de crédito para continuar.');
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
          alert('⚠️ Has marcado la opción de incluir crédito en Pago Mixto. Debes seleccionar al menos un cliente de crédito e ingresar su monto.');
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
        alert('⚠️ La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar. El vuelto solo aplica sobre Efectivo.');
        return;
      }

      const restante = parseFloat(Math.max(0, total - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, total - (efecVal + tarjVal + yapeVal + credVal)).toFixed(2));
        alert(`⚠️ Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}.\nFaltan S/ ${faltante.toFixed(2)}`);
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

    const pagaConNum = parseMonto(pagaConEfectivoMesa) || total;
    const vueltoNum = metodoPago === 'Efectivo' && pagaConNum > total ? (pagaConNum - total) : 0;

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
      payload: {
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
        cajeroNombre: cajeroNombre || currentUser?.nombre || 'Cajero'
      }
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
      setMontoCreditoMixto('');
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
        alert(`✅ Consumo Personal registrado. Mesa liberada.`);
      }

      await fetchCajaData();
    } catch (err) {
      alert('Error al procesar cobro: ' + err.message);
    } finally {
      setCobrando(false);
    }
  };




  const confirmarEntregaDelivery = async (pedidoId, codigo) => {
    if (!confirm(`¿Confirmas la entrega del pedido ${codigo}?`)) return;
    try {
      await api.confirmarEntrega(pedidoId);
      await fetchCajaData();
      alert(`✅ Entrega del pedido ${codigo} confirmada.`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // --- Cambiar método de pago de una venta existente ---
  const handleCambiarMetodoPago = async () => {
    if (!cambioPin.trim()) { setCambioError('Ingresa el PIN de Administrador.'); return; }
    if (!cambioNuevoMetodo) { setCambioError('Selecciona el nuevo método de pago.'); return; }
    
    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    const total = ventaACambiar.total;

    if (cambioNuevoMetodo === 'Mixto') {
      const efecVal = parseFloat(cambioMixtoEfectivo || 0);
      const tarjVal = parseFloat(cambioMixtoTarjeta || 0);
      const yapeVal = parseFloat(cambioMixtoYape || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0) {
        setCambioError('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (tarjVal + yapeVal > total) {
        setCambioError('La suma de Tarjeta y Yape / Plin no puede superar el total a pagar.');
        return;
      }

      const restante = total - (tarjVal + yapeVal);
      if (efecVal < restante) {
        setCambioError(`Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}. Faltan S/ ${(restante - efecVal).toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
    }

    setCambiando(true);
    setCambioError('');
    try {
      const res = await api.cambiarMetodoPago(ventaACambiar.id, cambioNuevoMetodo, cambioPin.trim(), {
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape
      });
      if (res.error) { setCambioError(res.error); return; }
      // Actualizar el estado local de ventas sin recargar
      setVentas(prev => prev.map(v => v.id === ventaACambiar.id ? { 
        ...v, 
        metodoPago: cambioNuevoMetodo,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape 
      } : v));
      setCambioMetodoModal(false);
      setVentaACambiar(null);
      setCambioPin('');
      setCambioNuevoMetodo('Efectivo');
      setCambioMixtoEfectivo('');
      setCambioMixtoTarjeta('');
      setCambioMixtoYape('');
      await fetchCajaData();
    } catch (err) {
      setCambioError('Error de conexión: ' + err.message);
    } finally {
      setCambiando(false);
    }
  };

  // --- Cambiar tipo de entrega de una venta existente ---
  const abrirCambioTipoEntregaModal = (v) => {
    setVentaATipoCambiar(v);
    setCambioTipoPin('');
    setCambioTipoError('');
    
    let currentType = 'ParaLlevar';
    let currentCodePY = '';
    let currentName = '';
    let currentPhone = '';
    let currentDir = '';
    let currentFee = '';
    let currentPayWith = '';
    let currentMethod = v.metodoPago || 'Efectivo';

    if (v.codigoPedidosYa) {
      if (v.codigoPedidosYa.startsWith('DELIVERY -')) {
        currentType = 'DeliveryPropio';
        const parsed = parseDeliveryInfo(v.codigoPedidosYa);
        if (parsed) {
          currentName = parsed.nombre;
          currentPhone = parsed.telefono;
          currentDir = parsed.direccion;
          currentFee = parsed.montoDelivery || '';
          currentPayWith = parsed.conCuanto || '';
        }
      } else if (v.codigoPedidosYa.startsWith('LLEVAR -')) {
        currentType = 'ParaLlevar';
        currentName = v.codigoPedidosYa.replace('LLEVAR - ', '');
      } else {
        currentType = 'PedidosYa';
        currentCodePY = v.codigoPedidosYa;
        currentName = 'PEDIDOS YA';
        currentMethod = 'PedidosYa';
      }
    }

    setCambioNuevoTipo(currentType);
    setCambioCodigoPY(currentCodePY);
    setCambioNombreCliente(currentName);
    setCambioTelefono(currentPhone);
    setCambioDireccion(currentDir);
    setCambioMontoDelivery(currentFee);
    setCambioMontoConCuanto(currentPayWith);
    setCambioMetodoPago(currentMethod === 'PedidosYa' ? 'Efectivo' : currentMethod);
    setCambioTipoEntregaModal(true);
  };

  const handleCambiarTipoEntrega = async () => {
    if (!cambioTipoPin.trim()) { setCambioTipoError('Ingresa el PIN de Administrador.'); return; }
    
    if (cambioNuevoTipo === 'PedidosYa' && !cambioCodigoPY.trim()) {
      setCambioTipoError('Ingresa el Código de PedidosYa.');
      return;
    }
    if ((cambioNuevoTipo === 'ParaLlevar' || cambioNuevoTipo === 'DeliveryPropio') && !cambioNombreCliente.trim()) {
      setCambioTipoError('Ingresa el nombre del cliente.');
      return;
    }
    if (cambioNuevoTipo === 'DeliveryPropio' && !cambioDireccion.trim()) {
      setCambioTipoError('Ingresa la dirección de envío.');
      return;
    }

    setCambioTipoCambiando(true);
    setCambioTipoError('');

    try {
      const res = await api.cambiarTipoEntrega(ventaATipoCambiar.id, {
        tipoEntrega: cambioNuevoTipo,
        codigoPedidosYa: cambioCodigoPY.trim(),
        nombreCliente: cambioNombreCliente.trim(),
        telefono: cambioTelefono.trim(),
        direccion: cambioDireccion.trim(),
        montoDelivery: parseFloat(cambioMontoDelivery || 0),
        montoConCuanto: parseFloat(cambioMontoConCuanto || 0),
        metodoPago: cambioMetodoPago,
        pin: cambioTipoPin.trim()
      });

      if (res.error) {
        setCambioTipoError(res.error);
        return;
      }

      await fetchCajaData();
      setCambioTipoEntregaModal(false);
      setVentaATipoCambiar(null);
      setCambioTipoPin('');
      alert('✅ Tipo de entrega corregido exitosamente.');
    } catch (err) {
      setCambioTipoError('Error de conexión: ' + err.message);
    } finally {
      setCambioTipoCambiando(false);
    }
  };


  const reintentarVentaIndividual = async (ventaId) => {
    try {
      const res = await api.reintentarNubefact(ventaId);
      if (res.error) {
        alert(`❌ Error al enviar a SUNAT: ${res.error}`);
        return;
      }
      await fetchCajaData();
      alert(`✅ Comprobante enviado y aceptado por SUNAT.`);
    } catch (err) {
      alert(`❌ Error al conectar con el servidor: ${err.message}`);
    }
  };

  const abrirAnularVentaModal = (v) => {
    setVentaAAnular(v);
    setAnularPin('');
    setAnularMotivo('');
    setAnularError('');
    setAnularCargando(false);
    setAnularVentaModal(true);
  };

  const procesarAnulacionVenta = async () => {
    if (!anularPin) {
      setAnularError('Por favor ingresa el PIN de Administrador.');
      return;
    }
    if (!anularMotivo.trim()) {
      setAnularError('Por favor ingresa el motivo de la devolución / anulación.');
      return;
    }
    setAnularCargando(true);
    setAnularError('');
    try {
      const res = await api.anularVenta(ventaAAnular.id, anularPin, anularMotivo);
      if (res.error) {
        setAnularError(res.error);
        return;
      }
      setAnularVentaModal(false);
      setVentaAAnular(null);
      setAnularPin('');
      setAnularMotivo('');
      await fetchCajaData();
      alert('✅ Devolución / Anulación registrada con éxito. La venta ha sido ajustada a S/ 0.00 en caja.');
    } catch (err) {
      setAnularError('Error al procesar devolución: ' + err.message);
    } finally {
      setAnularCargando(false);
    }
  };

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
    setDeliveryClienteNombre('');
    setDeliveryNumDocumento('');
    setTipoDelivery('PedidosYa');
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

  const getProductSteps = (prod, currentSelections = {}) => {
    const steps = getProductStepsBase(prod, currentSelections);
    const nameNorm = (prod && prod.nombre || '').toLowerCase();
    const isCuartoOOctavo = 
      nameNorm.includes('1/4') || nameNorm.includes('cuarto') || 
      nameNorm.includes('1/8') || nameNorm.includes('octavo');

    if (prod && prod.requiereGuarnicion && !isCuartoOOctavo) {
      steps.push({
        name: "Cantidad de Ensaladas",
        key: "cantidad_ensaladas",
        options: [
          { label: "Sin Ensalada", value: "Sin Ensalada" },
          { label: "1 Ensalada", value: "1 Ensalada" },
          { label: "2 Ensaladas", value: "2 Ensaladas" },
          { label: "3 Ensaladas", value: "3 Ensaladas" },
          { label: "4 Ensaladas", value: "4 Ensaladas" },
          { label: "5 Ensaladas", value: "5 Ensaladas" },
          { label: "6 Ensaladas", value: "6 Ensaladas" },
          { label: "7 Ensaladas", value: "7 Ensaladas" },
          { label: "8 Ensaladas", value: "8 Ensaladas" },
          { label: "9 Ensaladas", value: "9 Ensaladas" },
          { label: "10 Ensaladas", value: "10 Ensaladas" }
        ]
      });
    }
    return steps;
  };

  const getProductStepsBase = (prod, currentSelections = {}) => {
    if (!prod) return [];
    
    // 1. Variantes de Tallarines Verdes
    if (prod.esAgrupado) {
      const todasLasVariantes = (prod.variantes && prod.variantes.length > 0)
        ? prod.variantes
        : productosMenu.filter(p => (p.categoria === 'Tallarines Verdes' || (p.nombre && /tallar[ií]n(es)?\s+verde(s)?/i.test(p.nombre))) && p.activo !== false);
      return [{
        name: "Elige la Variante de Carne",
        key: "producto_variante",
        options: todasLasVariantes.map(v => ({
          label: `${v.nombre.replace(/tallar[ií]n(es)?\s+verde(s)?\s*(con\s*)?/i, 'Con ')} (S/ ${v.precio.toFixed(2)})`,
          value: v
        }))
      }];
    }

    // 2. OPCIONES Y MODIFICADORES PERSONALIZADOS DEL CLIENTE (MÁXIMA PRIORIDAD)
    const pasoAcomp = pasoComplementos(prod);
    const pasosConfigurados = parsePasosOpciones(prod);
    if (pasosConfigurados.length > 0) return pasoAcomp ? [...pasosConfigurados, pasoAcomp] : pasosConfigurados;
    // Sin opciones configuradas, pero con acompañamientos: igual se abre el asistente
    if (pasoAcomp) return [pasoAcomp];

    // 3. Blindaje de Carta: Si el producto fue configurado en la carta (tiene opcionesConfig)
    // o tiene requiereGuarnicion === false, NUNCA cae en los pasos demo/legacy hardcodeados.
    if ((prod.opcionesConfig !== null && prod.opcionesConfig !== undefined) || prod.requiereGuarnicion === false) {
      return [];
    }

    // 4. Categoría Menú (fallback solo si requiereGuarnicion es true y no tiene opcionesConfig)
    const isMenuCat = prod && (prod.categoria === 'Menú' || prod.categoria?.toLowerCase().includes('menú'));
    if (isMenuCat && prod.requiereGuarnicion && !prod.opcionesConfig) {
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
            { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
            { label: "Limonada - Vaso", value: "Limonada - Vaso" },
            { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
            { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
          ]
        }
      ];
    }
    
    // 5. Combos configurados (fallback legacy solo si requiereGuarnicion es true)
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
    const isCombo = prod && (String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo'));
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

    return [];
  };

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
        setSelections({});
        setCurrentStepIdx(0);
        setAdditionalNotes('');
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
      alert(`⚠️ Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
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
        alert(`⚠️ Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
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

  const handleExecuteCancelLlevar = async () => {
    if (!pinCancelLlevar.trim()) {
      setErrorCancelLlevar('El PIN es obligatorio.');
      return;
    }
    try {
      const auth = await api.validateAuth(pinCancelLlevar.trim());
      if (!auth || !auth.ok) {
        setErrorCancelLlevar('PIN incorrecto. Autorización denegada.');
        return;
      }
      const res = await api.cancelarPedido(pedidoACancelarLlevar.pedidoId, {
        canceladoPor: cajeroNombre,
        motivo: 'Cancelado por cajero (error en pedido)',
        force: true,
      });
      if (res.ok) {
        addToast('Pedido cancelado. Cocina ha sido notificada.', 'success');
        setCancelLlevarModalOpen(false);
        setPedidoACancelarLlevar(null);
        fetchCajaData();
      } else {
        setErrorCancelLlevar(res.error || 'No se pudo cancelar el pedido.');
      }
    } catch (err) {
      setErrorCancelLlevar('Error de conexión con el servidor.');
    }
  };

  const abrirTicketImpresionDirecto = (total, response, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items, mesaNum = 'Delivery', deliveryInfo = null, descuentoAplicado = 0, ofertaDescripcion = null) => {
    if (!response) response = {};
    const fecha = new Date().toLocaleDateString('es-PE');
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    let serie = response.serie || (tipoComprobante === 'Factura' ? 'F001' : (tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    let correlativoStr = String(response.numero || 1).padStart(4, '0');
    let subtotal = total / 1.105;
    let igv = total - subtotal;
    let totalLetras = numeroALetras(total);
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = `R.U.C. N° ${COMPANY_CONFIG.ruc}`;
    let qrData = `${rucEmpresa}|${tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igv.toFixed(2)}|${total.toFixed(2)}|${fecha}|${tipoComprobante === 'Factura' ? '6' : (numDocumento?.length === 8 ? '1' : '0')}|${numDocumento || '00000000'}`;
    let enlacePdf = null;

    let contingencia = response.contingencia || false;

    // Extraer datos oficiales devueltos por la API de Nubefact
    if (response.estadoNubefact && response.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(response.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        if (responseData.cadena_para_codigo_qr) {
          qrData = responseData.cadena_para_codigo_qr;
        }
        if (responseData.key) {
          hashResumen = responseData.key;
        }
        enlacePdf = responseData.enlace_del_pdf || null;
      } catch (err) {
        console.error("Error parsing Nubefact response:", err);
      }
    }

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
    if (itemsDelivery.length === 0) { alert('Debes agregar al menos un producto.'); return; }
    
    // Validar datos según el canal seleccionado
    if (tipoDelivery === 'PedidosYa') {
      if (!codigoPY.trim()) {
        alert('El código de PedidosYa es obligatorio.');
        return;
      }
    } else if (tipoDelivery === 'ParaLlevar') {
      if (!codigoPY.trim()) {
        alert('El nombre del cliente o número de ticket es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
        if (!deliveryClienteNombre.trim()) {
          alert('Para emitir Factura, la Razón Social del cliente es obligatoria.');
          return;
        }
        if (!deliveryDireccion.trim()) {
          alert('Para emitir Factura, la Dirección fiscal del cliente es obligatoria. Por favor, ingrésala.');
          return;
        }
      }
    } else if (tipoDelivery === 'DeliveryPropio') {
      if (!deliveryClienteNombre.trim()) {
        alert('El nombre del cliente es obligatorio.');
        return;
      }
      if (!deliveryDireccion.trim()) {
        alert('La dirección del cliente es obligatoria.');
        return;
      }
      if (!deliveryTelefono.trim()) {
        alert('El teléfono del cliente es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
      }
    }

    // Validar PIN de administrador si el método de pago es Consumo o Cortesía, o si hay ítems de cortesía
    const tieneCortesias = deliveryMetodoPago === 'Consumo' || deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0;
    if (tieneCortesias) {
      if (!pinAdminDelivery.trim()) {
        alert(`⚠️ Debes ingresar el PIN del administrador/cajero para autorizar ${deliveryMetodoPago === 'Consumo' ? 'un Consumo de Personal' : 'la Cortesía'}.`);
        return;
      }
      const authResult = await api.validateAuth(pinAdminDelivery.trim());
      if (!authResult || !authResult.ok) {
        alert(`❌ PIN incorrecto. Solo el administrador/cajero puede autorizar ${deliveryMetodoPago === 'Consumo' ? 'un Consumo de Personal' : 'la Cortesía'}.`);
        setPinAdminDelivery('');
        return;
      }
    }

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Crédito') {
      if (!deliveryClienteCreditoSeleccionado) {
        alert('Debe seleccionar un cliente con línea de crédito para continuar.');
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
        alert('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (credVal > 0 && !deliveryClienteCreditoSeleccionado) {
        alert('Debe seleccionar un cliente para la porción de pago a crédito.');
        return;
      }

      if (tarjVal + yapeVal + credVal > grandTotal) {
        alert('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar.');
        return;
      }

      const restante = grandTotal - (tarjVal + yapeVal + credVal);
      if (efecVal < restante) {
        alert(`Monto insuficiente. Debes cubrir el total de S/ ${grandTotal.toFixed(2)}.\nFaltan S/ ${(restante - efecVal).toFixed(2)}`);
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
        cajero: cajeroNombre,
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
      };

      const result = editingPedidoId 
        ? await api.actualizarDelivery(editingPedidoId, payload)
        : await api.crearPedidoLlevar(payload);

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
        alert(`✅ Pedido ${codigoPY.toUpperCase()} enviado a Cocina. Venta registrada.`);
      }
    } catch (err) {
      alert('Error: ' + err.message);
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
  const abrirCobroMesa = (m) => {
    if (!cajaEstado.abierto) {
      setModalAperturaOpen(true);
      return;
    }
    setMesaSeleccionada(m);
    setTipoComprobante('Boleta');
    setMetodoPago('Efectivo');
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
    setMontoCreditoMixto('');
    setMixtoEfectivo('');
    setMixtoTarjeta('');
    setMixtoYape('');
    setModalOpen(true);
  };

  const esPedidoListo = (p) => {
    const e = (p.estado || '').toUpperCase();
    return p.estado === 'Servido' || e.includes('LISTO') || e.includes('SERVIDO');
  };

  const origenPedido = (codigo = '') => {
    if (codigo.startsWith('DELIVERY -')) {
      const info = parseDeliveryInfo(codigo);
      return { tipo: 'delivery', etiqueta: 'Delivery', nombre: info ? info.nombre : codigo.replace('DELIVERY - ', ''), info, Icon: Bike, color: 'bg-indigo-50 text-indigo-600' };
    }
    if (codigo.startsWith('LLEVAR -')) {
      return { tipo: 'llevar', etiqueta: 'Para llevar', nombre: codigo.replace('LLEVAR - ', ''), info: null, Icon: ShoppingBag, color: 'bg-cyan-50 text-cyan-700' };
    }
    return { tipo: 'pedidosya', etiqueta: 'PedidosYa', nombre: codigo, info: null, Icon: Truck, color: 'bg-rose-50 text-rose-600' };
  };

  const clienteDeVenta = (v) => {
    const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    if (info) return info.nombre;
    if (v.nombreCliente?.startsWith('DELIVERY -')) return v.nombreCliente.replace('DELIVERY - ', '');
    return v.nombreCliente || 'Consumidor Final';
  };

  const origenDeVenta = (v) => (v.codigoPedidosYa ? origenPedido(v.codigoPedidosYa).etiqueta : `Mesa ${v.mesaNum}`);

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

  const iconoEditar = (onClick, title) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );

  const modalDetalle = (onClose, header, body, footer) => (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
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
  const activeIngresosPedidosYa = ventasTurno
    .filter(v => v.metodoPago === 'PedidosYa')
    .reduce((s, v) => s + v.total, 0);
  const activeCortesias = ventasTurno
    .filter(v => v.metodoPago === 'Cortesía')
    .reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + (i.cant * i.precio), 0) || 0), 0);

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
  const ventasLista = ventasTurno.filter(v => {
    if (filtroMetodoPago !== 'Todos') {
      let method = v.metodoPago;
      if (method === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) {
        method = 'Efectivo';
      }
      if (method !== filtroMetodoPago) return false;
    }
    if (!busquedaVentasNorm) return true;
    return [`vt-${v.id}`, String(v.id), clienteDeVenta(v), origenDeVenta(v), v.itemsResumen, v.serie && `${v.serie}-${v.numero}`]
      .some(s => s && String(s).toLowerCase().includes(busquedaVentasNorm));
  });
  const ventasVisibles = ventasLista.slice(0, ventasLimite);

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
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
                {cajaEstado.turno?.notaApertura && <span className="italic text-slate-400 truncate">“{cajaEstado.turno.notaApertura}”</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={abrirHistorialCierres}
              className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Historial de cierres"
            >
              <History className="w-4 h-4" /> <span className="hidden sm:inline">Cierres</span>
            </button>
            <button
              type="button"
              onClick={() => setCierreModalOpen(true)}
              className="h-10 px-3.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Arqueo y cierre
            </button>
            <button
              type="button"
              onClick={abrirDeliveryModal}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700 shadow-sm shadow-sky-600/25 transition-colors active:scale-[0.98] ml-auto md:ml-0"
            >
              <Plus className="w-4 h-4" /> Nuevo pedido
            </button>
          </div>
        </header>

        {!cajaEstado.cargando && !cajaEstado.abierto && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500 text-white grid place-items-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-800">Caja cerrada</p>
                <p className="text-sm text-rose-700/80">Inicia un turno con el fondo de sencillo para habilitar cobros y pedidos.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalAperturaOpen(true)}
              className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white transition-colors shrink-0"
            >
              <Unlock className="w-4 h-4" /> Abrir caja
            </button>
          </div>
        )}

        {/* RESUMEN DEL TURNO */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="col-span-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-4 sm:p-5 shadow-sm shadow-emerald-600/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-emerald-50/90">Ingresos en caja</p>
              <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Banknote className="w-4 h-4" /></span>
            </div>
            <p className="mt-1 text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight">{soles(activeIngresosCaja)}</p>
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-xs">
              {[['Efectivo', activeEfectivo], ['Tarjeta', activeTarjeta], ['Yape', activeYape]].map(([label, monto]) => (
                <div key={label} className="min-w-0">
                  <p className="text-emerald-50/75">{label}</p>
                  <p className="font-mono tabular-nums text-white truncate">{soles(monto)}</p>
                </div>
              ))}
            </div>
          </div>
          {[
            { label: 'Ventas', valor: ventasTurno.length, hint: `${mesasPendientes.length + pedidosLlevar.length} por cobrar/entregar`, Icon: Receipt, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' },
            { label: 'Créditos', valor: soles(totalCreditosTurno), hint: `Clientes ${soles(activeConsumoClientes)} · Planilla ${soles(activeConsumoPlanilla)}`, Icon: Wallet, color: 'bg-teal-50 text-teal-600', borde: 'border-t-teal-500' },
            { label: 'PedidosYa', valor: soles(activeIngresosPedidosYa), hint: 'Cobro semanal · fuera del cuadre', Icon: Truck, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' },
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
                    const listo = m.estado === 'Servido';
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
                            {estadoChip(listo, 'Listo p/ cobrar', 'En preparación')}
                            {m.pedidoData?.estadoEnsalada === 'Pendiente' && <span className="text-[11px] text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">🥗 Pendiente</span>}
                            {m.pedidoData?.estadoEnsalada === 'Listo' && <span className="text-[11px] text-blue-700 bg-blue-50 rounded-md px-1.5 py-0.5">🥗 Lista</span>}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); abrirCobroMesa(m); }}
                            className="h-8 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/25 transition-colors active:scale-95 shrink-0"
                          >
                            Cobrar
                          </button>
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
                    const o = origenPedido(p.codigoPedidosYa);
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
                <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center"><Receipt className="w-4 h-4" /></span> Últimas ventas
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
                    <option value="Consumo">Consumo personal</option>
                    <option value="Cortesía">Cortesías</option>
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
                    {ventasVisibles.map(v => {
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
                    {busquedaVentasNorm || filtroMetodoPago !== 'Todos' ? 'Ninguna venta coincide con el filtro.' : 'Aún no se registran ventas en este turno.'}
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
      {mesaDetalle && (() => {
        const m = mesaDetalle;
        const items = (m.pedidoData?.items || []).filter(Boolean);
        return modalDetalle(
          () => setMesaDetalleNum(null),
          <>
            <p className="text-lg font-semibold text-slate-900">Mesa {m.num}</p>
            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-2">
              <span>{m.pedidoData?.mesero || '—'}</span><span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{m.pedidoData?.hora}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {estadoChip(m.estado === 'Servido', 'Listo p/ cobrar', 'En preparación')}
              {m.pedidoData?.estadoEnsalada && <span className="text-[11px] text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">🥗 Ensalada {m.pedidoData.estadoEnsalada.toLowerCase()}</span>}
            </div>
          </>,
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Consumo ({items.length})</p>
            {items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-slate-700"><span className="font-mono text-slate-400 mr-2">{i.cant}×</span>{i.nombre}</span>
                    {i.precio != null && <span className="font-mono tabular-nums text-slate-600 shrink-0">{soles(i.cant * i.precio)}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">Sin consumos</p>}
          </div>,
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-slate-900">{soles(m.pedidoData?.total)}</p>
            </div>
            <button
              type="button"
              onClick={() => { setMesaDetalleNum(null); abrirCobroMesa(m); }}
              className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
            >
              Cobrar mesa
            </button>
          </div>
        );
      })()}

      {/* MODAL: DETALLE DE PEDIDO PARA LLEVAR / DELIVERY */}
      {pedidoDetalle && (() => {
        const p = pedidoDetalle;
        const o = origenPedido(p.codigoPedidosYa);
        const listo = esPedidoListo(p);
        const items = (p.items || []).filter(Boolean);
        return modalDetalle(
          () => setPedidoDetalleId(null),
          <>
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><o.Icon className="w-3.5 h-3.5" /> {o.etiqueta}</p>
            <p className="text-lg font-semibold text-slate-900 break-words">{o.nombre}</p>
            <p className="text-sm text-slate-500">{p.cajero} · {p.hora}</p>
            <div className="mt-2">{estadoChip(listo, 'Listo para entregar', 'En cocina')}</div>
          </>,
          <>
            {o.info && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {o.info.telefono && <div><dt className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</dt><dd className="text-slate-800">{o.info.telefono}</dd></div>}
                {o.info.direccion && <div className="sm:col-span-2"><dt className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección</dt><dd className="text-slate-800 break-words">{o.info.direccion}</dd></div>}
                {o.info.conCuanto && <div><dt className="text-xs text-slate-400">Paga con</dt><dd className="font-mono text-slate-800">{o.info.conCuanto}</dd></div>}
                {o.info.vuelto && <div><dt className="text-xs text-slate-400">Vuelto</dt><dd className="font-mono text-slate-800">{o.info.vuelto}</dd></div>}
              </dl>
            )}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Productos ({items.length})</p>
              {items.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 text-slate-700"><span className="font-mono text-slate-400 mr-2">{i.cant}×</span>{i.nombre}</span>
                      {i.precio != null && <span className="font-mono tabular-nums text-slate-600 shrink-0">{soles(i.cant * i.precio)}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">Sin detalle de productos</p>}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-xl font-semibold font-mono tabular-nums text-slate-900">{soles(p.total)}</span>
            </div>
          </>,
          <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPedidoDetalleId(null);
                setPedidoACancelarLlevar(p);
                setPinCancelLlevar('');
                setErrorCancelLlevar('');
                setCancelLlevarModalOpen(true);
              }}
              className="h-10 px-4 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={() => { setPedidoDetalleId(null); iniciarModificarDelivery(p); }}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-4 h-4" /> Modificar
            </button>
            {listo && (
              <button
                type="button"
                onClick={() => { setPedidoDetalleId(null); confirmarEntregaDelivery(p.pedidoId, p.codigoPedidosYa); }}
                className="col-span-2 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4" /> Confirmar entrega
              </button>
            )}
          </div>
        );
      })()}

      {/* MODAL: DETALLE DE VENTA */}
      {ventaDetalle && (() => {
        const v = ventaDetalle;
        const est = estiloMetodo(v.metodoPago);
        const items = itemsDeVenta(v);
        const infoDelivery = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
        const ofertaLimpia = v.ofertaDescripcion ? v.ofertaDescripcion.replace(/\[CREDITO_SPLIT:.*?\]/g, '').trim() : '';
        return modalDetalle(
          () => setVentaDetalleId(null),
          <>
            <p className="text-xs font-medium text-slate-400 font-mono">#VT-{v.id} · {v.hora}</p>
            <p className="text-lg font-semibold text-slate-900">
              {v.tipoComprobante} {v.serie ? `${v.serie}-${String(v.numero).padStart(4, '0')}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {v.anulado ? (
                <span className="text-xs font-medium text-red-700 bg-red-50 rounded-md px-2 py-0.5">Devuelto</span>
              ) : (
                <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 ${est.chip}`}><est.Icon className="w-3 h-3" /> {v.metodoPago}</span>
              )}
              {!v.anulado && v.metodoPago === 'Cortesía' && <span className="text-xs font-medium text-orange-700 bg-orange-50 rounded-md px-2 py-0.5">Cortesía total</span>}
              {!v.anulado && v.metodoPago !== 'Cortesía' && v.itemsResumen?.includes('CORTESÍA') && <span className="text-xs font-medium text-orange-700 bg-orange-50 rounded-md px-2 py-0.5">Con cortesía</span>}
              {FACTURACION_ELECTRONICA && v.estadoNubefact === 'PENDIENTE_REINTENTO' && <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-md px-2 py-0.5">Contingencia</span>}
              {FACTURACION_ELECTRONICA && v.estadoNubefact?.startsWith('ACEPTADO:') && <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">Enviado a SUNAT</span>}
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
              <div className="min-w-0">
                <dt className="text-xs text-slate-400">Cliente</dt>
                <dd className="text-slate-800 break-words">{clienteDeVenta(v)}</dd>
                {v.numDocumento && !v.numDocumento.startsWith('DELIVERY -') && <dd className="text-xs font-mono text-slate-500">{v.numDocumento}</dd>}
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-slate-400">Origen</dt>
                <dd className="flex items-center gap-1 text-slate-800">
                  <span className="truncate">{v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -') ? `PedidosYa · ${v.codigoPedidosYa}` : origenDeVenta(v)}</span>
                  {v.codigoPedidosYa && iconoEditar(() => abrirCambioTipoEntregaModal(v), 'Corregir tipo de entrega (requiere PIN Administrador)')}
                </dd>
              </div>
              {!v.anulado && (
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Método de pago</dt>
                  <dd className="flex items-center gap-1 text-slate-800">
                    <span className={est.text}>{v.metodoPago}</span>
                    {iconoEditar(() => {
                      setVentaACambiar(v);
                      setCambioNuevoMetodo(v.metodoPago);
                      setCambioPin('');
                      setCambioError('');
                      setCambioMetodoModal(true);
                    }, 'Corregir método de pago (requiere PIN Administrador)')}
                  </dd>
                  {v.metodoPago === 'Mixto' && (
                    <dd className="mt-1 text-xs font-mono text-slate-500 space-y-0.5">
                      {(v.montoEfectivo || 0) > 0 && <p>Efectivo {soles(v.montoEfectivo)}</p>}
                      {(v.montoTarjeta || 0) > 0 && <p>Tarjeta {soles(v.montoTarjeta)}</p>}
                      {(v.montoYape || 0) > 0 && <p>Yape {soles(v.montoYape)}</p>}
                      {(v.montoCredito || 0) > 0 && <p>Crédito {soles(v.montoCredito)}</p>}
                    </dd>
                  )}
                </div>
              )}
              {infoDelivery?.telefono && (
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</dt>
                  <dd className="text-slate-800">{infoDelivery.telefono}</dd>
                </div>
              )}
              {infoDelivery?.direccion && (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección</dt>
                  <dd className="text-slate-800 break-words">{infoDelivery.direccion}</dd>
                </div>
              )}
            </dl>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Productos ({items.length})</p>
              {items.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 text-slate-700">{i.cant != null && <span className="font-mono text-slate-400 mr-2">{i.cant}×</span>}{i.nombre}</span>
                      {i.subtotal != null && <span className="font-mono tabular-nums text-slate-600 shrink-0">{soles(i.subtotal)}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">Sin ítems</p>}
              {ofertaLimpia && <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">🏷️ {ofertaLimpia}</p>}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1 text-sm">
              {!v.anulado && v.descuentoAplicado > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-mono tabular-nums">{soles(parseFloat(v.total || 0) + parseFloat(v.descuentoAplicado || 0))}</span></div>
                  <div className="flex justify-between text-blue-600"><span>Descuento</span><span className="font-mono tabular-nums">−{soles(v.descuentoAplicado)}</span></div>
                </>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500">Total</span>
                {v.anulado ? (
                  <span className="text-right">
                    <span className="block text-xl font-semibold font-mono tabular-nums text-red-600">S/ 0.00</span>
                    <span className="block text-xs font-mono line-through text-slate-400">{soles(v.montoOriginal ?? v.total)}</span>
                  </span>
                ) : (
                  <span className="text-xl font-semibold font-mono tabular-nums text-slate-900">{soles(v.total)}</span>
                )}
              </div>
            </div>

            {!v.anulado && v.tipoComprobante === 'Ticket' && (
              <a
                href="https://ww1.sunat.gob.pe/ol-ti-itfesimpopciones/FESimpSunat.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Emitir boleta / factura en SUNAT</span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>
            )}
            {!v.anulado && FACTURACION_ELECTRONICA && (v.estadoNubefact === 'PENDIENTE_REINTENTO' || ((v.tipoComprobante === 'Boleta' || v.tipoComprobante === 'Factura') && !v.estadoNubefact?.startsWith('ACEPTADO:'))) && (
              <button
                type="button"
                onClick={() => reintentarVentaIndividual(v.id)}
                className="w-full h-10 rounded-xl border border-amber-200 bg-amber-50 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {v.estadoNubefact === 'PENDIENTE_REINTENTO' ? 'Reintentar envío a SUNAT' : 'Enviar a SUNAT'}
              </button>
            )}
          </>,
          !v.anulado && (
            <div className="grid grid-cols-3 sm:flex sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => abrirAnularVentaModal(v)}
                className="h-10 px-3 sm:px-4 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5"
                title="Registrar devolución (requiere PIN Administrador)"
              >
                <Ban className="w-4 h-4" /> <span className="truncate">Devolución</span>
              </button>
              <button
                type="button"
                onClick={() => enviarPorWhatsApp(v)}
                className="h-10 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 fill-current text-emerald-600 shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.161.001 6.136 1.23 8.375 3.466 2.238 2.237 3.467 5.21 3.466 8.373-.003 6.535-5.328 11.86-11.859 11.86-2.007-.001-3.98-.51-5.753-1.48L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.269 0 9.557-4.287 9.559-9.556.001-2.553-.99-4.955-2.792-6.758-1.802-1.802-4.199-2.793-6.753-2.794-5.27 0-9.559 4.287-9.56 9.559-.001 1.625.434 3.208 1.262 4.622L1.51 21.054l4.137-1.9zm12.135-6.843c-.268-.134-1.583-.78-1.828-.87-.247-.09-.427-.134-.607.134-.18.267-.697.87-.852 1.047-.156.178-.311.201-.579.067-.268-.134-1.132-.418-2.156-1.332-.796-.71-1.335-1.586-1.492-1.853-.156-.268-.017-.413.117-.547.12-.12.268-.312.401-.468.134-.156.179-.268.268-.446.09-.178.045-.335-.022-.469-.067-.134-.607-1.462-.832-2.002-.22-.53-.442-.457-.607-.466-.156-.008-.337-.008-.518-.008-.18 0-.473.067-.72.337-.247.268-.943.922-.943 2.248s.965 2.604 1.1 2.784c.134.18 1.9 2.901 4.6 4.068.643.277 1.143.443 1.534.568.646.205 1.233.176 1.697.107.518-.077 1.583-.647 1.807-1.272.223-.624.223-1.159.156-1.272-.069-.112-.249-.18-.517-.313z" />
                </svg>
                <span className="truncate">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => reimprimirComprobante(v)}
                className="h-10 px-3 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> <span className="truncate">Reimprimir</span>
              </button>
            </div>
          )
        );
      })()}

      {/* MODAL DE COBRO (MESAS) */}
      {modalOpen && mesaSeleccionada && (() => {
        const itemsMesa = (mesaSeleccionada.pedidoData.items || []).filter(Boolean);
        const cortesiaTotalMesa = metodoPago === 'Cortesía';
        const totalConCortesias = cortesiaTotalMesa ? 0 : itemsMesa
          .filter(i => !cortesiaItemIds.includes(i.itemId))
          .reduce((s, i) => s + (i.cant * i.precio), 0);
        const subtotalConCortesias = parseFloat((totalConCortesias / 1.105).toFixed(2));
        const igvConCortesias = parseFloat((totalConCortesias - subtotalConCortesias).toFixed(2));
        const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;
        const requierePin = metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales;
        const unidadesMesa = itemsMesa.reduce((s, i) => s + (i.cant || 0), 0);

        const labelCampo = 'block text-xs font-medium text-slate-500 mb-1.5';
        const inputCampo = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const inputMonto = 'w-full h-11 bg-white border border-slate-200 rounded-xl pl-9 pr-3 font-mono text-base font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const chipMonto = 'h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95';

        const campoMonto = (label, value, onChange, extra) => (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500">{label}</label>
              {parseMonto(value) > 0 && (
                <button type="button" onClick={() => onChange('')} className="text-[11px] text-slate-400 hover:text-rose-600">Limpiar</button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
              <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className={inputMonto} />
            </div>
            {extra}
          </div>
        );

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[110] flex items-end md:items-center justify-center md:p-6 animate-fade-in">
            <div className="bg-white w-full max-w-5xl h-[96dvh] md:h-[min(90dvh,820px)] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white grid place-items-center text-sm font-semibold shrink-0 shadow-sm shadow-emerald-600/30">{mesaSeleccionada.num}</div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">Cobrar mesa {mesaSeleccionada.num}</h2>
                    <p className="text-sm text-slate-500 truncate">
                      {mesaSeleccionada.pedidoData?.mesero || '—'} · {mesaSeleccionada.pedidoData?.hora} · {metodoPago === 'Consumo' ? 'Consumo personal (planilla)' : 'Ticket de venta'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">

                {/* Columna: consumo */}
                <div className="md:border-r border-b md:border-b-0 border-slate-100 bg-slate-50/60 flex flex-col md:min-h-0">
                  <div className="flex items-center justify-between px-5 md:px-6 pt-4 pb-2">
                    <p className="text-xs font-medium text-slate-500">Consumo · {unidadesMesa} ítem{unidadesMesa !== 1 ? 's' : ''}</p>
                    <p className={`text-[11px] flex items-center gap-1 ${cortesiaTotalMesa ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
                      <Gift className="w-3 h-3" /> {cortesiaTotalMesa ? 'Todo es cortesía' : 'Marca para cortesía'}
                    </p>
                  </div>
                  <ul className="flex-1 md:min-h-0 max-h-[38dvh] md:max-h-none overflow-y-auto custom-scrollbar px-3 md:px-4 pb-2">
                    {itemsMesa.map((item, idx) => {
                      const prodOriginal = productosMenu && productosMenu.find(p => p && String(p.id) === String(item.id));
                      const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                      const esCortesia = cortesiaTotalMesa || cortesiaItemIds.includes(item.itemId);
                      return (
                        <li key={idx} className={`rounded-xl px-2.5 py-2 transition-colors ${esCortesia ? 'bg-orange-50/70' : 'hover:bg-white'}`}>
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={esCortesia}
                              disabled={cortesiaTotalMesa}
                              onChange={() => {
                                if (esCortesia) setCortesiaItemIds(prev => prev.filter(id => id !== item.itemId));
                                else setCortesiaItemIds(prev => [...prev, item.itemId]);
                              }}
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-orange-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                              title="Marcar como cortesía (S/ 0.00)"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3 text-sm">
                                <span className={`min-w-0 ${esCortesia ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  <span className="font-mono text-slate-400 mr-1.5">{item.cant}×</span>{item.nombre}
                                </span>
                                <span className="font-mono tabular-nums shrink-0 text-right">
                                  {esCortesia ? (
                                    <span className="text-xs font-medium text-orange-600">Cortesía</span>
                                  ) : (
                                    <>
                                      {tieneDescuento && <span className="block text-[11px] line-through text-slate-400">{soles(item.cant * prodOriginal.precio)}</span>}
                                      <span className="text-slate-700">{soles(item.cant * item.precio)}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <input
                                type="text"
                                placeholder="Añadir nota…"
                                value={item.notas || item.notes || ''}
                                onChange={(e) => {
                                  setMesaSeleccionada(prev => {
                                    if (!prev || !prev.pedidoData) return prev;
                                    const nuevosItems = [...prev.pedidoData.items];
                                    const originalIdx = prev.pedidoData.items.findIndex(x => x.itemId === item.itemId);
                                    if (originalIdx >= 0) {
                                      nuevosItems[originalIdx].notas = e.target.value;
                                    }
                                    return { ...prev, pedidoData: { ...prev.pedidoData, items: nuevosItems } };
                                  });
                                }}
                                onBlur={async (e) => {
                                  if (item.itemId) {
                                    try {
                                      await api.updateItemNotas(item.itemId, e.target.value);
                                    } catch (err) {
                                      console.error("Error al actualizar nota en caja:", err);
                                    }
                                  }
                                }}
                                className="mt-0.5 w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-300 border-b border-transparent focus:border-slate-300 focus:outline-none py-0.5"
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="px-5 md:px-6 py-3 border-t border-slate-100 space-y-1 text-xs text-slate-500 shrink-0">
                    <div className="flex justify-between"><span>Subtotal (sin IGV)</span><span className="font-mono tabular-nums">{soles(subtotalConCortesias)}</span></div>
                    <div className="flex justify-between"><span>IGV (10.5%)</span><span className="font-mono tabular-nums">{soles(igvConCortesias)}</span></div>
                    <div className="flex justify-between pt-1 text-sm text-slate-900"><span className="font-medium">Total</span><span className="font-mono font-semibold tabular-nums">{soles(totalConCortesias)}</span></div>
                  </div>
                </div>

                {/* Columna: pago */}
                <div className="md:min-h-0 md:overflow-y-auto custom-scrollbar px-5 md:px-6 py-5 space-y-6">

                  {/* Método de pago */}
                  <div>
                    <p className={labelCampo}>Método de pago</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Efectivo', icon: Banknote, label: 'Efectivo' },
                        { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' },
                        { id: 'Yape', icon: Smartphone, label: 'Yape / Plin' },
                        { id: 'Crédito', icon: Wallet, label: 'Crédito' },
                        { id: 'Cortesía', icon: Gift, label: 'Cortesía' },
                        { id: 'Mixto', icon: Layers, label: 'Mixto' }
                      ].map(item => {
                        const IconComp = item.icon;
                        const active = metodoPago === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setMetodoPago(item.id);
                              if (item.id === 'Crédito' || item.id === 'Cortesía') {
                                setTipoComprobante('Ticket');
                              }
                            }}
                            className={`h-16 flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${active ? estiloMetodo(item.id).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                          >
                            <IconComp className={`w-4.5 h-4.5 ${active ? '' : estiloMetodo(item.id).icono}`} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Efectivo */}
                  {metodoPago === 'Efectivo' && (() => {
                    const total = totalConCortesias;
                    const pagaCon = parseFloat(pagaConEfectivoMesa || 0);
                    const vuelto = (pagaCon >= total && pagaCon > 0) ? (pagaCon - total) : 0;
                    const faltante = (pagaCon > 0 && pagaCon < total) ? (total - pagaCon) : 0;
                    return (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCampo}>Recibido</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={pagaConEfectivoMesa}
                                onChange={(e) => setPagaConEfectivoMesa(e.target.value)}
                                placeholder={total.toFixed(2)}
                                className={inputMonto}
                              />
                            </div>
                          </div>
                          <div>
                            <p className={labelCampo}>{faltante > 0 ? 'Falta' : 'Vuelto'}</p>
                            <p className={`h-11 flex items-center px-3 rounded-xl font-mono text-lg font-semibold tabular-nums ${faltante > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {soles(faltante > 0 ? faltante : vuelto)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setPagaConEfectivoMesa(total.toFixed(2))} className={`${chipMonto} !border-emerald-600 !bg-emerald-600 !text-white`}>
                            Exacto
                          </button>
                          {[10, 20, 50, 100, 200].map(monto => (
                            <button key={monto} type="button" onClick={() => setPagaConEfectivoMesa(monto.toFixed(2))} className={chipMonto}>
                              S/ {monto}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {(metodoPago === 'Tarjeta' || metodoPago === 'Yape') && (
                    <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3 animate-fade-in">
                      Se registrará <span className="font-mono font-semibold text-slate-900">{soles(totalConCortesias)}</span> pagado íntegramente con {metodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                    </p>
                  )}

                  {metodoPago === 'Crédito' && (
                    <div className="animate-fade-in">
                      <SelectorClienteCreditoCombobox
                        clientes={clientes}
                        clienteSeleccionado={clienteCreditoSeleccionado}
                        onSelectCliente={(c) => {
                          setClienteCreditoSeleccionado(c);
                          if (c) {
                            setClienteNombre(c.nombre);
                            setNumDocumento(c.numDoc || '');
                            setClienteDireccion(c.direccion || '');
                          }
                        }}
                        label="Cliente de crédito"
                      />
                    </div>
                  )}

                  {/* Mixto */}
                  {metodoPago === 'Mixto' && (() => {
                    const total = totalConCortesias;
                    const efecVal = parseMonto(mixtoEfectivo);
                    const tarjVal = parseMonto(mixtoTarjeta);
                    const yapeVal = parseMonto(mixtoYape);
                    const credVal = incluirCreditoMixto
                      ? (clientesCreditoMixto || []).reduce((s, c) => s + parseMonto(c.monto), 0)
                      : 0;

                    const totalIngresado = efecVal + tarjVal + yapeVal + credVal;
                    const restanteFisico = Math.max(0, total - (tarjVal + yapeVal + credVal));
                    const vuelto = efecVal > restanteFisico ? efecVal - restanteFisico : 0;
                    const faltante = Math.max(0, total - (Math.min(efecVal, restanteFisico) + tarjVal + yapeVal + credVal));
                    const cuadraExacto = faltante <= 0.01 && (tarjVal + yapeVal + credVal) <= (total + 0.01);

                    const pct = (n) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
                    const noEfectivoExcedido = (tarjVal + yapeVal + credVal) > (total + 0.01);

                    return (
                      <div className="space-y-4 animate-fade-in">
                        <div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div style={{ width: `${pct(Math.min(efecVal, restanteFisico))}%` }} className="bg-emerald-500 transition-all" />
                            <div style={{ width: `${pct(tarjVal)}%` }} className="bg-blue-500 transition-all" />
                            <div style={{ width: `${pct(yapeVal)}%` }} className="bg-purple-500 transition-all" />
                            <div style={{ width: `${pct(credVal)}%` }} className="bg-teal-500 transition-all" />
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            {[['bg-emerald-500', 'Efectivo'], ['bg-blue-500', 'Tarjeta'], ['bg-purple-500', 'Yape'], ['bg-teal-500', 'Crédito']].map(([c, l]) => (
                              <span key={l} className="inline-flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${c}`} /> {l}</span>
                            ))}
                          </div>
                        </div>

                        {noEfectivoExcedido && (
                          <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                            <span>Tarjeta, Yape y Crédito suman {soles(tarjVal + yapeVal + credVal)} y superan el total ({soles(total)}). El vuelto solo se genera con efectivo.</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {campoMonto('Efectivo', mixtoEfectivo, setMixtoEfectivo, (
                            <div className="flex gap-1 mt-1.5">
                              {[10, 20, 50, 100].map(billete => (
                                <button
                                  key={billete}
                                  type="button"
                                  onClick={() => setMixtoEfectivo((parseMonto(mixtoEfectivo) + billete).toFixed(2))}
                                  className="flex-1 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-600 transition active:scale-95"
                                >
                                  +{billete}
                                </button>
                              ))}
                            </div>
                          ))}
                          {campoMonto('Tarjeta', mixtoTarjeta, setMixtoTarjeta)}
                          {campoMonto('Yape / Plin', mixtoYape, setMixtoYape)}
                        </div>

                        {/* Crédito dentro del mixto */}
                        <label className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${incluirCreditoMixto ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                          <span className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={incluirCreditoMixto}
                              onChange={(e) => {
                                setIncluirCreditoMixto(e.target.checked);
                                if (!e.target.checked) {
                                  setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 accent-teal-600 cursor-pointer shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800">Incluir crédito a clientes</span>
                              <span className="block text-xs text-slate-500">Carga parte de la cuenta a uno o varios clientes</span>
                            </span>
                          </span>
                          {incluirCreditoMixto && <span className="font-mono text-sm font-semibold text-teal-700 shrink-0">{soles(credVal)}</span>}
                        </label>

                        {incluirCreditoMixto && (
                          <div className="space-y-2.5 animate-fade-in">
                            {(clientesCreditoMixto || []).map((row, idx) => {
                              const currentClient = clientes.find(c => String(c.id) === String(row.clienteId));
                              const filaSinCliente = !row.clienteId && parseMonto(row.monto) > 0;
                              return (
                                <div key={idx} className={`rounded-xl border p-3 space-y-2 ${filaSinCliente ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">Cliente {idx + 1}</span>
                                    {clientesCreditoMixto.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setClientesCreditoMixto(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Quitar cliente"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem] gap-2 items-start">
                                    <SelectorClienteCreditoCombobox
                                      clientes={clientes}
                                      clienteSeleccionado={currentClient}
                                      onSelectCliente={(c) => {
                                        setClientesCreditoMixto(prev => {
                                          const next = [...prev];
                                          next[idx] = { ...next[idx], clienteId: c ? c.id : '', nombre: c ? c.nombre : '' };
                                          return next;
                                        });
                                      }}
                                      label=""
                                      placeholder="Buscar por nombre, DNI o RUC..."
                                    />
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={row.monto}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setClientesCreditoMixto(prev => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], monto: val };
                                            return next;
                                          });
                                        }}
                                        className={inputMonto}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setClientesCreditoMixto(prev => [...prev, { clienteId: '', monto: '', nombre: '' }])}
                              className="w-full h-10 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors inline-flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-4 h-4" /> Dividir con otro cliente
                            </button>
                          </div>
                        )}

                        <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                          <div className="flex justify-between text-slate-500"><span>Ingresado</span><span className="font-mono tabular-nums text-slate-800">{soles(totalIngresado)} / {soles(total)}</span></div>
                          {faltante > 0.01 && <div className="flex justify-between font-medium text-amber-700"><span>Falta cubrir</span><span className="font-mono tabular-nums">{soles(faltante)}</span></div>}
                          {vuelto > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Vuelto</span><span className="font-mono tabular-nums">{soles(vuelto)}</span></div>}
                          {cuadraExacto && <div className="flex items-center gap-1.5 font-medium text-emerald-700"><Check className="w-4 h-4" /> Cuenta cubierta</div>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Autorización (cortesía / consumo) */}
                  {requierePin && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-fade-in">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Requiere autorización</p>
                          <p className="text-xs text-slate-500">
                            {tieneCortesiasIndividuales
                              ? `${cortesiaItemIds.length} producto(s) marcados como cortesía. Ingresa el PIN de administrador o cajero.`
                              : 'Ingresa el PIN de administrador o cajero para continuar.'}
                          </p>
                        </div>
                      </div>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={consumoPin}
                        onChange={(e) => {
                          setConsumoPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setConsumoPinError('');
                        }}
                        placeholder="PIN"
                        className="w-full h-12 bg-white border border-amber-200 rounded-xl px-4 text-center text-xl font-mono tracking-[0.5em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition"
                        autoComplete="off"
                        name="consumo-pin-auth"
                      />
                      {consumoPinError && <p className="text-xs font-medium text-rose-600">{consumoPinError}</p>}
                      {(metodoPago === 'Cortesía' || tieneCortesiasIndividuales) && (
                        <input
                          type="text"
                          value={motivoCortesia}
                          onChange={(e) => setMotivoCortesia(e.target.value)}
                          placeholder="Motivo de la cortesía (opcional): cumpleaños, demora…"
                          className={inputCampo}
                        />
                      )}
                    </div>
                  )}

                  {/* Datos del cliente */}
                  {metodoPago !== 'Consumo' && (
                    <details className="group rounded-xl border border-slate-200" open={!!(numDocumento || clienteNombre) || undefined}>
                      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none">
                        <span className="text-sm font-medium text-slate-700">
                          Datos del cliente <span className="font-normal text-slate-400">· opcional</span>
                        </span>
                        <span className="flex items-center gap-2 min-w-0">
                          {clienteNombre && <span className="text-xs text-slate-500 truncate max-w-[10rem]">{clienteNombre}</span>}
                          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                        </span>
                      </summary>
                      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCampo}>DNI o RUC</label>
                          <input type="text" value={numDocumento} onChange={(e) => handleDocumentoChange(e.target.value)} placeholder="Solo si lo pide" className={`${inputCampo} font-mono`} />
                        </div>
                        <div>
                          <label className={labelCampo}>Nombre</label>
                          <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Consumidor final" className={inputCampo} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCampo}>Dirección</label>
                          <input type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} placeholder="Ej. Av. Hoyos Rubio 338" className={inputCampo} />
                        </div>
                        <p className="sm:col-span-2 text-[11px] text-slate-400">La boleta o factura se emite en el portal de SUNAT.</p>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 md:px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                {requierePin && !consumoPin.trim() && (
                  <p className="mb-2 text-xs text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ingresa el PIN de autorización para poder cobrar.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Total a cobrar</p>
                    <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 leading-tight">{soles(totalConCortesias)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={procesarCobroYFacturar}
                    disabled={cobrando}
                    className="ml-auto h-12 px-6 sm:px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {cobrando
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle className="w-4.5 h-4.5" /> Cobrar y liberar mesa</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      {modalConfirmarCobro && datosConfirmacionCobro && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[250] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Confirmar cobro</h3>
                <p className="text-sm text-slate-500">Verifica los datos antes de cobrar</p>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarCobro(false)}
                disabled={cobrando}
                className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="text-center py-2">
                <p className="text-xs text-slate-500">Total a cobrar</p>
                <p className="text-4xl font-semibold font-mono tabular-nums text-slate-900 tracking-tight">{soles(datosConfirmacionCobro.total)}</p>
                {datosConfirmacionCobro.metodoPago === 'Efectivo' && datosConfirmacionCobro.pagaCon > datosConfirmacionCobro.total && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                    Recibe {soles(datosConfirmacionCobro.pagaCon)} · <span className="font-semibold">Vuelto {soles(datosConfirmacionCobro.vuelto)}</span>
                  </p>
                )}
              </div>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {[
                  ['Origen', datosConfirmacionCobro.esDelivery ? 'Para llevar / delivery' : `Mesa ${datosConfirmacionCobro.mesaNum}`],
                  ['Comprobante', datosConfirmacionCobro.tipoComprobante],
                  ['Cliente', `${datosConfirmacionCobro.nombreCliente}${datosConfirmacionCobro.numDocumento ? ` (${datosConfirmacionCobro.numDocumento})` : ''}`],
                  ['Método', datosConfirmacionCobro.metodoPago],
                ].map(([k, val]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <dt className="text-slate-500 shrink-0">{k}</dt>
                    <dd className="font-medium text-slate-900 truncate text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="px-5 pb-5 grid grid-cols-[1fr_2fr] gap-2">
              <button
                type="button"
                onClick={() => setModalConfirmarCobro(false)}
                disabled={cobrando}
                className="h-12 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={ejecutarCobroFinal}
                disabled={cobrando}
                className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {cobrando ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Confirmar y cobrar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIDOS YA */}
      {deliveryModal && (() => {
        const cerrarDelivery = () => { setDeliveryModal(false); setCodigoPY(''); setItemsDelivery([]); setEditingPedidoId(null); };
        const conCobro = tipoDelivery === 'ParaLlevar' || tipoDelivery === 'DeliveryPropio';
        const requierePinDelivery = deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo' || cortesiaDeliveryIndices.length > 0;
        const unidadesDelivery = itemsDelivery.reduce((s, i) => s + (i.cant || 0), 0);

        const lbl = 'block text-xs font-medium text-slate-500 mb-1.5';
        const inp = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const chip = 'h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95';
        const tituloSeccion = 'text-xs font-semibold uppercase tracking-wider text-sky-700 flex items-center gap-2 before:w-1 before:h-3.5 before:rounded-full before:bg-sky-500';

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[110] flex items-end md:items-center justify-center md:p-6 animate-fade-in">
            <div className="bg-white w-full max-w-6xl h-[96dvh] md:h-[min(92dvh,880px)] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">{editingPedidoId ? 'Modificar pedido' : 'Nuevo pedido'}</h2>
                    <p className="text-sm text-slate-500 truncate">Para llevar, delivery o PedidosYa · Cajero: {cajeroNombre}</p>
                  </div>
                  <button type="button" onClick={cerrarDelivery} className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 sm:w-auto">
                    {[
                      { id: 'ParaLlevar', label: 'Para llevar', Icon: ShoppingBag, activo: 'bg-cyan-600 text-white shadow-sm', onSel: () => { setTipoDelivery('ParaLlevar'); setCodigoPY(''); setDeliveryMontoEnvio(''); } },
                      { id: 'DeliveryPropio', label: 'Delivery', Icon: Bike, activo: 'bg-indigo-600 text-white shadow-sm', onSel: () => { setTipoDelivery('DeliveryPropio'); setCodigoPY(''); } },
                      { id: 'PedidosYa', label: 'PedidosYa', Icon: Truck, activo: 'bg-rose-600 text-white shadow-sm', onSel: () => { setTipoDelivery('PedidosYa'); setCodigoPY(''); setDeliveryMontoEnvio(''); } },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.onSel}
                        className={`h-9 px-3 sm:px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-all ${tipoDelivery === t.id ? t.activo : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        <t.Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Pestañas solo en móvil */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 md:hidden">
                    {[['productos', 'Productos'], ['pedido', `Pedido${unidadesDelivery ? ` (${unidadesDelivery})` : ''}`]].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDeliveryVistaMovil(id)}
                        className={`h-9 rounded-lg text-sm font-medium transition-all ${deliveryVistaMovil === id ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 flex md:grid md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">

                {/* Columna: catálogo */}
                <div className={`${deliveryVistaMovil === 'productos' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col min-h-0 bg-slate-50/60 md:border-r border-slate-100`}>
                  <div className="px-4 md:px-5 pt-4 pb-2 space-y-3 shrink-0">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar plato (ej: cuarto, octavo, chela)…"
                        value={deliverySearchQuery}
                        onChange={(e) => setDeliverySearchQuery(e.target.value)}
                        className={`${inp} pl-9 pr-9`}
                      />
                      {deliverySearchQuery && (
                        <button type="button" onClick={() => setDeliverySearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                      {(() => {
                        const ordenPrioridades = ORDEN_PRIORIDADES_CATEGORIAS;
                        const cats = ['🔥 Más Pedidos', 'Todos', ...new Set(productosMenu.filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))];
                        return cats.sort((a, b) => {
                          const idxA = ordenPrioridades.indexOf(a);
                          const idxB = ordenPrioridades.indexOf(b);
                          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                          if (idxA !== -1) return -1;
                          if (idxB !== -1) return 1;
                          return a.localeCompare(b);
                        }).map(cat => {
                          const isMasPedidos = cat === '🔥 Más Pedidos';
                          const isSelected = deliveryCategoriaFiltro === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setDeliveryCategoriaFiltro(cat)}
                              className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1 shrink-0 ${
                                isSelected
                                  ? (isMasPedidos ? 'bg-amber-500 text-white shadow-sm' : 'bg-sky-600 text-white shadow-sm')
                                  : (isMasPedidos ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700')
                              }`}
                            >
                              {isMasPedidos && <Flame className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-amber-500'}`} />}
                              {isMasPedidos ? 'Más pedidos' : cat}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-5 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {(() => {
                        const topProductosCajaIds = [...productosMenu]
                          .filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas')
                          .sort((a, b) => (b.ordenCount || b.ventasTotal || b.precio || 0) - (a.ordenCount || a.ventasTotal || a.precio || 0))
                          .slice(0, 8)
                          .map(p => p.id);

                        const menuFiltradoPre = productosMenu.filter(p => {
                          if (!p.activo) return false;
                          if (deliveryCategoriaFiltro === '🔥 Más Pedidos') {
                            return topProductosCajaIds.includes(p.id) && matchProductSemantic(p, deliverySearchQuery);
                          }
                          if (deliveryCategoriaFiltro !== 'Todos' && p.categoria !== deliveryCategoriaFiltro) return false;
                          return matchProductSemantic(p, deliverySearchQuery);
                        });
                        const menuFiltrado = agruparProductos(menuFiltradoPre);

                        if (menuFiltrado.length === 0) {
                          return <p className="col-span-full text-center text-sm text-slate-400 py-12">No se encontraron productos.</p>;
                        }

                        return menuFiltrado.map(prod => {
                          const isGroup = prod.esAgrupado;
                          const cantEnTicket = isGroup
                            ? 0
                            : itemsDelivery.filter(i => String(i.id) === String(prod.id)).reduce((sum, item) => sum + item.cant, 0);
                          const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
                          const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;
                          const tieneOferta = prod.precioOferta !== null && prod.precioOferta !== undefined;

                          return (
                            <button
                              key={prod.id}
                              type="button"
                              disabled={agotado}
                              onClick={() => agregarItemDelivery(prod)}
                              className={`relative text-left rounded-xl border p-3 min-h-[5.5rem] flex flex-col justify-between gap-2 transition-all ${
                                agotado
                                  ? 'opacity-50 grayscale border-slate-200 bg-slate-50 cursor-not-allowed'
                                  : cantEnTicket > 0
                                    ? 'bg-sky-50/60 border-sky-500 ring-1 ring-sky-500'
                                    : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm active:scale-[0.98]'
                              }`}
                            >
                              {cantEnTicket > 0 && !isGroup && (
                                <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-sky-600 text-white text-xs font-semibold grid place-items-center shadow">
                                  {cantEnTicket}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-2">{prod.nombre}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {isGroup && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">Opciones</span>}
                                  {tieneOferta && !isGroup && <span className="text-[10px] font-medium text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">-{prod.ofertaValor}%</span>}
                                  {prod.tipoStock === 'limitado' && !isGroup && (
                                    <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${agotado ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>
                                      {agotado ? 'Agotado' : `Stock ${stockDisponible}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isGroup ? (
                                <p className="font-mono text-sm font-semibold text-sky-700"><span className="text-xs font-sans font-normal text-slate-400">desde </span>{soles(prod.precioMin)}</p>
                              ) : tieneOferta ? (
                                <p className="font-mono text-sm font-semibold text-rose-600">
                                  {soles(prod.precioOferta)} <span className="text-[11px] font-normal line-through text-slate-400">{soles(prod.precio)}</span>
                                </p>
                              ) : (
                                <p className="font-mono text-sm font-semibold text-sky-700">{soles(prod.precio)}</p>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Columna: pedido y cobro */}
                <div className={`${deliveryVistaMovil === 'pedido' ? 'block' : 'hidden'} md:block flex-1 min-w-0 min-h-0 overflow-y-auto custom-scrollbar`}>
                  <div className="px-5 md:px-6 py-5 space-y-6">

                    {/* Datos del pedido */}
                    <section className="space-y-3">
                      <p className={tituloSeccion}>{tipoDelivery === 'DeliveryPropio' ? 'Datos de entrega' : 'Datos del pedido'}</p>
                      {tipoDelivery !== 'DeliveryPropio' ? (
                        <div>
                          <label className={lbl}>{tipoDelivery === 'PedidosYa' ? 'Código PedidosYa' : 'Nombre del cliente o ticket'}</label>
                          <input
                            type="text"
                            value={codigoPY}
                            onChange={(e) => setCodigoPY(e.target.value)}
                            placeholder={tipoDelivery === 'PedidosYa' ? 'Ej: FG-4821' : 'Ej: PEDRO o T-12'}
                            className={`${inp} font-mono uppercase`}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className={lbl}>Nombre del cliente</label>
                            <input type="text" value={deliveryClienteNombre} onChange={(e) => setDeliveryClienteNombre(e.target.value)} placeholder="Ej: Juan Pérez" className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Teléfono</label>
                            <input type="tel" inputMode="tel" value={deliveryTelefono} onChange={(e) => setDeliveryTelefono(e.target.value)} placeholder="999 888 777" className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Envío</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                              <input type="number" min="0" step="any" value={deliveryMontoEnvio} onChange={(e) => setDeliveryMontoEnvio(e.target.value)} placeholder="0.00" className={`${inp} pl-9 font-mono`} />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className={lbl}>Dirección de entrega</label>
                            <input type="text" value={deliveryDireccion} onChange={(e) => setDeliveryDireccion(e.target.value)} placeholder="Ej: Av. Hoyos Rubio 338" className={inp} />
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Productos del pedido */}
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className={tituloSeccion}>Productos {unidadesDelivery > 0 && <span className="normal-case tracking-normal font-medium">· {unidadesDelivery}</span>}</p>
                        {itemsDelivery.length > 0 && deliveryMetodoPago !== 'Cortesía' && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1"><Gift className="w-3 h-3" /> Toca el regalo para cortesía</p>
                        )}
                      </div>
                      {itemsDelivery.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                          <p className="text-sm text-slate-400">Agrega productos desde el catálogo</p>
                          <button type="button" onClick={() => setDeliveryVistaMovil('productos')} className="md:hidden mt-2 text-sm font-medium text-slate-700 underline underline-offset-2">
                            Ver productos
                          </button>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {itemsDelivery.map((item, idx) => {
                            const prodOriginal = productosMenu.find(p => String(p.id) === String(item.id));
                            const esCortesiaItem = cortesiaDeliveryIndices.includes(idx) || deliveryMetodoPago === 'Cortesía';
                            const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                            return (
                              <li key={idx} className={`px-3 py-2.5 ${esCortesiaItem ? 'bg-orange-50/60' : ''}`}>
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm leading-snug ${esCortesiaItem ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.nombre}</p>
                                    <p className="font-mono text-xs tabular-nums mt-0.5">
                                      {esCortesiaItem ? (
                                        <span className="text-orange-600 font-sans font-medium">Cortesía</span>
                                      ) : (
                                        <>
                                          {tieneDescuento && <span className="line-through text-slate-400 mr-1.5">{soles(item.cant * prodOriginal.precio)}</span>}
                                          <span className="text-slate-600">{soles(item.cant * item.precio)}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  {deliveryMetodoPago !== 'Cortesía' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (cortesiaDeliveryIndices.includes(idx)) setCortesiaDeliveryIndices(prev => prev.filter(i => i !== idx));
                                        else setCortesiaDeliveryIndices(prev => [...prev, idx]);
                                      }}
                                      className={`w-8 h-8 rounded-lg grid place-items-center transition-colors shrink-0 ${cortesiaDeliveryIndices.includes(idx) ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-orange-500 hover:bg-orange-50'}`}
                                      title={cortesiaDeliveryIndices.includes(idx) ? 'Quitar cortesía' : 'Marcar como cortesía (S/ 0.00)'}
                                    >
                                      <Gift className="w-4 h-4" />
                                    </button>
                                  )}
                                  <div className="flex items-center rounded-lg border border-slate-200 shrink-0">
                                    <button type="button" onClick={() => alterarItemDelivery(idx, '-')} className="w-8 h-8 grid place-items-center text-slate-500 hover:text-slate-900 text-lg leading-none" aria-label="Quitar uno">−</button>
                                    <span className="w-6 text-center text-sm font-semibold text-slate-900 tabular-nums">{item.cant}</span>
                                    <button type="button" onClick={() => alterarItemDelivery(idx, '+')} className="w-8 h-8 grid place-items-center text-slate-500 hover:text-slate-900 text-lg leading-none" aria-label="Agregar uno">+</button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Añadir especificación (ej: sin cebolla)…"
                                  value={item.notas || ''}
                                  onChange={(e) => alterarNotasDelivery(idx, e.target.value)}
                                  className="mt-1 w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-300 border-b border-transparent focus:border-slate-300 focus:outline-none py-0.5"
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    {/* Descuento */}
                    {itemsDelivery.length > 0 && (
                      <section className="space-y-2">
                        <p className={tituloSeccion}>Descuento</p>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0">
                            {[['porcentaje', '%'], ['monto', 'S/']].map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => { setDeliveryDescuentoTipo(id); setDeliveryDescuentoValor(''); }}
                                className={`h-8 w-11 rounded-lg text-sm font-semibold transition-all ${deliveryDescuentoTipo === id ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                title={id === 'porcentaje' ? 'Descuento en porcentaje' : 'Descuento en soles'}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="relative flex-1">
                            {deliveryDescuentoTipo === 'monto' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>}
                            <input
                              type="number"
                              min="0"
                              max={deliveryDescuentoTipo === 'porcentaje' ? 100 : totalDelivery}
                              step="any"
                              inputMode="decimal"
                              placeholder={deliveryDescuentoTipo === 'porcentaje' ? '0' : '0.00'}
                              value={deliveryDescuentoValor}
                              onChange={(e) => setDeliveryDescuentoValor(e.target.value)}
                              className={`${inp} font-mono ${deliveryDescuentoTipo === 'monto' ? 'pl-9' : 'pr-8'}`}
                            />
                            {deliveryDescuentoTipo === 'porcentaje' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">%</span>}
                          </div>
                          {deliveryDescuentoMonto > 0 && (
                            <span className="font-mono text-sm font-medium text-rose-600 tabular-nums shrink-0">−{soles(deliveryDescuentoMonto)}</span>
                          )}
                        </div>
                        {deliveryDescuentoTipo === 'porcentaje' && (
                          <div className="flex flex-wrap gap-1.5">
                            {[5, 10, 15, 20, 50].map(p => (
                              <button key={p} type="button" onClick={() => setDeliveryDescuentoValor(String(p))} className={chip}>{p}%</button>
                            ))}
                          </div>
                        )}
                        {deliveryDescuentoTipo === 'monto' && deliveryDescVal > totalDelivery && totalDelivery > 0 && (
                          <p className="text-xs text-amber-700">El descuento no puede superar el subtotal; se aplicará {soles(totalDelivery)}.</p>
                        )}
                      </section>
                    )}

                    {/* Cobro (Para llevar / Delivery propio) */}
                    {conCobro && (
                      <section className="space-y-4">
                        <p className={tituloSeccion}>Cobro</p>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'Efectivo', Icon: Banknote, label: 'Efectivo' },
                            { id: 'Tarjeta', Icon: CreditCard, label: 'Tarjeta' },
                            { id: 'Yape', Icon: Smartphone, label: 'Yape' },
                            { id: 'Mixto', Icon: Layers, label: 'Mixto' },
                            { id: 'Crédito', Icon: Wallet, label: 'Crédito' },
                            { id: 'Cortesía', Icon: Gift, label: 'Cortesía' },
                            { id: 'Consumo', Icon: Users, label: 'Personal' },
                          ].map(m => {
                            const active = deliveryMetodoPago === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setDeliveryMetodoPago(m.id);
                                  if (m.id === 'Crédito' || m.id === 'Cortesía' || m.id === 'Consumo') {
                                    setDeliveryTipoComprobante('Ticket');
                                    setDeliveryNumDocumento('');
                                  }
                                }}
                                className={`h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium transition-all active:scale-[0.97] ${active ? estiloMetodo(m.id).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                              >
                                <m.Icon className={`w-4 h-4 ${active ? '' : estiloMetodo(m.id).icono}`} />
                                {m.label}
                              </button>
                            );
                          })}
                        </div>

                        {deliveryMetodoPago === 'Efectivo' && (() => {
                          const conC = parseFloat(deliveryConCuanto);
                          const vuelto = (!isNaN(conC) && conC >= grandTotalDelivery) ? conC - grandTotalDelivery : 0;
                          const falta = (!isNaN(conC) && conC > 0 && conC < grandTotalDelivery) ? grandTotalDelivery - conC : 0;
                          return (
                            <div className="space-y-3 animate-fade-in">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={lbl}>{tipoDelivery === 'DeliveryPropio' ? 'Paga con' : 'Recibido'}</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                    <input type="number" min="0" step="any" value={deliveryConCuanto} onChange={(e) => setDeliveryConCuanto(e.target.value)} placeholder={grandTotalDelivery.toFixed(2)} className={`${inp} h-11 pl-9 font-mono text-base font-semibold`} />
                                  </div>
                                </div>
                                <div>
                                  <p className={lbl}>{falta > 0 ? 'Falta' : 'Vuelto'}</p>
                                  <p className={`h-11 flex items-center px-3 rounded-xl font-mono text-lg font-semibold tabular-nums ${falta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {soles(falta > 0 ? falta : vuelto)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => setDeliveryConCuanto(grandTotalDelivery.toFixed(2))} className={`${chip} !border-emerald-600 !bg-emerald-600 !text-white`}>Exacto</button>
                                {[10, 20, 50, 100, 200].map(monto => (
                                  <button key={monto} type="button" onClick={() => setDeliveryConCuanto(monto.toFixed(2))} className={chip}>S/ {monto}</button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {(deliveryMetodoPago === 'Tarjeta' || deliveryMetodoPago === 'Yape') && (
                          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3 animate-fade-in">
                            Se registrará <span className="font-mono font-semibold text-slate-900">{soles(grandTotalDelivery)}</span> con {deliveryMetodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                          </p>
                        )}

                        {deliveryMetodoPago === 'Crédito' && (
                          <div className="animate-fade-in">
                            <SelectorClienteCreditoCombobox
                              clientes={clientes}
                              clienteSeleccionado={deliveryClienteCreditoSeleccionado}
                              onSelectCliente={(client) => {
                                setDeliveryClienteCreditoSeleccionado(client || null);
                                if (client) {
                                  setDeliveryClienteNombre(client.nombre);
                                  setDeliveryNumDocumento(client.numDoc || '');
                                }
                              }}
                              label="Cliente de crédito"
                            />
                          </div>
                        )}

                        {deliveryMetodoPago === 'Mixto' && (() => {
                          const total = grandTotalDelivery;
                          const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
                          const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
                          const yapeVal = parseFloat(deliveryMixtoYape || 0);
                          const credVal = parseFloat(deliveryMontoCredito || 0);
                          const ingresado = efecVal + tarjVal + yapeVal + credVal;
                          const restante = Math.max(0, total - (tarjVal + yapeVal + credVal));
                          const vuelto = efecVal > restante ? efecVal - restante : 0;
                          const diferencia = total - ingresado;
                          const campos = [
                            { label: 'Efectivo', value: deliveryMixtoEfectivo, set: setDeliveryMixtoEfectivo, otros: tarjVal + yapeVal + credVal },
                            { label: 'Tarjeta', value: deliveryMixtoTarjeta, set: setDeliveryMixtoTarjeta, otros: efecVal + yapeVal + credVal },
                            { label: 'Yape / Plin', value: deliveryMixtoYape, set: setDeliveryMixtoYape, otros: efecVal + tarjVal + credVal },
                            { label: 'Crédito', value: deliveryMontoCredito, set: setDeliveryMontoCredito, otros: efecVal + tarjVal + yapeVal },
                          ];
                          return (
                            <div className="space-y-3 animate-fade-in">
                              <div className="grid grid-cols-2 gap-3">
                                {campos.map(c => (
                                  <div key={c.label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-xs font-medium text-slate-500">{c.label}</label>
                                      <button
                                        type="button"
                                        onClick={() => { const resto = Math.max(0, total - c.otros); c.set(resto > 0 ? resto.toFixed(2) : ''); }}
                                        className="text-[11px] font-medium text-slate-400 hover:text-slate-900"
                                        title="Completar con el saldo restante"
                                      >
                                        Completar
                                      </button>
                                    </div>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                      <input type="number" min="0" step="any" value={c.value} onChange={(e) => c.set(e.target.value)} placeholder="0.00" className={`${inp} pl-9 font-mono`} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {credVal > 0 && (
                                <div className="space-y-1.5">
                                  <SelectorClienteCreditoCombobox
                                    clientes={clientes}
                                    clienteSeleccionado={deliveryClienteCreditoSeleccionado}
                                    onSelectCliente={(client) => setDeliveryClienteCreditoSeleccionado(client || null)}
                                    label="Cliente para el crédito"
                                  />
                                  {deliveryClienteCreditoSeleccionado && (
                                    <p className={`text-xs font-medium ${(deliveryClienteCreditoSeleccionado.saldo || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      Saldo actual: {soles(deliveryClienteCreditoSeleccionado.saldo)}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                                <div className="flex justify-between text-slate-500"><span>Ingresado</span><span className="font-mono tabular-nums text-slate-800">{soles(ingresado)} / {soles(total)}</span></div>
                                {diferencia > 0.01 && <div className="flex justify-between font-medium text-amber-700"><span>Falta cubrir</span><span className="font-mono tabular-nums">{soles(diferencia)}</span></div>}
                                {vuelto > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Vuelto</span><span className="font-mono tabular-nums">{soles(vuelto)}</span></div>}
                                {diferencia <= 0.01 && vuelto === 0 && <div className="flex items-center gap-1.5 font-medium text-emerald-700"><Check className="w-4 h-4" /> Cuenta cubierta</div>}
                              </div>
                            </div>
                          );
                        })()}

                        {requierePinDelivery && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-fade-in">
                            <div className="flex items-start gap-2.5">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">Requiere autorización</p>
                                <p className="text-xs text-slate-500">
                                  {deliveryMetodoPago === 'Cortesía'
                                    ? 'Cortesía total (S/ 0.00). Ingresa el PIN de administrador o cajero.'
                                    : deliveryMetodoPago === 'Consumo'
                                      ? 'Consumo de personal. Ingresa el PIN de administrador o cajero.'
                                      : `${cortesiaDeliveryIndices.length} producto(s) como cortesía. Ingresa el PIN de administrador o cajero.`}
                                </p>
                              </div>
                            </div>
                            <input
                              type="password"
                              value={pinAdminDelivery}
                              onChange={(e) => setPinAdminDelivery(e.target.value)}
                              placeholder="PIN"
                              maxLength={10}
                              autoComplete="off"
                              className="w-full h-12 bg-white border border-amber-200 rounded-xl px-4 text-center text-xl font-mono tracking-[0.5em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition"
                            />
                            {(deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0) && (
                              <input
                                type="text"
                                value={deliveryMotivoCortesia}
                                onChange={(e) => setDeliveryMotivoCortesia(e.target.value)}
                                placeholder="Motivo de la cortesía (opcional)"
                                className={inp}
                              />
                            )}
                          </div>
                        )}

                        {deliveryMetodoPago !== 'Consumo' && (
                          <details className="group rounded-xl border border-slate-200" open={!!deliveryNumDocumento || undefined}>
                            <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none">
                              <span className="text-sm font-medium text-slate-700">Documento del cliente <span className="font-normal text-slate-400">· opcional</span></span>
                              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="px-4 pb-4 space-y-3">
                              <div className={`grid grid-cols-1 ${tipoDelivery === 'DeliveryPropio' ? '' : 'sm:grid-cols-2'} gap-3`}>
                                <div>
                                  <label className={lbl}>DNI o RUC</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={deliveryNumDocumento}
                                      onChange={(e) => setDeliveryNumDocumento(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarClienteDelivery(); } }}
                                      placeholder={deliveryTipoComprobante === 'Factura' ? '11 dígitos' : '8 dígitos'}
                                      className={`${inp} font-mono`}
                                    />
                                    <button
                                      type="button"
                                      onClick={buscarClienteDelivery}
                                      disabled={isBuscando}
                                      className="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 grid place-items-center shrink-0 disabled:opacity-50"
                                      title="Buscar cliente"
                                    >
                                      {isBuscando ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                {tipoDelivery !== 'DeliveryPropio' && (
                                  <div>
                                    <label className={lbl}>Nombre / razón social</label>
                                    <input type="text" value={deliveryClienteNombre} onChange={(e) => setDeliveryClienteNombre(e.target.value)} placeholder="Consumidor final" className={inp} />
                                  </div>
                                )}
                              </div>
                              {deliveryTipoComprobante === 'Factura' && tipoDelivery !== 'DeliveryPropio' && (
                                <div>
                                  <label className={lbl}>Dirección fiscal</label>
                                  <input type="text" value={deliveryDireccion} onChange={(e) => setDeliveryDireccion(e.target.value)} placeholder="Obligatorio" className={inp} />
                                </div>
                              )}
                              <p className="text-[11px] text-slate-400">Se emite ticket de venta; la boleta o factura se hace en SUNAT.</p>
                            </div>
                          </details>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 md:px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
                {requierePinDelivery && conCobro && !pinAdminDelivery.trim() && (
                  <p className="mb-2 text-xs text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ingresa el PIN de autorización para registrar la cortesía / consumo.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 truncate">
                      Subtotal {soles(totalDelivery)}
                      {deliveryDescuentoMonto > 0 && <span className="text-rose-600"> · Desc. {deliveryDescuentoTipo === 'porcentaje' ? `${deliveryDescPct}%` : ''} −{soles(deliveryDescuentoMonto)}</span>}
                      {tipoDelivery === 'DeliveryPropio' && <> · Envío {soles(deliveryShippingFee)}</>}
                    </p>
                    <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 leading-tight">{soles(grandTotalDelivery)}</p>
                  </div>
                  {deliveryVistaMovil === 'productos' && (
                    <button
                      type="button"
                      onClick={() => setDeliveryVistaMovil('pedido')}
                      className="md:hidden ml-auto h-12 px-5 rounded-xl bg-sky-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      Continuar <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={enviarDeliveryACocina}
                    disabled={enviandoDelivery}
                    className={`${deliveryVistaMovil === 'productos' ? 'hidden md:inline-flex' : 'inline-flex'} ml-auto h-12 px-6 sm:px-8 rounded-xl text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 items-center justify-center gap-2 ${
                      editingPedidoId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {enviandoDelivery ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {tipoDelivery === 'ParaLlevar' ? <Banknote className="w-4.5 h-4.5" /> : <Truck className="w-4.5 h-4.5" />}
                        {editingPedidoId
                          ? 'Actualizar pedido'
                          : tipoDelivery === 'ParaLlevar'
                            ? 'Cobrar y enviar'
                            : 'Registrar y enviar'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO PARA DELIVERY) */}
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
            agregarItemDeliveryDirecto(prodVariante, additionalNotes);
          } else if (soloComplementos) {
            const notas = [...compl.notas];
            if (additionalNotes.trim()) notas.push(`(Nota: ${additionalNotes.trim()})`);
            agregarItemDeliveryDirecto(selectedProduct, notas.join(' · '), { opciones: [], precioExtra: compl.precioExtra });
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
            agregarItemDeliveryDirecto(selectedProduct, finalNotes, { ...sel, precioExtra: sel.precioExtra + compl.precioExtra });
          } else if (selectedProduct.categoria === 'Menú' || selectedProduct.categoria?.toLowerCase().includes('menú')) {
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
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
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
            
            notesArray.push(`+ Refresco + Postre`);

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
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
          } else {
            const notesArray = [];
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
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
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
                            idx <= safeStepIdx ? 'bg-cyan-500' : 'bg-slate-800'
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
                  <div className="grid grid-cols-2 gap-3">
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
                              ? 'bg-cyan-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[0.98]'
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
                    disabled={!seleccionActual && (currentStep.options?.length > 0 || currentStep.key === 'producto_variante')}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (seleccionActual || (!currentStep.options?.length && currentStep.key !== 'producto_variante'))
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20'
                        : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Agregar Pedido
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
                    disabled={!seleccionActual && (currentStep.options?.length > 0 || currentStep.key === 'producto_variante')}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (seleccionActual || (!currentStep.options?.length && currentStep.key !== 'producto_variante'))
                        ? 'bg-cyan-500 hover:bg-amber-600 text-slate-950'
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

      {/* MODAL DE CIERRE DE CAJA (ARQUEO DE TURNO) */}
      {cierreModalOpen && (() => {
        // Consolidación reactiva de montos del turno actual
        const ventasFiltradas = (ultimoCierre 
          ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
          : ventas).filter(v => v.estadoPedido !== 'Cancelado');

        const abonosFiltrados = ultimoCierre
          ? abonos.filter(a => new Date(a.creadoEn) > new Date(ultimoCierre))
          : abonos;

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

        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalYape = 0;

        ventasFiltradas.forEach(v => {
          const { efec, tarj, yape } = obtenerMontosVentaFrontend(v);
          totalEfectivo += efec;
          totalTarjeta += tarj;
          totalYape += yape;
        });

        // Sumar abonos a la caja real
        abonosFiltrados.forEach(a => {
          totalEfectivo += a.montoEfectivo || 0;
          totalTarjeta += a.montoTarjeta || 0;
          totalYape += a.montoYape || 0;
        });

        const totalPedidosYa = ventasFiltradas
          .filter(v => v.metodoPago === 'PedidosYa')
          .reduce((s, v) => s + (v.total || 0), 0);

        const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
        let totalConsumoPlanilla = 0;
        let totalConsumoClientes = 0;

        ventasFiltradas.forEach(v => {
          if (v.anulado || v.estadoPedido === 'Cancelado') return;
          if (v.metodoPago === 'Consumo') {
            totalConsumoPlanilla += (v.descuentoAplicado || v.total || 0);
          } else {
            const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
            if (splits.length > 0) {
              splits.forEach(s => {
                const esTrab = clienteMap.get(s.clienteId) || false;
                if (esTrab) {
                  totalConsumoPlanilla += s.monto;
                } else {
                  totalConsumoClientes += s.monto;
                }
              });
            } else if (v.metodoPago === 'Crédito') {
              totalConsumoClientes += (v.total || 0);
            } else if (parseFloat(v.montoCredito || 0) > 0) {
              totalConsumoClientes += parseFloat(v.montoCredito);
            }
          }
        });

        // Fondo inicial registrado en la apertura del turno actual
        const fondoInicialTurno = Number(cajaEstado.turno?.montoInicial || 0);

        // Egresos en efectivo durante el turno
        const egresosEfectivo = (comprasTurno || [])
          .filter(c => {
            const fechaValida = !ultimoCierre || new Date(c.fecha || c.creadoEn) > new Date(ultimoCierre);
            return fechaValida && c.metodoPago === 'Efectivo';
          })
          .reduce((s, c) => s + parseFloat(c.total || 0), 0);

        // Total Efectivo Esperado en Gaveta = Fondo Inicial + (Ventas Efec + Abonos Efec) - Compras Efec
        const totalEfectivoEsperado = Math.max(0, fondoInicialTurno + totalEfectivo - egresosEfectivo);

        // Total Caja = ingresos reales cobrados en caja (efectivo neto + tarjeta + yape)
        const totalCalculado = totalEfectivoEsperado + totalTarjeta + totalYape;

        // Cortesías: solo las ventas con metodoPago === 'Cortesía' o descuentoAplicado parcial
        const totalCortesias = ventasFiltradas
          .filter(v => v.metodoPago === 'Cortesía')
          .reduce((s, v) => s + (v.descuentoAplicado || v.total || 0), 0);

        const montoFisicoNum = parseFloat(efectivoFisicoContado || 0);
        const tieneConteoFisico = efectivoFisicoContado.trim() !== '';
        const diferenciaEfectivo = tieneConteoFisico ? (montoFisicoNum - totalEfectivoEsperado) : 0;

        return (
          <div id="modal-cierre" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Calculator className="w-6 h-6 shrink-0" />
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Arqueo y Cierre</h3>
                </div>
                <button onClick={() => { setCierreModalOpen(false); setEfectivoFisicoContado(''); }} className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"><X className="w-5 h-5" /></button>
              </div>
 
              {/* Vista del ticket térmico */}
              <div id="cierre-imprimible" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-6 flex flex-col">
                <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4 flex flex-col items-center">
                  <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain mb-1 filter grayscale" />
                  <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">{COMPANY_CONFIG.legalName}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{COMPANY_CONFIG.address} · RUC: {COMPANY_CONFIG.ruc}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">CIERRE DE TURNO · ARQUEO DIARIO</p>
                </div>

                <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
                  <div className="flex justify-between"><span>FECHA:</span><span>{new Date().toLocaleDateString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>HORA IMP:</span><span>{new Date().toLocaleTimeString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>CAJERO:</span><span className="uppercase">{cajaEstado.turno?.cajeroNombre || cajeroNombre}</span></div>
                  <div className="flex justify-between"><span>ESTADO:</span><span className="text-emerald-700">FINALIZADO</span></div>
                </div>

                <div className="space-y-3 mb-4 border-b border-dashed border-slate-300 pb-3">
                  {fondoInicialTurno > 0 && (
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>💼 FONDO INICIAL (APERTURA):</span>
                      <span className="font-black text-emerald-800">+ S/ {fondoInicialTurno.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>💵 EFECTIVO VENTAS:</span>
                    <span className="font-black text-slate-900">S/ {totalEfectivo.toFixed(2)}</span>
                  </div>
                  {egresosEfectivo > 0 && (
                    <div className="flex justify-between font-bold text-rose-600">
                      <span>📉 EGRESOS / COMPRAS:</span>
                      <span className="font-black text-rose-600">- S/ {egresosEfectivo.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-700 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200">
                    <span>💵 EFECTIVO TOTAL ESPERADO:</span>
                    <span className="font-black text-emerald-800">S/ {totalEfectivoEsperado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>💳 TARJETA POS:</span>
                    <span className="font-black text-slate-900">S/ {totalTarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>📱 YAPE / PLIN:</span>
                    <span className="font-black text-slate-900">S/ {totalYape.toFixed(2)}</span>
                  </div>
                  {abonosFiltrados.length > 0 && (
                    <div className="border-t border-dashed border-slate-200 pt-2 pb-1 text-slate-650 font-bold text-[10px]">
                      <span className="text-[9px] text-slate-400">DETALLE DE ABONOS RECIBIDOS:</span>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Efec:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoEfectivo || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Tarj:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoTarjeta || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Yape:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoYape || 0), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  {totalConsumoClientes > 0 && (
                    <div className="flex justify-between font-bold text-emerald-700 border-t border-dashed border-slate-205 pt-2">
                      <span>👥 CRÉDITO CLIENTES:</span>
                      <span className="font-black text-emerald-800">S/ {totalConsumoClientes.toFixed(2)}</span>
                    </div>
                  )}
                  {totalConsumoPlanilla > 0 && (
                    <div className="flex justify-between font-bold text-violet-700 border-t border-dashed border-slate-205 pt-2">
                      <span>👤 CONSUMO PLANILLA:</span>
                      <span className="font-black text-violet-800">S/ {totalConsumoPlanilla.toFixed(2)}</span>
                    </div>
                  )}
                  {totalCortesias > 0 && (
                    <div className="flex justify-between font-bold text-amber-700 border-t border-dashed border-amber-200 pt-2">
                      <span>🎁 CORTESÍAS (VALOR):</span>
                      <span className="font-black text-amber-900">S/ {totalCortesias.toFixed(2)}</span>
                    </div>
                  )}
                  {totalPedidosYa > 0 && (
                    <div className="flex justify-between font-bold text-blue-700 border-t border-dashed border-blue-200 pt-2">
                      <span>🛵 PEDIDOS YA <span className="font-normal text-[9px]">(cobro semanal)</span>:</span>
                      <span className="font-black text-blue-800">S/ {totalPedidosYa.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
                  <span>💰 TOTAL RECAUDACIÓN:</span>
                  <span className="text-base text-emerald-700">S/ {totalCalculado.toFixed(2)}</span>
                </div>
                {totalPedidosYa > 0 && (
                  <div className="mt-1 text-[9px] text-blue-600 font-bold text-right">
                    + S/ {totalPedidosYa.toFixed(2)} PedidosYa (no incluir en cuadre físico)
                  </div>
                )}

                {tieneConteoFisico && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-300 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>EFECTIVO CONTADO:</span>
                      <span className="font-black">S/ {montoFisicoNum.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between font-black mt-1 text-xs ${
                      Math.abs(diferenciaEfectivo) < 0.05 
                        ? 'text-emerald-700' 
                        : (diferenciaEfectivo > 0 ? 'text-blue-700' : 'text-rose-600')
                    }`}>
                      <span>DIFERENCIA (CUADRE):</span>
                      <span>
                        {Math.abs(diferenciaEfectivo) < 0.05 
                          ? '✓ CUADRE EXACTO' 
                          : (diferenciaEfectivo > 0 
                              ? `+ S/ ${diferenciaEfectivo.toFixed(2)} (SOBRANTE)` 
                              : `- S/ ${Math.abs(diferenciaEfectivo).toFixed(2)} (FALTANTE)`)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-center text-[9px] text-slate-400 font-bold mt-6 border-t border-dashed border-slate-200 pt-3">
                  *** Fin del Reporte de Turno ***
                </div>
              </div>

              {/* Input de Conteo Físico para Arqueo */}
              <div className="mb-4 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <label className="block text-slate-700 font-black text-[11px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Efectivo Físico en Gaveta:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Conteo de billetes y monedas</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">S/</span>
                  <input
                    type="number"
                    step="0.10"
                    placeholder="0.00"
                    value={efectivoFisicoContado}
                    onChange={(e) => setEfectivoFisicoContado(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-1.5"
                >
                  Imprimir Ticket
                </button>
                <button
                  disabled={guardandoCierre}
                  onClick={async () => {
                    const pendientes = mesas.filter(m => m.estado !== 'Libre' && m.pedidoData);
                    if (pendientes.length > 0) {
                      const nombresMesas = pendientes.map(m => `Mesa ${m.num}`).join(', ');
                      alert(`⚠️ No se puede realizar el cierre de turno.\n\nAún quedan mesas activas o pendientes de cobración:\n👉 ${nombresMesas}\n\nPor favor, cobre o libere estas mesas antes de cerrar caja.`);
                      return;
                    }

                    const maxSaleTime = ventasFiltradas.length > 0
                      ? Math.max(...ventasFiltradas.map(v => new Date(v.createdAt).getTime()))
                      : new Date().getTime();
                    const newCierreISO = new Date(maxSaleTime + 1000).toISOString();

                    setGuardandoCierre(true);
                    try {
                      const abonosEfectivoTotal = abonosFiltrados.reduce((s, a) => s + (parseFloat(a.montoEfectivo) || 0), 0);
                      await api.registrarCierre({
                        fechaApertura: ultimoCierre || new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
                        fechaCierre: newCierreISO,
                        cajeroNombre: cajeroNombre || currentUser?.nombre || 'Cajero',
                        montoInicial: fondoInicialTurno,
                        efectivoVentas: totalEfectivo,
                        efectivoEsperado: totalEfectivoEsperado,
                        efectivoContado: tieneConteoFisico ? montoFisicoNum : totalEfectivoEsperado,
                        diferencia: diferenciaEfectivo,
                        totalTarjeta: totalTarjeta,
                        totalYape: totalYape,
                        totalConsumo: totalConsumoClientes + totalConsumoPlanilla,
                        totalPedidosYa: totalPedidosYa,
                        egresosEfectivo: egresosEfectivo,
                        abonosEfectivo: abonosEfectivoTotal,
                        nota: tieneConteoFisico ? `Conteo físico: S/ ${montoFisicoNum.toFixed(2)}. Diferencia: S/ ${diferenciaEfectivo.toFixed(2)}` : null,
                      });

                      localStorage.setItem('ultimoCierre', newCierreISO);
                      setUltimoCierre(newCierreISO);
                      setMostrarTodoElDia(false);
                      setCajaEstado({ abierto: false, turno: null, cargando: false });
                      await fetchCajaData();

                      const diffMsg = tieneConteoFisico 
                        ? `\nEfectivo Contado: S/ ${montoFisicoNum.toFixed(2)}\nDiferencia: S/ ${diferenciaEfectivo.toFixed(2)}`
                        : '';
                      alert(`✅ ¡Cierre de Turno registrado con éxito en la Base de Datos!\n\nTotal en Gaveta (esperado): S/ ${totalEfectivoEsperado.toFixed(2)}${diffMsg}\n${totalPedidosYa > 0 ? `PedidosYa (cobro semanal): S/ ${totalPedidosYa.toFixed(2)}\n` : ''}El turno ha sido cerrado.`);
                      setEfectivoFisicoContado('');
                      setCierreModalOpen(false);
                    } catch (err) {
                      console.error('Error al registrar cierre de caja en el servidor:', err);
                      // Fallback local por seguridad ante micro-desconexiones
                      localStorage.setItem('ultimoCierre', newCierreISO);
                      setUltimoCierre(newCierreISO);
                      setMostrarTodoElDia(false);
                      setCajaEstado({ abierto: false, turno: null, cargando: false });
                      alert(`⚠️ El turno se cerró localmente (aviso: sincronización con base de datos falló: ${err.message || 'error de conexión'}).`);
                      setEfectivoFisicoContado('');
                      setCierreModalOpen(false);
                    } finally {
                      setGuardandoCierre(false);
                    }
                  }}
                  className="py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-900 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {guardandoCierre ? 'Guardando...' : 'Cerrar Turno'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE APERTURA DE CAJA / INICIO DE TURNO */}
      {modalAperturaOpen && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col animate-slide-up border border-slate-100">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Apertura de Caja</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Iniciar nuevo turno y registrar fondo inicial</p>
                </div>
              </div>
              <button
                onClick={() => { setModalAperturaOpen(false); setModoOtroCajero(false); setErrorApertura(''); }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorApertura && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorApertura}</span>
              </div>
            )}

            <form onSubmit={handleAbrirCaja} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between items-center">
                  <span>Cajero(a) a quien se le aperturará la caja:</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Personal Registrado
                  </span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={modoOtroCajero ? '__OTRO__' : cajeroNombre}
                    onChange={(e) => {
                      if (e.target.value === '__OTRO__') {
                        setModoOtroCajero(true);
                        setCajeroNombre('');
                      } else {
                        setModoOtroCajero(false);
                        setCajeroNombre(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none transition-all cursor-pointer appearance-none pr-9 shadow-2xs"
                  >
                    <option value="" disabled>-- Selecciona el Cajero(a) --</option>
                    {cajerosDisponibles.map((u) => (
                      <option key={u.id} value={u.nombre}>
                        {u.nombre} · ({u.rol || 'Personal'})
                      </option>
                    ))}
                    {cajerosDisponibles.length === 0 && (
                      <option value={cajeroNombre || 'María'}>{cajeroNombre || 'María'} (Cajero)</option>
                    )}
                    <option value="__OTRO__">✍️ Ingresar otro nombre manualmente...</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {modoOtroCajero && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={cajeroNombre}
                      onChange={(e) => setCajeroNombre(e.target.value)}
                      placeholder="Escribe el nombre del cajero(a)..."
                      autoFocus
                      className="w-full bg-white border-2 border-emerald-500 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none shadow-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Escribe el nombre del cajero responsable para este turno.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between">
                  <span>Fondo Inicial en Gaveta (Sencillo):</span>
                  <span className="text-slate-400 font-normal">Billetes / Monedas</span>
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">S/</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    placeholder="0.00"
                    value={montoInicialInput}
                    onChange={(e) => setMontoInicialInput(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl pl-9 pr-3.5 py-2.5 text-lg font-black text-slate-900 focus:outline-none shadow-inner"
                  />
                </div>

                {/* Accesos directos de fondo de caja */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 50, 100, 150].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMontoInicialInput(String(val))}
                      className={`py-1.5 rounded-lg text-xs font-black transition-all border ${
                        montoInicialInput === String(val)
                          ? 'bg-emerald-500 text-slate-950 border-emerald-600 shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {val === 0 ? 'Sin Sencillo' : `S/ ${val}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  Observación / Nota de Apertura (opcional):
                </label>
                <input
                  type="text"
                  value={notaAperturaInput}
                  onChange={(e) => setNotaAperturaInput(e.target.value)}
                  placeholder="Ej. Sencillo recibido para inicio de labores..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setModalAperturaOpen(false); setModoOtroCajero(false); setErrorApertura(''); }}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoApertura}
                  className="w-2/3 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {guardandoApertura ? 'Abriendo...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DE CIERRES DE CAJA (POSTGRESQL) */}
      {historialCierresModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Historial de Cierres de Turno</h3>
                  <p className="text-xs text-slate-400 font-medium">Registros históricos persistidos en PostgreSQL</p>
                </div>
              </div>
              <button
                onClick={() => setHistorialCierresModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-3">
              {cargandoHistorialCierres ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-bold uppercase tracking-wider">Cargando registros...</p>
                </div>
              ) : (!historialCierres || historialCierres.length === 0) ? (
                <div className="py-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-black text-slate-600 uppercase">Sin cierres guardados</p>
                  <p className="text-xs text-slate-400 mt-1">Los cierres que realices desde "Cerrar Turno" se archivarán aquí automáticamente.</p>
                </div>
              ) : (
                historialCierres.map(c => {
                  const dif = Number(c.diferencia || 0);
                  const isExact = Math.abs(dif) < 0.01;
                  const isSobrante = dif > 0.01;
                  return (
                    <div key={c.id} className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                            #{c.id}
                          </span>
                          <span className="font-black text-xs text-slate-800 uppercase">
                            {new Date(c.fechaCierre).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            · Cajero: <strong className="text-slate-700 uppercase">{c.cajeroNombre}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400">Diferencia:</span>
                          <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-lg ${
                            isExact
                              ? 'bg-emerald-100 text-emerald-700'
                              : isSobrante
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isSobrante ? `+S/ ${dif.toFixed(2)}` : `S/ ${dif.toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Efec. Esperado</p>
                          <p className="font-black font-mono text-slate-800">S/ {Number(c.efectivoEsperado || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Efec. Contado</p>
                          <p className="font-black font-mono text-slate-800">S/ {Number(c.efectivoContado || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Tarjeta / Yape</p>
                          <p className="font-black font-mono text-slate-800">
                            S/ {(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Egresos Efec.</p>
                          <p className="font-black font-mono text-rose-600">S/ {Number(c.egresosEfectivo || 0).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-200/60">
                        {c.nota ? (
                          <p className="text-[11px] text-slate-500 font-medium italic">
                            Nota: {c.nota}
                          </p>
                        ) : <div />}
                        <button
                          onClick={() => setCierreAImprimir(c)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-purple-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5 text-purple-300" />
                          Reimprimir Ticket
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistorialCierresModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REIMPRESIÓN DE TICKET DE CIERRE HISTÓRICO */}
      {cierreAImprimir && (
        <div id="modal-cierre-reimpresion" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[240] flex items-center justify-center p-4">
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
            <div id="cierre-imprimible-reimpresion" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-5 flex flex-col">
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

      {/* Modal: Corregir Método de Pago */}
      {cambioMetodoModal && ventaACambiar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-slate-950 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Corregir Método de Pago
                </h3>
                <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{ventaACambiar.id} · S/ {ventaACambiar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCambioMetodoModal(false); setCambioPin(''); setCambioError(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Método anterior */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Método actual</p>
                <p className="font-black text-slate-800 uppercase text-sm">{ventaACambiar.metodoPago}</p>
              </div>

              {/* Nuevo método */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Método de Pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto'].map(mp => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => setCambioNuevoMetodo(mp)}
                      className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                        cambioNuevoMetodo === mp
                          ? mp === 'Efectivo' ? 'bg-emerald-500 border-emerald-600 text-white' :
                            mp === 'Tarjeta' ? 'bg-blue-500 border-blue-600 text-white' :
                            mp === 'Yape' ? 'bg-purple-500 border-purple-600 text-white' :
                            mp === 'Consumo' ? 'bg-slate-700 border-slate-800 text-white' :
                            mp === 'Cortesía' ? 'bg-cyan-500 border-amber-600 text-slate-950' :
                            mp === 'Mixto' ? 'bg-orange-500 border-orange-600 text-white' :
                            'bg-indigo-500 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {mp === 'Efectivo' ? '💵' : mp === 'Tarjeta' ? '💳' : mp === 'Yape' ? '📱' : mp === 'Consumo' ? '👤' : mp === 'Cortesía' ? '🎁' : mp === 'Mixto' ? '➕' : '🛵'} {mp === 'Consumo' ? 'Consumo' : mp === 'Cortesía' ? 'Corte.' : mp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pago Mixto para Corrección */}
              {cambioNuevoMetodo === 'Mixto' && (() => {
                const total = ventaACambiar.total;
                const efecVal = parseFloat(cambioMixtoEfectivo || 0);
                const tarjVal = parseFloat(cambioMixtoTarjeta || 0);
                const yapeVal = parseFloat(cambioMixtoYape || 0);
                const ingresado = efecVal + tarjVal + yapeVal;
                const restante = Math.max(0, total - (tarjVal + yapeVal));
                const vuelto = efecVal > restante ? efecVal - restante : 0;
                const diferencia = total - ingresado;

                return (
                  <div className="bg-cyan-500/5 border border-amber-500/20 p-3 rounded-2xl shadow-sm space-y-3">
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-amber-600 flex justify-between">
                      <span>Desglose de Pago Mixto</span>
                      <span>Total: S/ {total.toFixed(2)}</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💵 Efec. (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoEfectivo}
                          onChange={(e) => setCambioMixtoEfectivo(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💳 Tarj. (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoTarjeta}
                          onChange={(e) => setCambioMixtoTarjeta(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">📱 Yape (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoYape}
                          onChange={(e) => setCambioMixtoYape(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-1 text-[9px] font-bold text-slate-500">
                      <div className="flex justify-between">
                        <span>Ingresado:</span>
                        <span className="font-mono text-slate-700">S/ {ingresado.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Faltante:</span>
                        <span className={`font-mono ${diferencia > 0 ? 'text-red-650' : 'text-emerald-600'}`}>
                          S/ {Math.max(0, diferencia).toFixed(2)}
                        </span>
                      </div>
                      {vuelto > 0 && (
                        <div className="flex justify-between col-span-2 border-t border-slate-100 pt-1 mt-0.5 text-[10px] text-emerald-700 font-black">
                          <span>💸 Vuelto:</span>
                          <span className="font-mono">S/ {vuelto.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={cambioPin}
                  onChange={e => { setCambioPin(e.target.value); setCambioError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarMetodoPago()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cambio-pin-auth"
                  autoFocus
                />
              </div>

              {/* Error */}
              {cambioError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {cambioError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setCambioMetodoModal(false); setCambioPin(''); setCambioError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCambiarMetodoPago}
                  disabled={cambiando || !cambioPin.trim()}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {cambiando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : null}
                  {cambiando ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Corregir Tipo de Entrega */}
      {cambioTipoEntregaModal && ventaATipoCambiar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Corregir Tipo de Entrega
                </h3>
                <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{ventaATipoCambiar.id} · S/ {ventaATipoCambiar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCambioTipoEntregaModal(false); setCambioTipoPin(''); setCambioTipoError(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Selector de Nuevo Tipo */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Tipo de Entrega</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'ParaLlevar', label: '🛍️ Llevar' },
                    { type: 'DeliveryPropio', label: '🛵 Delivery' },
                    { type: 'PedidosYa', label: '🛵 PedidosYa' }
                  ].map(item => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setCambioNuevoTipo(item.type)}
                      className={`py-3 px-2 rounded-2xl text-xs font-black uppercase border-2 transition-all ${
                        cambioNuevoTipo === item.type
                          ? 'bg-indigo-500 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos dinámicos según el tipo de entrega */}
              {cambioNuevoTipo === 'PedidosYa' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Código PedidosYa</label>
                    <input
                      type="text"
                      value={cambioCodigoPY}
                      onChange={e => setCambioCodigoPY(e.target.value)}
                      placeholder="Ej. FG-4821"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                </div>
              )}

              {cambioNuevoTipo === 'ParaLlevar' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={cambioNombreCliente}
                      onChange={e => setCambioNombreCliente(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                        <button
                          key={mp}
                          type="button"
                          onClick={() => setCambioMetodoPago(mp)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                            cambioMetodoPago === mp
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {mp}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cambioNuevoTipo === 'DeliveryPropio' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={cambioNombreCliente}
                      onChange={e => setCambioNombreCliente(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={cambioTelefono}
                        onChange={e => setCambioTelefono(e.target.value)}
                        placeholder="Ej. 999888777"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Costo Delivery (S/)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cambioMontoDelivery}
                        onChange={e => setCambioMontoDelivery(e.target.value)}
                        placeholder="Ej. 5.00"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Dirección de Envío</label>
                    <input
                      type="text"
                      value={cambioDireccion}
                      onChange={e => setCambioDireccion(e.target.value)}
                      placeholder="Ej. Av. Larco 123"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Paga Con (S/)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cambioMontoConCuanto}
                        onChange={e => setCambioMontoConCuanto(e.target.value)}
                        placeholder="Ej. 100.00"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                          <button
                            key={mp}
                            type="button"
                            onClick={() => setCambioMetodoPago(mp)}
                            className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border transition-all ${
                              cambioMetodoPago === mp
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {mp}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={cambioTipoPin}
                  onChange={e => { setCambioTipoPin(e.target.value); setCambioTipoError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarTipoEntrega()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-2.5 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cambio-tipo-pin-auth"
                />
              </div>

              {/* Error */}
              {cambioTipoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {cambioTipoError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setCambioTipoEntregaModal(false); setCambioTipoPin(''); setCambioTipoError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCambiarTipoEntrega}
                  disabled={cambioTipoCambiando || !cambioTipoPin.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {cambioTipoCambiando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {cambioTipoCambiando ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Autorizar Cancelación de Llevar/Delivery */}
      {cancelLlevarModalOpen && pedidoACancelarLlevar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Autorizar Cancelación
                </h3>
                <p className="text-xs font-bold opacity-90 mt-0.5">Pedido: {pedidoACancelarLlevar.codigoPedidosYa || `ID: ${pedidoACancelarLlevar.pedidoId}`} · Total: S/ {pedidoACancelarLlevar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCancelLlevarModalOpen(false); setPedidoACancelarLlevar(null); setPinCancelLlevar(''); setErrorCancelLlevar(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="bg-red-50 rounded-2xl p-3 border border-red-100 text-slate-800 text-xs font-semibold leading-relaxed">
                ⚠️ <strong className="font-black text-red-700">Atención:</strong> Esta acción cancelará la orden del cliente de forma permanente y enviará una alerta en tiempo real a cocina/barra.
              </div>

              {/* Detalle de ítems del pedido */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Detalle del Pedido a Cancelar:</p>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                  {pedidoACancelarLlevar.items && pedidoACancelarLlevar.items.length > 0 ? (
                    pedidoACancelarLlevar.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1.5 text-xs text-slate-800 font-bold uppercase">
                        <span>{item.cant}× {item.nombre}</span>
                        <span className="font-mono text-slate-600">S/ {(item.cant * item.precio).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sin productos registrados</p>
                  )}
                </div>
              </div>

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN del Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinCancelLlevar}
                  onChange={e => { setPinCancelLlevar(e.target.value); setErrorCancelLlevar(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleExecuteCancelLlevar()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cancel-pin-auth"
                  autoFocus
                />
              </div>

              {/* Error */}
              {errorCancelLlevar && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {errorCancelLlevar}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setCancelLlevarModalOpen(false); setPedidoACancelarLlevar(null); setPinCancelLlevar(''); setErrorCancelLlevar(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Regresar
                </button>
                <button
                  onClick={handleExecuteCancelLlevar}
                  disabled={!pinCancelLlevar.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-2xl transition-all disabled:opacity-50 shadow-md shadow-red-500/20"
                >
                  ✓ Cancelar Orden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {activeComprobante.contingencia && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="bg-amber-100 text-amber-900 border-2 border-dashed border-amber-400 p-2 rounded-lg text-center mb-3 font-bold text-[9px] uppercase tracking-tight no-print">
                  ⚠️ TICKET DE CONTROL INTERNO<br />
                  Emisión electrónica pendiente por contingencia
                </div>
              )}
              
              <div className="flex justify-center mb-2">
                <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain filter grayscale contrast-125" />
              </div>
              <div className="text-center font-black tracking-wide" style={{ fontSize: '14px', marginBottom: '2px' }}>{COMPANY_CONFIG.legalName}</div>
              <div className="text-center text-[10px] leading-tight mb-2">
                {COMPANY_CONFIG.address}<br />
                R.U.C. N° {COMPANY_CONFIG.ruc}
              </div>
              
              <div className="text-center font-bold mb-1" style={{ fontSize: '11px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? '👤 VALE DE CONSUMO PERSONAL' :
                activeComprobante.metodoPago === 'Cortesía' ? '🎁 CORTESÍA / CONSUMO INTERNO' :
                'TICKET DE VENTA'
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
                const itemsImprimibles = (activeComprobante.items || []).filter(Boolean);

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
                    onLoad={() => {
                      if (activeComprobante.shouldAutoPrint) {
                        setTimeout(() => {
                          window.print();
                        }, 200);
                        activeComprobante.shouldAutoPrint = false; // Evitar disparar de nuevo al recargar
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'none' }}>
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                    onLoad={() => {
                      if (activeComprobante.shouldAutoPrint) {
                        setTimeout(() => {
                          window.print();
                        }, 200);
                        activeComprobante.shouldAutoPrint = false; // Evitar disparar de nuevo al recargar
                      }
                    }}
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

              {FACTURACION_ELECTRONICA && activeComprobante.enlacePdf && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
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

      {/* Modal: Anular / Registrar Devolución de Venta */}
      {anularVentaModal && ventaAAnular && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <Ban className="w-5 h-5 animate-pulse" />
                  Registrar Devolución
                </h3>
                <p className="text-xs font-bold opacity-90 mt-0.5">
                  Venta #{ventaAAnular.id} ({ventaAAnular.tipoComprobante}) · Original: S/ {(ventaAAnular.montoOriginal || ventaAAnular.total).toFixed(2)}
                </p>
              </div>
              <button 
                onClick={() => { setAnularVentaModal(false); setVentaAAnular(null); setAnularError(''); }}
                className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 p-3 rounded-2xl text-red-900 text-xs font-medium space-y-1">
                <div className="font-black flex items-center gap-1.5 text-red-700 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  Atención sobre Devoluciones
                </div>
                <p className="text-[11px] text-red-800 leading-snug">
                  Esta venta <strong>permanecerá en el historial</strong> para auditoría, pero su monto cambiará a <strong>S/ 0.00</strong> para que no afecte el arqueo de caja.
                </p>
              </div>

              {/* Motivo de Devolución */}
              <div>
                <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
                  Motivo de Devolución / Anulación:
                </label>
                <textarea
                  value={anularMotivo}
                  onChange={(e) => setAnularMotivo(e.target.value)}
                  placeholder="Ej: Cliente devolvió pedido por demora / Pedido equivocado / Cancelación..."
                  rows={2}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl p-2.5 font-medium text-slate-800 text-xs focus:outline-none resize-none"
                />
              </div>

              {/* PIN de Administrador */}
              <div>
                <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
                  PIN de Autorización (Administrador):
                </label>
                <input
                  type="password"
                  value={anularPin}
                  onChange={(e) => setAnularPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 text-center font-mono font-black text-slate-900 tracking-[0.5em] text-lg focus:outline-none"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                />
              </div>

              {/* Error */}
              {anularError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0" />
                  {anularError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setAnularVentaModal(false); setVentaAAnular(null); setAnularError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={procesarAnulacionVenta}
                  disabled={anularCargando || !anularPin.trim() || !anularMotivo.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                >
                  {anularCargando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {anularCargando ? 'Procesando...' : 'Confirmar Devolución'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
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
          section > *:not(#modal-comprobante-sunat-print-container):not(#modal-cierre):not(#modal-cierre-reimpresion) {
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
          
          /* Cierre de Caja en impresión */
          #modal-cierre,
          #modal-cierre-reimpresion {
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
          #modal-cierre > div,
          #modal-cierre-reimpresion > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre div.bg-slate-950, 
          #modal-cierre div.shrink-0,
          #modal-cierre-reimpresion button {
            display: none !important;
          }
          #cierre-imprimible,
          #cierre-imprimible-reimpresion {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible *,
          #cierre-imprimible-reimpresion * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible div,
          #cierre-imprimible-reimpresion div {
            page-break-inside: avoid !important;
          }
        }
      `}</style>


      {/* FLOATING TOASTS NOTIFICATIONS SYSTEM FOR CAJA */}
      <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const isError = t.tipo === 'error';
          const isSuccess = t.tipo === 'success';
          const borderClass = isError ? 'border-red-500/20' : (isSuccess ? 'border-emerald-500/20' : 'border-blue-500/20');
          const gradientClass = isError ? 'from-red-500/10' : (isSuccess ? 'from-emerald-500/10' : 'from-blue-500/10');
          const bgClass = isError ? 'bg-red-500 shadow-red-500/20' : (isSuccess ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-500 shadow-blue-500/20');
          const icon = isError ? '🗑️' : (isSuccess ? '✅' : '🛎️');
          const textTitle = isError ? 'Pedido Cancelado' : (isSuccess ? 'Operación Exitosa' : '¡Pedido Listo!');
          const titleColor = isError ? 'text-red-400' : (isSuccess ? 'text-emerald-400' : 'text-blue-400');
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
