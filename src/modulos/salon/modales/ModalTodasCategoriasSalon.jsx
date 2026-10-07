import { LayoutGrid, X, Flame } from 'lucide-react';

/**
 * Modal para seleccionar una categoría del menú en la toma de pedidos de salón
 */
export default function ModalTodasCategoriasSalon({
  abierto,
  onCerrar,
  categorias = [],
  categoriaActiva,
  onSeleccionar,
  contarProductos = () => 0,
}) {
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center text-slate-900">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm md:text-base uppercase tracking-tight leading-none">Categorías</h2>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Toca una para ver sus productos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="bg-slate-800 hover:bg-red-500 p-2 rounded-xl transition-colors text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar grid grid-cols-2 gap-2 content-start">
          {categorias.map(cat => {
            const activa = categoriaActiva === cat;
            const isMasPedidos = cat === '🔥 Más Pedidos';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSeleccionar(cat)}
                className={`min-h-[3.5rem] px-3 py-2.5 rounded-2xl border text-left flex flex-col justify-center transition-all active:scale-95 cursor-pointer ${
                  activa
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : isMasPedidos
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-amber-50'
                }`}
              >
                <span className="font-black text-xs uppercase leading-tight flex items-center gap-1.5">
                  {isMasPedidos && <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  {cat}
                </span>
                <span className={`text-[10px] font-bold mt-0.5 ${activa ? 'text-slate-300' : 'text-slate-400'}`}>
                  {contarProductos(cat)} productos
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
