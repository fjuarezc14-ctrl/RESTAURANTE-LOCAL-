import { Printer, X } from 'lucide-react';
import logoUrl from '../../../assets/logo.png';

/**
 * Modal para previsualizar e imprimir una copia física del ticket de arqueo/cierre de caja
 */
export default function ModalReimpresionCierre({
  cierre,
  onCerrar,
  empresa = {},
}) {
  if (!cierre) return null;

  return (
    <div id="modal-cierre-reimpresion" className="impresion-ventana fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[240] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-purple-700">
            <Printer className="w-5 h-5 shrink-0" />
            <h3 className="font-black text-slate-900 text-base uppercase tracking-tight leading-none">Ticket de Cierre #{cierre.id}</h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista del ticket térmico */}
        <div id="cierre-imprimible-reimpresion" className="impresion-ticket bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-5 flex flex-col">
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4 flex flex-col items-center">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-1 filter grayscale" />
            <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">{empresa.legalName || 'EMPRESA'}</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{empresa.address} · RUC: {empresa.ruc}</p>
            <p className="text-[10px] text-purple-700 font-black mt-1 uppercase">COPIA DE CIERRE DE TURNO · #{cierre.id}</p>
          </div>

          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
            <div className="flex justify-between"><span>FECHA APERTURA:</span><span>{new Date(cierre.fechaApertura).toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between"><span>FECHA CIERRE:</span><span>{new Date(cierre.fechaCierre).toLocaleString('es-PE')}</span></div>
            <div className="flex justify-between"><span>CAJERO:</span><span className="uppercase">{cierre.cajeroNombre}</span></div>
            <div className="flex justify-between"><span>ESTADO:</span><span className="text-emerald-700 font-black">CERRADO</span></div>
          </div>

          <div className="space-y-2.5 mb-4 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between font-bold text-slate-700">
              <span>EFECTIVO VENTAS:</span>
              <span className="font-black text-slate-900">S/ {Number(cierre.efectivoVentas || 0).toFixed(2)}</span>
            </div>
            {Number(cierre.egresosEfectivo || 0) > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>GASTOS EFECTIVO:</span>
                <span className="font-black">- S/ {Number(cierre.egresosEfectivo || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(cierre.abonosEfectivo || 0) > 0 && (
              <div className="flex justify-between font-bold text-emerald-600">
                <span>ABONOS EFECTIVO:</span>
                <span className="font-black">+ S/ {Number(cierre.abonosEfectivo || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-slate-900 bg-amber-100/60 p-2 rounded-lg">
              <span>EFECTIVO ESPERADO:</span>
              <span>S/ {Number(cierre.efectivoEsperado || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-700">
              <span>EFECTIVO CONTADO:</span>
              <span className="font-black text-slate-900">S/ {Number(cierre.efectivoContado || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black">
              <span>DIFERENCIA:</span>
              <span className={Number(cierre.diferencia || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                S/ {Number(cierre.diferencia || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-3 border-b border-dashed border-slate-300 pb-3 text-[11px]">
            <div className="flex justify-between font-bold text-slate-600">
              <span>TARJETA:</span>
              <span>S/ {Number(cierre.totalTarjeta || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-600">
              <span>YAPE / PLIN:</span>
              <span>S/ {Number(cierre.totalYape || 0).toFixed(2)}</span>
            </div>
            {Number(cierre.totalPedidosYa || 0) > 0 && (
              <div className="flex justify-between font-bold text-rose-500">
                <span>PEDIDOS YA:</span>
                <span>S/ {Number(cierre.totalPedidosYa || 0).toFixed(2)}</span>
              </div>
            )}
            {Number(cierre.totalConsumo || 0) > 0 && (
              <div className="flex justify-between font-bold text-purple-600">
                <span>CONSUMO / CRÉDITO:</span>
                <span>S/ {Number(cierre.totalConsumo || 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          {cierre.nota && (
            <div className="text-[10px] text-slate-500 italic mb-3">
              <strong>Nota:</strong> {cierre.nota}
            </div>
          )}

          <div className="text-center text-[10px] text-slate-400 font-bold">
            *** Reimpresión de Arqueo de Turno ***
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
