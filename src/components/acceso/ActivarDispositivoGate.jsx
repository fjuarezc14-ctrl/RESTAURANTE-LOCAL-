// Activación del equipo con usuario o correo y contraseña
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import logoUrl from '../../assets/logo.png';
import { useCompany } from '../../context/CompanyContext';
import { api } from '../../api';
import { splitBrand } from '../../utils/marca';

// === PANTALLA DE ACTIVACIÓN DE DISPOSITIVOS (USUARIO/CORREO + CONTRASEÑA) ===
export const ActivarDispositivoGate = ({ onLoginSuccess, onVolverPin, aviso }) => {
  const { empresa } = useCompany();
  const [brandMain, brandHighlight] = splitBrand(empresa.brandShort);
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [nombreDispositivo, setNombreDispositivo] = useState(() => {
    const esMovil = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
    return esMovil ? 'Tablet Mozo' : 'Terminal Caja';
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!usuario.trim()) {
      setError('Ingresa tu usuario o correo.');
      return;
    }
    if (!contrasena) {
      setError('Ingresa tu contraseña.');
      return;
    }
    if (!nombreDispositivo.trim()) {
      setError('Ingresa un nombre para este dispositivo.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const res = await api.activarDispositivo({
        usuario: usuario.trim(),
        contrasena,
        nombreDispositivo: nombreDispositivo.trim(),
      });
      if (res && res.usuario) {
        onLoginSuccess(res.usuario);
      } else {
        throw new Error('Respuesta inválida al activar el dispositivo');
      }
    } catch (err) {
      setError(err.message || 'Error al activar el dispositivo. Verifica tus credenciales.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-3 sm:p-4 z-[9999] overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md md:max-w-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden my-auto transition-all duration-300">
        
        {/* LADO IZQUIERDO: Branding */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-800/80 md:w-1/2 shrink-0 relative overflow-hidden">
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
              Vincular dispositivo a la red del restaurante por 180 días
            </p>
          </div>
        </div>

        {/* LADO DERECHO: Formulario de Activación */}
        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center md:w-1/2 bg-slate-900/90">
          <div className="text-center md:text-left mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Activación de Dispositivo
            </div>
            <h2 className="text-white font-black text-lg md:text-xl uppercase tracking-tight">Vincular este equipo</h2>
            <p className="text-slate-400 text-xs mt-1">Ingresa las credenciales del administrador para autorizar esta pantalla.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Usuario o Correo
              </label>
              <input
                type="text"
                autoComplete="username"
                value={usuario}
                onChange={(e) => { setUsuario(e.target.value); setError(''); }}
                placeholder="ej. admin o correo@empresa.com"
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-400 text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => { setContrasena(e.target.value); setError(''); }}
                  placeholder="Contraseña del usuario"
                  className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-400 text-white text-sm rounded-xl pl-3.5 pr-10 py-2.5 outline-none transition-all placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave(!mostrarClave)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                >
                  {mostrarClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Nombre de este equipo
              </label>
              <input
                type="text"
                value={nombreDispositivo}
                onChange={(e) => { setNombreDispositivo(e.target.value); setError(''); }}
                placeholder="ej. Tablet Mozo 1, Caja Principal"
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-400 text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Mensajes de aviso / error */}
            {error && (
              <p className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-center">
                {error}
              </p>
            )}
            {!error && aviso && (
              <p className="text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-center">
                {aviso}
              </p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Vinculando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Activar y Entrar</span>
                </>
              )}
            </button>

            {onVolverPin && (
              <button
                type="button"
                onClick={onVolverPin}
                className="w-full text-center text-xs text-slate-400 hover:text-cyan-300 font-semibold py-1.5 transition-colors"
              >
                ← Volver al teclado de PIN
              </button>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};
