import { X, Flame } from 'lucide-react';

/**
 * Modal para seleccionar una categoría del menú en la creación de pedidos de delivery / llevar
 */
export default function ModalTodasCategorias({
  abierto,
  onCerrar,
  categorias = [],
  categoriaFiltro,
  onSeleccionar,
  contarProductos = () => 0,
}) {
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[120] flex items-end md:items-center justify-center md:p-6 animate-fade-in"
      onClick={onCerrar}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[85dvh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900">Categorías</p>
            <p className="text-sm text-slate-500">Toca una para ver sus productos</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-2 gap-2 content-start">
          {categorias.map(cat => {
            const activa = categoriaFiltro === cat;
            const isMasPedidos = cat === '🔥 Más Pedidos';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSeleccionar(cat)}
                className={`min-h-[3.5rem] px-3 py-2.5 rounded-xl border text-left flex flex-col justify-center transition active:scale-95 cursor-pointer ${
                  activa
                    ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                    : isMasPedidos
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                }`}
              >
                <span className="text-sm font-medium leading-tight flex items-center gap-1.5">
                  {isMasPedidos && (
                    <Flame className={`w-3.5 h-3.5 shrink-0 ${activa ? 'text-white' : 'text-amber-500'}`} />
                  )}
                  {isMasPedidos ? 'Más pedidos' : cat}
                </span>
                <span className={`text-[11px] mt-0.5 ${activa ? 'text-sky-100' : 'text-slate-400'}`}>
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
