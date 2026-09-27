import { ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';

// Clases completas (Tailwind necesita verlas escritas) para cada color de categoría
export const COLORES_CATEGORIA = {
  amber:   { dot: 'bg-amber-500',   soft: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800' },
  orange:  { dot: 'bg-orange-500',  soft: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-800' },
  rose:    { dot: 'bg-rose-500',    soft: 'bg-rose-50',    border: 'border-rose-300',    text: 'text-rose-800' },
  lime:    { dot: 'bg-lime-500',    soft: 'bg-lime-50',    border: 'border-lime-300',    text: 'text-lime-800' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
  sky:     { dot: 'bg-sky-500',     soft: 'bg-sky-50',     border: 'border-sky-300',     text: 'text-sky-800' },
  violet:  { dot: 'bg-violet-500',  soft: 'bg-violet-50',  border: 'border-violet-300',  text: 'text-violet-800' },
  slate:   { dot: 'bg-slate-500',   soft: 'bg-slate-50',   border: 'border-slate-300',   text: 'text-slate-800' },
};

export const colorCategoria = (color) => COLORES_CATEGORIA[color] || COLORES_CATEGORIA.amber;

// Primero el orden gastronómico habitual, luego alfabético
export function ordenarCategorias(lista, getNombre = (c) => c) {
  return [...lista].sort((a, b) => {
    const na = getNombre(a);
    const nb = getNombre(b);
    const ia = ORDEN_PRIORIDADES_CATEGORIAS.indexOf(na);
    const ib = ORDEN_PRIORIDADES_CATEGORIAS.indexOf(nb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return na.localeCompare(nb);
  });
}
