import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Dialog, useAviso } from '../ui';
import { resolverComplementos } from '../../utils/combos';

/**
 * Modal interactivo para selección de opciones, variantes de carne y complementos de un producto
 */
export default function ModalOpcionesProducto({
  abierto,
  producto,
  onCerrar,
  onConfirmarItem,
  getProductSteps = () => [],
}) {
  const aviso = useAviso();
  const [selections, setSelections] = useState({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState('');

  if (!abierto || !producto) return null;

  const steps = getProductSteps(producto, selections);
  if (!steps || steps.length === 0) return null;

  const safeStepIdx = Math.max(0, Math.min(currentStepIdx, steps.length - 1));
  const currentStep = steps[safeStepIdx] || steps[0];
  if (!currentStep) return null;

  const esUltimoPaso = safeStepIdx >= steps.length - 1;
  const seleccionActual = selections[currentStep.key];

  const handleSelectOption = (val) => {
    setSelections(prev => ({ ...prev, [currentStep.key]: val }));

    if (!esUltimoPaso) {
      setTimeout(() => {
        setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1));
      }, 150);
    }
  };

  const handleConfirm = () => {
    const hasCustomConfig = producto.opcionesConfig && (() => {
      try {
        const p = typeof producto.opcionesConfig === 'string'
          ? JSON.parse(producto.opcionesConfig)
          : producto.opcionesConfig;
        return Array.isArray(p) && p.length > 0;
      } catch { return false; }
    })();

    // Acompañamientos quitados y complementos agregados
    const compl = resolverComplementos(producto, selections);
    const soloComplementos = !hasCustomConfig && steps.length === 1 && steps[0].tipo === 'complementos';

    if (producto.esAgrupado) {
      const prodVariante = selections['producto_variante'];
      if (!prodVariante) {
        aviso.advertencia('Por favor, selecciona una opción de carne.');
        return;
      }
      onConfirmarItem(prodVariante, additionalNotes);
    } else if (soloComplementos) {
      const notas = [...compl.notas];
      if (additionalNotes.trim()) notas.push(`(Nota: ${additionalNotes.trim()})`);
      onConfirmarItem(producto, notas.join(' · '), { opciones: [], precioExtra: compl.precioExtra });
    } else if (hasCustomConfig) {
      const notesArray = [];
      steps.forEach(step => {
        if (step.tipo === 'complementos') return;
        const val = selections[step.key];
        if (val) {
          const valLower = String(val).toLowerCase();
          if (valLower.includes('sin ') || valLower.includes('omitir')) return;
          const stepLower = step.name.toLowerCase();
          if (stepLower.includes('bebida')) {
            notesArray.push(`[Bebida: ${val}]`);
          } else if (stepLower.includes('entrada')) {
            notesArray.push(`[Entrada: ${val}]`);
          } else if (stepLower.includes('guarnicion') || stepLower.includes('acompañamiento')) {
            notesArray.push(`[Guarnición: ${val}]`);
          } else {
            notesArray.push(`${step.name}: ${val}`);
          }
        }
      });
      notesArray.push(...compl.notas);
      if (additionalNotes.trim()) {
        notesArray.push(`(Nota: ${additionalNotes.trim()})`);
      }
      const finalNotes = notesArray.join(' · ');
      onConfirmarItem(producto, finalNotes, { opciones: selections, precioExtra: compl.precioExtra });
    } else {
      const notesArray = [];
      steps.forEach(step => {
        if (step.tipo === 'complementos') return;
        const val = selections[step.key];
        if (val) {
          const valLower = String(val).toLowerCase();
          if (!valLower.includes('sin ') && !valLower.includes('omitir')) {
            notesArray.push(`[${step.name}: ${val}]`);
          }
        }
      });
      notesArray.push(...compl.notas);
      if (additionalNotes.trim()) {
        notesArray.push(`(Nota: ${additionalNotes.trim()})`);
      }
      const finalNotes = notesArray.join(' · ');
      onConfirmarItem(producto, finalNotes, { opciones: selections, precioExtra: compl.precioExtra });
    }

    onCerrar();
  };

  return (
    <Dialog open onClose={onCerrar} closeOnBackdrop={false} capa="z-[260]" className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
        <div>
          <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Personalizar Pedido
          </span>
          <h3 className="font-black text-white text-base uppercase tracking-tight mt-0.5">
            {producto.nombre}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Steps Bar */}
      <div className="px-5 py-2.5 bg-slate-950/20 border-b border-slate-800 flex gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
        {steps.map((st, i) => (
          <button
            key={st.key}
            type="button"
            onClick={() => setCurrentStepIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              i === safeStepIdx
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : selections[st.key]
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {st.name}
          </button>
        ))}
      </div>

      {/* Step Body */}
      <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
        <div>
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-1">
            Paso {safeStepIdx + 1} de {steps.length}: {currentStep.name}
          </h4>
          <p className="text-[11px] text-slate-400">
            Selecciona una opción para continuar:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(currentStep.options || []).map((opt) => {
            const optNombre = typeof opt === 'string' ? opt : opt.nombre;
            const optValor = typeof opt === 'string' ? opt : (opt.id || opt.nombre);
            const seleccionada = seleccionActual === optValor;

            return (
              <button
                key={optValor}
                type="button"
                onClick={() => handleSelectOption(optValor)}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  seleccionada
                    ? 'bg-cyan-500/10 border-amber-500 text-white shadow-sm'
                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-xs">{optNombre}</span>
                {seleccionada && (
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-black text-[10px]">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notas adicionales */}
        {esUltimoPaso && (
          <div className="pt-3 border-t border-slate-800/80">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Instrucciones especiales para cocina (Opcional):
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Ej. Poco picante, sin cebolla, salsa aparte..."
              className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
          disabled={safeStepIdx === 0}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            safeStepIdx === 0
              ? 'bg-slate-850 text-slate-600 border border-slate-850 opacity-40 cursor-not-allowed shadow-none'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white cursor-pointer'
          }`}
        >
          Atrás
        </button>

        {esUltimoPaso ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!seleccionActual && (currentStep.options?.length > 0 || currentStep.key === 'producto_variante')}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer ${
              (seleccionActual || (!currentStep.options?.length && currentStep.key !== 'producto_variante'))
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20'
                : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
            }`}
          >
            Agregar Pedido
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
            disabled={!seleccionActual && (currentStep.options?.length > 0 || currentStep.key === 'producto_variante')}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer ${
              (seleccionActual || (!currentStep.options?.length && currentStep.key !== 'producto_variante'))
                ? 'bg-cyan-500 hover:bg-amber-600 text-slate-950'
                : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
            }`}
          >
            Siguiente
          </button>
        )}
      </div>
    </Dialog>
  );
}
