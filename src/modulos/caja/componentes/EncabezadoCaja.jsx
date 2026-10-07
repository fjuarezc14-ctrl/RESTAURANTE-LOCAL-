import { ArrowLeftRight, History, Lock, ShoppingCart, Unlock } from 'lucide-react';
import { soles } from '../utils/ventasTurno';

// Encabezado de Caja: título, acciones (cierres, abrir/cerrar caja, nuevo pedido) y estado del turno
export default function EncabezadoCaja({
  abrirDeliveryModal,
  abrirHistorialCierres,
  abrirMovimientoGaveta,
  cajaEstado,
  cajeroNombre,
  setCierreModalOpen,
  setModalAperturaOpen,
}) {
  return (
    <>

    {/* ENCABEZADO + ESTADO DEL TURNO */}
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Caja</h1>
        {!cajaEstado.cargando && cajaEstado.abierto && (
          <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Turno abierto
            </span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{cajaEstado.turno?.cajeroNombre || cajeroNombre}</span>
            <span className="text-slate-300">·</span>
            <span>desde {cajaEstado.turno?.fechaApertura ? new Date(cajaEstado.turno.fechaApertura).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
            <span className="text-slate-300">·</span>
            <span>Fondo <span className="font-mono text-slate-700">{soles(cajaEstado.turno?.montoInicial)}</span></span>
            {(() => {
              const notaLimpia = (cajaEstado.turno?.notaApertura || '').replace(/\[Conteo inicial:.*?\]/g, '').trim();
              return notaLimpia ? <span className="italic text-slate-400 truncate">“{notaLimpia}”</span> : null;
            })()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
        <button
          type="button"
          onClick={abrirHistorialCierres}
          className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0 whitespace-nowrap"
          title="Historial de cierres"
        >
          <History className="w-4 h-4" /> <span className="hidden sm:inline">Cierres</span>
        </button>
        {cajaEstado.abierto && (
          <button
            type="button"
            onClick={() => abrirMovimientoGaveta('RETIRO')}
            className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs active:scale-[0.98] shrink-0 whitespace-nowrap"
            title="Retirar o ingresar dinero en la gaveta física"
          >
            <ArrowLeftRight className="w-4 h-4 text-slate-500" />
            <span>Movimiento de caja</span>
          </button>
        )}
        {cajaEstado.abierto ? (
          <button
            type="button"
            onClick={() => setCierreModalOpen(true)}
            className="h-10 px-3.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs active:scale-[0.98] shrink-0 whitespace-nowrap"
            title="Realizar arqueo físico y cerrar turno"
          >
            <Lock className="w-4 h-4 text-rose-600" /> Cerrar caja
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModalAperturaOpen(true)}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition-all active:scale-[0.98] shrink-0 whitespace-nowrap"
            title="Iniciar turno y registrar fondo de sencillo"
          >
            <Unlock className="w-4 h-4" /> Abrir caja
          </button>
        )}
        <button
          type="button"
          onClick={abrirDeliveryModal}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700 shadow-sm shadow-sky-600/25 transition-colors active:scale-[0.98] shrink-0 whitespace-nowrap"
        >
          <ShoppingCart className="w-4 h-4" /> Nuevo pedido
        </button>
      </div>
    </header>

    {!cajaEstado.cargando && !cajaEstado.abierto && (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500 text-white grid place-items-center shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-rose-800">Caja cerrada</p>
          <p className="text-sm text-rose-700/80">Inicia un turno con el fondo de sencillo usando el botón "Abrir caja" para habilitar cobros y pedidos.</p>
        </div>
      </div>
    )}
    </>
  );
}
