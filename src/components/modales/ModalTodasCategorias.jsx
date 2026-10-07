import { LayoutGrid, X, Flame } from 'lucide-react';

const CONFIG_TEMAS = {
  claro: {
    capa: 'fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[120] flex items-end md:items-center justify-center md:p-6 animate-fade-in',
    ventana: 'bg-white w-full max-w-lg max-h-[85dvh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up',
    cuerpo: 'flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-2 gap-2 content-start',
    itemBase: 'min-h-[3.5rem] px-3 py-2.5 rounded-xl border text-left flex flex-col justify-center transition active:scale-95 cursor-pointer',
    itemActivo: 'bg-sky-600 border-sky-600 text-white shadow-sm',
    itemMasPedidos: 'bg-amber-50 border-amber-200 text-amber-900',
    itemNormal: 'bg-white border-slate-200 text-slate-700 hover:border-sky-300',
    tituloClase: 'text-sm font-medium leading-tight flex items-center gap-1.5',
    subtituloClase: (activa) => `text-[11px] mt-0.5 ${activa ? 'text-sky-100' : 'text-slate-400'}`,
    flameActivoClase: (activa) => `w-3.5 h-3.5 shrink-0 ${activa ? 'text-white' : 'text-amber-500'}`,
    textoMasPedidos: () => 'Más pedidos',
  },
  oscuro: {
    capa: 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-end md:items-center justify-center p-0 md:p-4',
    ventana: 'bg-white w-full max-w-lg max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up',
    cuerpo: 'flex-1 overflow-y-auto p-3 custom-scrollbar grid grid-cols-2 gap-2 content-start',
    itemBase: 'min-h-[3.5rem] px-3 py-2.5 rounded-2xl border text-left flex flex-col justify-center transition-all active:scale-95 cursor-pointer',
    itemActivo: 'bg-slate-900 border-slate-900 text-white shadow-md',
    itemMasPedidos: 'bg-amber-50 border-amber-300 text-amber-900',
    itemNormal: 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-amber-50',
    tituloClase: 'font-black text-xs uppercase leading-tight flex items-center gap-1.5',
    subtituloClase: (activa) => `text-[10px] font-bold mt-0.5 ${activa ? 'text-slate-300' : 'text-slate-400'}`,
    flameActivoClase: () => 'w-3.5 h-3.5 text-amber-500 shrink-0',
    textoMasPedidos: (cat) => cat,
  },
};

/**
 * Modal unificado para seleccionar una categoría del menú en Caja (delivery/llevar) o Salón
 */
export default function ModalTodasCategorias({
  abierto,
  onCerrar,
  categorias = [],
  categoriaActiva,
  onSeleccionar,
  contarProductos = () => 0,
  tema = 'claro',
}) {
  if (!abierto) return null;

  const cfg = CONFIG_TEMAS[tema] || CONFIG_TEMAS.claro;

  return (
    <div className={cfg.capa} onClick={onCerrar}>
      <div className={cfg.ventana} onClick={(e) => e.stopPropagation()}>
        {tema === 'oscuro' ? (
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
        ) : (
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
        )}

        <div className={cfg.cuerpo}>
          {categorias.map((cat) => {
            const activa = categoriaActiva === cat;
            const isMasPedidos = cat === '🔥 Más Pedidos';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSeleccionar(cat)}
                className={`${cfg.itemBase} ${
                  activa
                    ? cfg.itemActivo
                    : isMasPedidos
                      ? cfg.itemMasPedidos
                      : cfg.itemNormal
                }`}
              >
                <span className={cfg.tituloClase}>
                  {isMasPedidos && (
                    <Flame className={cfg.flameActivoClase(activa)} />
                  )}
                  {isMasPedidos ? cfg.textoMasPedidos(cat) : cat}
                </span>
                <span className={cfg.subtituloClase(activa)}>
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
