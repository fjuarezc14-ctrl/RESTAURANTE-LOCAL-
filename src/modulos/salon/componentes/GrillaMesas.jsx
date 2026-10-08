// Salón: cuadrícula de mesas con su estado
import { Bell, Receipt, ChefHat, CheckCircle, Link2 } from 'lucide-react';

export function GrillaMesas({ abrirModal, activeMeseroName, esMesaCompartida, isElevatedRole, mesas, mesasUnidasA }) {
  return (
    <div className="grid-mesas-dinamico gap-3 md:gap-5 pb-20 md:pb-0">
      {mesas.map((m, idx) => {
        const esMiMesa = m.pedidoData?.mesero === activeMeseroName || isElevatedRole || esMesaCompartida(m.pedidoData?.mesero);
        const tieneListos = esMiMesa && (m.pedidoData?.items?.some(i => 
          i.historial && 
          !i.entregado
        ) || false);

        let colorBg = 'bg-white hover:bg-emerald-50', colorText = 'text-emerald-500', colorBorder = 'border-slate-200', Icon = Receipt;

        if (tieneListos) {
          colorBg = 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-400 shadow-lg';
          colorText = 'text-indigo-600';
          colorBorder = 'border-indigo-400';
          Icon = Bell;
        } else if (m.estado === 'Cocina') { 
          colorBg = 'bg-amber-50'; colorText = 'text-cyan-500'; colorBorder = 'border-amber-300 shadow-md'; Icon = ChefHat; 
        } else if (m.estado === 'Servido') { 
          colorBg = 'bg-blue-50'; colorText = 'text-blue-500'; colorBorder = 'border-blue-300 shadow-md'; Icon = CheckCircle; 
        } else if (m.estado && m.estado.startsWith("Unida a ")) {
          colorBg = 'bg-slate-50/70 border-dashed opacity-80'; colorText = 'text-slate-400'; colorBorder = 'border-slate-300 border-dashed'; Icon = Link2;
        }

        return (
          <div key={idx} onClick={() => abrirModal(m)} className={`relative rounded-2xl md:rounded-3xl border-2 ${colorBorder} ${colorBg} p-3 md:p-5 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 hover:-translate-y-1 aspect-square md:aspect-auto md:h-40 group`}>
            {tieneListos && (
              <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1.5 animate-bounce shadow-md" title="¡Platos listos en cocina!">
                <Bell className="w-3.5 h-3.5 animate-ring" />
              </div>
            )}
            <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center ${colorText} mb-1 md:mb-2 bg-white shadow-sm border border-slate-100`}>
              <Icon className="w-4 h-4 md:w-6 md:h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-sm md:text-lg uppercase tracking-tight">Mesa {m.num}</h3>
            {m.estado && m.estado.startsWith("Unida a ") ? (
              <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full mt-1.5">
                🔗 {m.estado}
              </span>
            ) : null}
            {!(m.estado && m.estado.startsWith("Unida a ")) && mesasUnidasA(m.num).length > 0 && (
              <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full" title="Mesas unidas a esta">
                🔗 +{mesasUnidasA(m.num).map(u => u.num).join(', ')}
              </span>
            )}
            {m.estado && m.estado.startsWith("Unida a ") ? null : m.pedidoData ? (
              <div className="flex flex-col items-center">
                <p className="font-mono font-black text-sm md:text-lg mt-1 text-slate-800">S/ {m.pedidoData.total.toFixed(2)}</p>
                <span className="text-[8px] md:text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1.5 uppercase truncate max-w-[110px] text-center">
                  👤 {m.pedidoData.mesero}
                </span>
              </div>
            ) : (
              <p className="text-[10px] md:text-xs mt-1 text-slate-400 font-medium">Disponible</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
