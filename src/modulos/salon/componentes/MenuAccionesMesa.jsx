// Acciones de la mesa que no son tomar el pedido (unir, precuenta, anular): van en un menú aparte
// para que no queden al lado de los botones que el mozo toca todo el tiempo.
import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Link2, Receipt, AlertTriangle, Lock } from 'lucide-react';

function Opcion({ icono: Icono, children, peligro, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full min-h-12 px-4 flex items-center gap-3 text-left text-[15px] font-bold active:bg-slate-100 cursor-pointer ${
        peligro ? 'text-rose-600' : 'text-slate-800'
      }`}
    >
      <Icono className="w-5 h-5 shrink-0" />
      {children}
    </button>
  );
}

export function MenuAccionesMesa({ mesa, onUnir, onPrecuenta, onAnular, onReclamo }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  const elegir = (accion) => () => { setAbierto(false); accion(); };
  const tienePedido = Boolean(mesa?.pedidoData);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más acciones de la mesa"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="w-11 h-11 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center active:scale-95 cursor-pointer"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 py-1.5 rounded-2xl bg-white shadow-2xl border border-slate-200 animate-fade-in">
          <Opcion icono={Link2} onClick={elegir(onUnir)}>Unir con otra mesa</Opcion>
          {tienePedido && <Opcion icono={Receipt} onClick={elegir(onPrecuenta)}>Imprimir precuenta</Opcion>}
          {tienePedido && (
            <>
              <div className="my-1.5 border-t border-slate-100" />
              {mesa.estado === 'Cocina'
                ? <Opcion icono={AlertTriangle} peligro onClick={elegir(onAnular)}>Anular todo el pedido</Opcion>
                : <Opcion icono={Lock} peligro onClick={elegir(onReclamo)}>Anulación especial (reclamo)</Opcion>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
