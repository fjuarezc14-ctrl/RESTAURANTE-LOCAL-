import { Ban, Banknote, Briefcase, CreditCard, DollarSign, Gift, Receipt, Search, Smartphone, TrendingDown, TrendingUp, Truck, Users, Wallet } from 'lucide-react';
import { chipCount, kpi, panel, vacio } from './piezas';
import { clienteDeVenta, fechaVenta, metodoReal, origenDeVenta, soles } from '../utils';
import { getEstiloMetodo as estiloMetodo } from '../../caja/constantes/metodosPago';

// Pestaña Resumen: balance del rango, comprobantes y medios de pago
export default function PestanaResumen({
  busquedaCompNorm,
  cajeros,
  comprobantesBusqueda,
  comprobantesLista,
  comprobantesMetodo,
  comprobantesVisibles,
  resumen,
  retirosCaja,
  setComprobantesBusqueda,
  setComprobantesLimite,
  setComprobantesMetodo,
  setVentaDetalleId,
  ventas,
}) {
  const margen = resumen.ventasTotal - resumen.comprasTotal;
  const dc = resumen.desgloseCaja;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi({ label: 'Ventas del periodo', valor: soles(resumen.ventasTotal), hint: `Base ${soles(resumen.ventasBase)} · IGV ${soles(resumen.ventasIGV)}`, Icon: TrendingUp, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
        {kpi({ label: 'Retiros de caja', valor: soles(retirosCaja.reduce((s, m) => s + (Number(m.monto) || 0), 0)), valorClase: 'text-rose-600', hint: `${retirosCaja.length} salida${retirosCaja.length !== 1 ? 's' : ''} · sin devoluciones de ventas`, Icon: TrendingDown, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
        {kpi({ label: 'Margen operativo', valor: soles(margen), valorClase: margen >= 0 ? 'text-emerald-600' : 'text-rose-600', hint: `Rentabilidad ${resumen.ventasTotal > 0 ? ((margen / resumen.ventasTotal) * 100).toFixed(1) : '0.0'}%`, Icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
        {kpi({ label: 'Ticket promedio', valor: soles(ventas.length > 0 ? resumen.ventasTotal / ventas.length : 0), hint: `${ventas.length} comandas cobradas`, Icon: Receipt, color: 'bg-amber-50 text-amber-600', borde: 'border-t-amber-500' })}
      </div>

      {dc && panel({
        titulo: 'Recaudación por método',
        subtitulo: 'Periodo seleccionado',
        Icon: Wallet,
        color: 'bg-emerald-50 text-emerald-600',
        children: (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {[
              ['Efectivo', dc.efectivo, Banknote, 'bg-emerald-50 text-emerald-700'],
              ['Tarjeta / POS', dc.tarjeta, CreditCard, 'bg-blue-50 text-blue-700'],
              ['Yape / Plin', dc.yape, Smartphone, 'bg-purple-50 text-purple-700'],
              ['PedidosYa', dc.pedidosYa, Truck, 'bg-rose-50 text-rose-600'],
              ['Consumo planilla', dc.consumos ?? dc.consumoPlanilla, Users, 'bg-violet-50 text-violet-700'],
              ['Crédito comercial', dc.credito ?? dc.consumoClientes, Briefcase, 'bg-teal-50 text-teal-700'],
              ['Cortesías', dc.cortesias, Gift, 'bg-orange-50 text-orange-700'],
            ].map(([label, monto, Icon, color]) => (
              <div key={label} className={`rounded-xl px-3 py-2.5 ${color}`}>
                <p className="text-[11px] font-medium flex items-center gap-1.5 opacity-90"><Icon className="w-3.5 h-3.5" /> {label}</p>
                <p className="mt-0.5 font-mono font-semibold tabular-nums text-base">{soles(monto)}</p>
              </div>
            ))}
          </div>
        ),
      })}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        {/* Comprobantes */}
        <div className="xl:col-span-3 min-w-0">
          {panel({
            titulo: 'Comprobantes emitidos',
            subtitulo: 'Registro de ventas del periodo · toca uno para ver el detalle',
            Icon: Receipt,
            color: 'bg-indigo-50 text-indigo-600',
            derecha: chipCount(comprobantesLista.length, 'bg-indigo-50 text-indigo-700'),
            sinPadding: true,
            children: (
              <>
                <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={comprobantesBusqueda}
                      onChange={(e) => { setComprobantesBusqueda(e.target.value); setComprobantesLimite(25); }}
                      placeholder="Buscar venta, cliente, cajero…"
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <select
                    value={comprobantesMetodo}
                    onChange={(e) => { setComprobantesMetodo(e.target.value); setComprobantesLimite(25); }}
                    className="h-9 px-2.5 rounded-lg bg-slate-100/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="Todos">Todos</option>
                    {['Efectivo', 'Tarjeta', 'Yape', 'Mixto', 'Crédito', 'Consumo', 'Cortesía', 'PedidosYa'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {comprobantesVisibles.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {comprobantesVisibles.map(v => {
                      const metodo = metodoReal(v);
                      const est = estiloMetodo(metodo);
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setVentaDetalleId(v.id)}
                            className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${v.anulado ? 'bg-red-50 text-red-500' : est.chip}`}>
                              {v.anulado ? <Ban className="w-4 h-4" /> : <est.Icon className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${v.anulado ? 'text-slate-400' : 'text-slate-900'}`}>
                                {origenDeVenta(v)} <span className="text-slate-300">·</span> {clienteDeVenta(v)}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                <span className="font-mono">#VT-{v.id}</span> · {fechaVenta(v)} {v.hora} · {v.cajeroNombre || 'Cajero principal'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-mono text-sm font-semibold tabular-nums ${v.anulado ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {soles(v.anulado ? (v.montoOriginal ?? v.total) : v.total)}
                              </p>
                              <p className={`text-[11px] font-medium ${v.anulado ? 'text-red-600' : est.chip.split(' ')[1]}`}>{v.anulado ? 'Devuelto' : metodo}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : vacio(busquedaCompNorm || comprobantesMetodo !== 'Todos' ? 'Ningún comprobante coincide con el filtro.' : 'No hay comprobantes en este rango de fechas.')}
                {comprobantesLista.length > comprobantesVisibles.length && (
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setComprobantesLimite(l => l + 25)}
                      className="w-full h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      Mostrar más ({comprobantesLista.length - comprobantesVisibles.length})
                    </button>
                  </div>
                )}
              </>
            ),
          })}
        </div>

        {/* Cajeros */}
        <div className="xl:col-span-2 min-w-0">
          {panel({
            titulo: 'Ventas por cajero',
            subtitulo: 'Recaudación del personal de caja',
            Icon: Users,
            color: 'bg-purple-50 text-purple-600',
            derecha: chipCount(cajeros.length, 'bg-purple-50 text-purple-700'),
            sinPadding: true,
            children: cajeros.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {cajeros.map((c, i) => (
                  <li key={i} className="px-4 sm:px-5 py-3.5 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white grid place-items-center text-sm font-semibold shrink-0">{(c.nombre || 'C')[0].toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.nombre}</p>
                        <p className="text-xs text-slate-500">{c.cantidadTickets} tickets · prom. {soles(c.ticketPromedio)}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 shrink-0">{soles(c.totalVentas)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-12 text-[11px] font-mono">
                      <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5">Efec. {soles(c.efectivo)}</span>
                      <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5">Tarj. {soles(c.tarjeta)}</span>
                      <span className="rounded-md bg-purple-50 text-purple-700 px-2 py-0.5">Yape {soles(c.yape)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : vacio('Sin cobros de cajeros en este periodo.'),
          })}
        </div>
      </div>
    </div>
  );
}
