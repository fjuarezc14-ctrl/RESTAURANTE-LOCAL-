// Salón: título, mozo activo, wifi y filtros de mesas
import { Wifi, WifiOff } from 'lucide-react';

export function EncabezadoSalon({ isElevatedRole, mesas, setAdminMesasOpen, setNuevaMesaNum, wifiStatus }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Atención en Salón</h1>
          <p className="text-xs md:text-sm text-slate-500">Toca una mesa para tomar, editar o agregar un pedido adicional.</p>
        </div>
        {isElevatedRole && (
          <button
            onClick={() => {
              const nums = mesas.map(m => m.num).filter(n => !isNaN(n));
              const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
              setNuevaMesaNum(String(maxNum + 1));
              setAdminMesasOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-black text-[10px] md:text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all uppercase tracking-wider shrink-0"
          >
            ⚙️ Ajustes de Mesas
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Libre</div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div> Cocina</div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> Platos Listos</div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Servido</div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
          Sync BD Activo
        </div>
        {/* Semáforo Wi-Fi Local */}
        {wifiStatus === 'online' && (
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap" title="Conexión Wi-Fi excelente con el servidor local">
            <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="hidden sm:inline">Wi-Fi OK</span>
          </div>
        )}
        {wifiStatus === 'warning' && (
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-700 uppercase bg-amber-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm whitespace-nowrap" title="Señal Wi-Fi inestable o lenta">
            <Wifi className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            <span>Wi-Fi Lento</span>
          </div>
        )}
        {wifiStatus === 'offline' && (
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-red-700 uppercase bg-red-100 px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-300 shadow-sm whitespace-nowrap animate-bounce" title="Sin señal Wi-Fi. Acércate a la barra">
            <WifiOff className="w-3.5 h-3.5 text-red-600" />
            <span>Sin Wi-Fi</span>
          </div>
        )}
      </div>
    </div>
  );
}
