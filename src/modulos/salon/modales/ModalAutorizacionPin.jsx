import { Lock, Check } from 'lucide-react';

/**
 * Modal de teclado PIN para autorización de supervisor/admin en acciones restringidas de salón
 */
export default function ModalAutorizacionPin({
  abierto,
  promptText = '',
  pin = '',
  error = '',
  onPinChange,
  onCerrar,
  onSubmit,
}) {
  if (!abierto) return null;

  const handleKeyPress = (num) => {
    if (pin.length < 6) {
      onPinChange(pin + num);
    }
  };

  const handleBackspace = () => {
    onPinChange(pin.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center animate-slide-up">
        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 mb-3 shadow-lg shadow-amber-500/20">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="font-black text-white text-base uppercase tracking-tight text-center leading-none">
          Autorización de Supervisor
        </h3>
        {promptText && (
          <p className="text-[10px] text-amber-400 font-mono uppercase tracking-widest text-center mt-2 font-bold bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/20">
            Acción: {promptText}
          </p>
        )}

        {/* Input PIN */}
        <div className="w-full mt-4 mb-2">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 text-center mb-1.5">
            Ingresa el PIN de Admin / Cajero:
          </label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit(pin);
              if (e.key === 'Escape') onCerrar();
            }}
            placeholder="••••"
            className="w-full bg-slate-800 border-2 border-amber-500/40 focus:border-amber-500 rounded-2xl px-4 py-3 text-center text-2xl font-mono font-black tracking-[0.4em] text-white focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
          />
        </div>

        {/* Error */}
        <div className="min-h-[24px] mb-2 text-center w-full">
          {error && (
            <p className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-xl">
              {error}
            </p>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="aspect-square bg-slate-800 hover:bg-slate-700 text-white font-black text-xl rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center shadow-sm cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={onCerrar}
            className="aspect-square bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center uppercase tracking-wider border border-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress(0)}
            className="aspect-square bg-slate-800 hover:bg-slate-700 text-white font-black text-xl rounded-xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center shadow-sm cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="aspect-square bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center uppercase tracking-wider border border-slate-800 cursor-pointer"
          >
            Borrar
          </button>
        </div>

        {/* Botón Validar */}
        <button
          type="button"
          onClick={() => onSubmit(pin)}
          disabled={!pin}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black uppercase tracking-wider text-xs rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Validar y Autorizar
        </button>
      </div>
    </div>
  );
}
