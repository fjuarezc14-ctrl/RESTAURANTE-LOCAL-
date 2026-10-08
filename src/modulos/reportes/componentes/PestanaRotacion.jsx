import { Award, DollarSign, Flame, PieChart, Search, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { kpi, panel, vacio } from './piezas';
import { soles } from '../utils';

// Pestaña Rotación: rendimiento de la carta y ranking de platos
export default function PestanaRotacion({
  rotacion,
  rotacionBusqueda,
  rotacionCatFiltro,
  setRotacionBusqueda,
  setRotacionCatFiltro,
}) {
  const totalPlatosVendidos = rotacion.reduce((sum, item) => sum + (item.cantidad || 0), 0);
  const totalFacturacionCarta = rotacion.reduce((sum, item) => sum + (item.total || 0), 0);
  const platoEstrella = rotacion.length > 0 ? rotacion[0] : null;
  const platoMayorIngreso = rotacion.length > 0 ? [...rotacion].sort((a, b) => (b.total || 0) - (a.total || 0))[0] : null;

  // Agrupación por categoría gastronómica
  const catMap = {};
  rotacion.forEach(item => {
    const cat = item.categoria || 'Sin Categoría';
    if (!catMap[cat]) {
      catMap[cat] = { categoria: cat, cantidad: 0, total: 0 };
    }
    catMap[cat].cantidad += item.cantidad || 0;
    catMap[cat].total += item.total || 0;
  });
  const categoriasRanking = Object.values(catMap).sort((a, b) => b.total - a.total);
  const categoriasDisponibles = ['Todos', ...categoriasRanking.map(c => c.categoria)];

  const top5 = rotacion.slice(0, 5);

  const rotacionFiltrada = rotacion.filter(item => {
    const matchCat = rotacionCatFiltro === 'Todos' || item.categoria === rotacionCatFiltro;
    const matchNom = !rotacionBusqueda.trim() ||
      item.nombre.toLowerCase().includes(rotacionBusqueda.toLowerCase()) ||
      (item.categoria && item.categoria.toLowerCase().includes(rotacionBusqueda.toLowerCase()));
    return matchCat && matchNom;
  });
  const maxTotal = Math.max(1, ...rotacionFiltrada.map(r => r.total || 0));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 shadow-sm shadow-amber-500/20 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-amber-50/90">Plato más vendido</p>
            <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Award className="w-4 h-4" /></span>
          </div>
          <p className="mt-1 text-base font-semibold truncate" title={platoEstrella?.nombre}>{platoEstrella ? platoEstrella.nombre : 'Sin ventas'}</p>
          <p className="text-xs text-amber-50/90">{platoEstrella ? `${platoEstrella.cantidad} raciones · ${soles(platoEstrella.total)}` : '—'}</p>
        </div>
        {kpi({ label: 'Mayor ingreso', valor: soles(platoMayorIngreso?.total), valorClase: 'text-emerald-600', hint: platoMayorIngreso ? `${platoMayorIngreso.nombre} · ${platoMayorIngreso.cantidad} unid.` : 'Sin ventas', Icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
        {kpi({ label: 'Raciones vendidas', valor: totalPlatosVendidos, hint: `${rotacion.length} platos distintos`, Icon: UtensilsCrossed, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' })}
        {kpi({ label: 'Total recaudado carta', valor: soles(totalFacturacionCarta), hint: `${categoriasRanking.length} categorías activas`, Icon: TrendingUp, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {categoriasRanking.length > 0 && panel({
          titulo: 'Participación por categoría',
          subtitulo: `100% = ${soles(totalFacturacionCarta)}`,
          Icon: PieChart,
          color: 'bg-amber-50 text-amber-600',
          children: (
            <ul className="space-y-3">
              {categoriasRanking.map((catItem, cIdx) => {
                const pct = totalFacturacionCarta > 0 ? ((catItem.total / totalFacturacionCarta) * 100) : 0;
                return (
                  <li key={cIdx}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-800 truncate">{catItem.categoria}</span>
                      <span className="font-mono tabular-nums text-slate-900 shrink-0">{soles(catItem.total)} <span className="text-xs text-amber-700 ml-1">{pct.toFixed(1)}%</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{catItem.cantidad} unidades</p>
                  </li>
                );
              })}
            </ul>
          ),
        })}

        {top5.length > 0 && panel({
          titulo: 'Top 5 más pedidos',
          Icon: Flame,
          color: 'bg-orange-50 text-orange-600',
          sinPadding: true,
          children: (
            <ol className="divide-y divide-slate-100">
              {top5.map((item, idx) => {
                const pct = totalPlatosVendidos > 0 ? ((item.cantidad / totalPlatosVendidos) * 100) : 0;
                const medalla = ['bg-amber-400 text-white', 'bg-slate-300 text-slate-700', 'bg-orange-300 text-orange-900', 'bg-slate-100 text-slate-500', 'bg-slate-100 text-slate-500'][idx];
                return (
                  <li key={idx} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold shrink-0 ${medalla}`}>{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.nombre}</p>
                      <p className="text-xs text-slate-500 truncate">{item.categoria} · {item.cantidad} platos · {pct.toFixed(1)}%</p>
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 shrink-0">{soles(item.total)}</p>
                  </li>
                );
              })}
            </ol>
          ),
        })}
      </div>

      {panel({
        titulo: 'Rotación de la carta',
        subtitulo: 'Platos ordenados por volumen de venta',
        Icon: TrendingUp,
        color: 'bg-sky-50 text-sky-600',
        derecha: (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={rotacionBusqueda}
              onChange={e => setRotacionBusqueda(e.target.value)}
              placeholder="Buscar plato o categoría…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-100/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        ),
        sinPadding: true,
        children: (
          <>
            <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 flex gap-1.5 overflow-x-auto custom-scrollbar">
              {categoriasDisponibles.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setRotacionCatFiltro(cat)}
                  className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    rotacionCatFiltro === cat ? 'bg-sky-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {rotacionFiltrada.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {rotacionFiltrada.map((r, i) => {
                  const pct = totalFacturacionCarta > 0 ? ((r.total / totalFacturacionCarta) * 100) : 0;
                  const precioProm = r.cantidad > 0 ? (r.total / r.cantidad) : r.precio;
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span className="w-6 text-right font-mono text-xs text-slate-400 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900 truncate">{r.nombre}</p>
                          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-600 shrink-0">{soles(r.total)}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-3">
                          <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(2, ((r.total || 0) / maxTotal) * 100)}%` }} />
                          </div>
                          <p className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                            <span className="hidden sm:inline">{r.categoria || 'General'} · </span>{r.cantidad} u · prom. {soles(precioProm)} · {pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : vacio('No se encontraron platos que coincidan con los filtros.')}
          </>
        ),
      })}
    </div>
  );
}
