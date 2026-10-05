import {
  Banknote,
  CreditCard,
  Smartphone,
  Layers,
  Wallet,
  Users,
  Gift,
  Truck,
  Receipt,
} from 'lucide-react';

export const METODO_ESTILO = {
  Efectivo: {
    Icon: Banknote,
    chip: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    activo: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/25',
    icono: 'text-emerald-600',
  },
  Tarjeta: {
    Icon: CreditCard,
    chip: 'bg-blue-50 text-blue-700',
    text: 'text-blue-700',
    activo: 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25',
    icono: 'text-blue-600',
  },
  Yape: {
    Icon: Smartphone,
    chip: 'bg-purple-50 text-purple-700',
    text: 'text-purple-700',
    activo: 'bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/25',
    icono: 'text-purple-600',
  },
  Mixto: {
    Icon: Layers,
    chip: 'bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    activo: 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/25',
    icono: 'text-amber-500',
  },
  Crédito: {
    Icon: Wallet,
    chip: 'bg-teal-50 text-teal-700',
    text: 'text-teal-700',
    activo: 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/25',
    icono: 'text-teal-600',
  },
  Consumo: {
    Icon: Users,
    chip: 'bg-violet-50 text-violet-700',
    text: 'text-violet-700',
    activo: 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/25',
    icono: 'text-violet-600',
  },
  Cortesía: {
    Icon: Gift,
    chip: 'bg-orange-50 text-orange-700',
    text: 'text-orange-700',
    activo: 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/25',
    icono: 'text-orange-500',
  },
  PedidosYa: {
    Icon: Truck,
    chip: 'bg-rose-50 text-rose-600',
    text: 'text-rose-600',
    activo: 'bg-rose-600 border-rose-600 text-white',
    icono: 'text-rose-600',
  },
};

export const getEstiloMetodo = (metodo) =>
  METODO_ESTILO[metodo] || {
    Icon: Receipt,
    chip: 'bg-slate-100 text-slate-600',
    text: 'text-slate-600',
    activo: 'bg-slate-900 border-slate-900 text-white',
    icono: 'text-slate-500',
  };
