// Avisos flotantes de Caja: pedido listo, cancelado, operación exitosa o atención
import { X } from 'lucide-react';

export function AvisosCaja({ toasts, setToasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const isError = t.tipo === 'error';
        const isSuccess = t.tipo === 'success';
        const isWarning = t.tipo === 'warning';
        const borderClass = isError ? 'border-red-500/20' : isSuccess ? 'border-emerald-500/20' : isWarning ? 'border-amber-500/30' : 'border-blue-500/20';
        const gradientClass = isError ? 'from-red-500/10' : isSuccess ? 'from-emerald-500/10' : isWarning ? 'from-amber-500/10' : 'from-blue-500/10';
        const bgClass = isError ? 'bg-red-500 shadow-red-500/20' : isSuccess ? 'bg-emerald-500 shadow-emerald-500/20' : isWarning ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-500 shadow-blue-500/20';
        const icon = isError ? '🗑️' : isSuccess ? '✅' : isWarning ? '⏳' : '🛎️';
        const textTitle = isError ? 'Pedido Cancelado' : isSuccess ? 'Operación Exitosa' : isWarning ? 'Atención' : '¡Pedido Listo!';
        const titleColor = isError ? 'text-red-400' : isSuccess ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-blue-400';
        return (
          <div key={t.id} className={`pointer-events-auto bg-slate-900 border ${borderClass} text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up relative overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${gradientClass} to-transparent`}></div>
            <div className={`w-10 h-10 ${bgClass} rounded-xl flex items-center justify-center font-bold text-lg animate-bounce shrink-0 shadow-lg`}>
              {icon}
            </div>
            <div className="flex-1 pr-2 relative z-10">
              <h4 className={`font-black text-xs ${titleColor} uppercase tracking-widest leading-none mb-1`}>{textTitle}</h4>
              <p className="font-bold text-sm text-slate-100">{t.mensaje}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors relative z-10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
