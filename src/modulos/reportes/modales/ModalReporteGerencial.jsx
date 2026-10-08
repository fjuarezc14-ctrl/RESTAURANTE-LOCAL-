import { Printer, X } from 'lucide-react';
import { montosVenta, construirCreditosPlanilla } from '../../../utils/exportarReporteExcel';
import { Dialog } from '../../../components/ui';

/**
 * ModalReporteGerencial: Resumen ejecutivo e informe gerencial para directivos,
 * con balance de ventas, compras, IGV, recaudación, cajeros, mozos y arqueos.
 */
export default function ModalReporteGerencial({
  abierto,
  onCerrar,
  COMPANY_CONFIG,
  fechaDesde,
  fechaHasta,
  ventas = [],
  clientes = [],
  parsearCreditoSplit,
  resumen = {},
  cierresHistorial = [],
  cajeros = [],
  mozos = [],
  rotacion = [],
  compras = [],
  cancelaciones = [],
  // Secciones
  incluirBalance,
  setIncluirBalance,
  incluirRecaudacion,
  setIncluirRecaudacion,
  incluirCajeros,
  setIncluirCajeros,
  incluirMozos,
  setIncluirMozos,
  incluirRotacion,
  setIncluirRotacion,
  incluirGastos,
  setIncluirGastos,
  incluirPedidosYa,
  setIncluirPedidosYa,
  incluirPersonal,
  setIncluirPersonal,
  incluirAnulaciones,
  setIncluirAnulaciones,
  incluirCierres,
  setIncluirCierres,
}) {
  if (!abierto) return null;

  const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

  const esPedidosYa = (v) =>
    v.metodoPago === 'PedidosYa' &&
    v.codigoPedidosYa &&
    !v.codigoPedidosYa.startsWith('DELIVERY -') &&
    !v.codigoPedidosYa.startsWith('LLEVAR -');

  const secciones = [
    ['balance', 'Balance / IGV', incluirBalance, setIncluirBalance],
    ['recaudacion', 'Recaudación', incluirRecaudacion, setIncluirRecaudacion],
    ['cajeros', 'Cajeros', incluirCajeros, setIncluirCajeros],
    ['mozos', 'Mozos', incluirMozos, setIncluirMozos],
    ['rotacion', 'Rotación de carta', incluirRotacion, setIncluirRotacion],
    ['gastos', 'Compras y gastos', incluirGastos, setIncluirGastos],
    ['pedidosya', 'PedidosYa', incluirPedidosYa, setIncluirPedidosYa],
    ['personal', 'Créditos y planilla', incluirPersonal, setIncluirPersonal],
    ['anulaciones', 'Anulaciones', incluirAnulaciones, setIncluirAnulaciones],
    ['cierres', 'Cierres de caja', incluirCierres, setIncluirCierres],
  ];

  const recaudacion = { efectivo: 0, tarjeta: 0, yape: 0, credito: 0, pedidosYa: 0, consumo: 0, cortesia: 0 };
  ventas.forEach((v) => {
    const m = montosVenta(v);
    Object.keys(recaudacion).forEach((k) => {
      recaudacion[k] += m[k];
    });
  });

  const devueltas = ventas.filter((v) => v.anulado || v.estadoPedido === 'Cancelado');
  const { planilla, comercial } = construirCreditosPlanilla(ventas, clientes, parsearCreditoSplit);

  const agrupar = (items) =>
    Object.entries(
      items.reduce((acc, it) => {
        const k = it.documento ? `${it.nombre} (${it.documento})` : it.nombre;
        acc[k] = (acc[k] || 0) + it.monto;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

  const totalPY = ventas.filter(esPedidosYa).reduce((s, v) => s + v.total, 0);
  const nPY = ventas.filter(esPedidosYa).length;

  const cierresRango = cierresHistorial.filter((c) => {
    if (!c.fechaCierre) return true;
    const fStr = new Date(c.fechaCierre).toISOString().slice(0, 10);
    return fStr >= fechaDesde && fStr <= fechaHasta;
  });

  let n = 0;
  const titulo = (texto, color) => {
    n += 1;
    return (
      <h2
        className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b-2 pb-1.5 mb-3 flex items-center gap-2"
        style={{ borderColor: color }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        {n}. {texto}
      </h2>
    );
  };

  const th = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500';
  const td = 'px-3 py-1.5';

  return (
    <Dialog
      open
      onClose={onCerrar}
      closeOnBackdrop={false}
      id="modal-reporte-gerencial-container"
      capa="impresion-hoja z-[250]"
      className="bg-white w-full max-w-4xl h-[96dvh] sm:h-auto sm:max-h-[94dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up"
    >
      {/* Cabecera */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 no-print">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">Reporte gerencial</h3>
          <p className="text-sm text-slate-500">Vista previa · {fechaDesde} al {fechaHasta}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm shadow-sky-600/25 transition-colors"
          >
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir / Guardar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Selector de Secciones */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 no-print shrink-0">
        <p className="text-xs font-medium text-slate-500 mb-2">Secciones a incluir</p>
        <div className="flex flex-wrap gap-1.5">
          {secciones.map(([id, label, activo, set]) => (
            <button
              key={id}
              type="button"
              onClick={() => set(!activo)}
              className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                activo
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              {activo && <span className="text-[10px]">✓</span>} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del Reporte Imprimible */}
      <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 text-xs">
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">{COMPANY_CONFIG?.name}</h1>
            <p className="text-[11px] text-slate-500">{COMPANY_CONFIG?.legalName} · RUC {COMPANY_CONFIG?.ruc}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-700">Reporte de gestión</p>
            <p className="text-[11px] font-mono text-slate-500">Periodo: {fechaDesde} al {fechaHasta}</p>
            <p className="text-[10px] font-mono text-slate-400">Generado: {new Date().toLocaleString('es-PE')}</p>
          </div>
        </div>

        {/* 1. Balance */}
        {incluirBalance && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Balance del periodo', '#0284c7')}
            <div className="grid grid-cols-4 gap-3">
              {[
                ['Ventas', resumen.ventasTotal, `Base ${soles(resumen.ventasBase)} · IGV ${soles(resumen.ventasIGV)}`],
                ['Compras / gastos', resumen.comprasTotal, `Base ${soles(resumen.comprasBase)} · IGV ${soles(resumen.comprasIGV)}`],
                ['IGV neto a liquidar', resumen.igvAPagar, 'Débito fiscal − crédito fiscal'],
                [
                  'Margen operativo',
                  resumen.ventasTotal - resumen.comprasTotal,
                  `${ventas.length - devueltas.length} ventas · ticket prom. ${soles(
                    ventas.length - devueltas.length ? resumen.ventasTotal / (ventas.length - devueltas.length) : 0
                  )}`,
                ],
              ].map(([label, valor, hint]) => (
                <div key={label} className="border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{soles(valor)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{hint}</p>
                </div>
              ))}
            </div>
            {devueltas.length > 0 && (
              <p className="mt-2 text-[10px] text-rose-600">
                {devueltas.length} venta(s) devuelta(s) por{' '}
                {soles(devueltas.reduce((s, v) => s + (v.montoOriginal ?? v.total ?? 0), 0))} excluidas de la
                recaudación.
              </p>
            )}
          </div>
        )}

        {/* 2. Recaudación */}
        {incluirRecaudacion && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Recaudación por medio de cobro', '#059669')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Medio</th>
                  <th className={`${th} text-right`}>Monto</th>
                  <th className={th}>Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Efectivo', recaudacion.efectivo, 'Cuadre de caja'],
                  ['Tarjeta / POS', recaudacion.tarjeta, 'Cuadre de caja'],
                  ['Yape / Plin', recaudacion.yape, 'Cuadre de caja'],
                  ['Crédito comercial', recaudacion.credito, 'Cuentas por cobrar'],
                  ['PedidosYa', recaudacion.pedidosYa, 'Liquidación semanal'],
                  ['Consumo de personal', recaudacion.consumo, 'Descuento por planilla'],
                  ['Cortesías', recaudacion.cortesia, 'Valor referencial, sin cobro'],
                ].map(([m, monto, obs]) => (
                  <tr key={m}>
                    <td className={`${td} font-medium`}>{m}</td>
                    <td className={`${td} text-right font-mono`}>{soles(monto)}</td>
                    <td className={`${td} text-slate-500`}>{obs}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td className={td}>Ingresos en caja (efectivo + tarjeta + Yape)</td>
                  <td className={`${td} text-right font-mono`}>
                    {soles(recaudacion.efectivo + recaudacion.tarjeta + recaudacion.yape)}
                  </td>
                  <td className={td} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Cajeros */}
        {incluirCajeros && cajeros.length > 0 && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Ventas por cajero', '#9333ea')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Cajero</th>
                  <th className={`${th} text-center`}>Tickets</th>
                  <th className={`${th} text-right`}>Efectivo</th>
                  <th className={`${th} text-right`}>Tarjeta</th>
                  <th className={`${th} text-right`}>Yape</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cajeros.map((c, i) => (
                  <tr key={i}>
                    <td className={`${td} font-medium`}>{c.nombre}</td>
                    <td className={`${td} text-center`}>{c.cantidadTickets}</td>
                    <td className={`${td} text-right font-mono`}>{soles(c.efectivo)}</td>
                    <td className={`${td} text-right font-mono`}>{soles(c.tarjeta)}</td>
                    <td className={`${td} text-right font-mono`}>{soles(c.yape)}</td>
                    <td className={`${td} text-right font-mono font-bold`}>{soles(c.totalVentas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Mozos */}
        {incluirMozos && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Rendimiento de mozos', '#4f46e5')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Mozo</th>
                  <th className={`${th} text-center`}>Mesas activas</th>
                  <th className={`${th} text-center`}>Mesas atendidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mozos.length > 0 ? (
                  mozos.map((m, idx) => (
                    <tr key={idx}>
                      <td className={`${td} font-medium`}>{m.nombre}</td>
                      <td className={`${td} text-center`}>{m.mesasActivas}</td>
                      <td className={`${td} text-center font-bold text-emerald-700`}>{m.mesasAtendidas}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className={`${td} text-center text-slate-400`}>
                      Sin registros en el periodo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Rotación */}
        {incluirRotacion && (
          <div className="mb-7">
            {titulo('Rotación de productos por categoría', '#d97706')}
            {(() => {
              const grouped = {};
              rotacion.forEach((r) => {
                const cat = r.categoria || 'Otros';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(r);
              });
              const categories = Object.keys(grouped).sort();
              if (categories.length === 0)
                return <p className="text-slate-400 text-center py-3">Sin datos de rotación en el periodo.</p>;
              return (
                <table className="w-full text-left border border-slate-200">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className={th}>Producto</th>
                      <th className={`${th} text-center`}>Cantidad</th>
                      <th className={`${th} text-right`}>Precio prom.</th>
                      <th className={`${th} text-right`}>Total</th>
                    </tr>
                  </thead>
                  {categories.map((cat) => {
                    const items = grouped[cat].sort((a, b) => b.cantidad - a.cantidad);
                    return (
                      <tbody key={cat} className="divide-y divide-slate-100 break-inside-avoid">
                        <tr className="bg-amber-50/70">
                          <td className={`${td} font-bold uppercase text-amber-900`}>{cat}</td>
                          <td className={`${td} text-center font-bold`}>{items.reduce((s, i) => s + i.cantidad, 0)}</td>
                          <td className={td} />
                          <td className={`${td} text-right font-mono font-bold`}>
                            {soles(items.reduce((s, i) => s + i.total, 0))}
                          </td>
                        </tr>
                        {items.map((r, idx) => (
                          <tr key={idx}>
                            <td className={`${td} pl-6`}>{r.nombre}</td>
                            <td className={`${td} text-center`}>{r.cantidad}</td>
                            <td className={`${td} text-right font-mono text-slate-600`}>
                              {soles(r.cantidad > 0 ? r.total / r.cantidad : r.precio)}
                            </td>
                            <td className={`${td} text-right font-mono`}>{soles(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              );
            })()}
          </div>
        )}

        {/* 6. Compras y gastos */}
        {incluirGastos && (
          <div className="mb-7">
            {titulo('Compras y gastos', '#e11d48')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Comprobante</th>
                  <th className={th}>Proveedor</th>
                  <th className={`${th} text-right`}>Base</th>
                  <th className={`${th} text-right`}>IGV</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compras.length > 0 ? (
                  compras.map((c, idx) => (
                    <tr key={idx}>
                      <td className={`${td} font-mono`}>{c.creadoEn ? c.creadoEn.split('T')[0] : ''}</td>
                      <td className={td}>
                        {c.tipoDocumento || 'Factura'} {c.serieNumero || ''}
                      </td>
                      <td className={td}>
                        <span className="font-medium">{c.proveedor}</span>{' '}
                        <span className="text-slate-400 font-mono">{c.ruc || ''}</span>
                      </td>
                      <td className={`${td} text-right font-mono`}>{soles(c.baseImponible)}</td>
                      <td className={`${td} text-right font-mono`}>{soles(c.igv)}</td>
                      <td className={`${td} text-right font-mono font-bold`}>{soles(c.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className={`${td} text-center text-slate-400`}>
                      Sin compras en el periodo
                    </td>
                  </tr>
                )}
                {compras.length > 0 && (
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan="3" className={`${td} text-right`}>
                      Total
                    </td>
                    <td className={`${td} text-right font-mono`}>{soles(resumen.comprasBase)}</td>
                    <td className={`${td} text-right font-mono`}>{soles(resumen.comprasIGV)}</td>
                    <td className={`${td} text-right font-mono`}>{soles(resumen.comprasTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. PedidosYa */}
        {incluirPedidosYa && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Conciliación PedidosYa', '#e11d48')}
            <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-slate-600">{nPY} pedido(s) para conciliar con la liquidación semanal</span>
              <span className="text-lg font-bold font-mono">{soles(totalPY)}</span>
            </div>
          </div>
        )}

        {/* 8. Créditos y planilla */}
        {incluirPersonal && (
          <div className="mb-7 break-inside-avoid">
            {titulo('Créditos comerciales y consumo de personal', '#0d9488')}
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Créditos a clientes', comercial, '#0f766e'],
                ['Planilla (personal)', planilla, '#6d28d9'],
              ].map(([label, items, color]) => (
                <table key={label} className="w-full text-left border border-slate-200 self-start">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className={th}>{label}</th>
                      <th className={`${th} text-right`}>Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length > 0 ? (
                      agrupar(items).map(([nombre, total]) => (
                        <tr key={nombre}>
                          <td className={td}>{nombre}</td>
                          <td className={`${td} text-right font-mono`} style={{ color }}>
                            {soles(total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className={`${td} text-center text-slate-400`}>
                          Sin registros
                        </td>
                      </tr>
                    )}
                    {items.length > 0 && (
                      <tr className="bg-slate-100 font-bold">
                        <td className={td}>Total</td>
                        <td className={`${td} text-right font-mono`}>
                          {soles(items.reduce((s, i) => s + i.monto, 0))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        )}

        {/* 9. Anulaciones */}
        {incluirAnulaciones && (
          <div className="mb-7">
            {titulo('Anulaciones y devoluciones', '#dc2626')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Origen</th>
                  <th className={th}>Responsable</th>
                  <th className={th}>Motivo</th>
                  <th className={`${th} text-right`}>Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cancelaciones.length > 0 ? (
                  cancelaciones.map((c, i) => (
                    <tr key={i}>
                      <td className={`${td} font-mono whitespace-nowrap`}>
                        {c.fecha || ''} {c.hora}
                      </td>
                      <td className={td}>{c.tipo || 'Comanda cancelada'}</td>
                      <td className={td}>{c.mesa ? `Mesa ${c.mesa}` : c.codigoPedidosYa || 'Delivery'}</td>
                      <td className={td}>{c.canceladoPor || '—'}</td>
                      <td className={`${td} italic text-slate-600`}>{c.motivoCancela || 'Sin motivo'}</td>
                      <td className={`${td} text-right font-mono text-rose-600`}>−{soles(c.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className={`${td} text-center text-slate-400`}>
                      Sin anulaciones en el periodo
                    </td>
                  </tr>
                )}
                {cancelaciones.length > 0 && (
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan="5" className={`${td} text-right`}>
                      Total
                    </td>
                    <td className={`${td} text-right font-mono text-rose-600`}>
                      −{soles(cancelaciones.reduce((s, c) => s + (Number(c.total) || 0), 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 10. Cierres de caja */}
        {incluirCierres && (
          <div className="mb-7">
            {titulo('Cierres de caja (arqueos)', '#7c3aed')}
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Cajero</th>
                  <th className={`${th} text-right`}>Esperado</th>
                  <th className={`${th} text-right`}>Contado</th>
                  <th className={`${th} text-right`}>Diferencia</th>
                  <th className={`${th} text-right`}>Tarjeta + Yape</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cierresRango.length > 0 ? (
                  cierresRango.map((c) => {
                    const dif = Number(c.diferencia || 0);
                    return (
                      <tr key={c.id}>
                        <td className={`${td} font-mono whitespace-nowrap`}>
                          {new Date(c.fechaCierre).toLocaleString('es-PE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className={td}>{c.cajeroNombre}</td>
                        <td className={`${td} text-right font-mono`}>{soles(c.efectivoEsperado)}</td>
                        <td className={`${td} text-right font-mono`}>{soles(c.efectivoContado)}</td>
                        <td
                          className={`${td} text-right font-mono font-bold ${
                            dif < -0.01 ? 'text-rose-600' : dif > 0.01 ? 'text-blue-600' : 'text-emerald-600'
                          }`}
                        >
                          {dif > 0.01 ? '+' : ''}
                          {soles(dif)}
                        </td>
                        <td className={`${td} text-right font-mono`}>
                          {soles(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0))}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className={`${td} text-center text-slate-400`}>
                      Sin cierres en el periodo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Firmas */}
        <div className="mt-14 flex justify-around break-inside-avoid">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 h-10 mb-2" />
            <p className="font-semibold text-slate-700">Firma administrador</p>
          </div>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 h-10 mb-2" />
            <p className="font-semibold text-slate-700">Firma propietario</p>
            <p className="text-[10px] text-slate-400">{COMPANY_CONFIG?.name}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
