import { Users } from 'lucide-react';
import { chipCount, panel, vacio } from './piezas';

// Pestaña Mozos: ventas y mesas atendidas por cada mozo
export default function PestanaMozos({
  mozos,
}) {
  const maxAtendidas = Math.max(1, ...mozos.map(m => m.mesasAtendidas || 0));
  return panel({
    titulo: 'Rendimiento de mozos',
    subtitulo: 'Mesas atendidas y activas en el periodo',
    Icon: Users,
    color: 'bg-indigo-50 text-indigo-600',
    derecha: chipCount(`${mozos.length} con comanda`, 'bg-indigo-50 text-indigo-700'),
    sinPadding: true,
    children: mozos.length > 0 ? (
      <ul className="divide-y divide-slate-100">
        {mozos.map((m, i) => (
          <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 grid place-items-center text-sm font-bold shrink-0">{m.nombre[0]}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900 truncate">{m.nombre}</p>
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                  <span className={`rounded-full px-2.5 py-0.5 ${m.mesasActivas > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>{m.mesasActivas} activa{m.mesasActivas !== 1 ? 's' : ''}</span>
                  <span className="rounded-full px-2.5 py-0.5 bg-emerald-50 text-emerald-700">{m.mesasAtendidas} atendida{m.mesasAtendidas !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full" style={{ width: `${Math.max(2, ((m.mesasAtendidas || 0) / maxAtendidas) * 100)}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : vacio('Sin actividad de mozos en este rango de fechas.'),
  });
}
