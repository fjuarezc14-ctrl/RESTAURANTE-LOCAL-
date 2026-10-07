import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, LayoutGrid, ChefHat, GlassWater, Calculator, PieChart, BookOpen, UsersRound, Menu, X, ChevronRight, LogOut, Lock, Wallet, Tags, Building2, Share2, Copy, Check as CheckIcon, Wifi, Maximize, Minimize, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import logoUrl from './assets/logo.png';
import { useCompany } from './context/CompanyContext';
import { api, esErrorDeSesion, onSesionPerdida } from './api';
import { generateOfflineQrUrl } from './utils/qrOffline';

// Carga bajo demanda (code-splitting) de páginas
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SalonPage = lazy(() => import('./pages/SalonPage'));
const CocinaPage = lazy(() => import('./pages/CocinaPage'));
const BarraPage = lazy(() => import('./pages/BarraPage'));
const CajaPage = lazy(() => import('./pages/CajaPage'));
const ComprasPage = lazy(() => import('./pages/ComprasPage'));
const ReportesPage = lazy(() => import('./pages/ReportesPage'));
const CartaPage = lazy(() => import('./pages/CartaPage'));
const CategoriasPage = lazy(() => import('./pages/CategoriasPage'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'));
const CreditosPage = lazy(() => import('./pages/CreditosPage'));
const ConfiguracionPage = lazy(() => import('./pages/ConfiguracionPage'));
import { useAviso } from './components/ui';

// === SESIÓN ===
// La sesión vive en sessionStorage: al cerrar la pestaña/navegador hay que volver a poner el PIN.
// En celulares el navegador mantiene la pestaña viva por días, así que además se cierra
// por inactividad (salvo en el monitor de cocina, que queda fijo todo el día).
const SESSION_KEY = 'currentUser';
const ACTIVIDAD_KEY = 'ultimaActividad';
const INACTIVIDAD_MS = 5 * 60 * 1000;
const AVISO_INACTIVIDAD_MS = 30 * 1000;
const ROLES_SIN_CIERRE_POR_INACTIVIDAD = ['Cocinero'];

const guardarSesion = (user) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
const borrarSesion = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ACTIVIDAD_KEY);
};
const leerUltimaActividad = () => Number(sessionStorage.getItem(ACTIVIDAD_KEY)) || 0;
const aplicaInactividad = (user) => !!user && !ROLES_SIN_CIERRE_POR_INACTIVIDAD.includes(user.rol);

// === PANTALLA COMPLETA (celulares Android de los mozos) ===
// Se recuerda la preferencia en el dispositivo: si el navegador sale solo de la pantalla
// completa (gesto de atrás, cambio de app), se vuelve a activar con el siguiente toque.
// Solo el botón la desactiva de forma definitiva.
const PANTALLA_COMPLETA_KEY = 'pantallaCompleta';
const pantallaCompletaSoportada = () => !!document.documentElement.requestFullscreen;
const quierePantallaCompleta = () => localStorage.getItem(PANTALLA_COMPLETA_KEY) === '1';
const entrarPantallaCompleta = () => {
  if (document.fullscreenElement || !pantallaCompletaSoportada()) return Promise.resolve();
  return document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
};

const BotonPantallaCompleta = () => {
  const [activa, setActiva] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const actualizar = () => setActiva(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', actualizar);
    return () => document.removeEventListener('fullscreenchange', actualizar);
  }, []);

  if (!pantallaCompletaSoportada()) return null;

  const alternar = () => {
    if (document.fullscreenElement) {
      localStorage.removeItem(PANTALLA_COMPLETA_KEY);
      document.exitFullscreen().catch(() => {});
    } else {
      localStorage.setItem(PANTALLA_COMPLETA_KEY, '1');
      entrarPantallaCompleta();
    }
  };

  return (
    <button
      type="button"
      onClick={alternar}
      title={activa ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className={`p-2 rounded-xl border transition-all active:scale-90 shrink-0 ${
        activa ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
      }`}
    >
      {activa ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
    </button>
  );
};

// === PROTECTED ROUTE NAVIGATION GUARD ===
const ProtectedRoute = ({ children, permission, currentUser }) => {
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  
  const hasAccess = isAdmin || userPermissions.includes(permission) ||
    ((permission === 'Carta' || permission === 'Categorias') && userPermissions.includes('Dashboard')) ||
    (permission === 'Creditos' && userPermissions.includes('Caja'));

  if (!hasAccess) {
    // Si no tiene permisos para esta ruta ni para nada más, o evitar bucle
    const validPermitted = userPermissions.filter(p => p !== 'Usuarios');
    if (validPermitted.length === 0) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-rose-500 mb-2">Acceso Restringido</h2>
            <p className="text-slate-400 text-sm mb-6">Tu usuario no cuenta con permisos asignados para acceder a ningún módulo.</p>
            <button 
              onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-2.5 rounded-xl uppercase text-xs tracking-wider transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      );
    }
    const firstPermitted = validPermitted[0];
    const pathToRedirect = 
      firstPermitted === 'Dashboard' ? '/' :
      firstPermitted === 'Salon' ? '/salon' :
      firstPermitted === 'Cocina' ? '/cocina' :
      firstPermitted === 'Barra' ? '/barra' :
      firstPermitted === 'Caja' ? '/caja' :
      firstPermitted === 'Creditos' ? '/creditos' :
      firstPermitted === 'Compras' ? '/compras' :
      firstPermitted === 'Reportes' ? '/reportes' :
      firstPermitted === 'Carta' ? '/carta' :
      firstPermitted === 'Categorias' ? '/categorias' : '/';
    return <Navigate to={pathToRedirect} replace />;
  }
  return children;
};

// === PANTALLA DE ACTIVACIÓN DE DISPOSITIVOS (USUARIO/CORREO + CONTRASEÑA) ===
const ActivarDispositivoGate = ({ onLoginSuccess, onVolverPin, aviso }) => {
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

// === LOGIN GATE (PANTALLA DE BLOQUEO PREMIUM POR PIN) ===
const LoginGate = ({ onLoginSuccess, onActivarClick, aviso }) => {
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
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    if (bloqueadoSegundos > 0) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (bloqueadoSegundos > 0) return;
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }
    setCargando(true);
    try {
      const res = await api.login(pin);
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

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

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

// === COMPONENTE PUERTA DE AUTENTICACIÓN (PIN O ACTIVACIÓN) ===
const AuthGate = ({ onLoginSuccess, aviso, inicialModo = 'pin' }) => {
  const [modo, setModo] = useState(inicialModo);
  const [mensajeModo, setMensajeModo] = useState(aviso);

  useEffect(() => {
    if (aviso) setMensajeModo(aviso);
  }, [aviso]);

  if (modo === 'activar') {
    return (
      <ActivarDispositivoGate
        onLoginSuccess={onLoginSuccess}
        onVolverPin={() => setModo('pin')}
        aviso={mensajeModo}
      />
    );
  }

  return (
    <LoginGate
      onLoginSuccess={onLoginSuccess}
      aviso={mensajeModo}
      onActivarClick={(msg) => {
        if (msg) setMensajeModo(msg);
        setModo('activar');
      }}
    />
  );
};

// === COMPONENTS ===
// Divide la marca para resaltar la última palabra (ej. "VALETEC GOURMET" → VALETEC + GOURMET)
function splitBrand(brand) {
  const words = String(brand || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || '', ''];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

// Muestra las direcciones con las que los mozos entran desde su celular (se consultan al abrir,
// así siempre reflejan la IP actual de la PC aunque el router se la haya cambiado).
const ModalCompartirDireccion = ({ onClose }) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    let vigente = true;
    api.getDireccionesRed()
      .then(res => {
        if (!vigente) return;
        if (res?.error || !res?.urls) setError('No se pudieron obtener las direcciones.');
        else setDatos(res);
      })
      .catch(() => vigente && setError('No se pudieron obtener las direcciones.'));
    return () => { vigente = false; };
  }, []);

  const copiar = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): selección manual como respaldo
      const tmp = document.createElement('textarea');
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }
    setCopiado(url);
    setTimeout(() => setCopiado(''), 2000);
  };

  // Si la app ya se abrió con una IP/host de la red, esa dirección es la correcta.
  // El puerto es el de la app abierta (en desarrollo difiere del backend).
  const hostActual = window.location.hostname;
  const esLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostActual);
  const puerto = window.location.port || datos?.puerto;
  const aUrl = (host) => `${window.location.protocol}//${host}${puerto ? `:${puerto}` : ''}`;
  const ipsDetectadas = datos?.ips || (datos?.urls || []).map(u => ({ ip: new URL(u).hostname, virtual: false }));
  const principal = datos ? (!esLocal ? aUrl(hostActual) : (ipsDetectadas[0] ? aUrl(ipsDetectadas[0].ip) : null)) : null;
  const otras = ipsDetectadas
    .map(i => ({ ...i, url: aUrl(i.ip) }))
    .filter(i => i.url !== principal);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" /> Dirección para los mozos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}
          {!datos && !error && <p className="text-xs text-slate-400 animate-pulse">Buscando direcciones...</p>}

          {datos && (
            <>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                El celular debe estar en el <strong className="text-slate-200">mismo WiFi</strong> que esta PC.
                Escanea el código o copia el enlace y envíaselo.
              </p>

              {principal && (
                <div className="flex justify-center">
                  <img src={generateOfflineQrUrl(principal, 160)} alt="Código QR de acceso" className="bg-white p-2 rounded-xl w-40 h-40" />
                </div>
              )}

              <div className="space-y-2">
                {principal && (
                  <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/40 rounded-xl px-3 py-2.5">
                    <span className="flex-1 text-sm font-mono font-bold text-cyan-300 truncate">{principal}</span>
                    <button
                      onClick={() => copiar(principal)}
                      className="shrink-0 px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      {copiado === principal ? <><CheckIcon className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </button>
                  </div>
                )}
                {!principal && (
                  <p className="text-xs text-amber-400 font-bold">Esta PC no está conectada a ninguna red WiFi o cable.</p>
                )}
                {otras.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[11px] text-slate-400 hover:text-slate-200 select-none">
                      ▸ Otras direcciones de esta PC ({otras.length}) · úsalas solo si la principal no abre
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {otras.map(o => (
                        <div key={o.url} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-1.5">
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-mono text-slate-300 truncate">{o.url}</span>
                            {o.interfaz && <span className="block text-[10px] text-slate-500 truncate">{o.interfaz}{o.virtual ? ' · adaptador virtual' : ''}</span>}
                          </span>
                          <button
                            onClick={() => copiar(o.url)}
                            className="shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                          >
                            {copiado === o.url ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
                Si el enlace deja de funcionar, es porque el router le cambió la IP a esta PC. Vuelve a abrir esta
                ventana para ver la nueva, o pídele a tu proveedor de internet que le fije una IP siempre igual.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ isOpen, toggleSidebar, currentUser, onLogout, modoInstalacion = 'local' }) => {
  const location = useLocation();
  const { empresa } = useCompany();
  const [brandMain, brandHighlight] = splitBrand(empresa.brandShort);
  const [compartirAbierto, setCompartirAbierto] = useState(false);

  // Mapeo dinámico de permisos para visualización
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'Dashboard' },
    { path: '/salon', icon: LayoutGrid, label: 'Salón / Mesas', permission: 'Salon' },
    { path: '/cocina', icon: ChefHat, label: 'Cocina / Pedidos', permission: 'Cocina' },
    { path: '/barra', icon: GlassWater, label: 'Barra / Bebidas', permission: 'Barra' },
    { path: '/caja', icon: Calculator, label: 'Caja / Cobros', permission: 'Caja' },
    { path: '/creditos', icon: Wallet, label: 'Créditos / Clientes', permission: 'Creditos' },
    { path: '/compras', icon: BookOpen, label: 'Compras / Gastos', permission: 'Compras' },
    { path: '/reportes', icon: PieChart, label: 'Reportes', permission: 'Reportes' },
    { path: '/carta', icon: BookOpen, label: 'Carta e Inventario', permission: 'Carta' },
    { path: '/categorias', icon: Tags, label: 'Categorías', permission: 'Categorias' },
  ];

  // Filtrar ítems según permisos del usuario activo o si es administrador (retrocompatible)
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  const hasItemPermission = (perm) => {
    if (isAdmin) return true;
    if (userPermissions.includes(perm)) return true;
    if ((perm === 'Carta' || perm === 'Categorias') && userPermissions.includes('Dashboard')) return true;
    if (perm === 'Creditos' && userPermissions.includes('Caja')) return true;
    return false;
  };
  const filteredItems = menuItems.filter(item => hasItemPermission(item.permission));

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden ${isOpen ? 'block' : 'hidden'}`}
        onClick={toggleSidebar}
      ></div>

      <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-slate-900 text-slate-400 flex flex-col shadow-2xl z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="p-5 flex items-center justify-between md:justify-start gap-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src={logoUrl} 
              className="w-11 h-11 rounded-xl border border-slate-700/60 object-contain bg-white/95 p-1 shrink-0 shadow-lg shadow-cyan-500/20" 
              alt={empresa.name} 
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-black text-sm tracking-wide uppercase leading-none">{brandMain}</span>
                {brandHighlight && <span className="text-cyan-400 font-extrabold text-xs tracking-wider uppercase leading-none">{brandHighlight}</span>}
              </div>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-1 leading-none">
                POS & Restaurante
              </span>
            </div>
          </div>
          <button onClick={toggleSidebar} className="text-slate-400 hover:text-white md:hidden p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 mt-4 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }}
                className={`sidebar-item flex items-center gap-3 p-3 text-sm ${isActive ? 'sidebar-active' : ''}`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </Link>
            )
          })}
          {(userPermissions.includes('Usuarios') || isAdmin) && (
            <div className="my-4 border-t border-slate-800 mx-4"></div>
          )}
          {userPermissions.includes('Usuarios') && (
            <Link to="/usuarios" onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }} className={`sidebar-item flex items-center gap-3 p-3 text-sm ${location.pathname === '/usuarios' ? 'sidebar-active' : ''}`}><UsersRound className="w-5 h-5"/> Personal y Accesos</Link>
          )}
          {isAdmin && (
            <Link to="/configuracion" onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }} className={`sidebar-item flex items-center gap-3 p-3 text-sm ${location.pathname === '/configuracion' ? 'sidebar-active' : ''}`}><Building2 className="w-5 h-5"/> Datos de Empresa</Link>
          )}
        </nav>

        {/* Footer del usuario logueado */}
        <div className="p-4 border-t border-slate-800 shrink-0 flex flex-col gap-3 bg-slate-950/20">
          <div className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-xl border border-slate-800/50">
            <div className="w-8 h-8 bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center text-xs font-black shrink-0">
              {currentUser?.nombre?.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-xs truncate flex-1">
              <p className="text-white font-bold">{currentUser?.nombre}</p>
              <p className="text-cyan-400 font-mono text-[10px] uppercase font-black">{currentUser?.rol}</p>
            </div>
          </div>
          {modoInstalacion !== 'web' && (
            <button
              onClick={() => setCompartirAbierto(true)}
              className="w-full py-2 bg-slate-800 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/20 border border-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Compartir dirección
            </button>
          )}
          <button 
            onClick={onLogout}
            className="w-full py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {modoInstalacion !== 'web' && compartirAbierto && <ModalCompartirDireccion onClose={() => setCompartirAbierto(false)} />}
    </>
  );
};

const Header = ({ toggleSidebar, title, currentUser }) => (
  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 md:px-8 z-10 shrink-0">
    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
      <button onClick={toggleSidebar} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden shrink-0">
        <Menu className="w-6 h-6" />
      </button>
      <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 text-xs sm:text-sm font-medium truncate">
        <span className="hidden sm:inline">Sistema</span>
        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:inline shrink-0" />
        <span className="text-slate-900 font-black truncate">{title || 'Punto de Cobro'}</span>
      </div>
    </div>
    
    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider hidden lg:inline">Usuario Activo: <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{currentUser?.nombre} ({currentUser?.rol})</strong></span>
      <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="hidden sm:inline">Sync BD Activo</span>
        <span className="sm:hidden">Sync BD</span>
      </div>
      <BotonPantallaCompleta />
    </div>
  </header>
);

const Layout = ({ children, title, currentUser, onLogout, modoInstalacion }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 relative">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} currentUser={currentUser} onLogout={onLogout} modoInstalacion={modoInstalacion} />
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={title} currentUser={currentUser} />
        {children}
      </main>
    </div>
  );
};

// === APP MAIN ENTRY ===
function App() {
  const aviso = useAviso();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [necesitaActivacion, setNecesitaActivacion] = useState(false);
  const [avisoLogin, setAvisoLogin] = useState('');
  const [segundosParaCierre, setSegundosParaCierre] = useState(null);
  const [modoInstalacion, setModoInstalacion] = useState('local');
  const ultimaEscrituraRef = useRef(0);

  // Obtener modo de instalación (local vs web)
  useEffect(() => {
    api.getMarcaAuth().then(res => {
      if (res?.modoInstalacion) {
        setModoInstalacion(res.modoInstalacion);
      }
    }).catch(() => {});
  }, []);

  // Reactivar la pantalla completa con el primer toque si el mozo la dejó activada
  // (el navegador exige un toque del usuario; no se puede activar sola al abrir).
  useEffect(() => {
    const reactivar = () => {
      if (quierePantallaCompleta() && !document.fullscreenElement) entrarPantallaCompleta();
    };
    window.addEventListener('click', reactivar, true);
    return () => window.removeEventListener('click', reactivar, true);
  }, []);

  useEffect(() => {
    const initSession = async () => {
      // Sesiones antiguas guardadas de forma permanente: ya no se reutilizan
      localStorage.removeItem(SESSION_KEY);

      // 1. Validar sesión activa en el backend mediante cookie httpOnly (/api/auth/yo)
      try {
        const sesionActual = await api.getSesionYo();
        if (sesionActual && sesionActual.usuario) {
          const user = sesionActual.usuario;
          setCurrentUser(user);
          guardarSesion(user);
          setLoading(false);
          return;
        }
      } catch (err) {
        if (err.codigo === 'DISPOSITIVO_NO_ACTIVADO') {
          setNecesitaActivacion(true);
          borrarSesion();
          setCurrentUser(null);
          setLoading(false);
          return;
        }
      }

      // 2. Si no hay sesión httpOnly activa o está offline, verificar sessionStorage
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const ultima = leerUltimaActividad();
          if (aplicaInactividad(parsed) && ultima && Date.now() - ultima >= INACTIVIDAD_MS) {
            borrarSesion();
            setAvisoLogin('Tu sesión se cerró por inactividad. Ingresa tu PIN.');
            setLoading(false);
            return;
          }
        } catch { /* se valida abajo */ }
      }
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            // Validar directamente contra el servidor
            const status = await api.checkUserStatus(parsed.id);
            if (!status || !status.exists || !status.activo) {
              borrarSesion();
              setCurrentUser(null);
            } else if (parsed.pinSignature && status.pinSignature && parsed.pinSignature !== status.pinSignature) {
              borrarSesion();
              setCurrentUser(null);
              aviso.advertencia('La contraseña/PIN de tu cuenta ha sido modificada por el administrador. Por favor, inicia sesión con tu nuevo PIN.');
            } else {
              // Sincronizar roles y permisos actualizados de la BD
              const updatedUser = {
                ...parsed,
                nombre: status.nombre || parsed.nombre,
                rol: status.rol || parsed.rol,
                permisos: status.permisos || parsed.permisos || [],
                pinSignature: status.pinSignature || parsed.pinSignature,
              };
              setCurrentUser(updatedUser);
              guardarSesion(updatedUser);
            }
          } else {
            borrarSesion();
            setCurrentUser(null);
          }
        } catch (e) {
          console.error('Error inicializando sesión:', e);
          // Sin sesión en el servidor no se restaura la guardada: onSesionPerdida ya lleva al PIN
          if (esErrorDeSesion(e)) {
            borrarSesion();
            setLoading(false);
            return;
          }
          try {
            setCurrentUser(JSON.parse(saved));
          } catch (err) {
            borrarSesion();
          }
        }
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const handleLoginSuccess = (user) => {
    sessionStorage.setItem(ACTIVIDAD_KEY, String(Date.now()));
    setAvisoLogin('');
    setNecesitaActivacion(false);
    setCurrentUser(user);
    guardarSesion(user);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignorar fallos de red al cerrar sesión
    }
    setCurrentUser(null);
    setSegundosParaCierre(null);
    borrarSesion();
  };

  // El backend rechazó la sesión (expiró, la revocaron o se desactivó el equipo): volver al PIN o a la activación
  useEffect(() => onSesionPerdida((err) => {
    setCurrentUser(null);
    setSegundosParaCierre(null);
    borrarSesion();
    setNecesitaActivacion(err.codigo === 'DISPOSITIVO_NO_ACTIVADO');
    setAvisoLogin(err.message);
  }), []);

  // Cierre de sesión por inactividad. Se compara contra la hora de la última actividad
  // (no contra un temporizador) porque al bloquear el celular los timers se congelan.
  useEffect(() => {
    if (!aplicaInactividad(currentUser)) return;

    const registrarActividad = (e) => {
      // El botón "Cerrar sesión" del aviso no debe contar como actividad
      if (e?.target?.closest?.('[data-sin-actividad]')) return;
      const ahora = Date.now();
      // Evitar escribir en cada movimiento: basta con una vez por segundo
      if (ahora - ultimaEscrituraRef.current < 1000) return;
      ultimaEscrituraRef.current = ahora;
      sessionStorage.setItem(ACTIVIDAD_KEY, String(ahora));
      setSegundosParaCierre(null);
    };

    const revisar = () => {
      const restante = INACTIVIDAD_MS - (Date.now() - leerUltimaActividad());
      if (restante <= 0) {
        handleLogout();
        setAvisoLogin('Tu sesión se cerró por inactividad. Ingresa tu PIN.');
      } else if (restante <= AVISO_INACTIVIDAD_MS) {
        setSegundosParaCierre(Math.ceil(restante / 1000));
      } else {
        setSegundosParaCierre(null);
      }
    };

    const alVolverALaApp = () => {
      if (document.visibilityState === 'visible') revisar();
    };

    if (!leerUltimaActividad()) sessionStorage.setItem(ACTIVIDAD_KEY, String(Date.now()));
    const eventos = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    eventos.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true }));
    document.addEventListener('visibilitychange', alVolverALaApp);
    window.addEventListener('focus', revisar);
    const interval = setInterval(revisar, 1000);
    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, registrarActividad));
      document.removeEventListener('visibilitychange', alVolverALaApp);
      window.removeEventListener('focus', revisar);
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.rol]);

  // Polling de seguridad activo: detectar si el usuario fue eliminado, desactivado o si cambió su PIN/rol
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.checkUserStatus(currentUser.id);
        if (!res || !res.exists || !res.activo) {
          handleLogout();
          aviso.advertencia('Tu usuario ha sido eliminado o desactivado. Sesión cerrada.');
        } else if (currentUser.pinSignature && res.pinSignature && currentUser.pinSignature !== res.pinSignature) {
          handleLogout();
          aviso.advertencia('La contraseña/PIN de tu cuenta fue modificada por el administrador. Sesión cerrada.');
        } else if (res.rol !== currentUser.rol || JSON.stringify(res.permisos) !== JSON.stringify(currentUser.permisos)) {
          const syncedUser = {
            ...currentUser,
            nombre: res.nombre,
            rol: res.rol,
            permisos: res.permisos,
            pinSignature: res.pinSignature,
          };
          setCurrentUser(syncedUser);
          guardarSesion(syncedUser);
        }
      } catch (err) {
        // Ignorar errores de red 502 temporales durante reinicios del servidor
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        onLoginSuccess={handleLoginSuccess}
        aviso={avisoLogin}
        inicialModo={necesitaActivacion ? 'activar' : 'pin'}
      />
    );
  }

  return (
    <>
    {segundosParaCierre !== null && (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-black text-slate-900 text-base uppercase tracking-tight">¿Sigues ahí?</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tu sesión se cerrará por inactividad en <strong className="text-slate-900 text-lg">{segundosParaCierre}s</strong>
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              data-sin-actividad
              onClick={handleLogout}
              className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-xs uppercase transition-colors"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => setSegundosParaCierre(null)}
              className="py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl text-xs uppercase transition-colors active:scale-95"
            >
              Seguir aquí
            </button>
          </div>
        </div>
      </div>
    )}
    <BrowserRouter>
      <Suspense fallback={
        <div className="flex-1 min-h-[50vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Layout title="Resumen de Ventas" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><DashboardPage /></ProtectedRoute></Layout>} />
          <Route path="/salon" element={<Layout title="Gestión de Salón" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Salon" currentUser={currentUser}><SalonPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/cocina" element={<Layout title="Monitor de Preparación" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Cocina" currentUser={currentUser}><CocinaPage /></ProtectedRoute></Layout>} />
          <Route path="/barra" element={<Layout title="Monitor de Barra" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Barra" currentUser={currentUser}><BarraPage /></ProtectedRoute></Layout>} />
          <Route path="/caja" element={<Layout title="Punto de Cobro" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Caja" currentUser={currentUser}><CajaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/creditos" element={<Layout title="Módulo de Créditos" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Creditos" currentUser={currentUser}><CreditosPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/compras" element={<Layout title="Registro de Compras" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Compras" currentUser={currentUser}><ComprasPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/reportes" element={<Layout title="Panel Contable" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Reportes" currentUser={currentUser}><ReportesPage /></ProtectedRoute></Layout>} />
          <Route path="/carta" element={<Layout title="Carta e Inventario" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Carta" currentUser={currentUser}><CartaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/categorias" element={<Layout title="Categorías de la Carta" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Categorias" currentUser={currentUser}><CategoriasPage /></ProtectedRoute></Layout>} />
          <Route path="/usuarios" element={<Layout title="Personal y Accesos" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Usuarios" currentUser={currentUser}><UsuariosPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
          <Route path="/configuracion" element={<Layout title="Configuración de Empresa" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><ConfiguracionPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </>
  );
}

export default App;
