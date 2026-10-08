import { Receipt, Truck } from 'lucide-react';
import { chipCount, kpi, panel, vacio } from './piezas';
import { esPedidosYa, fechaVenta, soles } from '../utils';

// Pestaña PedidosYa: pedidos de la app y lo que se debe cobrar
export default function PestanaPedidosYa({
  setVentaDetalleId,
  ventas,
}) {
  const itemsPY = ventas.filter(esPedidosYa);
  const totalPY = itemsPY.reduce((s, v) => s + v.total, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi({ label: 'Total PedidosYa', valor: soles(totalPY), hint: 'Para conciliar la liquidación semanal', Icon: Truck, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
        {kpi({ label: 'Pedidos', valor: itemsPY.length, hint: `Prom. ${soles(itemsPY.length ? totalPY / itemsPY.length : 0)}`, Icon: Receipt, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
      </div>
      {panel({
        titulo: 'Ventas de PedidosYa',
        subtitulo: 'Detalle para conciliar con el portal',
        Icon: Truck,
        color: 'bg-rose-50 text-rose-600',
        derecha: chipCount(itemsPY.length, 'bg-rose-50 text-rose-700'),
        sinPadding: true,
        children: itemsPY.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {itemsPY.map(v => (
              <li key={v.id}>
                <button type="button" onClick={() => setVentaDetalleId(v.id)} className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                  <span className="h-7 px-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-mono font-semibold grid place-items-center shrink-0">{v.codigoPedidosYa || 'N/A'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{v.itemsResumen}</p>
                    <p className="text-xs text-slate-500"><span className="font-mono">#VT-{v.id}</span> · {fechaVenta(v)} {v.hora}</p>
                  </div>
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 shrink-0">{soles(v.total)}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : vacio('No se registraron ventas de PedidosYa en este periodo.'),
      })}
    </div>
  );
}
