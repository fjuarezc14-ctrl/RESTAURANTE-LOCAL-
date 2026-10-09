// Pedido de mesa: platos de la carta en lista (una fila por plato) o en cuadrícula.
// Pensado para el celular del mozo: todo lo que se toca mide al menos 44 px y el texto se lee sin forzar la vista.
import { Tag, Plus, Minus, ChevronRight, SearchX } from 'lucide-react';

const precioDe = (prod) => (prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio);
const tieneOferta = (prod) => prod.precioOferta !== null && prod.precioOferta !== undefined;

// − cantidad + (o solo + si aún no se pidió). Los toques no llegan a la fila (que también agrega).
// ancho: en las tarjetas ocupa todo el ancho para no salirse en celulares angostos
function Contador({ cantidad, agotado, onMenos, onMas, ancho = false }) {
  const tam = 'w-10 h-10';
  if (cantidad === 0) {
    return (
      <button
        type="button"
        disabled={agotado}
        onClick={(e) => { e.stopPropagation(); onMas(); }}
        aria-label="Agregar"
        className={`${tam} shrink-0 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer`}
      >
        <Plus className="w-5 h-5" strokeWidth={3} />
      </button>
    );
  }
  // En las tarjetas los botones se achican hasta caber (en celulares angostos el ancho fijo cortaba el "+")
  const tamBoton = ancho ? 'h-9 flex-1 min-w-0 max-w-10' : tam;
  return (
    <div className={`flex items-center gap-1 ${ancho ? 'w-full min-w-0 justify-between' : 'shrink-0'}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onMenos}
        aria-label="Quitar uno"
        className={`${tamBoton} rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center active:scale-95 transition-transform cursor-pointer`}
      >
        <Minus className="w-5 h-5" strokeWidth={3} />
      </button>
      <span className="shrink-0 min-w-5 px-0.5 text-center font-black text-base text-slate-900 tabular-nums">{cantidad}</span>
      <button
        type="button"
        disabled={agotado}
        onClick={onMas}
        aria-label="Agregar uno"
        className={`${tamBoton} rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer`}
      >
        <Plus className="w-5 h-5" strokeWidth={3} />
      </button>
    </div>
  );
}

function Etiquetas({ prod, agotado, stockDisponible }) {
  if (prod.esAgrupado) {
    return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">Elige la carne</span>;
  }
  return (
    <>
      {tieneOferta(prod) && !agotado && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white">
          <Tag className="w-3 h-3" /> {prod.ofertaValor}% OFF
        </span>
      )}
      {prod.tipoStock === 'limitado' && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${agotado ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
          {agotado ? 'Agotado' : `Quedan ${stockDisponible}`}
        </span>
      )}
    </>
  );
}

function Precio({ prod }) {
  if (prod.esAgrupado) {
    return <span className="font-black text-sm text-emerald-700 tabular-nums whitespace-nowrap">desde S/ {prod.precioMin.toFixed(2)}</span>;
  }
  return (
    <span className="flex items-baseline gap-1.5 flex-wrap min-w-0">
      <span className="font-black text-sm text-emerald-700 tabular-nums whitespace-nowrap">S/ {precioDe(prod).toFixed(2)}</span>
      {tieneOferta(prod) && <span className="line-through text-slate-400 text-[11px] font-semibold whitespace-nowrap">S/ {prod.precio.toFixed(2)}</span>}
    </span>
  );
}

export function ListaPlatosMesa({ agregarAlTicket, alterarCantidad, menuFiltrado, modoVista, ticketActual, hayBusqueda = false }) {
  if (menuFiltrado.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
        <SearchX className="w-10 h-10" />
        <p className="font-bold text-sm">{hayBusqueda ? 'Ningún plato coincide con la búsqueda.' : 'No hay platos en esta categoría.'}</p>
      </div>
    );
  }

  const compacto = modoVista === 'compacto';

  return (
    <div className={`flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-3 pb-28 md:pb-4 content-start ${
      compacto ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 md:gap-3'
    }`}>
      {menuFiltrado.map((prod) => {
        const esGrupo = prod.esAgrupado;
        const cantEnTicket = esGrupo
          ? 0
          : ticketActual.filter((t) => String(t.id) === String(prod.id) && !t.yaEnviado).reduce((sum, item) => sum + item.cant, 0);
        const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
        const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;
        const agregar = () => { if (!agotado) agregarAlTicket(prod); };
        const quitar = () => {
          const idx = ticketActual.findIndex((t) => String(t.id) === String(prod.id) && !t.yaEnviado);
          if (idx >= 0) alterarCantidad(idx, '-');
        };
        const estado = agotado
          ? 'opacity-55 border-slate-200 bg-slate-50 cursor-not-allowed'
          : cantEnTicket > 0
            ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300 cursor-pointer'
            : 'border-slate-200 bg-white active:bg-slate-50 cursor-pointer';

        const accion = esGrupo ? (
          <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </span>
        ) : (
          <Contador cantidad={cantEnTicket} agotado={agotado} onMenos={quitar} onMas={agregar} />
        );

        if (compacto) {
          return (
            <div
              key={prod.id}
              role="button"
              tabIndex={agotado ? -1 : 0}
              aria-disabled={agotado}
              onClick={agregar}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
              className={`min-h-[60px] rounded-2xl border px-3 py-2 flex items-center gap-2.5 transition-colors select-none overflow-hidden ${estado}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-snug text-slate-900 line-clamp-2 break-words">{prod.nombre}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <Precio prod={prod} />
                  <Etiquetas prod={prod} agotado={agotado} stockDisponible={stockDisponible} />
                </div>
              </div>
              {accion}
            </div>
          );
        }

        return (
          <div
            key={prod.id}
            role="button"
            tabIndex={agotado ? -1 : 0}
            aria-disabled={agotado}
            onClick={agregar}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
            className={`min-w-0 min-h-[120px] rounded-2xl border p-2.5 flex flex-col justify-between gap-2 transition-colors select-none overflow-hidden ${estado}`}
          >
            <div className="min-w-0">
              <p className="font-bold text-[13px] leading-snug text-slate-900 line-clamp-3 break-words">{prod.nombre}</p>
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                <Etiquetas prod={prod} agotado={agotado} stockDisponible={stockDisponible} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <Precio prod={prod} />
              {esGrupo && <ChevronRight className="w-5 h-5 shrink-0 text-slate-500" />}
              {!esGrupo && cantEnTicket === 0 && !agotado && (
                <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm">
                  <Plus className="w-5 h-5" strokeWidth={3} />
                </span>
              )}
            </div>
            {cantEnTicket > 0 && !esGrupo && (
              <Contador cantidad={cantEnTicket} agotado={agotado} onMenos={quitar} onMas={agregar} ancho />
            )}
          </div>
        );
      })}
    </div>
  );
}
