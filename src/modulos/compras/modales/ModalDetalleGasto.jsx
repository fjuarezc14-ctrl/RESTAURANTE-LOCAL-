import { X, Trash2, Pencil } from 'lucide-react';
import { Dialog } from '../../../components/ui';

/**
 * ModalDetalleGasto: Visualizador completo de un gasto/compra con desglose
 * de impuestos, métodos de pago y selector rápido de categorías.
 */
export default function ModalDetalleGasto({
  abierto,
  compra,
  onCerrar,
  estiloMetodo,
  parsearGastoMetodos,
  formatearDia,
  diaDeCompra,
  soles,
  CATEGORIAS = [],
  coloresDe,
  actualizarCategoria,
  onEliminar,
  onEditar
}) {
  if (!abierto || !compra) return null;

  const est = estiloMetodo ? estiloMetodo(compra.metodoPago) : { chip: '', Icon: () => null, label: compra.metodoPago };
  const p = parsearGastoMetodos ? parsearGastoMetodos(compra.metodoPago, compra.total) : { esMixto: false };

  return (
    <Dialog open onClose={onCerrar} capa="z-[105]" className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 break-words">{compra.proveedor}</p>
          <p className="text-sm text-slate-500">{formatearDia ? formatearDia(diaDeCompra(compra)) : ''} · Registro #{compra.id}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Monto</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-rose-600">{soles ? soles(compra.total) : `S/ ${compra.total}`}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium ${est.chip}`}>
            <est.Icon className="w-4 h-4" /> {est.id === 'Mixto' ? 'Pago mixto' : est.label}
          </span>
        </div>

        {p.esMixto && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[['Efectivo', p.efec], ['Yape', p.yape], ['Tarjeta', p.tarj]].map(([label, monto]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-slate-500">{label}</p>
                <p className="font-mono tabular-nums text-slate-900">{soles ? soles(monto) : `S/ ${monto}`}</p>
              </div>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Comprobante</dt>
            <dd className="text-slate-800">{compra.tipoDocumento || 'Recibo Interno'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Número</dt>
            <dd className="font-mono text-slate-800">{compra.serieNumero || 'S/N'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">RUC</dt>
            <dd className="font-mono text-slate-800">{compra.ruc && compra.ruc !== '00000000000' ? compra.ruc : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">IGV</dt>
            <dd className="font-mono text-slate-800">{soles ? soles(compra.igv) : `S/ ${compra.igv}`}</dd>
          </div>
        </dl>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Categoría · toca para cambiarla</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((cat) => {
              const activa = compra.categoria === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => !activa && actualizarCategoria && actualizarCategoria(compra.id, cat)}
                  className={`h-8 px-3 rounded-full border text-xs font-medium transition active:scale-95 ${
                    activa ? coloresDe(cat).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEliminar && onEliminar(compra)}
          className="h-11 px-4 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors inline-flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
        <button
          type="button"
          onClick={() => onEditar && onEditar(compra)}
          className="ml-auto h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors active:scale-[0.98] inline-flex items-center gap-2"
        >
          <Pencil className="w-4 h-4" /> Editar
        </button>
      </div>
    </Dialog>
  );
}
