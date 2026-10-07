import { Trash2 } from 'lucide-react';
import { Dialog } from '../../../components/ui';

/**
 * ModalEliminarGasto: Confirmación para eliminación irreversible de una compra o gasto.
 */
export default function ModalEliminarGasto({
  abierto,
  compra,
  onCerrar,
  onConfirmar,
  soles
}) {
  if (!abierto || !compra) return null;

  return (
    <Dialog open={abierto} onClose={onCerrar} capa="z-[110]" className="max-w-sm p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center mx-auto mb-3">
        <Trash2 className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-slate-900">¿Eliminar este gasto?</p>
      <p className="mt-1 text-sm text-slate-500">
        <span className="text-slate-800">{compra.proveedor}</span> por{' '}
        <span className="font-mono text-slate-800">{soles ? soles(compra.total) : `S/ ${compra.total}`}</span>. No se puede deshacer.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button
          type="button"
          onClick={onCerrar}
          className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] cursor-pointer"
        >
          Sí, eliminar
        </button>
      </div>
    </Dialog>
  );
}
