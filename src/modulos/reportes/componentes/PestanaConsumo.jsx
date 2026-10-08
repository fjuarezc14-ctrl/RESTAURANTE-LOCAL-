import { Briefcase, Users } from 'lucide-react';
import { botonTicket, chipCount, kpi, panel, vacio } from './piezas';
import { parsearCreditoSplit } from '../../../utils/ventas';
import { soles } from '../utils';

// Pestaña Consumo de personal (planilla) y créditos de clientes
export default function PestanaConsumo({
  clientes,
  reimprimirComprobante,
  ventas,
}) {
  const clienteMap = new Map(clientes.map(c => [c.id, c]));

  const listadoPlanilla = [];
  const listadoComercial = [];

  ventas.forEach(v => {
    if (v.anulado || v.estadoPedido === 'Cancelado') return;

    if (v.metodoPago === 'Consumo') {
      listadoPlanilla.push({
        id: v.id,
        fecha: v.fecha,
        createdAt: v.createdAt,
        hora: v.hora,
        nombre: v.nombreCliente || v.mesero || 'Consumo Personal',
        documento: '',
        itemsResumen: v.itemsResumen,
        monto: v.descuentoAplicado || v.total,
        rawVenta: v
      });
    } else {
      const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      if (splits.length > 0) {
        splits.forEach(s => {
          const cli = clienteMap.get(s.clienteId);
          const esTrab = cli?.esTrabajador || false;
          const nombre = cli?.nombre || s.nombre || v.nombreCliente || 'Cliente Crédito';
          const doc = cli?.numDoc || cli?.documento || '';
          const item = {
            id: v.id,
            fecha: v.fecha,
            createdAt: v.createdAt,
            hora: v.hora,
            nombre,
            documento: doc,
            itemsResumen: v.itemsResumen,
            monto: s.monto,
            rawVenta: v
          };
          if (esTrab) listadoPlanilla.push(item);
          else listadoComercial.push(item);
        });
      } else if (v.metodoPago === 'Crédito') {
        listadoComercial.push({
          id: v.id,
          fecha: v.fecha,
          createdAt: v.createdAt,
          hora: v.hora,
          nombre: v.nombreCliente || 'Cliente Comercial',
          documento: '',
          itemsResumen: v.itemsResumen,
          monto: v.total,
          rawVenta: v
        });
      }
    }
  });

  const planillaPorColaborador = {};
  listadoPlanilla.forEach(item => {
    planillaPorColaborador[item.nombre] = (planillaPorColaborador[item.nombre] || 0) + item.monto;
  });

  const clientesPorComercial = {};
  listadoComercial.forEach(item => {
    const key = item.documento ? `${item.nombre} (${item.documento})` : item.nombre;
    clientesPorComercial[key] = (clientesPorComercial[key] || 0) + item.monto;
  });

  const totalPlanilla = listadoPlanilla.reduce((sum, item) => sum + item.monto, 0);
  const totalComercial = listadoComercial.reduce((sum, item) => sum + item.monto, 0);

  const acumulado = (entries, color) => entries.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {entries.map(([nombre, total]) => (
        <span key={nombre} className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${color}`}>
          <span className="truncate max-w-[12rem]" title={nombre}>{nombre}</span>
          <span className="font-mono font-semibold">{soles(total)}</span>
        </span>
      ))}
    </div>
  ) : null;

  const listado = (items, colorMonto, etiqueta, textoVacio) => items.length > 0 ? (
    <ul className="divide-y divide-slate-100">
      {items.map((item, idx) => (
        <li key={`${item.id}-${idx}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">
              {item.nombre}
              {item.documento && <span className="ml-2 text-[11px] font-mono font-normal text-slate-400">{item.documento}</span>}
              {etiqueta}
            </p>
            <p className="text-xs text-slate-500 truncate"><span className="font-mono">#VT-{item.id}</span> · {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} {item.hora} · {item.itemsResumen}</p>
          </div>
          <p className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${colorMonto}`}>{soles(item.monto)}</p>
          {botonTicket(() => reimprimirComprobante(item.rawVenta))}
        </li>
      ))}
    </ul>
  ) : vacio(textoVacio);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi({ label: 'Créditos comerciales', valor: soles(totalComercial), hint: `${listadoComercial.length} ventas a crédito`, Icon: Briefcase, color: 'bg-teal-50 text-teal-600', borde: 'border-t-teal-500', valorClase: 'text-teal-700' })}
        {kpi({ label: 'Consumo de planilla', valor: soles(totalPlanilla), hint: `${listadoPlanilla.length} consumos de personal`, Icon: Users, color: 'bg-violet-50 text-violet-600', borde: 'border-t-violet-500', valorClase: 'text-violet-700' })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {panel({
          titulo: 'Cuentas por cobrar · Clientes',
          subtitulo: 'Ventas a crédito comercial',
          Icon: Briefcase,
          color: 'bg-teal-50 text-teal-600',
          derecha: chipCount(soles(totalComercial), 'bg-teal-50 text-teal-700 font-mono'),
          sinPadding: true,
          children: (
            <>
              {Object.keys(clientesPorComercial).length > 0 && (
                <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-400 mb-2">Acumulado por cliente</p>
                  {acumulado(Object.entries(clientesPorComercial), 'bg-teal-50 text-teal-800')}
                </div>
              )}
              {listado(listadoComercial, 'text-teal-700', null, 'No se registraron ventas a crédito comercial en este periodo.')}
            </>
          ),
        })}

        {panel({
          titulo: 'Descuentos de planilla · Personal',
          subtitulo: 'Consumos de colaboradores internos',
          Icon: Users,
          color: 'bg-violet-50 text-violet-600',
          derecha: chipCount(soles(totalPlanilla), 'bg-violet-50 text-violet-700 font-mono'),
          sinPadding: true,
          children: (
            <>
              {Object.keys(planillaPorColaborador).length > 0 && (
                <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-400 mb-2">Acumulado por colaborador</p>
                  {acumulado(Object.entries(planillaPorColaborador), 'bg-violet-50 text-violet-800')}
                </div>
              )}
              {listado(listadoPlanilla, 'text-violet-700', <span className="ml-2 text-[10px] font-medium text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">Planilla</span>, 'No se registraron consumos de personal en este periodo.')}
            </>
          ),
        })}
      </div>
    </div>
  );
}
