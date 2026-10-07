import { ArrowUpRight, Ban, Eye, EyeOff, Receipt, Search } from 'lucide-react';
import { clienteDeVenta, horaMovimiento, origenDeVenta, soles } from '../utils/ventasTurno';
import { getEstiloMetodo as estiloMetodo } from '../constantes/metodosPago';

// Ventas y salidas de caja del turno: búsqueda, filtro por método, lista y desglose
export default function PanelVentasTurno({
  busquedaVentas,
  busquedaVentasNorm,
  filtroMetodoPago,
  historialColapsado,
  mostrarTodoElDia,
  setBusquedaVentas,
  setFiltroMetodoPago,
  setHistorialColapsado,
  setMostrarTodoElDia,
  setVentaDetalleId,
  setVentasLimite,
  soloSalidas,
  ultimoCierre,
  ventasLista,
  ventasVisibles,
}) {
  return (
    <>
    {/* ÚLTIMAS VENTAS */}
    <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/70 min-w-0">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center"><Receipt className="w-4 h-4" /></span> Ventas y Salidas de Turno
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">{ventasLista.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => setHistorialColapsado(prev => !prev)}
          className="p-2 -m-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={historialColapsado ? 'Mostrar ventas' : 'Ocultar ventas'}
        >
          {historialColapsado ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {!historialColapsado ? (
        <>
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={busquedaVentas}
                onChange={(e) => { setBusquedaVentas(e.target.value); setVentasLimite(20); }}
                placeholder="Buscar venta, cliente, mesa…"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <select
              value={filtroMetodoPago}
              onChange={(e) => { setFiltroMetodoPago(e.target.value); setVentasLimite(20); }}
              className="h-9 px-2.5 rounded-lg bg-slate-100/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="Todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Yape">Yape / Plin</option>
              <option value="PedidosYa">PedidosYa</option>
              <option value="Cortesía">Cortesías</option>
              <option value="Salidas">💸 Salidas de caja</option>
            </select>
            {ultimoCierre && (
              <div className="inline-flex h-9 p-0.5 rounded-lg bg-slate-100/80 text-xs font-medium">
                {[[false, 'Turno'], [true, 'Día']].map(([valor, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setMostrarTodoElDia(valor); setVentasLimite(20); }}
                    className={`px-3 rounded-md transition-colors ${mostrarTodoElDia === valor ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    title={valor ? 'Mostrar todas las ventas del día' : 'Solo ventas del turno activo'}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {ventasVisibles.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {ventasVisibles.map(fila => {
                if (fila.tipoFila === 'movimiento') {
                  const m = fila.mov;
                  const esIngreso = m.tipo === 'INGRESO';
                  return (
                    <li key={`mov-${m.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${esIngreso ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        <ArrowUpRight className={`w-4 h-4 ${esIngreso ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-slate-900">
                          {esIngreso ? 'Ingreso de Caja' : 'Salida de Caja'} <span className="text-slate-300">·</span> {m.motivo}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {horaMovimiento(m.creadoEn)}
                          {m.cajeroNombre && <> · <span className="text-slate-600">{m.cajeroNombre}</span></>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono text-sm font-semibold tabular-nums ${esIngreso ? 'text-emerald-600' : 'text-red-600'}`}>
                          {esIngreso ? '+ ' : '- '}{soles(m.monto)}
                        </p>
                        <p className={`text-[11px] font-medium ${esIngreso ? 'text-emerald-600' : 'text-red-600'}`}>Efectivo</p>
                      </div>
                    </li>
                  );
                }
                const v = fila.venta;
                const est = estiloMetodo(v.metodoPago);
                const conCortesia = v.metodoPago === 'Cortesía' || v.itemsResumen?.includes('CORTESÍA');
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setVentaDetalleId(v.id)}
                      className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:bg-slate-50"
                    >
                      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${v.anulado ? 'bg-red-50 text-red-500' : est.chip}`}>
                        {v.anulado ? <Ban className="w-4 h-4" /> : <est.Icon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${v.anulado ? 'text-slate-400' : 'text-slate-900'}`}>
                          {origenDeVenta(v)} <span className="text-slate-300">·</span> {clienteDeVenta(v)}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-mono">#VT-{v.id}</span> · {v.hora}
                          {v.cajeroNombre && <> · <span className="text-slate-600">{v.cajeroNombre}</span></>}
                          {v.descuentoAplicado > 0 && !v.anulado && <span className="text-blue-600"> · Desc.</span>}
                          {conCortesia && !v.anulado && <span className="text-orange-600"> · Cortesía</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono text-sm font-semibold tabular-nums ${v.anulado ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {soles(v.anulado ? (v.montoOriginal ?? v.total) : v.total)}
                        </p>
                        <p className={`text-[11px] font-medium ${v.anulado ? 'text-red-600' : est.text}`}>{v.anulado ? 'Devuelto' : v.metodoPago}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              {soloSalidas && !busquedaVentasNorm
                ? 'No hay salidas de caja en este turno.'
                : (busquedaVentasNorm || filtroMetodoPago !== 'Todos' ? 'Nada coincide con el filtro.' : 'Aún no se registran ventas en este turno.')}
            </p>
          )}

          {ventasLista.length > ventasVisibles.length && (
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVentasLimite(l => l + 20)}
                className="w-full h-9 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                Mostrar más ({ventasLista.length - ventasVisibles.length})
              </button>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setHistorialColapsado(false)}
          className="w-full px-5 py-8 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          Historial oculto · toca para mostrar
        </button>
      )}
    </section>
    </>
  );
}
