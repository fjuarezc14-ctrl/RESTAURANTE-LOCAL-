import { Banknote, ChevronDown, Gift, Receipt, Wallet } from 'lucide-react';
import { soles } from '../utils/ventasTurno';

// Tarjetas del resumen del turno: ingresos en caja (con desglose), ventas, créditos y cortesías
export default function ResumenTurnoCaja({
  activeConsumoClientes,
  activeConsumoPlanilla,
  activeCortesias,
  activeEfectivo,
  activeIngresosCaja,
  activeTarjeta,
  activeYape,
  ingresosDesglose,
  mesasPendientes,
  pedidosLlevar,
  setIngresosDesglose,
  totalCreditosTurno,
  ventasTurno,
}) {
  return (
    <>
    {/* RESUMEN DEL TURNO */}
    <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 ${ingresosDesglose ? 'items-start' : ''}`}>
      <div className="col-span-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-4 sm:p-5 shadow-sm shadow-emerald-600/20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-emerald-50/90">Ingresos en caja</p>
          <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center"><Banknote className="w-4 h-4" /></span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight truncate">{soles(activeIngresosCaja)}</p>
          <button
            type="button"
            onClick={() => setIngresosDesglose(v => !v)}
            className="h-7 pl-2.5 pr-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium inline-flex items-center gap-1 transition-colors shrink-0"
            aria-expanded={ingresosDesglose}
            title={ingresosDesglose ? 'Ocultar detalle' : 'Ver efectivo, tarjeta y Yape'}
          >
            Detalle <ChevronDown className={`w-4 h-4 transition-transform ${ingresosDesglose ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {ingresosDesglose && (
        <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-3 gap-2 text-xs animate-fade-in">
          {[['Efectivo', activeEfectivo], ['Tarjeta', activeTarjeta], ['Yape', activeYape]].map(([label, monto]) => (
            <div key={label} className="min-w-0">
              <p className="text-emerald-50/75">{label}</p>
              <p className="font-mono tabular-nums text-white truncate">{soles(monto)}</p>
            </div>
          ))}
        </div>
        )}
      </div>
      {[
        { label: 'Ventas', valor: ventasTurno.length, hint: `${mesasPendientes.length + pedidosLlevar.length} por cobrar/entregar`, Icon: Receipt, color: 'bg-sky-50 text-sky-600', borde: 'border-t-sky-500' },
        { label: 'Créditos', valor: soles(totalCreditosTurno), hint: `Clientes ${soles(activeConsumoClientes)} · Planilla ${soles(activeConsumoPlanilla)}`, Icon: Wallet, color: 'bg-teal-50 text-teal-600', borde: 'border-t-teal-500' },
        { label: 'Cortesías', valor: soles(activeCortesias), hint: 'Valor referencial', Icon: Gift, color: 'bg-orange-50 text-orange-600', borde: 'border-t-orange-500' },
      ].map(({ label, valor, hint, Icon, color, borde }) => (
        <div key={label} className={`rounded-2xl border border-slate-200/70 border-t-4 ${borde} bg-white p-4 min-w-0`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <span className={`w-8 h-8 rounded-lg grid place-items-center ${color}`}><Icon className="w-4 h-4" /></span>
          </div>
          <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-900 font-mono tabular-nums truncate">{valor}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>
        </div>
      ))}
    </div>

    </>
  );
}
