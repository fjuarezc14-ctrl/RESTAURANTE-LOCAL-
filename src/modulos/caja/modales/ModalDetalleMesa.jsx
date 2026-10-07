import { Clock, X } from 'lucide-react';
import { formatearMoneda } from '../../../utils/dinero';

/**
 * Modal para visualizar el detalle de consumo de una mesa activa y acceder a su cobro
 */
export default function ModalDetalleMesa({
  mesa,
  onCerrar,
  onCobrar,
  esCobrable = false,
  enPreparacion = false,
  cantPlatosEnPreparacion = 0,
  cantPlatosSinServir = 0,
}) {
  if (!mesa) return null;

  const items = (mesa.pedidoData?.items || []).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onCerrar}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900">Mesa {mesa.num}</p>
            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-2">
              <span>{mesa.pedidoData?.mesero || '—'}</span><span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{mesa.pedidoData?.hora}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 ${
                esCobrable
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {esCobrable ? 'Listo p/ cobrar' : enPreparacion ? 'En preparación' : 'Por servir'}
              </span>
              {mesa.pedidoData?.estadoEnsalada && (
                <span className="text-[11px] text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">
                  🥗 Ensalada {mesa.pedidoData.estadoEnsalada.toLowerCase()}
                </span>
              )}
            </div>
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

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Consumo ({items.length})</p>
            {items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-slate-700">
                      <span className="font-mono text-slate-400 mr-2">{i.cant}×</span>{i.nombre}
                    </span>
                    {i.precio != null && (
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {formatearMoneda(i.cant * i.precio)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">Sin consumos</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-slate-900">
                {formatearMoneda(mesa.pedidoData?.total || 0)}
              </p>
            </div>
            {!esCobrable ? (
              <div className="text-right">
                <button
                  type="button"
                  disabled
                  className="h-11 px-6 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed inline-flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" /> {enPreparacion ? 'En preparación' : 'Por servir'}
                </button>
                <p className="mt-1 text-[11px] text-slate-400">
                  {enPreparacion
                    ? (cantPlatosEnPreparacion > 0 ? `${cantPlatosEnPreparacion} plato(s) en preparación` : 'Esperando a cocina y barra')
                    : `El mozo debe servir ${cantPlatosSinServir} plato(s)`}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onCobrar(mesa)}
                className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] cursor-pointer shadow-sm shadow-emerald-600/30"
              >
                Cobrar mesa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
