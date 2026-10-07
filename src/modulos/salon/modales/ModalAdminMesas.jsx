import { Settings, X, PlusCircle, Plus, ChefHat, Utensils, Save, Trash2 } from 'lucide-react';

/**
 * ModalAdminMesas: Modal para administradores y supervisores para crear, renombrar
 * y eliminar mesas físicas del salón.
 */
export default function ModalAdminMesas({
  abierto,
  onCerrar,
  handleCrearMesa,
  nuevaMesaNum,
  setNuevaMesaNum,
  mesas = [],
  editandoMesas = {},
  setEditandoMesas,
  handleEditarMesa,
  handleEliminarMesa
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[230] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base uppercase tracking-tight leading-none">Administrar Mesas</h2>
              <p className="text-xs text-slate-400 mt-1">Crear, editar o eliminar mesas del salón</p>
            </div>
          </div>
          <button 
            onClick={onCerrar} 
            className="bg-slate-800 hover:bg-red-500 hover:text-white text-slate-300 p-2.5 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {/* Crear nueva mesa */}
          <form onSubmit={handleCrearMesa} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-amber-500" /> Agregar Nueva Mesa
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <input 
                  type="number" 
                  value={nuevaMesaNum}
                  onChange={(e) => setNuevaMesaNum(e.target.value)}
                  placeholder="Número de mesa" 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                  min="1"
                />
              </div>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase text-xs tracking-wider rounded-xl transition-colors shadow-md shadow-amber-500/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          </form>
          
          {/* Listado de mesas */}
          <div>
            <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-3 px-1">Mesas Existentes</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {mesas.map((m) => {
                const ocupada = m.estado !== 'Libre';
                const numActual = m.num;
                const valEdit = editandoMesas[numActual] !== undefined ? editandoMesas[numActual] : numActual;
                
                return (
                  <div key={numActual} className="flex items-center justify-between p-3 bg-white border border-slate-150 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${ocupada ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500'} flex items-center justify-center text-xs font-bold`}>
                        {ocupada ? <ChefHat className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Mesa:</span>
                        <input 
                          type="number" 
                          value={valEdit}
                          disabled={ocupada}
                          onChange={(e) => {
                            setEditandoMesas(prev => ({
                              ...prev,
                              [numActual]: e.target.value
                            }));
                          }}
                          min="1" 
                          className={`w-20 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:outline-none ${
                            ocupada 
                              ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed' 
                              : 'bg-white border border-slate-200 text-slate-800 focus:border-amber-500'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ocupada ? (
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-250 uppercase mr-1 animate-pulse">Ocupada</span>
                      ) : (
                        <>
                          <button 
                            type="button"
                            onClick={() => handleEditarMesa(numActual)}
                            className="p-2 text-emerald-600 hover:text-white hover:bg-emerald-500 border border-emerald-250 hover:border-emerald-500 rounded-lg transition-colors cursor-pointer"
                            title="Guardar Número"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleEliminarMesa(numActual)}
                            className="p-2 text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Mesa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
