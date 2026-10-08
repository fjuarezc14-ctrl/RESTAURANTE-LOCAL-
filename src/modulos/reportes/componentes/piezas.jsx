// Piezas de dibujo de Reportes: panel con título, tarjeta de KPI, contador, estado vacío, botón de ticket y hoja de detalle
import { Printer, X } from 'lucide-react';
import { Dialog } from '../../../components/ui';

export const panel = ({ titulo, subtitulo, Icon, color, derecha, children, sinPadding }) => (
  <section className="bg-white rounded-2xl border border-slate-200/70 min-w-0">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${color}`}><Icon className="w-4 h-4" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-400 truncate">{subtitulo}</p>}
        </div>
      </div>
      {derecha}
    </div>
    <div className={sinPadding ? '' : 'p-4 sm:p-5'}>{children}</div>
  </section>
);

export const kpi = ({ label, valor, hint, Icon, color, borde, valorClase = 'text-slate-900', extra }) => (
  <div key={label} className={`rounded-2xl border border-slate-200/70 border-t-4 ${borde} bg-white p-4 min-w-0`}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${color}`}><Icon className="w-4 h-4" /></span>
    </div>
    <p className={`mt-1 text-lg sm:text-xl font-semibold font-mono tabular-nums truncate ${valorClase}`}>{valor}</p>
    {hint && <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>}
    {extra}
  </div>
);

export const chipCount = (n, color) => (
  <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 shrink-0 ${color}`}>{n}</span>
);

export const vacio = (texto) => <p className="px-5 py-10 text-center text-sm text-slate-400">{texto}</p>;

export const botonTicket = (onClick, label = 'Ticket') => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors shrink-0"
  >
    <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
  </button>
);

export const modalDetalle = (onClose, header, body, footer) => (
  <Dialog open onClose={onClose} capa="z-[200]" className="bg-white w-full sm:max-w-lg max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
      <div className="min-w-0">{header}</div>
      <button type="button" onClick={onClose} className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
        <X className="w-5 h-5" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">{body}</div>
    {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">{footer}</div>}
  </Dialog>
);
