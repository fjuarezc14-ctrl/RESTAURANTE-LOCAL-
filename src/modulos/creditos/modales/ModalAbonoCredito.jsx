import { X } from 'lucide-react';

/**
 * ModalAbonoCredito: Registro de abonos y amortización de deudas de clientes
 * con desglose de métodos de pago (Efectivo, Tarjeta, Yape, Mixto).
 */
export default function ModalAbonoCredito({
  abierto,
  cliente,
  formAbono,
  setFormAbono,
  METODOS_PAGO = [],
  onCerrar,
  onGuardar
}) {
  if (!abierto || !cliente || !formAbono) return null;

  const saldo = cliente.saldo || 0;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-fade-in"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-slate-800 text-lg">Registrar Abono</h2>
            <p className="text-xs text-slate-500">{cliente.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de saldo deudor */}
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 mb-4 ${
            saldo > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'
          }`}
        >
          <div>
            <p className={`text-[10px] font-black uppercase ${saldo > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              Saldo Deudor Actual
            </p>
            <p
              className={`text-2xl font-black font-mono ${
                saldo > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              S/ {saldo.toFixed(2)}
            </p>
          </div>
          {saldo > 0 ? <span className="text-3xl">⚠️</span> : <span className="text-3xl">✅</span>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto *</label>
            <input
              type="number"
              step="0.01"
              value={formAbono.monto}
              onChange={(e) => setFormAbono({ ...formAbono, monto: e.target.value })}
              className="w-full px-3 py-3 rounded-xl border border-slate-200 text-lg font-black text-center focus:ring-2 focus:ring-emerald-500/30 outline-none"
              placeholder="S/ 0.00"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Método de Pago</label>
            <select
              value={formAbono.metodoPago}
              onChange={(e) => setFormAbono({ ...formAbono, metodoPago: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            >
              {METODOS_PAGO.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          {formAbono.metodoPago === 'Mixto' && (
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="Efectivo"
                value={formAbono.montoEfectivo}
                onChange={(e) => setFormAbono({ ...formAbono, montoEfectivo: e.target.value })}
                className="px-2 py-2 rounded-xl border border-slate-200 text-sm"
              />
              <input
                type="number"
                placeholder="Tarjeta"
                value={formAbono.montoTarjeta}
                onChange={(e) => setFormAbono({ ...formAbono, montoTarjeta: e.target.value })}
                className="px-2 py-2 rounded-xl border border-slate-200 text-sm"
              />
              <input
                type="number"
                placeholder="Yape"
                value={formAbono.montoYape}
                onChange={(e) => setFormAbono({ ...formAbono, montoYape: e.target.value })}
                className="px-2 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nota (opcional)</label>
            <input
              value={formAbono.nota}
              onChange={(e) => setFormAbono({ ...formAbono, nota: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              placeholder="Ej. Abono parcial"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onGuardar}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm"
          >
            Registrar Abono
          </button>
        </div>
      </div>
    </div>
  );
}
