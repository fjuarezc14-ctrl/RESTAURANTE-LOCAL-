import { Banknote, CreditCard, History, Scale } from 'lucide-react';
import { botonTicket, chipCount, kpi, panel, vacio } from './piezas';
import { soles } from '../utils';

// Pestaña Cierres de caja: arqueos del rango con su diferencia y reimpresión
export default function PestanaCierres({
  cierresHistorial,
  fechaDesde,
  fechaHasta,
  setCierreAImprimir,
}) {
  const cierresFiltrados = cierresHistorial.filter(c => {
    if (!c.fechaCierre) return true;
    const fStr = new Date(c.fechaCierre).toISOString().slice(0, 10);
    return fStr >= fechaDesde && fStr <= fechaHasta;
  });

  const totalEsperado = cierresFiltrados.reduce((s, c) => s + (Number(c.efectivoEsperado) || 0), 0);
  const totalDif = cierresFiltrados.reduce((s, c) => s + (Number(c.diferencia) || 0), 0);
  const totalElec = cierresFiltrados.reduce((s, c) => s + (Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)), 0);
  const difTexto = (d) => (d > 0.01 ? `+${soles(d)}` : soles(d));
  const difColor = (d) => (Math.abs(d) < 0.01 ? 'bg-emerald-50 text-emerald-700' : d > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi({ label: 'Turnos cerrados', valor: cierresFiltrados.length, hint: 'Arqueos archivados', Icon: History, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
        {kpi({ label: 'Efectivo esperado', valor: soles(totalEsperado), hint: 'Ventas + abonos − egresos', Icon: Banknote, color: 'bg-emerald-50 text-emerald-600', borde: 'border-t-emerald-500' })}
        {kpi({ label: 'Tarjetas y Yape', valor: soles(totalElec), hint: 'Cobros electrónicos', Icon: CreditCard, color: 'bg-blue-50 text-blue-600', borde: 'border-t-blue-500' })}
        {kpi({ label: 'Diferencia acumulada', valor: difTexto(totalDif), valorClase: totalDif < -0.01 ? 'text-rose-600' : (totalDif > 0.01 ? 'text-blue-600' : 'text-emerald-600'), hint: 'Físico vs calculado', Icon: Scale, color: 'bg-slate-100 text-slate-600', borde: 'border-t-slate-400' })}
      </div>

      {panel({
        titulo: 'Historial de arqueos',
        subtitulo: 'Cierres de turno por cajero',
        Icon: History,
        color: 'bg-purple-50 text-purple-600',
        derecha: chipCount(cierresFiltrados.length, 'bg-purple-50 text-purple-700'),
        sinPadding: true,
        children: cierresFiltrados.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {cierresFiltrados.map(c => {
              const dif = Number(c.diferencia || 0);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 grid place-items-center text-xs font-semibold shrink-0">#{c.id}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.cajeroNombre}</p>
                      <span className={`text-[11px] font-mono font-semibold rounded-md px-1.5 py-0.5 ${difColor(dif)}`}>{difTexto(dif)}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {new Date(c.fechaCierre).toLocaleDateString('es-PE')} {new Date(c.fechaCierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      <span className="hidden sm:inline"> · Esperado {soles(c.efectivoEsperado)} · Contado {soles(c.efectivoContado)} · Elec. {soles(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0))} · Egresos {soles(c.egresosEfectivo)}</span>
                    </p>
                    <p className="sm:hidden text-xs text-slate-500 font-mono">Contado {soles(c.efectivoContado)} / {soles(c.efectivoEsperado)}</p>
                  </div>
                  {botonTicket(() => setCierreAImprimir(c))}
                </li>
              );
            })}
          </ul>
        ) : vacio('No hay cierres de caja registrados en este rango de fechas.'),
      })}
    </div>
  );
}
