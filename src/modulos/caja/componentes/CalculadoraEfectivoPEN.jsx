// ================================================================
// CALCULADORA DE EFECTIVO PEN (BILLETES Y MONEDAS)
// VT VALETEC — Componente reutilizable para arqueo y apertura de caja
// ================================================================
import { Banknote, Coins, RotateCcw } from 'lucide-react';
import { DENOMINACIONES_PEN } from '../constantes/denominaciones';


export function CalculadoraEfectivoPEN({
  conteo = {},
  onChangeCantidad,
  onLimpiar,
  mostrarTitulo = true,
  titulo = 'Conteo de efectivo',
}) {
  const safeConteo = conteo || {};
  const billetes = DENOMINACIONES_PEN.filter((d) => d.tipo === 'billete');
  const monedas = DENOMINACIONES_PEN.filter((d) => d.tipo === 'moneda');

  const subtotalBilletes = billetes.reduce(
    (s, d) => s + d.valor * (Number(safeConteo[d.valor]) || 0),
    0
  );
  const subtotalMonedas = monedas.reduce(
    (s, d) => s + d.valor * (Number(safeConteo[d.valor]) || 0),
    0
  );
  const hayConteo = DENOMINACIONES_PEN.some((d) => Number(safeConteo[d.valor]) > 0);

  const renderFila = (d) => {
    const cant = Number(safeConteo[d.valor]) || 0;
    const subtotal = d.valor * cant;
    return (
      <div
        key={d.valor}
        className={`flex items-center gap-1.5 rounded-xl px-2 py-1 transition-all ${
          cant > 0
            ? 'bg-emerald-50/90 border border-emerald-200/80 shadow-2xs'
            : 'hover:bg-slate-50/80 border border-transparent'
        }`}
      >
        <span
          className={`w-14 h-7.5 rounded-lg grid place-items-center text-xs font-bold font-mono shrink-0 shadow-2xs ${d.color}`}
        >
          {d.etiqueta}
        </span>
        <div className="flex items-center rounded-lg border border-slate-200 bg-white shrink-0 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeCantidad(d.valor, cant - 1)}
            disabled={cant === 0}
            className="w-7 h-7.5 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 text-base font-bold leading-none cursor-pointer transition-colors"
            aria-label={`Quitar ${d.etiqueta}`}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={cant || ''}
            placeholder="0"
            onChange={(e) => onChangeCantidad(d.valor, e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-10 h-7.5 text-center text-xs font-bold font-mono text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={`Cantidad de ${d.etiqueta}`}
          />
          <button
            type="button"
            onClick={() => onChangeCantidad(d.valor, cant + 1)}
            className="w-7 h-7.5 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-base font-bold leading-none cursor-pointer transition-colors"
            aria-label={`Agregar ${d.etiqueta}`}
          >
            +
          </button>
        </div>
        <span
          className={`flex-1 text-right font-mono text-xs tabular-nums truncate ${
            cant > 0 ? 'text-slate-900 font-bold' : 'text-slate-300'
          }`}
        >
          S/ {subtotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {mostrarTitulo && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Coins className="w-4 h-4 text-amber-500" /> {titulo}
          </p>
          {hayConteo && onLimpiar && (
            <button
              type="button"
              onClick={onLimpiar}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* Grid de 2 Columnas: Billetes a la izquierda, Monedas a la derecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Columna Billetes */}
        <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Billetes
              </span>
              <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                S/ {subtotalBilletes.toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">{billetes.map(renderFila)}</div>
          </div>
        </div>

        {/* Columna Monedas */}
        <div className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" /> Monedas
              </span>
              <span className="text-[10px] font-bold font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                S/ {subtotalMonedas.toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">{monedas.map(renderFila)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
