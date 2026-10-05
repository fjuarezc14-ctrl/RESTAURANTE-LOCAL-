import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Plus, Minus, X } from 'lucide-react';

const MOTIVOS_FRECUENTES = [
  'Error de digitación / plato equivocado',
  'Cliente desistió / canceló',
  'Demora en cocina',
  'Cambio por otro plato',
  'Mesa equivocada',
];

/**
 * Modal táctil ergonómico para anular o reducir unidades de un ítem ya enviado a cocina
 */
export default function ModalCancelarItem({
  abierto,
  item,
  onCerrar,
  onConfirmar,
  cancelando = false,
}) {
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState(MOTIVOS_FRECUENTES[0]);

  useEffect(() => {
    if (abierto && item) {
      setCantidad(item.cant || 1);
      setMotivo(MOTIVOS_FRECUENTES[0]);
    }
  }, [abierto, item]);

  if (!abierto || !item) return null;

  const maxCant = item.cant || 1;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!motivo.trim() || cantidad < 1 || cantidad > maxCant) return;
    onConfirmar({
      cantidad,
      motivo: motivo.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-6 animate-slide-up border border-slate-200 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                Anular Plato de Comanda
              </h3>
              <p className="text-xs text-slate-500 font-medium line-clamp-1">
                {item.nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={cancelando}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del ítem */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 my-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Producto</span>
            <span className="font-bold text-slate-800 text-sm">{item.nombre}</span>
            <span className="text-xs text-slate-500 block font-mono">Precio unit: S/ {Number(item.precio || 0).toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">En Comanda</span>
            <span className="font-black text-slate-900 text-base">{maxCant} un.</span>
          </div>
        </div>

        {/* Selector de cantidad (solo si hay más de 1 unidad) */}
        {maxCant > 1 && (
          <div className="mb-4 bg-amber-50/60 border border-amber-200 rounded-2xl p-3">
            <label className="block text-amber-900 font-bold mb-2 text-[10px] tracking-widest uppercase">
              Cantidad a cancelar:
            </label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-amber-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => setCantidad(prev => Math.max(1, prev - 1))}
                  disabled={cantidad <= 1 || cancelando}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-black text-lg flex items-center justify-center active:scale-95 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-mono font-black text-lg text-slate-900">
                  {cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(prev => Math.min(maxCant, prev + 1))}
                  disabled={cantidad >= maxCant || cancelando}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-black text-lg flex items-center justify-center active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCantidad(maxCant)}
                className="text-xs font-black text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-2 rounded-xl active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                Cancelar Todos ({maxCant})
              </button>
            </div>
          </div>
        )}

        {/* Chips de motivos rápidos de 1 toque */}
        <div className="mb-3">
          <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">
            Motivo de anulación (1 toque):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_FRECUENTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 text-left cursor-pointer ${
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

        {/* Motivo personalizado opcional */}
        <div className="mb-4">
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="O escribe otro motivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-400 resize-none font-medium text-slate-800"
          />
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={cancelando}
            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Regresar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={cancelando || !motivo.trim()}
            className="py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 shadow-lg shadow-red-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {cancelando ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Anulación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
