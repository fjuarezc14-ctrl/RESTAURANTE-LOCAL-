// Categorías de barra e ícono y color por categoría
import { Utensils, CupSoda, Wine } from 'lucide-react';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS } from '../../config/company';

// Categorías de Barra (el resto va a Cocina)
export const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

// Ícono y color por categoría
export function getCatStyle(cat, esBarra) {
  if (esBarra) {
    if (cat === 'Cervezas') return { Icon: CupSoda, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
    if (cat === 'Bar y Cocteles') return { Icon: Wine, color: 'text-purple-500', bg: 'bg-purple-100', badge: 'bg-purple-100 text-purple-700' };
    if (cat === 'Bebidas Calientes') return { Icon: CupSoda, color: 'text-orange-500', bg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700' };
    if (cat === 'Postres') return { Icon: Utensils, color: 'text-rose-400', bg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700' };
    return { Icon: CupSoda, color: 'text-blue-500', bg: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700' };
  }
  return { Icon: Utensils, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
}
