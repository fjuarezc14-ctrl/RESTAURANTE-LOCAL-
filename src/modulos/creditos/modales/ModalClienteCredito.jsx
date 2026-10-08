import { X } from 'lucide-react';
import { Dialog } from '../../../components/ui';

/**
 * ModalClienteCredito: Alta y edición de clientes de crédito o personal interno.
 */
export default function ModalClienteCredito({
  abierto,
  editandoCliente,
  formCliente,
  setFormCliente,
  usuarios = [],
  onCerrar,
  onGuardar
}) {
  if (!abierto || !formCliente) return null;

  return (
    <Dialog open onClose={onCerrar} capa="z-[400]" className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-slide-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-black text-slate-800 text-lg">
          {editandoCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="text-slate-400 hover:text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre *</label>
          <input
            value={formCliente.nombre}
            onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo Doc.</label>
            <select
              value={formCliente.tipoDoc}
              onChange={(e) => setFormCliente({ ...formCliente, tipoDoc: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            >
              <option>DNI</option>
              <option>RUC</option>
              <option>CE</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">N° Documento</label>
            <input
              value={formCliente.numDoc}
              onChange={(e) => setFormCliente({ ...formCliente, numDoc: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label>
          <input
            value={formCliente.telefono}
            onChange={(e) => setFormCliente({ ...formCliente, telefono: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dirección</label>
          <input
            value={formCliente.direccion}
            onChange={(e) => setFormCliente({ ...formCliente, direccion: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-xl">
          <input
            type="checkbox"
            checked={formCliente.esTrabajador}
            onChange={(e) => setFormCliente({ ...formCliente, esTrabajador: e.target.checked })}
            className="w-4 h-4 accent-violet-600"
          />
          <div>
            <label className="text-sm font-bold text-violet-800">Es trabajador interno</label>
            <p className="text-xs text-violet-500">Permite líneas de crédito para personal</p>
          </div>
        </div>

        {formCliente.esTrabajador && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
              Asociar con usuario del sistema
            </label>
            <select
              value={formCliente.usuarioId}
              onChange={(e) => setFormCliente({ ...formCliente, usuarioId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
            >
              <option value="">— Sin asociar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={onCerrar}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onGuardar}
          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
        >
          {editandoCliente ? 'Guardar Cambios' : 'Crear Cliente'}
        </button>
      </div>
    </Dialog>
  );
}
