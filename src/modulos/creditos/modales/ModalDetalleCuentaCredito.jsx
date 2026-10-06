import React from 'react';
import { X } from 'lucide-react';

/**
 * ModalDetalleCuentaCredito: Visor de cuenta corriente de crédito comercial y personal,
 * con balance de consumo, abonos, lista de ventas a crédito e historial de amortizaciones.
 */
export default function ModalDetalleCuentaCredito({
  abierto,
  cliente,
  onCerrar
}) {
  if (!abierto || !cliente) return null;

  const totalConsumido = cliente.totalConsumido || 0;
  const totalAbonado = cliente.totalAbonado || 0;
  const saldo = cliente.saldo || 0;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-fade-in"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-black text-slate-800 text-lg">Cuenta Corriente</h2>
            <p className="text-sm text-slate-500">
              {cliente.nombre} {cliente.numDoc ? `(${cliente.tipoDoc}: ${cliente.numDoc})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400">Consumido</p>
            <p className="font-black text-lg text-slate-800">S/ {totalConsumido.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase font-bold text-emerald-500">Abonado</p>
            <p className="font-black text-lg text-emerald-600">S/ {totalAbonado.toFixed(2)}</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${saldo > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
            <p className={`text-[10px] uppercase font-bold ${saldo > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Saldo</p>
            <p className={`font-black text-lg ${saldo > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              S/ {saldo.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-bold text-sm text-slate-700 mb-3">Ventas a Crédito</h3>
          {cliente.ventasCredito?.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Sin consumos registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Comprobante</th>
                  <th className="py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {cliente.ventasCredito?.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="py-2">{new Date(v.fecha).toLocaleDateString('es-PE')}</td>
                    <td className="py-2">{v.tipoComprobante}</td>
                    <td className="py-2 text-right font-bold">
                      {Number(v.montoCredito || 0) > 0
                        ? `S/ ${Number(v.montoCredito).toFixed(2)}`
                        : `S/ ${Number(v.total || 0).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3 className="font-bold text-sm text-slate-700 mb-3">Historial de Abonos</h3>
          {cliente.AbonosCredito?.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Sin abonos registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Método</th>
                  <th className="py-2">Registrado por</th>
                  <th className="py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {cliente.AbonosCredito?.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2">
                      {new Date(a.creadoEn).toLocaleDateString('es-PE')}{' '}
                      {new Date(a.creadoEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2">{a.metodoPago}</td>
                    <td className="py-2">{a.registradoPor}</td>
                    <td className="py-2 text-right font-bold text-emerald-600">S/ {a.monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
