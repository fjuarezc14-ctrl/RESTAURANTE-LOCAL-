import { Receipt, X, Printer } from 'lucide-react';

/**
 * Modal e impresión de precuenta de consumo de una mesa
 */
export default function ModalPrecuentaMesa({
  mesa,
  onCerrar,
  empresa = {},
  mesero = 'Mozo',
}) {
  if (!mesa) return null;

  const items = mesa.pedidoData?.items || [];
  const subtotal = items.reduce((s, i) => s + (i.cant * i.precio), 0);
  const subtotalBase = parseFloat((subtotal / 1.105).toFixed(2));
  const igv = parseFloat((subtotal - subtotalBase).toFixed(2));

  return (
    <div id="precuenta-print-container" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-2 text-indigo-700">
            <Receipt className="w-6 h-6 shrink-0" />
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">
              Precuenta Mesa {mesa.num}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista del ticket térmico */}
        <div id="precuenta-ticket-print" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-6 flex flex-col">
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4">
            <h4 className="font-black text-sm text-slate-900 uppercase">{empresa.legalName || 'EMPRESA'}</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{empresa.address} · RUC: {empresa.ruc}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">PRECUENTA DE CONSUMO (NO VALIDO COMO COMPROBANTE)</p>
          </div>

          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
            <div className="flex justify-between"><span>MESA:</span><span className="text-slate-900 text-sm font-black">{mesa.num}</span></div>
            <div className="flex justify-between"><span>FECHA:</span><span>{new Date().toLocaleDateString('es-PE')}</span></div>
            <div className="flex justify-between"><span>HORA:</span><span>{new Date().toLocaleTimeString('es-PE')}</span></div>
            <div className="flex justify-between"><span>MOZO:</span><span className="uppercase">{mesero}</span></div>
          </div>

          {/* Detalle de productos */}
          <div className="border-b border-dashed border-slate-300 pb-3 mb-4">
            <div className="grid grid-cols-12 gap-1 font-black text-slate-900 text-[10px] uppercase tracking-wider mb-2">
              <span className="col-span-2 text-center">CANT</span>
              <span className="col-span-7">PRODUCTO</span>
              <span className="col-span-3 text-right">TOTAL</span>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 text-[11px] font-bold text-slate-700 leading-tight">
                  <span className="col-span-2 text-center font-black">{item.cant}</span>
                  <span className="col-span-7 uppercase">{item.nombre}</span>
                  <span className="col-span-3 text-right font-black">S/ {(item.cant * item.precio).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-1.5 font-bold text-slate-700 border-b border-dashed border-slate-300 pb-3 mb-3">
            <div className="flex justify-between">
              <span>OP. GRAVADA:</span>
              <span>S/ {subtotalBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>I.G.V. (10%):</span>
              <span>S/ {igv.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
            <span>💰 TOTAL A PAGAR:</span>
            <span className="text-base text-indigo-700">S/ {subtotal.toFixed(2)}</span>
          </div>

          {empresa.ticketFooter && (
            <div className="text-center text-[9px] text-slate-400 font-bold mt-6 border-t border-dashed border-slate-200 pt-3">
              {empresa.ticketFooter}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
