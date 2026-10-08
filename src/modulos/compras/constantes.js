// Compras: categorías, colores, conceptos rápidos, métodos de pago y formato de fechas
import { Banknote, CreditCard, Smartphone, Layers } from 'lucide-react';
import { getFechaPeru } from './utils';

export const CATEGORIAS = [
  'Insumos y Alimentos',
  'Bebidas',
  'Gas y Carbón',
  'Limpieza e Higiene',
  'Personal',
  'Otros',
];

export const COLORES_CATEGORIA = {
  'Insumos y Alimentos': { chip: 'bg-amber-50 text-amber-700 border-amber-200', activo: 'bg-amber-500 text-white border-amber-500', bar: 'bg-amber-500' },
  'Bebidas':             { chip: 'bg-sky-50 text-sky-700 border-sky-200',       activo: 'bg-sky-600 text-white border-sky-600',     bar: 'bg-sky-500' },
  'Gas y Carbón':        { chip: 'bg-orange-50 text-orange-700 border-orange-200', activo: 'bg-orange-500 text-white border-orange-500', bar: 'bg-orange-500' },
  'Limpieza e Higiene':  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', activo: 'bg-emerald-600 text-white border-emerald-600', bar: 'bg-emerald-500' },
  'Personal':            { chip: 'bg-violet-50 text-violet-700 border-violet-200', activo: 'bg-violet-600 text-white border-violet-600', bar: 'bg-violet-500' },
  'Otros':               { chip: 'bg-slate-100 text-slate-600 border-slate-200', activo: 'bg-slate-700 text-white border-slate-700', bar: 'bg-slate-400' },
  'Sin Categoría':       { chip: 'bg-slate-50 text-slate-400 border-slate-200', activo: 'bg-slate-400 text-white border-slate-400', bar: 'bg-slate-300' },
};

export const coloresDe = (cat) => COLORES_CATEGORIA[cat] || COLORES_CATEGORIA['Sin Categoría'];

// Conceptos rápidos inspirados en el cuaderno de Control Caja
export const CONCEPTOS_RAPIDOS = [
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

export const METODOS_PAGO = [
  { id: 'Efectivo', label: 'Efectivo', Icon: Banknote, activo: 'bg-emerald-600 border-emerald-600 text-white', icono: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700' },
  { id: 'Yape', label: 'Yape / Plin', Icon: Smartphone, activo: 'bg-violet-600 border-violet-600 text-white', icono: 'text-violet-600', chip: 'bg-violet-50 text-violet-600', text: 'text-violet-700' },
  { id: 'Tarjeta', label: 'Tarjeta', Icon: CreditCard, activo: 'bg-sky-600 border-sky-600 text-white', icono: 'text-sky-600', chip: 'bg-sky-50 text-sky-600', text: 'text-sky-700' },
  { id: 'Mixto', label: 'Mixto', Icon: Layers, activo: 'bg-slate-800 border-slate-800 text-white', icono: 'text-slate-600', chip: 'bg-slate-100 text-slate-600', text: 'text-slate-600' },
];

export const estiloMetodo = (metodoPago) => {
  const id = String(metodoPago || 'Efectivo').startsWith('Mixto') ? 'Mixto' : metodoPago;
  return METODOS_PAGO.find(m => m.id === id) || METODOS_PAGO[0];
};

export const TIPOS_DOCUMENTO = ['Recibo Interno', 'Boleta', 'Factura', 'Ticket'];

export const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

// Día del gasto en formato YYYY-MM-DD. fechaEmision es un día de calendario: se guarda a las
// 12:00 de Lima (y los registros antiguos a las 00:00 UTC), así que su día UTC es el correcto.
// Sin fechaEmision solo queda la hora real de registro, que se lee en hora de Lima.
export const diaDeCompra = (c) => {
  if (c.fechaEmision) return String(c.fechaEmision).slice(0, 10);
  const f = c.fecha || c.creadoEn;
  return f ? getFechaPeru(new Date(f)) : null;
};

export const formatearDia = (dia, opciones = { day: '2-digit', month: 'short' }) => dia
  ? new Date(`${dia}T12:00:00.000Z`).toLocaleDateString('es-PE', { timeZone: 'UTC', ...opciones })
  : '—';

export const formVacio = (fecha) => ({
  proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
  total: '', categoria: 'Insumos y Alimentos', fechaEmision: fecha,
  metodoPago: 'Efectivo', montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: '',
});
