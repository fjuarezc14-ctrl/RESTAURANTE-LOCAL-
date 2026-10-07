import { Receipt, X } from 'lucide-react';
import logoUrl from '../../../assets/logo.png';

/**
 * Modal visor e impresión de comprobante / ticket SUNAT / control interno
 */
export default function ModalComprobanteSunat({
  abierto,
  comprobante,
  empresa = {},
  facturacionElectronica = false,
  onCerrar,
}) {
  if (!abierto || !comprobante) return null;

  const itemsImprimibles = (comprobante.items || []).filter(Boolean);

  return (
    <div id="modal-comprobante-sunat-print-container" className="impresion-ventana fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
        <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" /> {
              comprobante.metodoPago === 'Consumo' ? '👤 CONSUMO PERSONAL 👤' :
              comprobante.metodoPago === 'Cortesía' ? '🎁 TICKET DE CORTESÍA 🎁' :
              'TICKET DE VENTA'
            }
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="comprobante-sunat-ticket-print" className="impresion-ticket p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-mono text-xs leading-relaxed">
          {comprobante.contingencia && comprobante.metodoPago !== 'Cortesía' && comprobante.metodoPago !== 'Consumo' && (
            <div className="bg-amber-100 text-amber-900 border-2 border-dashed border-amber-400 p-2 rounded-lg text-center mb-3 font-bold text-[9px] uppercase tracking-tight no-print">
              TICKET DE CONTROL INTERNO<br />
              Emisión electrónica pendiente por contingencia
            </div>
          )}

          <div className="flex justify-center mb-2">
            <img src={logoUrl} alt="Logo" className="w-14 h-14 object-contain filter grayscale contrast-125" />
          </div>
          <div className="text-center font-black tracking-wide" style={{ fontSize: '14px', marginBottom: '2px' }}>{empresa.legalName || 'EMPRESA'}</div>
          <div className="text-center text-[10px] leading-tight mb-2">
            {empresa.address}<br />
            R.U.C. N° {empresa.ruc}
          </div>

          <div className="text-center font-bold mb-1" style={{ fontSize: '11px' }}>{
            comprobante.metodoPago === 'Consumo' ? 'VALE DE CONSUMO PERSONAL' :
            comprobante.metodoPago === 'Cortesía' ? 'CORTESÍA / CONSUMO INTERNO' :
            'TICKET DE VENTA'
          }</div>
          <div className="text-center font-bold mb-3" style={{ fontSize: '13px' }}>{
            comprobante.metodoPago === 'Consumo' ? `CONS-00${comprobante.mesaNum || 'SM'}-${comprobante.correlativo}` :
            comprobante.metodoPago === 'Cortesía' ? `COR-00${comprobante.mesaNum || 'SM'}` :
            `N° ${comprobante.correlativo}`
          }</div>

          <div className="flex justify-between border-t border-b border-dashed border-slate-300 py-1.5 mb-2 font-bold">
            <span>{comprobante.fecha} {comprobante.hora}</span>
            <span>Mesa {comprobante.mesaNum}</span>
          </div>

          <div className="space-y-1 mb-3">
            <div><strong>Cliente:</strong> <span className="uppercase">{comprobante.clienteNombre}</span></div>
            {comprobante.metodoPago !== 'Cortesía' && comprobante.metodoPago !== 'Consumo' && (
              <div><strong>{comprobante.tipo === 'Factura' ? 'RUC' : 'DNI'}:</strong> <span>{comprobante.clienteDoc}</span></div>
            )}
            {comprobante.clienteDireccion && (
              <div><strong>Dirección:</strong> <span className="uppercase text-[9px] leading-none block mt-0.5">{comprobante.clienteDireccion}</span></div>
            )}
            <div><strong>Items:</strong> <span>{itemsImprimibles.length}</span></div>
          </div>

          {/* Box de Datos de Despacho para Delivery */}
          {comprobante.deliveryInfo && (
            <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-0.5">
              <div className="font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1 border-b border-slate-200 pb-1 mb-1">
                <span>Datos de Envío / Despacho</span>
              </div>
              {comprobante.deliveryInfo.nombreCliente && (
                <div><strong>Destinatario:</strong> <span className="uppercase">{comprobante.deliveryInfo.nombreCliente}</span></div>
              )}
              {comprobante.deliveryInfo.telefono && (
                <div><strong>Teléfono:</strong> <span>{comprobante.deliveryInfo.telefono}</span></div>
              )}
              {comprobante.deliveryInfo.direccion && (
                <div><strong>Dirección:</strong> <span className="uppercase">{comprobante.deliveryInfo.direccion}</span></div>
              )}
              {comprobante.deliveryInfo.montoDelivery > 0 && (
                <div><strong>Costo Delivery:</strong> <span>S/ {comprobante.deliveryInfo.montoDelivery.toFixed(2)}</span></div>
              )}
              {comprobante.deliveryInfo.montoConCuanto > 0 && (
                <div className="pt-0.5 border-t border-dashed border-slate-200 flex justify-between font-black text-slate-800">
                  <span>PAGA CON: S/ {comprobante.deliveryInfo.montoConCuanto.toFixed(2)}</span>
                  <span>VUELTO: S/ {Math.max(0, comprobante.deliveryInfo.montoConCuanto - (comprobante.total + comprobante.deliveryInfo.montoDelivery)).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Items Table Header */}
          <table className="w-full text-left border-collapse mb-3">
            <thead>
              <tr className="border-b border-dashed border-slate-300 font-bold text-[10px]">
                <th className="py-1">CANT</th>
                <th className="py-1">DESCRIPCIÓN</th>
                <th className="py-1 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {itemsImprimibles.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 font-bold align-top">{it.cant || it.cantidad}</td>
                  <td className="py-1 align-top uppercase">
                    {it.nombre}
                    {it.descuentoAplicado > 0 && (
                      <span className="block text-[9px] text-amber-700 font-bold">
                        (Dcto: -S/ {it.descuentoAplicado.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right font-bold align-top">
                    S/ {((it.cant || it.cantidad) * (it.precio || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1 mb-3">
            <div className="flex justify-between">
              <span>OP. GRAVADA:</span>
              <span>S/ {(comprobante.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>I.G.V. (10.5%):</span>
              <span>S/ {(comprobante.igv || 0).toFixed(2)}</span>
            </div>
            {comprobante.descuentoAplicado > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>DESCUENTO:</span>
                <span>-S/ {comprobante.descuentoAplicado.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200">
              <span>TOTAL A PAGAR:</span>
              <span>S/ {(comprobante.total || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1 mb-3 text-[10px]">
            <div><strong>SON:</strong> {comprobante.totalLetras}</div>
            <div><strong>FORMA DE PAGO:</strong> <span className="uppercase">{comprobante.metodoPago}</span></div>
          </div>

          {comprobante.metodoPago === 'Consumo' && (
            <div className="mt-6 mb-3 text-center border-t border-dashed border-slate-350 pt-6">
              <p className="border-t border-dashed border-slate-350 mx-auto w-3/4 mb-1"></p>
              <p className="text-[10px] font-black uppercase tracking-wider">FIRMA COLABORADOR</p>
              <p className="text-[9px] text-slate-500 mt-0.5 font-medium">{comprobante.clienteNombre}</p>
            </div>
          )}

          <div className="text-center font-bold mt-4" style={{ fontSize: '10px' }}>¡Gracias por su preferencia!</div>
          <div className="text-center text-[9px] leading-tight text-slate-500 mt-1">
            {
              comprobante.metodoPago === 'Consumo' ? 'VALE INTERNO AUTORIZADO DE COLABORADOR' :
              comprobante.metodoPago === 'Cortesía' ? 'TICKET DE CONSUMO INTERNO AUTORIZADO' :
              'Documento interno de control. No es comprobante de pago: solicite su boleta o factura en caja.'
            }
          </div>

          {facturacionElectronica && comprobante.enlacePdf && comprobante.metodoPago !== 'Cortesía' && comprobante.metodoPago !== 'Consumo' && (
            <div className="text-center text-[10px] mt-4 font-bold no-print pt-2 border-t border-slate-100">
              <a href={comprobante.enlacePdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 flex items-center justify-center gap-1.5">
                📄 Descargar Comprobante SUNAT (PDF)
              </a>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest rounded-xl text-xs flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Receipt className="w-4 h-4" /> Imprimir 80mm
          </button>
        </div>
      </div>
    </div>
  );
}
