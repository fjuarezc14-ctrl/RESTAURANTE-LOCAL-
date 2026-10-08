// Cierre de caja: vista previa del ticket térmico (es lo que se imprime)
import logoUrl from '../../../assets/logo.png';

export function TicketCierrePrevio({ abonosFiltrados, cajaEstado, cajeroNombre, cuadra, detalleConteo, diferenciaEfectivo, egresosEfectivo, empresa, fondoInicialTurno, ingresosCaja, montoFisicoNum, tieneConteoFisico, totalCalculado, totalConsumoClientes, totalConsumoPlanilla, totalCortesias, totalEfectivo, totalEfectivoEsperado, totalPedidosYa, totalTarjeta, totalYape }) {
  return (
    <div className="order-2 md:overflow-y-auto custom-scrollbar p-4 md:p-6 bg-slate-50/70 md:border-l border-slate-100">
      <p className="cierre-no-print text-xs font-medium text-slate-500 mb-2">
        Vista previa del ticket
      </p>

      <div
        id="cierre-imprimible"
        className="impresion-ticket bg-white border-2 border-dashed border-slate-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm flex flex-col"
      >
        <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4 flex flex-col items-center">
          <img
            src={logoUrl}
            alt="Logo"
            className="w-12 h-12 object-contain mb-1 filter grayscale"
          />
          <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
            {empresa.legalName || 'RESTAURANTE VALETEC'}
          </h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
            {empresa.address || 'Av. Principal 123'} · RUC: {empresa.ruc || '20600000001'}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            CIERRE DE TURNO · ARQUEO DIARIO
          </p>
        </div>

        <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
          <div className="flex justify-between">
            <span>FECHA:</span>
            <span>{new Date().toLocaleDateString('es-PE')}</span>
          </div>
          <div className="flex justify-between">
            <span>HORA IMP:</span>
            <span>{new Date().toLocaleTimeString('es-PE')}</span>
          </div>
          <div className="flex justify-between">
            <span>CAJERO:</span>
            <span className="uppercase">
              {cajaEstado.turno?.cajeroNombre || cajeroNombre}
            </span>
          </div>
          <div className="flex justify-between">
            <span>ESTADO:</span>
            <span className="text-emerald-700">FINALIZADO</span>
          </div>
        </div>

        <div className="space-y-3 mb-4 border-b border-dashed border-slate-300 pb-3">
          {fondoInicialTurno > 0 && (
            <div className="flex justify-between font-bold text-slate-700">
              <span>FONDO INICIAL (APERTURA):</span>
              <span className="font-black text-emerald-800">
                + S/ {fondoInicialTurno.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-700">
            <span>EFECTIVO VENTAS:</span>
            <span className="font-black text-slate-900">S/ {totalEfectivo.toFixed(2)}</span>
          </div>
          {ingresosCaja > 0 && (
            <div className="flex justify-between font-bold text-emerald-700">
              <span>INGRESOS A CAJA:</span>
              <span className="font-black text-emerald-700">
                + S/ {ingresosCaja.toFixed(2)}
              </span>
            </div>
          )}
          {egresosEfectivo > 0 && (
            <div className="flex justify-between font-bold text-rose-600">
              <span>SALIDAS DE CAJA:</span>
              <span className="font-black text-rose-600">
                - S/ {egresosEfectivo.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-700 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200">
            <span>EFECTIVO TOTAL ESPERADO:</span>
            <span className="font-black text-emerald-800">
              S/ {totalEfectivoEsperado.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-slate-700">
            <span>TARJETA POS:</span>
            <span className="font-black text-slate-900">S/ {totalTarjeta.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-700">
            <span>YAPE / PLIN:</span>
            <span className="font-black text-slate-900">S/ {totalYape.toFixed(2)}</span>
          </div>
          {abonosFiltrados.length > 0 && (
            <div className="border-t border-dashed border-slate-200 pt-2 pb-1 text-slate-650 font-bold text-[10px]">
              <span className="text-[9px] text-slate-400">DETALLE DE ABONOS RECIBIDOS:</span>
              <div className="flex justify-between pl-2">
                <span>Abonos Efec:</span>
                <span>
                  S/{' '}
                  {abonosFiltrados
                    .reduce((s, a) => s + (a.montoEfectivo || 0), 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pl-2">
                <span>Abonos Tarj:</span>
                <span>
                  S/{' '}
                  {abonosFiltrados
                    .reduce((s, a) => s + (a.montoTarjeta || 0), 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pl-2">
                <span>Abonos Yape:</span>
                <span>
                  S/{' '}
                  {abonosFiltrados
                    .reduce((s, a) => s + (a.montoYape || 0), 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          )}
          {totalConsumoClientes > 0 && (
            <div className="flex justify-between font-bold text-emerald-700 border-t border-dashed border-slate-205 pt-2">
              <span>CRÉDITO CLIENTES:</span>
              <span className="font-black text-emerald-800">
                S/ {totalConsumoClientes.toFixed(2)}
              </span>
            </div>
          )}
          {totalConsumoPlanilla > 0 && (
            <div className="flex justify-between font-bold text-violet-700 border-t border-dashed border-slate-205 pt-2">
              <span>CONSUMO PLANILLA:</span>
              <span className="font-black text-violet-800">
                S/ {totalConsumoPlanilla.toFixed(2)}
              </span>
            </div>
          )}
          {totalCortesias > 0 && (
            <div className="flex justify-between font-bold text-amber-700 border-t border-dashed border-amber-200 pt-2">
              <span>CORTESÍAS (VALOR):</span>
              <span className="font-black text-amber-900">
                S/ {totalCortesias.toFixed(2)}
              </span>
            </div>
          )}
          {totalPedidosYa > 0 && (
            <div className="flex justify-between font-bold text-blue-700 border-t border-dashed border-blue-200 pt-2">
              <span>
                PEDIDOS YA <span className="font-normal text-[9px]">(cobro semanal)</span>:
              </span>
              <span className="font-black text-blue-800">
                S/ {totalPedidosYa.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
          <span>TOTAL RECAUDACIÓN:</span>
          <span className="text-base text-emerald-700">
            S/ {totalCalculado.toFixed(2)}
          </span>
        </div>

        {tieneConteoFisico && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-300 text-xs">
            {detalleConteo.length > 0 && (
              <div className="mb-2 text-[10px] font-bold text-slate-600">
                <span className="text-[9px] text-slate-400">DETALLE DEL CONTEO:</span>
                {detalleConteo.map((d) => (
                  <div key={d.valor} className="flex justify-between pl-2">
                    <span>
                      {d.cantidad} x {d.etiqueta}
                    </span>
                    <span>S/ {d.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-800">
              <span>EFECTIVO CONTADO:</span>
              <span className="font-black">S/ {montoFisicoNum.toFixed(2)}</span>
            </div>
            <div
              className={`flex justify-between font-black mt-1 text-xs ${
                cuadra
                  ? 'text-emerald-700'
                  : diferenciaEfectivo > 0
                  ? 'text-blue-700'
                  : 'text-rose-600'
              }`}
            >
              <span>DIFERENCIA (CUADRE):</span>
              <span>
                {cuadra
                  ? '✓ CUADRE EXACTO'
                  : diferenciaEfectivo > 0
                  ? `+ S/ ${diferenciaEfectivo.toFixed(2)} (SOBRANTE)`
                  : `- S/ ${Math.abs(diferenciaEfectivo).toFixed(2)} (FALTANTE)`}
              </span>
            </div>
          </div>
        )}

        <div className="text-center text-[9px] text-slate-400 font-bold mt-6 border-t border-dashed border-slate-200 pt-3">
          *** Fin del Reporte de Turno ***
        </div>
      </div>
    </div>
  );
}
