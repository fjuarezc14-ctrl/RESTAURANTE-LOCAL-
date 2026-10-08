import { X, Phone, MapPin, Trash2, Pencil, PackageCheck } from 'lucide-react';
import { formatearMoneda } from '../../../utils/dinero';
import { Dialog } from '../../../components/ui';

/**
 * Modal para visualizar el detalle de un pedido de llevar o delivery y gestionar su despacho
 */
export default function ModalDetallePedidoLlevar({
  pedido,
  onCerrar,
  onCancelar,
  onModificar,
  onConfirmarEntrega,
  origen = {},
  listo = false,
}) {
  if (!pedido) return null;

  const items = (pedido.items || []).filter(Boolean);
  const IconOrigen = origen.Icon;

  return (
    <Dialog open onClose={onCerrar} capa="z-[105]" className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            {IconOrigen && <IconOrigen className="w-3.5 h-3.5" />} {origen.etiqueta}
          </p>
          <p className="text-lg font-semibold text-slate-900 break-words">{origen.nombre}</p>
          <p className="text-sm text-slate-500">{pedido.cajero} · {pedido.hora}</p>
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 ${
              listo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {listo ? 'Listo para entregar' : 'En cocina'}
            </span>
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

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
        {origen.info && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {origen.info.telefono && (
              <div>
                <dt className="text-xs text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Teléfono
                </dt>
                <dd className="text-slate-800">{origen.info.telefono}</dd>
              </div>
            )}
            {origen.info.direccion && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Dirección
                </dt>
                <dd className="text-slate-800 break-words">{origen.info.direccion}</dd>
              </div>
            )}
            {origen.info.conCuanto && (
              <div>
                <dt className="text-xs text-slate-400">Paga con</dt>
                <dd className="font-mono text-slate-800">{origen.info.conCuanto}</dd>
              </div>
            )}
            {origen.info.vuelto && (
              <div>
                <dt className="text-xs text-slate-400">Vuelto</dt>
                <dd className="font-mono text-slate-800">{origen.info.vuelto}</dd>
              </div>
            )}
          </dl>
        )}

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Productos ({items.length})</p>
          {items.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {items.map((i, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 text-slate-700">
                    <span className="font-mono text-slate-400 mr-2">{i.cant}×</span>{i.nombre}
                  </span>
                  {i.precio != null && (
                    <span className="font-mono tabular-nums text-slate-600 shrink-0">
                      {formatearMoneda(i.cant * i.precio)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">Sin detalle de productos</p>}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-slate-900">
            {formatearMoneda(pedido.total || 0)}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">
        <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => onCancelar(pedido)}
            className="h-10 px-4 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Cancelar
          </button>
          <button
            type="button"
            onClick={() => onModificar(pedido)}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Pencil className="w-4 h-4" /> Modificar
          </button>
          {listo && (
            <button
              type="button"
              onClick={() => onConfirmarEntrega(pedido.pedidoId, pedido.codigoPedidosYa)}
              className="col-span-2 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/30"
            >
              <PackageCheck className="w-4 h-4" /> Confirmar entrega
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
