import { estadoChip } from './camposCaja';
import { Clock, UtensilsCrossed } from 'lucide-react';
import { mesaCobrable, mesaEnPreparacion, textoBloqueoMesa } from '../utils/mesas';
import { soles } from '../utils/ventasTurno';

// Mesas con pedido pendiente de cobro: total, estado en cocina y botón de cobrar
export default function PanelMesasPorCobrar({
  abrirCobroMesa,
  mesasPendientes,
  setMesaDetalleNum,
}) {
  return (
    <>
    {/* MESAS PENDIENTES POR COBRAR */}
    <section className="bg-white rounded-2xl border border-slate-200/70">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center"><UtensilsCrossed className="w-4 h-4" /></span> Mesas por cobrar
        </h2>
        <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">{mesasPendientes.length}</span>
      </div>
      {mesasPendientes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 p-3 sm:p-4">
          {mesasPendientes.map(m => {
            const items = (m.pedidoData?.items || []).filter(Boolean);
            const unidades = items.reduce((s, i) => s + (i.cant || 0), 0);
            const listo = mesaCobrable(m);
            return (
              <div
                key={m.num}
                role="button"
                tabIndex={0}
                onClick={() => setMesaDetalleNum(m.num)}
                onKeyDown={(e) => { if (e.key === 'Enter') setMesaDetalleNum(m.num); }}
                className={`group rounded-xl border border-slate-200 border-l-4 ${listo ? 'border-l-emerald-500' : 'border-l-amber-400'} bg-white p-3.5 flex flex-col gap-3 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 grid place-items-center text-sm font-bold shrink-0">{m.num}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-slate-900 truncate">Mesa {m.num}</p>
                      <p className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">{soles(m.pedidoData?.total)}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.pedidoData?.mesero || '—'} · {m.pedidoData?.hora}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  <span className="font-medium text-slate-700">{unidades} ítem{unidades !== 1 ? 's' : ''}</span>
                  {items.length > 0 && <> · {items.map(i => `${i.cant}× ${i.nombre}`).join(', ')}</>}
                </p>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {estadoChip(listo, 'Listo p/ cobrar', mesaEnPreparacion(m) ? 'En preparación' : 'Por servir')}
                  </div>
                  {listo ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); abrirCobroMesa(m); }}
                      className="h-8 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-600/25 transition-colors active:scale-95 shrink-0"
                    >
                      Cobrar
                    </button>
                  ) : (
                    <span
                      className="h-8 px-3 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-not-allowed"
                      title="Se podrá cobrar cuando el mozo marque todos los platos como servidos"
                    >
                      <Clock className="w-3.5 h-3.5" /> {textoBloqueoMesa(m)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-slate-400">No hay mesas pendientes por cobrar.</p>
      )}
    </section>
    </>
  );
}
