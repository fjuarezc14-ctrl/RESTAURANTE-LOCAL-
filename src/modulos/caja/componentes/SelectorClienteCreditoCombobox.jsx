import { useState } from 'react';
import { Search, X, Users } from 'lucide-react';

/**
 * Selector de cliente de crédito con autocompletado y visualización de deuda.
 */
export default function SelectorClienteCreditoCombobox({
  clientes = [],
  clienteSeleccionado,
  onSelectCliente,
  label = 'Cliente para Crédito:',
  placeholder = 'Buscar por nombre, DNI o RUC...',
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = (clientes || []).filter((c) => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase().trim();
    const nom = (c.nombre || '').toLowerCase();
    const doc = (c.numDoc || '').toLowerCase();
    return nom.includes(term) || doc.includes(term);
  });

  return (
    <div className="space-y-1 relative">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase">
            {label}
          </label>
          {clienteSeleccionado && (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                (clienteSeleccionado.saldo || 0) > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {(clienteSeleccionado.saldo || 0) > 0
                ? `Debe S/ ${(clienteSeleccionado.saldo || 0).toFixed(2)}`
                : 'Al día'}
            </span>
          )}
        </div>
      )}

      {clienteSeleccionado ? (
        <div className="bg-amber-50/60 border-2 border-amber-300 rounded-xl p-2 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                clienteSeleccionado.esTrabajador
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">
                  {clienteSeleccionado.nombre}
                </p>
                <span
                  className={`text-[8px] font-black uppercase px-1 py-0.2 rounded shrink-0 ${
                    clienteSeleccionado.esTrabajador
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {clienteSeleccionado.esTrabajador ? 'STAFF' : 'CLIENTE'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 truncate">
                {clienteSeleccionado.tipoDoc || 'DOC'}: {clienteSeleccionado.numDoc || 'S/D'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCliente(null);
              setBusqueda('');
              setAbierto(true);
            }}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 shrink-0"
            title="Cambiar cliente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={placeholder}
              value={busqueda}
              onFocus={() => setAbierto(true)}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {abierto && (
            <>
              <div className="fixed inset-0 z-[120]" onClick={() => setAbierto(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[130] max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {filtrados.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold">
                    No se encontraron clientes
                  </div>
                ) : (
                  filtrados.map((c) => {
                    const debe = (c.saldo || 0) > 0;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCliente(c);
                          setAbierto(false);
                          setBusqueda('');
                        }}
                        className="w-full text-left p-1.5 rounded-xl hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2 border border-transparent hover:border-amber-200"
                      >
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 uppercase truncate">
                              {c.nombre}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                c.esTrabajador
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.esTrabajador ? 'STAFF' : 'CLIENTE'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {c.tipoDoc || 'DOC'}: {c.numDoc || 'S/D'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                              debe
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {debe ? `Debe S/ ${c.saldo.toFixed(2)}` : 'S/ 0.00'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
