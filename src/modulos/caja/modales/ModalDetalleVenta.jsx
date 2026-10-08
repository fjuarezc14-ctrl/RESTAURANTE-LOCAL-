import { X, ExternalLink, Ban, Printer, Phone, MapPin, Pencil } from 'lucide-react';
import { formatearMoneda } from '../../../utils/dinero';
import { Dialog } from '../../../components/ui';

/**
 * Modal para visualizar el detalle completo de una venta efectuada o anulada
 */
export default function ModalDetalleVenta({
  venta,
  onCerrar,
  onAbrirAnulacion,
  onEnviarWhatsApp,
  onReimprimir,
  onEditarMetodoPago,
  onEditarTipoEntrega,
  estiloMetodo = () => ({ chip: 'bg-slate-100 text-slate-700', text: 'text-slate-700', Icon: () => null }),
  itemsDeVenta = () => [],
  clienteDeVenta = () => 'Cliente Varios',
  origenDeVenta = () => 'Salón',
  parseDeliveryInfo = () => null,
}) {
  if (!venta) return null;

  const est = estiloMetodo(venta.metodoPago);
  const items = itemsDeVenta(venta);
  const infoDelivery = parseDeliveryInfo(venta.codigoPedidosYa) || parseDeliveryInfo(venta.nombreCliente);
  const ofertaLimpia = venta.ofertaDescripcion
    ? venta.ofertaDescripcion.replace(/\[CREDITO_SPLIT:.*?\]/g, '').trim()
    : '';

  const IconMetodo = est.Icon;

  return (
    <Dialog open onClose={onCerrar} capa="z-[105]" className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 font-mono">#VT-{venta.id} · {venta.hora}</p>
          <p className="text-lg font-semibold text-slate-900">
            {venta.tipoComprobante} {venta.serie ? `${venta.serie}-${String(venta.numero).padStart(4, '0')}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {venta.anulado ? (
              <span className="text-xs font-medium text-red-700 bg-red-50 rounded-md px-2 py-0.5">Devuelto</span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 ${est.chip}`}>
                {IconMetodo && <IconMetodo className="w-3 h-3" />} {venta.metodoPago}
              </span>
            )}
            {!venta.anulado && venta.metodoPago === 'Cortesía' && (
              <span className="text-xs font-medium text-orange-700 bg-orange-50 rounded-md px-2 py-0.5">Cortesía total</span>
            )}
            {!venta.anulado && venta.metodoPago !== 'Cortesía' && venta.itemsResumen?.includes('CORTESÍA') && (
              <span className="text-xs font-medium text-orange-700 bg-orange-50 rounded-md px-2 py-0.5">Con cortesía</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
        {venta.anulado && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
            <p className="font-medium">Venta devuelta</p>
            {venta.motivoAnulacion && (
              <p className="text-red-600/90">Motivo: {venta.motivoAnulacion} ({venta.anuladoPor || 'Admin'})</p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="min-w-0">
            <dt className="text-xs text-slate-400">Cliente</dt>
            <dd className="text-slate-800 break-words">{clienteDeVenta(venta)}</dd>
            {venta.numDocumento && !venta.numDocumento.startsWith('DELIVERY -') && (
              <dd className="text-xs font-mono text-slate-500">{venta.numDocumento}</dd>
            )}
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-slate-400">Cobrado por</dt>
            <dd className="text-slate-800">{venta.cajeroNombre || 'Cajero Principal'}</dd>
            {venta.mesero && <dd className="text-xs text-slate-500">Mesero: {venta.mesero}</dd>}
          </div>
          {venta.codigoPago && (
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Código de pago</dt>
              <dd className="font-mono text-slate-800 break-all">{venta.codigoPago}</dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-xs text-slate-400">Origen</dt>
            <dd className="flex items-center gap-1 text-slate-800">
              <span className="truncate">
                {venta.codigoPedidosYa && !venta.codigoPedidosYa.startsWith('DELIVERY -') && !venta.codigoPedidosYa.startsWith('LLEVAR -')
                  ? `PedidosYa · ${venta.codigoPedidosYa}`
                  : origenDeVenta(venta)}
              </span>
              {venta.codigoPedidosYa && (
                <button
                  type="button"
                  onClick={() => onEditarTipoEntrega(venta)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Corregir tipo de entrega (requiere PIN Administrador)"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </dd>
          </div>
          {!venta.anulado && (
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Método de pago</dt>
              <dd className="flex items-center gap-1 text-slate-800">
                <span className={est.text}>{venta.metodoPago}</span>
                <button
                  type="button"
                  onClick={() => onEditarMetodoPago(venta)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Corregir método de pago (requiere PIN Administrador)"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </dd>
              {venta.metodoPago === 'Mixto' && (
                <dd className="mt-1 text-xs font-mono text-slate-500 space-y-0.5">
                  {(venta.montoEfectivo || 0) > 0 && <p>Efectivo {formatearMoneda(venta.montoEfectivo)}</p>}
                  {(venta.montoTarjeta || 0) > 0 && <p>Tarjeta {formatearMoneda(venta.montoTarjeta)}</p>}
                  {(venta.montoYape || 0) > 0 && <p>Yape {formatearMoneda(venta.montoYape)}</p>}
                  {(venta.montoCredito || 0) > 0 && <p>Crédito {formatearMoneda(venta.montoCredito)}</p>}
                </dd>
              )}
            </div>
          )}
          {infoDelivery?.telefono && (
            <div className="min-w-0">
              <dt className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</dt>
              <dd className="text-slate-800">{infoDelivery.telefono}</dd>
            </div>
          )}
          {infoDelivery?.direccion && (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección</dt>
              <dd className="text-slate-800 break-words">{infoDelivery.direccion}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Productos ({items.length})</p>
          {items.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {items.map((i, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 text-slate-700">
                    {i.cant != null && <span className="font-mono text-slate-400 mr-2">{i.cant}×</span>}
                    {i.nombre}
                  </span>
                  {i.subtotal != null && (
                    <span className="font-mono tabular-nums text-slate-600 shrink-0">
                      {formatearMoneda(i.subtotal)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">Sin ítems</p>}
          {ofertaLimpia && <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">🏷️ {ofertaLimpia}</p>}
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1 text-sm">
          {!venta.anulado && venta.descuentoAplicado > 0 && (
            <>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatearMoneda(parseFloat(venta.total || 0) + parseFloat(venta.descuentoAplicado || 0))}
                </span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Descuento</span>
                <span className="font-mono tabular-nums">−{formatearMoneda(venta.descuentoAplicado)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-slate-500">Total</span>
            {venta.anulado ? (
              <span className="text-right">
                <span className="block text-xl font-semibold font-mono tabular-nums text-red-600">S/ 0.00</span>
                <span className="block text-xs font-mono line-through text-slate-400">
                  {formatearMoneda(venta.montoOriginal ?? venta.total)}
                </span>
              </span>
            ) : (
              <span className="text-xl font-semibold font-mono tabular-nums text-slate-900">
                {formatearMoneda(venta.total || 0)}
              </span>
            )}
          </div>
        </div>

        {!venta.anulado && (
          <a
            href="https://ww1.sunat.gob.pe/ol-ti-itfesimpopciones/FESimpSunat.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 px-3.5 py-2.5 text-sm font-medium text-blue-900 transition-colors shadow-sm"
            title="Abrir portal oficial de SUNAT para emitir comprobante electrónico"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Emitir boleta / factura en SUNAT (Portal SOL)</span>
            </span>
            <span className="text-xs font-semibold text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200 shrink-0">sunat.gob.pe ↗</span>
          </a>
        )}
      </div>

      {/* Footer */}
      {!venta.anulado && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="grid grid-cols-3 sm:flex sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => onAbrirAnulacion(venta)}
              className="h-10 px-3 sm:px-4 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              title="Registrar devolución (requiere PIN Administrador)"
            >
              <Ban className="w-4 h-4" /> <span className="truncate">Devolución</span>
            </button>
            <button
              type="button"
              onClick={() => onEnviarWhatsApp(venta)}
              className="h-10 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current text-emerald-600 shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.161.001 6.136 1.23 8.375 3.466 2.238 2.237 3.467 5.21 3.466 8.373-.003 6.535-5.328 11.86-11.859 11.86-2.007-.001-3.98-.51-5.753-1.48L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.269 0 9.557-4.287 9.559-9.556.001-2.553-.99-4.955-2.792-6.758-1.802-1.802-4.199-2.793-6.753-2.794-5.27 0-9.559 4.287-9.56 9.559-.001 1.625.434 3.208 1.262 4.622L1.51 21.054l4.137-1.9zm12.135-6.843c-.268-.134-1.583-.78-1.828-.87-.247-.09-.427-.134-.607.134-.18.267-.697.87-.852 1.047-.156.178-.311.201-.579.067-.268-.134-1.132-.418-2.156-1.332-.796-.71-1.335-1.586-1.492-1.853-.156-.268-.017-.413.117-.547.12-.12.268-.312.401-.468.134-.156.179-.268.268-.446.09-.178.045-.335-.022-.469-.067-.134-.607-1.462-.832-2.002-.22-.53-.442-.457-.607-.466-.156-.008-.337-.008-.518-.008-.18 0-.473.067-.72.337-.247.268-.943.922-.943 2.248s.965 2.604 1.1 2.784c.134.18 1.9 2.901 4.6 4.068.643.277 1.143.443 1.534.568.646.205 1.233.176 1.697.107.518-.077 1.583-.647 1.807-1.272.223-.624.223-1.159.156-1.272-.069-.112-.249-.18-.517-.313z" />
              </svg>
              <span className="truncate">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => onReimprimir(venta)}
              className="h-10 px-3 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> <span className="truncate">Reimprimir</span>
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
