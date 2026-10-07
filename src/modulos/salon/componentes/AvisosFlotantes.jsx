import { X } from 'lucide-react';

/**
 * Avisos flotantes del salón: "plato/bebida listo", "mesa lista para servir" y "comanda enviada".
 * Tocar un aviso de tipo "listo" abre la bandeja de despacho; los demás solo se cierran.
 */
export default function AvisosFlotantes({ avisos = [], onAbrirBandeja, onCerrarAviso }) {
  if (avisos.length === 0) return null;

  return (
    <div className="fixed top-3 inset-x-3 sm:top-20 sm:right-6 sm:inset-x-auto sm:max-w-sm z-[300] flex flex-col gap-2.5 pointer-events-none">
      {avisos.map(t => {
        const esListo = t.tipo === 'listo';
        let etiqueta = 'Aviso';
        if (esListo) etiqueta = t.esMiMesa ? '⭐ Tu Pedido Listo' : '¡Pedido Listo!';
        return (
          <div
            key={t.id}
            role="button"
            onClick={() => (esListo ? onAbrirBandeja() : onCerrarAviso(t.id))}
            className={`pointer-events-auto cursor-pointer active:scale-[0.98] border rounded-2xl shadow-2xl p-3.5 flex items-center gap-3 animate-slide-up relative overflow-hidden backdrop-blur-md transition-all ${
              t.esMiMesa
                ? 'bg-slate-900 border-emerald-400 ring-2 ring-emerald-500/40 text-white'
                : 'bg-slate-900/95 border-amber-500/40 text-slate-100'
            }`}
          >
            <div className={`absolute inset-0 ${t.esMiMesa ? 'bg-gradient-to-r from-emerald-500/15 to-transparent' : 'bg-gradient-to-r from-amber-500/10 to-transparent'}`}></div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg animate-bounce shrink-0 shadow-lg ${
              t.esMiMesa ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-amber-500 text-white shadow-amber-500/20'
            }`}>
              {t.esMiMesa ? '🛎️' : '🔔'}
            </div>
            <div className="flex-1 pr-1 relative z-10 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`font-black text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  t.esMiMesa ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {etiqueta}
                </span>
              </div>
              <p className="font-bold text-xs sm:text-sm leading-tight text-white">{t.mensaje}</p>
              {esListo && (
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Toca para ver la bandeja</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCerrarAviso(t.id);
              }}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors relative z-10 shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
