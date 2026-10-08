// Compras: distribución del gasto por categoría y método de pago
import { PieChart, Calendar } from 'lucide-react';
import { coloresDe, soles } from '../constantes';

export function PanelDistribucion({ filtroCategoria, gastosDetalle, setFiltroCategoria, stats }) {
  return (
    <div className="xl:col-span-2 space-y-5 min-w-0">
      <section className="bg-white rounded-2xl border border-slate-200/70">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 grid place-items-center"><PieChart className="w-4 h-4" /></span>
          <h2 className="text-sm font-semibold text-slate-800">Por categoría</h2>
        </div>
        {gastosDetalle.categorias.length > 0 ? (
          <ul className="px-4 sm:px-5 py-4 space-y-3">
            {gastosDetalle.categorias.map(([cat, monto]) => {
              const pct = gastosDetalle.total > 0 ? (monto / gastosDetalle.total) * 100 : 0;
              const activa = filtroCategoria === cat;
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => setFiltroCategoria(activa || cat === 'Sin Categoría' ? 'Todas' : cat)}
                    className="w-full text-left group"
                    title={activa ? 'Quitar filtro' : 'Ver solo esta categoría'}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={`truncate ${activa ? 'font-semibold text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>{cat}</span>
                      <span className="font-mono tabular-nums text-slate-900 shrink-0">{soles(monto)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${coloresDe(cat).bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums w-9 text-right">{Math.round(pct)}%</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Sin gastos para mostrar.</p>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/70">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 grid place-items-center"><Calendar className="w-4 h-4" /></span>
          <h2 className="text-sm font-semibold text-slate-800">Este mes</h2>
        </div>
        <dl className="px-4 sm:px-5 py-4 space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Total gastado</dt>
            <dd className="font-mono tabular-nums font-semibold text-slate-900">{soles(stats?.totalGastado)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Registros</dt>
            <dd className="font-mono tabular-nums text-slate-900">{stats?.numFacturas ?? 0}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">IGV de compras</dt>
            <dd className="font-mono tabular-nums text-slate-900">{soles(stats?.totalIGV)}</dd>
          </div>
          <div className="flex justify-between gap-3 pt-2.5 border-t border-slate-100">
            <dt className="text-slate-500 shrink-0">Mayor proveedor</dt>
            <dd className="text-right min-w-0">
              <p className="text-slate-900 truncate">{stats?.topProveedor?.nombre || '—'}</p>
              {stats?.topProveedor && <p className="text-xs font-mono text-slate-400">{soles(stats.topProveedor.total)}</p>}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
