import React from 'react';
import { X, CheckCircle } from 'lucide-react';
import { formatearMoneda } from '../../../utils/dinero';

/**
 * Modal de confirmación final antes de registrar un cobro (tanto de mesa como para llevar/delivery)
 */
export default function ModalConfirmacionCobro({
  abierto,
  datos,
  cobrando,
  onCerrar,
  onConfirmar,
}) {
  if (!abierto || !datos) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[250] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Confirmar cobro</h3>
            <p className="text-sm text-slate-500">Verifica los datos antes de cobrar</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={cobrando}
            className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="text-center py-2">
            <p className="text-xs text-slate-500">Total a cobrar</p>
            <p className="text-4xl font-semibold font-mono tabular-nums text-slate-900 tracking-tight">
              {formatearMoneda(datos.total)}
            </p>
            {datos.metodoPago === 'Efectivo' && datos.pagaCon > datos.total && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                Recibe {formatearMoneda(datos.pagaCon)} · <span className="font-semibold">Vuelto {formatearMoneda(datos.vuelto)}</span>
              </p>
            )}
          </div>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {[
              ['Origen', datos.esDelivery ? 'Para llevar / delivery' : `Mesa ${datos.mesaNum}`],
              ['Comprobante', datos.tipoComprobante],
              ['Cliente', `${datos.nombreCliente}${datos.numDocumento ? ` (${datos.numDocumento})` : ''}`],
              ['Método', datos.metodoPago],
            ].map(([k, val]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500 shrink-0">{k}</dt>
                <dd className="font-medium text-slate-900 truncate text-right">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-5 pb-5 grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={cobrando}
            className="h-12 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cobrando}
            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/30"
          >
            {cobrando ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Confirmar y cobrar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
