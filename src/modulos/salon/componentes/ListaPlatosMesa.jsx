// Pedido de mesa: platos de la carta en lista o cuadrícula
import { Tag, Plus, Minus, PlusCircle } from 'lucide-react';

export function ListaPlatosMesa({ agregarAlTicket, alterarCantidad, menuFiltrado, modoVista, ticketActual }) {
  return (
    <>
      <div className={`p-3 overflow-y-auto custom-scrollbar content-start flex-1 ${
        modoVista === 'compacto' 
          ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' 
          : 'grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4'
      }`}>
        {menuFiltrado.map(prod => {
          const isGroup = prod.esAgrupado;
          const cantEnTicket = isGroup 
            ? 0 
            : ticketActual.filter(t => String(t.id) === String(prod.id) && !t.yaEnviado).reduce((sum, item) => sum + item.cant, 0);
          const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
          const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;

          if (modoVista === 'compacto') {
            return (
              <div
                key={prod.id}
                onClick={() => !agotado && agregarAlTicket(prod)}
                className={`bg-white border rounded-xl p-2.5 flex items-center justify-between shadow-xs relative transition-all ${
                  agotado
                    ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50'
                    : cantEnTicket > 0
                      ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/40 cursor-pointer shadow-sm'
                      : 'cursor-pointer hover:border-amber-300 hover:bg-amber-50/20 active:bg-slate-100'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-slate-900 text-xs uppercase truncate">{prod.nombre}</p>
                    {cantEnTicket > 0 && (
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-md shadow-xs">
                        x{cantEnTicket}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isGroup && (
                      <span className="text-[9px] font-black px-1 rounded bg-amber-100 text-amber-700">VARIANTES</span>
                    )}
                    {prod.tipoStock === 'limitado' && !isGroup && (
                      <span className={`text-[9px] font-bold px-1 rounded ${agotado ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        {agotado ? 'AGOTADO' : `STK: ${stockDisponible}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                    S/ {isGroup ? prod.precioMin.toFixed(2) : (prod.precioOferta ?? prod.precio).toFixed(2)}
                  </span>
                  {cantEnTicket > 0 && !isGroup ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                          if (idx >= 0) alterarCantidad(idx, '-');
                        }}
                        className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={agotado}
                        onClick={() => !agotado && agregarAlTicket(prod)}
                        className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={agotado}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center font-black shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={prod.id} 
              onClick={() => !agotado && agregarAlTicket(prod)} 
              className={`bg-white border rounded-xl p-3 md:p-4 flex flex-col justify-between shadow-sm relative overflow-hidden h-28 md:h-32 transition-all ${
                agotado 
                  ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50' 
                  : cantEnTicket > 0
                    ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/20 cursor-pointer shadow-md'
                    : 'cursor-pointer hover:border-amber-300 hover:-translate-y-0.5 active:bg-slate-50'
              }`}
            >
              {prod.precioOferta !== null && prod.precioOferta !== undefined && !agotado && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1 animate-pulse z-15">
                  <Tag className="w-2.5 h-2.5" />
                  {prod.ofertaValor}% OFF
                </div>
              )}
              {cantEnTicket > 0 && !agotado && (
                <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 z-20">
                  <span>x{cantEnTicket}</span>
                </div>
              )}
              <div className="z-10 flex flex-col justify-between h-full w-full">
                <div>
                  <p className="font-bold text-slate-800 text-[10px] md:text-xs uppercase leading-tight pr-8">{prod.nombre}</p>
                  {isGroup && (
                    <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 bg-amber-100 text-amber-700">
                      OPCIONES DE CARNE
                    </span>
                  )}
                  {prod.tipoStock === 'limitado' && !isGroup && (
                    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 ${
                      agotado ? 'bg-red-100 text-red-650' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {agotado ? 'AGOTADO' : `STOCK: ${stockDisponible}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  {isGroup ? (
                    <p className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                      Desde S/ {prod.precioMin.toFixed(2)}
                    </p>
                  ) : prod.precioOferta !== null && prod.precioOferta !== undefined ? (
                    <div className="flex flex-col items-start leading-none -mt-1">
                      <span className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precioOferta.toFixed(2)}</span>
                      <span className="line-through text-slate-400 font-semibold text-[10px] md:text-xs mt-0.5">S/ {prod.precio.toFixed(2)}</span>
                    </div>
                  ) : (
                    <p className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precio.toFixed(2)}</p>
                  )}

                  {cantEnTicket > 0 && !isGroup && (
                    <div className="flex items-center gap-1 z-20" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                          if (idx >= 0) alterarCantidad(idx, '-');
                        }}
                        className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-black text-xs text-slate-900 w-4 text-center">{cantEnTicket}</span>
                      <button
                        type="button"
                        disabled={agotado}
                        onClick={() => !agotado && agregarAlTicket(prod)}
                        className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <PlusCircle className="absolute bottom-[-10px] right-[-10px] w-12 h-12 text-slate-100 opacity-50 pointer-events-none" />
            </div>
          );
        })}
      </div>
    </>
  );
}
