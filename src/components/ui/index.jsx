// Componentes base al estilo shadcn/ui (Tailwind puro, sin dependencias extra)
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

const VARIANTES_BOTON = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/20',
  primary: 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm shadow-amber-500/20',
  destructive: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-600/20',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const TAMANOS_BOTON = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
};

export function Button({ variant = 'default', size = 'md', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-bold transition-all active:scale-[0.97] cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTES_BOTON[variant],
        TAMANOS_BOTON[size],
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900',
        'placeholder:font-normal placeholder:text-slate-400 transition-all',
        'focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100',
        className
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }) {
  return <label className={cn('mb-1.5 block text-sm font-bold text-slate-700', className)} {...props} />;
}

export function Card({ className, ...props }) {
  return <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)} {...props} />;
}

export function Badge({ className, ...props }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', className)} {...props} />;
}

// Diálogo modal: cierra con Escape o tocando el fondo (desactivable en formularios largos)
// capa: clases extra de la capa (z-index, impresion-ventana...); el resto de props (id, onPointerDown...) va a la capa
// Con un diálogo encima de otro (confirmar cobro sobre el cobro), Escape cierra solo el de arriba
const pilaDialogos = [];

export function Dialog({ open, onClose, closeOnBackdrop = true, capa = 'z-50', className, children, ...resto }) {
  // onClose suele ser una función nueva en cada render: se lee de una referencia para no reordenar la pila
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const propio = {};
    pilaDialogos.push(propio);
    const onKey = (e) => {
      if (e.key === 'Escape' && pilaDialogos[pilaDialogos.length - 1] === propio) onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      pilaDialogos.splice(pilaDialogos.indexOf(propio), 1);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      {...resto}
      className={cn('fixed inset-0 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in', capa)}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={cn('relative flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl', className)}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ icon: Icon, iconClassName, title, onClose, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', iconClassName)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-900">{title}</h3>
          {children}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4', className)} {...props} />;
}

export { AvisoProvider } from './AvisoContext';
export { useAviso, useConfirmar, usePedirDato, useNotificaciones, mostrarAvisoGlobal } from './avisos';
