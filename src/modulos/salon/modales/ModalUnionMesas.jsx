import { Link2, X } from 'lucide-react';

/**
 * Modal para gestionar unión y separación de mesas en el salón
 */
export default function ModalUnionMesas({
  abierto,
  mesaActual,
  mesas = [],
  mesasUnidas = [],
  onCerrar,
  onUnirMesa,
  onSepararMesas,
}) {
  if (!abierto || !mesaActual) return null;

  const disponibles = mesas.filter(
    m => m.estado === 'Libre' && m.num !== mesaActual.num && !m.mesaPrincipalId && !m.esUnida
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-fade-in">
        <h3 className="font-black uppercase text-sm border-b border-slate-100 pb-2 mb-3 flex items-center gap-2 text-slate-800">
          <Link2 className="w-5 h-5 text-amber-500" /> Unir Mesas con Mesa {mesaActual.num}
        </h3>

        {/* Mesas unidas actualmente */}
        {mesasUnidas.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200/50 p-3 rounded-xl">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
              Unidas a la Mesa {mesaActual.num}:
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {mesasUnidas.map(m => (
                <span key={m.num} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-black pl-2.5 pr-1 py-1 rounded-lg">
                  Mesa {m.num}
                  <button
                    type="button"
                    onClick={() => onSepararMesas(m.num)}
                    className="w-5 h-5 grid place-items-center rounded-md text-amber-700 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                    title={`Separar solo la Mesa ${m.num}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {mesasUnidas.length > 1 && (
              <button
                type="button"
                onClick={() => onSepararMesas()}
                className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-xs uppercase transition-colors cursor-pointer"
              >
                🔓 Separar las {mesasUnidas.length} mesas de este grupo
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-slate-500 font-bold mb-2">Selecciona una mesa libre para unirla:</p>
        <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar p-1 mb-4">
          {disponibles.length === 0 ? (
            <p className="col-span-4 text-center text-xs text-slate-400 py-3">No hay mesas libres disponibles.</p>
          ) : (
            disponibles.map(m => (
              <button
                key={m.num}
                type="button"
                onClick={() => onUnirMesa(m.num)}
                className="bg-slate-50 hover:bg-amber-100 border border-slate-200 text-slate-800 text-xs font-black py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Mesa {m.num}
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase transition-colors cursor-pointer"
        >
          Cerrar Ventana
        </button>
      </div>
    </div>
  );
}
