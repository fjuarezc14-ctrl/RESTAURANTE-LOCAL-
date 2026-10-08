import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { api, esErrorDeSesion, onSesionPerdida } from './api';
import { useEventos } from './hooks/useEventos';
import { useAviso } from './components/ui';
import { AuthGate } from './components/acceso/AuthGate';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { entrarPantallaCompleta, quierePantallaCompleta } from './utils/pantallaCompleta';

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
const EquiposPage = lazy(() => import('./pages/EquiposPage'));
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage'));

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
  }, [aviso]); // aviso es estable: solo corre al iniciar

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
  const aplicaCierrePorInactividad = aplicaInactividad(currentUser);
  useEffect(() => {
    if (!aplicaCierrePorInactividad) return;

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
  }, [currentUser?.id, aplicaCierrePorInactividad]);

  // Detectar si el usuario fue eliminado, desactivado o si cambió su PIN/rol: al recibir el aviso en vivo
  // de que cambiaron los usuarios (SSE), y cada 60 s como respaldo
  useEventos(['usuarios'], async () => {
    if (!currentUser || !currentUser.id) return;
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
    } catch {
      // Ignorar errores de red 502 temporales durante reinicios del servidor
    }
  }, { activo: Boolean(currentUser?.id) });

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
          <Route path="/equipos" element={<Layout title="Equipos y Sesiones" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="SoloAdmin" currentUser={currentUser}><EquiposPage /></ProtectedRoute></Layout>} />
          <Route path="/auditoria" element={<Layout title="Auditoría" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="SoloAdmin" currentUser={currentUser}><AuditoriaPage /></ProtectedRoute></Layout>} />
          <Route path="/configuracion" element={<Layout title="Configuración de Empresa" currentUser={currentUser} onLogout={handleLogout} modoInstalacion={modoInstalacion}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><ConfiguracionPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </>
  );
}

export default App;
