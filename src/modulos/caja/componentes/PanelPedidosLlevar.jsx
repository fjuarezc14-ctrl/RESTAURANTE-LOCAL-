import { estadoChip } from './camposCaja';
import { ChevronRight, PackageCheck, Truck } from 'lucide-react';
import { esPedidoListo, origenPedido, soles } from '../utils/ventasTurno';

// Pedidos para llevar, delivery y PedidosYa del turno: estado en cocina, cobro y entrega
export default function PanelPedidosLlevar({
  confirmarEntregaDelivery,
  pedidosLlevar,
  setPedidoDetalleId,
}) {
  return (
    <>
    {/* PEDIDOS PARA LLEVAR / DELIVERY */}
    {pedidosLlevar.length > 0 && (
      <section className="bg-white rounded-2xl border border-slate-200/70">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center"><Truck className="w-4 h-4" /></span> Para llevar y delivery
          </h2>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-0.5">{pedidosLlevar.length}</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {pedidosLlevar.map(p => {
            const o = origenPedido(p.codigoPedidosYa, p);
            const listo = esPedidoListo(p);
            return (
              <li
                key={p.pedidoId}
                role="button"
                tabIndex={0}
                onClick={() => setPedidoDetalleId(p.pedidoId)}
                onKeyDown={(e) => { if (e.key === 'Enter') setPedidoDetalleId(p.pedidoId); }}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:bg-slate-50"
              >
                <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${o.color}`}>
                  <o.Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{o.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <span className="shrink-0">{o.etiqueta} · {p.hora}</span>
                    <span className="hidden sm:inline">{estadoChip(listo, 'Listo', 'En cocina')}</span>
                  </div>
                </div>
                <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">{soles(p.total)}</p>
                {listo ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); confirmarEntregaDelivery(p.pedidoId, p.codigoPedidosYa); }}
                    className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors active:scale-95 shrink-0 inline-flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Entregar</span>
                  </button>
                ) : (
                  <span className="sm:hidden">{estadoChip(false, '', '')}</span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
              </li>
            );
          })}
        </ul>
      </section>
    )}
    </>
  );
}
