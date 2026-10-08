// Buscador de productos de la carta
import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '../../components/ui';
import { cn } from '../../utils/cn';
import { matchProductSemantic } from './busqueda';

const ACENTOS_BUSCADOR = {
  violet: { foco: 'focus:border-violet-500 focus:ring-violet-100', hover: 'hover:bg-violet-50', mas: 'bg-violet-100 text-violet-700' },
  sky: { foco: 'focus:border-sky-500 focus:ring-sky-100', hover: 'hover:bg-sky-50', mas: 'bg-sky-100 text-sky-700' },
};

// Buscador de productos de la carta; con onTextoLibre también permite agregar lo escrito como texto
export function BuscadorProductos({ productos, onElegir, onTextoLibre, placeholder, acento = 'violet', compacto = false }) {
  const [q, setQ] = useState('');
  const texto = q.trim();
  const resultados = texto ? productos.filter(p => matchProductSemantic(p, texto)).slice(0, 6) : [];
  const a = ACENTOS_BUSCADOR[acento];

  const elegir = (p) => { onElegir(p); setQ(''); };
  const agregarTexto = () => {
    if (!texto || !onTextoLibre) return;
    onTextoLibre(texto);
    setQ('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onTextoLibre) agregarTexto();
      else if (resultados[0]) elegir(resultados[0]);
    } else if (e.key === 'Escape' && q) {
      e.stopPropagation(); // limpia la búsqueda sin cerrar el modal
      setQ('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(compacto ? 'h-10 text-sm' : 'h-12', 'pl-10 font-medium', a.foco)}
        />
      </div>
      {texto && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y divide-slate-100 animate-fade-in">
          {onTextoLibre && (
            <button type="button" onClick={agregarTexto} className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-slate-700 cursor-pointer', a.hover)}>
              <span className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', a.mas)}><Plus className="w-4 h-4" /></span>
              Agregar “{texto}”
            </button>
          )}
          {onTextoLibre && resultados.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">De la carta</p>
          )}
          {resultados.map(p => (
            <button key={p.id} type="button" onClick={() => elegir(p)} className={cn('w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer', a.hover)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400 truncate">{p.categoria}</p>
              </div>
              <span className="text-sm font-mono font-bold text-slate-600">S/ {Number(p.precio || 0).toFixed(2)}</span>
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', a.mas)}><Plus className="w-4 h-4" /></span>
            </button>
          ))}
          {!onTextoLibre && resultados.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">No se encontró “{texto}”</p>
          )}
        </div>
      )}
    </div>
  );
}
