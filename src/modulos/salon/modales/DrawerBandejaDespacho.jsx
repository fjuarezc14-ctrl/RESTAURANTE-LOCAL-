import React from 'react';
import { Bell, X, CheckCircle } from 'lucide-react';

/**
 * DrawerBandejaDespacho: Panel lateral que lista los platos listos para servir
 * organizados por mesas (priorizando las del mozo actual) y confirmación de entrega.
 */
export default function DrawerBandejaDespacho({
  abierto,
  onCerrar,
  platosListosDespacho = [],
  servirConfirm,
  setServirConfirm,
  sirviendo,
  setSirviendo,
  api,
  fetchMesas,
  aviso
}) {
  return (
    <>
      {/* DRAWER / PANEL LATERAL */}
      {abierto && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[270] flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-sm md:text-base uppercase tracking-tight leading-none">Bandeja de Despacho</h2>
                  <p className="text-[10px] text-indigo-200 mt-1 uppercase tracking-wider">Platos listos para servir</p>
                </div>
              </div>
              <button onClick={onCerrar} className="bg-indigo-700 hover:bg-red-500 p-2 rounded-xl transition-colors text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
              {platosListosDespacho.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                  <CheckCircle className="w-16 h-16 text-slate-300 mb-3" />
                  <p className="font-black uppercase tracking-wider text-sm">Bandeja Vacía</p>
                  <p className="text-xs text-slate-400 text-center mt-1">No hay platos ni bebidas pendientes de llevar a las mesas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const grupos = Object.entries(
                      platosListosDespacho.reduce((groups, item) => {
                        const key = item.mesaNum;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                        return groups;
                      }, {})
                    ).map(([mesaNum, items]) => ({ mesaNum, items, esMiMesa: items.some(i => i.esMiMesa) }));

                    const misMesas = grupos.filter(g => g.esMiMesa);
                    const otrasMesas = grupos.filter(g => !g.esMiMesa);

                    const renderGrupo = ({ mesaNum, items, esMiMesa }) => {
                      const primerItem = items[0];
                      const pedidoIds = [...new Set(items.map(i => i.pedidoId).filter(Boolean))];
                      return (
                        <div key={mesaNum} className={`border rounded-2xl p-4 shadow-sm transition-all ${
                          esMiMesa ? 'bg-white border-emerald-300 ring-1 ring-emerald-400/30' : 'bg-slate-200/70 border-slate-300 border-dashed'
                        }`}>
                          <div className={`flex justify-between items-center gap-2 mb-3 pb-2 border-b ${esMiMesa ? 'border-slate-100' : 'border-slate-300'}`}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className={`font-black text-sm md:text-base uppercase tracking-tight ${esMiMesa ? 'text-slate-900' : 'text-slate-600'}`}>Mesa {mesaNum}</h3>
                                {esMiMesa ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    ⭐ Mi Mesa
                                  </span>
                                ) : (
                                  <span className="bg-slate-300 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Otro mozo
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] mt-0.5 ${esMiMesa ? 'text-slate-400' : 'text-slate-500 font-bold'}`}>Mozo: {primerItem.mesero || 'Salón'}</p>
                            </div>
                            <button
                              onClick={() => setServirConfirm({
                                mesaNum,
                                items,
                                esMiMesa,
                                mesero: primerItem.mesero,
                                onConfirm: async () => {
                                  for (const pid of pedidoIds) {
                                    const res = await api.entregarTodoPedido(pid);
                                    if (res.error) throw new Error(res.error);
                                  }
                                },
                              })}
                              className={`font-black text-[11px] px-3 py-2 rounded-lg border transition-colors uppercase tracking-wider active:scale-95 shrink-0 ${
                                esMiMesa ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100' : 'bg-white/70 hover:bg-white text-slate-600 border-slate-300'
                              }`}
                            >
                              Servir Todo
                            </button>
                          </div>
                          <ul className="space-y-2">
                            {items.map((item, idx) => (
                              <li key={idx} className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${
                                esMiMesa ? 'bg-slate-50 border-slate-100' : 'bg-white/60 border-slate-300'
                              }`}>
                                <span className={`font-bold uppercase flex-1 pr-2 flex items-center gap-2 flex-wrap ${esMiMesa ? 'text-slate-800' : 'text-slate-600'}`}>
                                  <span className={`font-black ${esMiMesa ? 'text-indigo-600' : 'text-slate-500'}`}>{item.cant}x</span> {item.nombre}
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider ${
                                    item.estacion === 'Barra' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {item.estacion === 'Barra' ? '🍹 BARRA' : '🔥 COCINA'}
                                  </span>
                                </span>
                                <button
                                  onClick={() => setServirConfirm({
                                    mesaNum,
                                    items: [item],
                                    esMiMesa,
                                    mesero: primerItem.mesero,
                                    onConfirm: async () => {
                                      const res = await api.entregarItem(item.itemId);
                                      if (res.error) throw new Error(res.error);
                                    },
                                  })}
                                  className="p-2 bg-white hover:bg-emerald-500 hover:text-white border border-slate-200 rounded-lg text-slate-400 hover:border-emerald-500 transition-all active:scale-90 shrink-0"
                                  title="Marcar como Servido"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    };

                    return (
                      <>
                        {misMesas.map(renderGrupo)}
                        {otrasMesas.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 pt-2">
                              <div className="h-px bg-slate-300 flex-1"></div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mesas de otros mozos</span>
                              <div className="h-px bg-slate-300 flex-1"></div>
                            </div>
                            {otrasMesas.map(renderGrupo)}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ANTES DE MARCAR COMO SERVIDO */}
      {servirConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[280] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[85vh]">
            <div className="p-5 text-center shrink-0">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="font-black text-slate-900 text-base uppercase tracking-tight">¿Ya lo serviste?</h2>
              <p className="text-sm text-slate-500 mt-1">
                Confirma que llevaste a la <strong className="text-slate-900 text-lg">Mesa {servirConfirm.mesaNum}</strong>:
              </p>
              {!servirConfirm.esMiMesa && (
                <p className="mt-2 text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 uppercase tracking-wide">
                  ⚠️ Esta mesa la atiende {servirConfirm.mesero || 'otro mozo'}
                </p>
              )}
            </div>
            <ul className="px-5 space-y-1.5 overflow-y-auto custom-scrollbar">
              {servirConfirm.items.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-bold text-slate-800 uppercase">
                  <span className="font-black text-indigo-600">{item.cant}x</span>
                  <span className="flex-1">{item.nombre}</span>
                </li>
              ))}
            </ul>
            <div className="p-5 grid grid-cols-2 gap-3 shrink-0">
              <button
                type="button"
                disabled={sirviendo}
                onClick={() => setServirConfirm(null)}
                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-sm uppercase transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sirviendo}
                onClick={async () => {
                  setSirviendo(true);
                  try {
                    await servirConfirm.onConfirm();
                    setServirConfirm(null);
                    await fetchMesas();
                  } catch (err) {
                    aviso.error("Error al entregar: " + err.message);
                  } finally {
                    setSirviendo(false);
                  }
                }}
                className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-sm uppercase transition-colors shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                {sirviendo ? 'Guardando...' : 'Sí, servido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
