import { AlertTriangle, DollarSign, Receipt, XCircle } from 'lucide-react';
import { kpi, panel, vacio } from './piezas';
import { soles } from '../utils';

// Pestaña Anulaciones: pedidos cancelados, platos cancelados sueltos y ventas anuladas o devueltas
export default function PestanaAnulaciones({
  cancelaciones,
  filtroTipoAnulacion,
  setAnulacionDetalle,
  setFiltroTipoAnulacion,
}) {
  const cancelacionesFiltradas = cancelaciones.filter(c => {
    if (filtroTipoAnulacion === 'Todos') return true;
    return (c.tipo || 'Comanda Cancelada') === filtroTipoAnulacion;
  });

  const totalPerdida = cancelacionesFiltradas.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const devolucionesList = cancelaciones.filter(c => c.tipo === 'Devolución en Caja');
  const montoDevoluciones = devolucionesList.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const comandasList = cancelaciones.filter(c => c.tipo !== 'Devolución en Caja' && c.tipo !== 'Plato Cancelado');
  const platosList = cancelaciones.filter(c => c.tipo === 'Plato Cancelado');
  const montoComandas = comandasList.reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi({ label: 'Incidencias', valor: cancelacionesFiltradas.length, hint: 'Cancelaciones y devoluciones', Icon: XCircle, color: 'bg-rose-50 text-rose-600', borde: 'border-t-rose-500' })}
        {kpi({ label: 'Monto impactado', valor: `−${soles(totalPerdida)}`, valorClase: 'text-rose-600', hint: 'Según el filtro actual', Icon: DollarSign, color: 'bg-red-50 text-red-600', borde: 'border-t-red-500' })}
        {kpi({ label: 'Devoluciones en caja', valor: devolucionesList.length, hint: `Reembolsos ${soles(montoDevoluciones)}`, Icon: Receipt, color: 'bg-purple-50 text-purple-600', borde: 'border-t-purple-500' })}
        {kpi({ label: 'Comandas de salón', valor: comandasList.length, hint: `Anuladas antes del pago ${soles(montoComandas)}`, Icon: AlertTriangle, color: 'bg-amber-50 text-amber-600', borde: 'border-t-amber-500' })}
      </div>

      {panel({
        titulo: 'Registro de anulaciones',
        subtitulo: 'Toca un registro para ver motivo y detalle',
        Icon: XCircle,
        color: 'bg-rose-50 text-rose-600',
        derecha: (
          <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0 self-start sm:self-auto">
            {[
              { id: 'Todos', label: 'Todos', count: cancelaciones.length, activo: 'bg-slate-900 text-white' },
              { id: 'Devolución en Caja', label: 'Devoluciones', count: devolucionesList.length, activo: 'bg-purple-600 text-white' },
              { id: 'Comanda Cancelada', label: 'Comandas', count: comandasList.length, activo: 'bg-amber-500 text-white' },
              { id: 'Plato Cancelado', label: 'Platos', count: platosList.length, activo: 'bg-orange-500 text-white' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroTipoAnulacion(f.id)}
                className={`h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all ${filtroTipoAnulacion === f.id ? `${f.activo} shadow-sm` : 'text-slate-500 hover:text-slate-800'}`}
              >
                {f.label} <span className="opacity-70">{f.count}</span>
              </button>
            ))}
          </div>
        ),
        sinPadding: true,
        children: (
          <>
            {cancelacionesFiltradas.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {cancelacionesFiltradas.map((c, i) => {
                  const isDevolucion = c.tipo === 'Devolución en Caja';
                  return (
                    <li key={i}>
                      <button type="button" onClick={() => setAnulacionDetalle(c)} className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${isDevolucion ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                          {isDevolucion ? <Receipt className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {c.mesa ? `Mesa ${c.mesa}` : (c.codigoPedidosYa || 'Delivery')} <span className="text-slate-300">·</span> <span className="font-normal italic text-slate-600">“{c.motivoCancela || 'Sin motivo'}”</span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {c.tipo || 'Comanda cancelada'} · {c.fecha || 'Hoy'} {c.hora} · {c.canceladoPor || 'No registrado'}
                            {c.autorizadoPor && c.autorizadoPor !== c.canceladoPor && <> · Autorizó {c.autorizadoPor}</>}
                          </p>
                        </div>
                        <p className="font-mono text-sm font-semibold tabular-nums text-rose-600 shrink-0">−{soles(c.total)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : vacio(`No hay registros de ${filtroTipoAnulacion.toLowerCase()} en este rango de fechas.`)}
            {cancelacionesFiltradas.length > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">{cancelacionesFiltradas.length} de {cancelaciones.length} eventos</span>
                <span className="font-mono font-semibold text-rose-600">−{soles(totalPerdida)}</span>
              </div>
            )}
          </>
        ),
      })}
    </div>
  );
}
