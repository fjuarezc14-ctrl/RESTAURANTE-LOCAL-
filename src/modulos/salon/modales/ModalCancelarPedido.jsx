import { AlertTriangle } from 'lucide-react';

/**
 * Modal para confirmar y registrar el motivo de cancelación de un pedido de mesa en salón
 */
export default function ModalCancelarPedido({
  abierto,
  mesa,
  mesero,
  motivo,
  onMotivoChange,
  onCerrar,
  onConfirmar,
  cancelando = false,
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Cancelar Pedido</h3>
            <p className="text-xs text-slate-500 mt-1">Mesa {mesa?.num} · Mozo: {mesero}</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <p className="text-xs text-red-700 font-bold">
            ⚠️ Esta acción eliminará el pedido. Si algún insumo ya fue usado, se habrá generado un desperdicio.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">
            Motivos frecuentes (1 toque):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Error de digitación / plato equivocado',
              'Cliente desistió / canceló',
              'Demora en cocina',
              'Mesa equivocada',
              'Cambio de plato por cliente',
            ].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onMotivoChange(m)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 text-left ${
                  motivo === m
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                ⚡ {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">
            O escribe un motivo personalizado:
          </label>
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder="Escribe el motivo o selecciona uno de los botones arriba..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs md:text-sm focus:outline-none focus:border-red-400 resize-none font-medium text-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm uppercase tracking-wide transition-colors cursor-pointer"
          >
            No cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cancelando || !motivo.trim()}
            className="py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm uppercase tracking-wide transition-colors flex justify-center items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20 cursor-pointer"
          >
            {cancelando ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Confirmar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
