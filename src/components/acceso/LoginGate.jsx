// Pantalla de bloqueo: teclado de PIN
import { ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import logoUrl from '../../assets/logo.png';
import { useCompany } from '../../context/CompanyContext';
import { api } from '../../api';
import { splitBrand } from '../../utils/marca';

// === LOGIN GATE (PANTALLA DE BLOQUEO PREMIUM POR PIN) ===
export const LoginGate = ({ onLoginSuccess, onActivarClick, aviso }) => {
  const { empresa } = useCompany();
  const [brandMain, brandHighlight] = splitBrand(empresa.brandShort);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoSegundos, setBloqueadoSegundos] = useState(0);

  useEffect(() => {
    let timer;
    if (bloqueadoSegundos > 0) {
      timer = setInterval(() => {
        setBloqueadoSegundos(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [bloqueadoSegundos]);

  const handleKeyPress = (num) => {
    if (bloqueadoSegundos > 0) return;
    if (pin.length < 4) {
      const nuevo = pin + num;
      setPin(nuevo);
      setError('');
      if (nuevo.length === 4) handleSubmit(nuevo); // al cuarto dígito entra solo
    }
  };

  const handleBackspace = () => {
    if (bloqueadoSegundos > 0) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async (pinIngresado = pin) => {
    if (bloqueadoSegundos > 0) return;
    if (pinIngresado.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }
    setCargando(true);
    try {
      const res = await api.login(pinIngresado);
      if (res.error) {
        throw new Error(res.error);
      }
      setIntentosFallidos(0);
      onLoginSuccess(res.user);
    } catch (err) {
      if (err.codigo === 'DISPOSITIVO_NO_ACTIVADO' && onActivarClick) {
        onActivarClick(err.message || 'Este dispositivo no está activado. Actívalo con tu usuario y contraseña.');
        return;
      }
      const nuevosIntentos = intentosFallidos + 1;
      setIntentosFallidos(nuevosIntentos);
      if (nuevosIntentos >= 4) {
        setBloqueadoSegundos(30);
        setError('Demasiados intentos fallidos. Bloqueado por 30s');
      } else {
        setError(err.message || 'Error de conexión');
      }
      setPin('');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-3 sm:p-4 z-[9999] overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md md:max-w-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden my-auto transition-all duration-300">
        
        {/* LADO IZQUIERDO: Branding y Foto del Logo */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-800/80 md:w-1/2 shrink-0 relative overflow-hidden">
          {/* Brillo decorativo de fondo */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-3 sm:mb-5 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <img 
                src={logoUrl} 
                className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-2xl border-2 border-slate-700/60 object-contain bg-white/95 p-2 shadow-2xl shadow-cyan-500/20 transform transition duration-300 hover:scale-105" 
                alt={empresa.name} 
              />
            </div>
            
            <h1 className="text-white font-black text-xl sm:text-2xl md:text-3xl tracking-wide uppercase leading-tight flex items-center justify-center gap-2">
              <span className="text-white font-black tracking-wide">{brandMain}</span>
              {brandHighlight && <span className="text-cyan-400 font-extrabold tracking-widest">{brandHighlight}</span>}
            </h1>
            <p className="text-[10px] sm:text-xs text-cyan-300 font-bold uppercase tracking-widest mt-1.5 sm:mt-2 bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-400/25">
              {empresa.tagline || 'Sistema Gastronómico & Punto de Venta'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-3 sm:mt-4 max-w-xs">
              Sistema Inteligente de Gestión, Comandas y Punto de Venta
            </p>
          </div>
        </div>

        {/* LADO DERECHO: Formulario e Ingreso de PIN */}
        <div className="p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center md:w-1/2 bg-slate-900/90">
          <div className="text-center mb-6">
            <h2 className="text-white font-black text-lg md:text-xl uppercase tracking-tight">Acceso al Sistema</h2>
            <p className="text-slate-400 text-xs mt-1">Ingresa tu PIN personal de 4 dígitos</p>
          </div>

          {/* Indicadores de PIN */}
          <div className="flex gap-4 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pin.length > idx 
                    ? 'bg-cyan-400 border-cyan-400 scale-125 shadow-lg shadow-cyan-400/50' 
                    : 'bg-slate-800 border-slate-700'
                }`}
              ></div>
            ))}
          </div>

          {/* Mensaje de Error / Cargando */}
          <div className="min-h-[24px] mb-4 flex items-center justify-center">
            {error && <p className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-lg animate-shake">{error}</p>}
            {!error && !cargando && aviso && <p className="text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg text-center">{aviso}</p>}
            {cargando && <p className="text-xs text-cyan-400 font-bold animate-pulse flex items-center gap-2"><span>⏳</span> Validando PIN...</p>}
          </div>

          {/* Teclado Numérico */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num}
                onClick={() => handleKeyPress(num)}
                className="aspect-square bg-slate-800/80 hover:bg-slate-750 hover:border-cyan-400/50 text-white font-black text-2xl rounded-2xl border border-slate-700/80 transition-all active:scale-90 flex items-center justify-center shadow-md hover:shadow-cyan-400/20"
              >
                {num}
              </button>
            ))}
            <div className="aspect-square pointer-events-none" />
            <button 
              onClick={() => handleKeyPress(0)}
              className="aspect-square bg-slate-800/80 hover:bg-slate-750 hover:border-cyan-400/50 text-white font-black text-2xl rounded-2xl border border-slate-700/80 transition-all active:scale-90 flex items-center justify-center shadow-md hover:shadow-cyan-400/20"
            >
              0
            </button>
            <button 
              onClick={handleBackspace}
              className="aspect-square bg-slate-800/30 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-2xl transition-all active:scale-95 flex items-center justify-center uppercase tracking-wider border border-slate-800"
            >
              Borrar
            </button>

          </div>

          {onActivarClick && (
            <button
              type="button"
              onClick={() => onActivarClick()}
              className="mt-4 text-xs text-cyan-400/80 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1.5 py-1"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>¿Dispositivo nuevo? Activar equipo</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
