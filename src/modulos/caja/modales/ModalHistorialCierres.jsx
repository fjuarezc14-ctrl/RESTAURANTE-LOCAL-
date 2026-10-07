import { History, X, FileText, Printer } from 'lucide-react';

/**
 * Modal para visualizar el historial persistido de cierres de caja (arqueos)
 */
export default function ModalHistorialCierres({
  abierto,
  onCerrar,
  cargandoHistorialCierres,
  historialCierres,
  onReimprimir,
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Historial de Cierres de Turno</h3>
              <p className="text-xs text-slate-400 font-medium">Registros históricos persistidos en PostgreSQL</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-3">
          {cargandoHistorialCierres ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider">Cargando registros...</p>
            </div>
          ) : (!historialCierres || historialCierres.length === 0) ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
              <p className="text-sm font-black text-slate-600 uppercase">Sin cierres guardados</p>
              <p className="text-xs text-slate-400 mt-1">Los cierres que realices desde "Cerrar Turno" se archivarán aquí automáticamente.</p>
            </div>
          ) : (
            historialCierres.map(c => {
              const dif = Number(c.diferencia || 0);
              const isExact = Math.abs(dif) < 0.01;
              const isSobrante = dif > 0.01;
              return (
                <div key={c.id} className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                        #{c.id}
                      </span>
                      <span className="font-black text-xs text-slate-800 uppercase">
                        {new Date(c.fechaCierre).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        · Cajero: <strong className="text-slate-700 uppercase">{c.cajeroNombre}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400">Diferencia:</span>
                      <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-lg ${
                        isExact
                          ? 'bg-emerald-100 text-emerald-700'
                          : isSobrante
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}>
                        {isSobrante ? `+S/ ${dif.toFixed(2)}` : `S/ ${dif.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Efec. Esperado</p>
                      <p className="font-black font-mono text-slate-800">S/ {Number(c.efectivoEsperado || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Efec. Contado</p>
                      <p className="font-black font-mono text-slate-800">S/ {Number(c.efectivoContado || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Tarjeta / Yape</p>
                      <p className="font-black font-mono text-slate-800">
                        S/ {(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Egresos Efec.</p>
                      <p className="font-black font-mono text-rose-600">S/ {Number(c.egresosEfectivo || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-200/60">
                    {c.nota ? (
                      <p className="text-[11px] text-slate-500 font-medium italic">
                        Nota: {c.nota}
                      </p>
                    ) : <div />}
                    <button
                      type="button"
                      onClick={() => onReimprimir(c)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-purple-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ml-auto"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-300" />
                      Reimprimir Ticket
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
