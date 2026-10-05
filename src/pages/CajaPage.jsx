import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, X, Banknote, Search, CheckCircle, Clock, CreditCard, Wallet, Truck, PackageCheck, Plus, Calculator, Printer, Gift, Percent, Check, Users, Layers, Ban, AlertTriangle, Trash2, Lock, Flame, FileText, History, ExternalLink, ChevronDown, ChevronRight, ShoppingCart, Coins, RotateCcw, Pencil, ShoppingBag, UtensilsCrossed, Phone, MapPin, Smartphone, Eye, EyeOff, Bike, Unlock, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';

import { api } from '../api';
import { parsePasosOpciones, resolverSeleccion, pasoComplementos, resolverComplementos, tieneComplementos } from '../utils/combos';

import { useCompany } from '../context/CompanyContext';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS, ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';
import { matchProductSemantic, relevanciaBusqueda, ordenarCategorias } from '../utils/busquedaProductos';
import { generateOfflineQrUrl } from '../utils/qrOffline';
import { useAviso, useConfirmar } from '../components/ui';
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
} from '../modulos/caja/modales';

// Desactivado por defecto (se emite en portal SUNAT SOL o ticket de control interno)
const FACTURACION_ELECTRONICA = false;

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
// Billetes y monedas en circulación en Perú (los de 1 y 5 céntimos ya no circulan)
const DENOMINACIONES_PEN = [
  { valor: 200, etiqueta: 'S/ 200', tipo: 'billete', color: 'bg-purple-100 text-purple-800' },
  { valor: 100, etiqueta: 'S/ 100', tipo: 'billete', color: 'bg-sky-100 text-sky-800' },
  { valor: 50, etiqueta: 'S/ 50', tipo: 'billete', color: 'bg-orange-100 text-orange-800' },
  { valor: 20, etiqueta: 'S/ 20', tipo: 'billete', color: 'bg-amber-100 text-amber-800' },
  { valor: 10, etiqueta: 'S/ 10', tipo: 'billete', color: 'bg-emerald-100 text-emerald-800' },
  { valor: 5, etiqueta: 'S/ 5', tipo: 'moneda', color: 'bg-yellow-100 text-yellow-800 rounded-full' },
  { valor: 2, etiqueta: 'S/ 2', tipo: 'moneda', color: 'bg-yellow-100 text-yellow-800 rounded-full' },
  { valor: 1, etiqueta: 'S/ 1', tipo: 'moneda', color: 'bg-slate-200 text-slate-700 rounded-full' },
  { valor: 0.5, etiqueta: '50 cént.', tipo: 'moneda', color: 'bg-amber-50 text-amber-700 rounded-full' },
  { valor: 0.2, etiqueta: '20 cént.', tipo: 'moneda', color: 'bg-amber-50 text-amber-700 rounded-full' },
  { valor: 0.1, etiqueta: '10 cént.', tipo: 'moneda', color: 'bg-amber-50 text-amber-700 rounded-full' },
];

const parseMonto = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
};

// Componente de Calculadora de Billetes y Monedas en 2 Columnas
function CalculadoraEfectivoPEN({
  conteo = {},
  onChangeCantidad,
  onLimpiar,
  mostrarTitulo = true,
  titulo = "Conteo de efectivo",
}) {
  const safeConteo = conteo || {};
  const billetes = DENOMINACIONES_PEN.filter(d => d.tipo === 'billete');
  const monedas = DENOMINACIONES_PEN.filter(d => d.tipo === 'moneda');

  const subtotalBilletes = billetes.reduce((s, d) => s + d.valor * (Number(safeConteo[d.valor]) || 0), 0);
  const subtotalMonedas = monedas.reduce((s, d) => s + d.valor * (Number(safeConteo[d.valor]) || 0), 0);
  const hayConteo = DENOMINACIONES_PEN.some(d => Number(safeConteo[d.valor]) > 0);

  const renderFila = (d) => {
    const cant = Number(safeConteo[d.valor]) || 0;
    const subtotal = d.valor * cant;
    return (
      <div
        key={d.valor}
        className={`flex items-center gap-1.5 rounded-xl px-2 py-1 transition-all ${
          cant > 0 ? 'bg-emerald-50/90 border border-emerald-200/80 shadow-2xs' : 'hover:bg-slate-50/80 border border-transparent'
        }`}
      >
        <span className={`w-14 h-7.5 rounded-lg grid place-items-center text-xs font-bold font-mono shrink-0 shadow-2xs ${d.color}`}>
          {d.etiqueta}
        </span>
        <div className="flex items-center rounded-lg border border-slate-200 bg-white shrink-0 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeCantidad(d.valor, cant - 1)}
            disabled={cant === 0}
            className="w-7 h-7.5 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 text-base font-bold leading-none cursor-pointer transition-colors"
            aria-label={`Quitar ${d.etiqueta}`}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={cant || ''}
            placeholder="0"
            onChange={(e) => onChangeCantidad(d.valor, e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-10 h-7.5 text-center text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={`Cantidad de ${d.etiqueta}`}
          />
          <button
            type="button"
            onClick={() => onChangeCantidad(d.valor, cant + 1)}
            className="w-7 h-7.5 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-base font-bold leading-none cursor-pointer transition-colors"
            aria-label={`Agregar ${d.etiqueta}`}
          >
            +
          </button>
        </div>
        <span className={`flex-1 text-right font-mono text-xs tabular-nums truncate ${cant > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
          S/ {subtotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {mostrarTitulo && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Coins className="w-4 h-4 text-amber-500" /> {titulo}
          </p>
          {hayConteo && onLimpiar && (
            <button
              type="button"
              onClick={onLimpiar}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* Grid de 2 Columnas: Billetes a la izquierda, Monedas a la derecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Columna Billetes */}
        <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Billetes
              </span>
              <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                S/ {subtotalBilletes.toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">
              {billetes.map(renderFila)}
            </div>
          </div>
        </div>

        {/* Columna Monedas */}
        <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" /> Monedas
              </span>
              <span className="text-[10px] font-bold font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                S/ {subtotalMonedas.toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">
              {monedas.map(renderFila)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

const parseDeliveryInfo = (code) => {
  if (!code || typeof code !== 'string' || !code.startsWith('DELIVERY -')) return null;
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
  const FACTURACION_ELECTRONICA = COMPANY_CONFIG?.facturacionElectronica ?? true;
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [stats, setStats] = useState({ atendidas: 0, ingresos: 0 });
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
  const [conteoApertura, setConteoApertura] = useState({}); // { valorDenominacion: cantidad } para fondo inicial
  const [notaAperturaInput, setNotaAperturaInput] = useState('');
  const [guardandoApertura, setGuardandoApertura] = useState(false);
  const [errorApertura, setErrorApertura] = useState('');

  // Salidas / Retiros de Efectivo de Caja en Turno
  const [modalSalidaCajaOpen, setModalSalidaCajaOpen] = useState(false);
  const [montoSalidaCaja, setMontoSalidaCaja] = useState('');
  const [motivoSalidaCaja, setMotivoSalidaCaja] = useState('');
  const [guardandoSalidaCaja, setGuardandoSalidaCaja] = useState(false);
  const [errorSalidaCaja, setErrorSalidaCaja] = useState('');
  const [tipoMovimientoCaja, setTipoMovimientoCaja] = useState('RETIRO'); // 'RETIRO' | 'INGRESO'

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
  const [conteoBilletes, setConteoBilletes] = useState({}); // { valorDenominacion: cantidad }
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
  const [pinCancelLlevar, setPinCancelLlevar] = useState('');
  const [errorCancelLlevar, setErrorCancelLlevar] = useState('');

  // Modal PedidosYa y Para Llevar
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [codigoPY, setCodigoPY] = useState('');
  // cajeroNombre = responsable del turno (apertura/cierre). Las ventas, retiros y
  // cancelaciones se registran con quien tiene la sesión iniciada (usuarioOperador).
  const [cajeroNombre, setCajeroNombre] = useState(currentUser?.nombre || 'María');
  const usuarioOperador = currentUser?.nombre || cajeroNombre || 'Cajero';
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
  const [deliveryCategoriasModalOpen, setDeliveryCategoriasModalOpen] = useState(false);
  const deliverySearchInputRef = useRef(null);
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

  const cambiarCantidadApertura = (valor, cantidad) => {
    const n = Math.max(0, Math.floor(Number(cantidad) || 0));
    const siguiente = { ...conteoApertura, [valor]: n };
    setConteoApertura(siguiente);
    const total = DENOMINACIONES_PEN.reduce((s, d) => s + d.valor * (Number(siguiente[d.valor]) || 0), 0);
    setMontoInicialInput(DENOMINACIONES_PEN.some(d => Number(siguiente[d.valor]) > 0) ? total.toFixed(2) : '');
  };

  const handleAbrirCaja = async (e) => {
    e?.preventDefault();
    setErrorApertura('');
    const cajero = cajeroNombre || currentUser?.nombre || 'Cajero';
    const monto = parseMonto(montoInicialInput);
    if (isNaN(monto) || monto < 0) {
      setErrorApertura('El fondo inicial debe ser un número válido mayor o igual a 0.');
      return;
    }

    setGuardandoApertura(true);
    try {
      const res = await api.abrirCaja({
        cajeroNombre: cajero,
        montoInicial: Math.max(0, monto),
        notaApertura: notaAperturaInput.trim() || null,
      });

      if (res.error) {
        setErrorApertura(res.error);
        return;
      }

      setModalAperturaOpen(false);
      setModoOtroCajero(false);
      setConteoApertura({});
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

  const handleRegistrarSalidaCaja = async (e) => {
    e?.preventDefault();
    setErrorSalidaCaja('');
    const monto = parseMonto(montoSalidaCaja);
    if (isNaN(monto) || monto <= 0) {
      setErrorSalidaCaja('Ingresa un monto válido mayor a S/ 0.00');
      return;
    }
    const esIngreso = tipoMovimientoCaja === 'INGRESO';
    if (!motivoSalidaCaja.trim()) {
      setErrorSalidaCaja(esIngreso ? 'Ingresa el motivo del ingreso de dinero.' : 'Ingresa el motivo del retiro o salida de dinero.');
      return;
    }

    setGuardandoSalidaCaja(true);
    try {
      const res = await api.registrarMovimientoCaja({
        monto,
        motivo: motivoSalidaCaja.trim(),
        tipo: esIngreso ? 'INGRESO' : 'RETIRO',
        cajeroNombre: usuarioOperador
      });
      if (res.error) {
        setErrorSalidaCaja(res.error);
        return;
      }
      setModalSalidaCajaOpen(false);
      setMontoSalidaCaja('');
      setMotivoSalidaCaja('');
      await fetchCajaData();
      addToast(esIngreso
        ? `💵 Ingreso de S/ ${monto.toFixed(2)} registrado en caja`
        : `💸 Salida de S/ ${monto.toFixed(2)} registrada correctamente de caja`, 'success');
    } catch (err) {
      setErrorSalidaCaja('Error al registrar el movimiento: ' + err.message);
    } finally {
      setGuardandoSalidaCaja(false);
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
    let correlativoStr = String(v.numero || v.id).padStart(4, '0');
    
    const detalle = (v.itemsResumen || '').trim();
    const totalSafe = Number(v.total || 0).toFixed(2);
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, le enviamos el detalle de su consumo en *${COMPANY_CONFIG.name}*:\n\n${detalle ? detalle + '\n\n' : ''}Total: *S/ ${totalSafe}*\nTicket de venta N° ${v.id}\n\n¡Gracias por su preferencia!`;
    
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
        cajeroNombre: usuarioOperador,
        codigoPago: codigoPago.trim() || null,
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
        canceladoPor: usuarioOperador,
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
    // Los tickets no llevan correlativo SUNAT: se numeran con el ID de la venta (único e incremental)
    let correlativoStr = String(response.numero || response.ventaId || response.id || '').padStart(4, '0');
    let subtotal = total / 1.105;
    let igv = total - subtotal;
    let totalLetras = numeroALetras(total);
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = `R.U.C. N° ${COMPANY_CONFIG.ruc}`;
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
    if (itemsDelivery.length === 0) { alert('Debes agregar al menos un producto.'); return; }
    // Pedidos nuevos por PedidosYa deshabilitados (versión de prueba)
    if (tipoDelivery === 'PedidosYa' && !editingPedidoId) { avisarPedidosYaPrueba(); return; }

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

      if (tarjVal + yapeVal + credVal > (grandTotal + 0.01)) {
        alert('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar.');
        return;
      }

      const restante = parseFloat(Math.max(0, grandTotal - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, restante - efecVal).toFixed(2));
        alert(`Monto insuficiente. Debes cubrir el total de S/ ${grandTotal.toFixed(2)}.\nFaltan S/ ${faltante.toFixed(2)}`);
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
    setMontoCreditoMixto('');
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
                onClick={() => {
                  setMontoSalidaCaja('');
                  setMotivoSalidaCaja('');
                  setErrorSalidaCaja('');
                  setTipoMovimientoCaja('RETIRO');
                  setModalSalidaCajaOpen(true);
                }}
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
                onClick={() => {
                  setConteoApertura({});
                  setMontoInicialInput('');
                  setNotaAperturaInput('');
                  setErrorApertura('');
                  setModalAperturaOpen(true);
                }}
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
          setPinCancelLlevar('');
          setErrorCancelLlevar('');
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
        onAbrirAnulacion={(v) => abrirAnularVentaModal(v)}
        onEnviarWhatsApp={(v) => enviarPorWhatsApp(v)}
        onReimprimir={(v) => reimprimirComprobante(v)}
        onEditarMetodoPago={(v) => {
          setVentaACambiar(v);
          setCambioNuevoMetodo(v.metodoPago);
          setCambioPin('');
          setCambioError('');
          setCambioMetodoModal(true);
        }}
        onEditarTipoEntrega={(v) => abrirCambioTipoEntregaModal(v)}
        estiloMetodo={estiloMetodo}
        itemsDeVenta={itemsDeVenta}
        clienteDeVenta={clienteDeVenta}
        origenDeVenta={origenDeVenta}
        parseDeliveryInfo={parseDeliveryInfo}
      />

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
                    <div className="space-y-3 animate-fade-in">
                      <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                        Se registrará <span className="font-mono font-semibold text-slate-900">{soles(totalConCortesias)}</span> pagado íntegramente con {metodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                      </p>
                      {campoCodigoPago(codigoPago, setCodigoPago, metodoPago)}
                    </div>
                  )}
                  {metodoPago === 'Mixto' && (parseMonto(mixtoTarjeta) > 0 || parseMonto(mixtoYape) > 0) &&
                    campoCodigoPago(codigoPago, setCodigoPago, 'Mixto')}

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
          <div
            onPointerDown={(e) => {
              // Cierra el teclado del celular al tocar fuera del buscador
              const input = deliverySearchInputRef.current;
              if (input && document.activeElement === input && !input.contains(e.target)) input.blur();
            }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[110] flex items-end md:items-center justify-center md:p-6 animate-fade-in"
          >
            <div className="bg-white w-full max-w-6xl h-[96dvh] md:h-[min(92dvh,880px)] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">{editingPedidoId ? 'Modificar pedido' : 'Nuevo pedido'}</h2>
                    <p className="text-sm text-slate-500 truncate">Para llevar, delivery o PedidosYa · Cajero: {usuarioOperador}</p>
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
                      {
                        id: 'PedidosYa', label: 'PedidosYa', Icon: Truck, activo: 'bg-rose-600 text-white shadow-sm',
                        // Los pedidos nuevos por PedidosYa están deshabilitados (versión de prueba);
                        // los que ya existían se pueden seguir modificando.
                        bloqueado: !editingPedidoId,
                        onSel: () => {
                          if (!editingPedidoId) { avisarPedidosYaPrueba(); return; }
                          setTipoDelivery('PedidosYa'); setCodigoPY(''); setDeliveryMontoEnvio('');
                        },
                      },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.onSel}
                        className={`h-9 px-3 sm:px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                          tipoDelivery === t.id ? t.activo : (t.bloqueado ? 'text-slate-400 opacity-60' : 'text-slate-500 hover:text-slate-800')
                        }`}
                      >
                        {t.bloqueado ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <t.Icon className="w-4 h-4 shrink-0" />} <span className="truncate">{t.label}</span>
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
                        ref={deliverySearchInputRef}
                        type="text"
                        inputMode="search"
                        enterKeyHint="search"
                        placeholder="Buscar por nombre (ej: pollo, 1/4, parri)…"
                        value={deliverySearchQuery}
                        onChange={(e) => setDeliverySearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className={`${inp} pl-9 pr-9`}
                      />
                      {deliverySearchQuery && (
                        <button type="button" onClick={() => setDeliverySearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {/* Categorías: solo unas pocas + botón para ver todas (deslizar era incómodo en celular) */}
                    <div className="flex flex-wrap gap-1.5">
                      {deliveryCategoriasBarra.map(cat => {
                        const isMasPedidos = cat === '🔥 Más Pedidos';
                        const isSelected = deliveryCategoriaFiltro === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setDeliveryCategoriaFiltro(cat)}
                            className={`max-w-[11rem] h-8 px-3 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                              isSelected
                                ? (isMasPedidos ? 'bg-amber-500 text-white shadow-sm' : 'bg-sky-600 text-white shadow-sm')
                                : (isMasPedidos ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700')
                            }`}
                          >
                            {isMasPedidos && <Flame className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />}
                            <span className="truncate">{isMasPedidos ? 'Más pedidos' : cat}</span>
                          </button>
                        );
                      })}
                      {deliveryCategoriasOrdenadas.length > CATEGORIAS_VISIBLES && (
                        <button
                          type="button"
                          onClick={() => setDeliveryCategoriasModalOpen(true)}
                          className="h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 active:scale-95 transition"
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" /> Ver todas ({deliveryCategoriasOrdenadas.length - 2})
                        </button>
                      )}
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
                        const menuAgrupado = agruparProductos(menuFiltradoPre);
                        const menuFiltrado = deliverySearchQuery.trim()
                          ? [...menuAgrupado].sort((a, b) => relevanciaBusqueda(a, deliverySearchQuery) - relevanciaBusqueda(b, deliverySearchQuery))
                          : menuAgrupado;

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
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'Efectivo', Icon: Banknote, label: 'Efectivo' },
                            { id: 'Tarjeta', Icon: CreditCard, label: 'Tarjeta' },
                            { id: 'Yape', Icon: Smartphone, label: 'Yape' },
                            { id: 'Mixto', Icon: Layers, label: 'Mixto' },
                            { id: 'Crédito', Icon: Wallet, label: 'Crédito' },
                            { id: 'Cortesía', Icon: Gift, label: 'Cortesía' },
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
                          <div className="space-y-3 animate-fade-in">
                            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                              Se registrará <span className="font-mono font-semibold text-slate-900">{soles(grandTotalDelivery)}</span> con {deliveryMetodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                            </p>
                            {campoCodigoPago(deliveryCodigoPago, setDeliveryCodigoPago, deliveryMetodoPago)}
                          </div>
                        )}
                        {deliveryMetodoPago === 'Mixto' && (parseFloat(deliveryMixtoTarjeta || 0) > 0 || parseFloat(deliveryMixtoYape || 0) > 0) &&
                          campoCodigoPago(deliveryCodigoPago, setDeliveryCodigoPago, 'Mixto')}

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
