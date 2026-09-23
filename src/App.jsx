import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { UtensilsCrossed, LayoutDashboard, LayoutGrid, ChefHat, GlassWater, Calculator, PieChart, BookOpen, UsersRound, Menu, X, ChevronRight, LogOut, Lock, Wallet, Building2, Share2, Copy, Check as CheckIcon, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import logoUrl from './assets/logo.png';
import { COMPANY_CONFIG } from './config/company';
import { useCompany } from './context/CompanyContext';
import { api } from './api';
import { generateOfflineQrUrl } from './utils/qrOffline';
import DashboardPage from './pages/DashboardPage';
import SalonPage from './pages/SalonPage';
import CocinaPage from './pages/CocinaPage';
import BarraPage from './pages/BarraPage';
import CajaPage from './pages/CajaPage';
import ComprasPage from './pages/ComprasPage';
import ReportesPage from './pages/ReportesPage';
import CartaPage from './pages/CartaPage';
import UsuariosPage from './pages/UsuariosPage';
import CreditosPage from './pages/CreditosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';

// === PROTECTED ROUTE NAVIGATION GUARD ===
const ProtectedRoute = ({ children, permission, currentUser }) => {
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  if (!isAdmin && !userPermissions.includes(permission)) {
    // Si no tiene permisos para esta ruta ni para nada más, o evitar bucle
    const validPermitted = userPermissions.filter(p => p !== 'Usuarios');
    if (validPermitted.length === 0) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-rose-500 mb-2">Acceso Restringido</h2>
            <p className="text-slate-400 text-sm mb-6">Tu usuario no cuenta con permisos asignados para acceder a ningún módulo.</p>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
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
      firstPermitted === 'Reportes' ? '/reportes' : '/';
    return <Navigate to={pathToRedirect} replace />;
  }
  return children;
};

// === LOGIN GATE (PANTALLA DE BLOQUEO PREMIUM POR PIN) ===
const LoginGate = ({ onLoginSuccess }) => {
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
        </div>

      </div>
    </div>
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

  const principal = datos?.urls?.[0];

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
                {datos.urls.map(url => (
                  <div key={url} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
                    <span className="flex-1 text-xs font-mono text-cyan-300 truncate">{url}</span>
                    <button
                      onClick={() => copiar(url)}
                      className="shrink-0 px-2.5 py-1.5 bg-slate-700 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      {copiado === url ? <><CheckIcon className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </button>
                  </div>
                ))}
                {datos.urls.length === 0 && (
                  <p className="text-xs text-amber-400 font-bold">Esta PC no está conectada a ninguna red WiFi o cable.</p>
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

const Sidebar = ({ isOpen, toggleSidebar, currentUser, onLogout }) => {
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
    { path: '/creditos', icon: Wallet, label: 'Créditos / Clientes', permission: 'Caja' },
    { path: '/compras', icon: BookOpen, label: 'Compras / Gastos', permission: 'Caja' },
    { path: '/reportes', icon: PieChart, label: 'Reportes (Contador)', permission: 'Reportes' },
    { path: '/carta', icon: BookOpen, label: 'Carta e Inventario', permission: 'Dashboard' },
  ];

  // Filtrar ítems según permisos del usuario activo o si es administrador
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  const filteredItems = menuItems.filter(item => isAdmin || userPermissions.includes(item.permission));

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
          <button
            onClick={() => setCompartirAbierto(true)}
            className="w-full py-2 bg-slate-800 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/20 border border-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" /> Compartir dirección
          </button>
          <button 
            onClick={onLogout}
            className="w-full py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {compartirAbierto && <ModalCompartirDireccion onClose={() => setCompartirAbierto(false)} />}
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
    </div>
  </header>
);

const Layout = ({ children, title, currentUser, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 relative">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} currentUser={currentUser} onLogout={onLogout} />
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={title} currentUser={currentUser} />
        {children}
      </main>
    </div>
  );
};

// === APP MAIN ENTRY ===
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            // Validar directamente contra el servidor
            const status = await api.checkUserStatus(parsed.id);
            if (!status || !status.exists || !status.activo) {
              localStorage.removeItem('currentUser');
              setCurrentUser(null);
            } else if (parsed.pinSignature && status.pinSignature && parsed.pinSignature !== status.pinSignature) {
              localStorage.removeItem('currentUser');
              setCurrentUser(null);
              alert('⚠️ La contraseña/PIN de tu cuenta ha sido modificada por el administrador. Por favor, inicia sesión con tu nuevo PIN.');
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
              localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }
          } else {
            localStorage.removeItem('currentUser');
            setCurrentUser(null);
          }
        } catch (e) {
          console.error('Error inicializando sesión:', e);
          try {
            setCurrentUser(JSON.parse(saved));
          } catch (err) {
            localStorage.removeItem('currentUser');
          }
        }
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // Polling de seguridad activo: detectar si el usuario fue eliminado, desactivado o si cambió su PIN/rol
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.checkUserStatus(currentUser.id);
        if (!res || !res.exists || !res.activo) {
          handleLogout();
          alert('⚠️ Tu usuario ha sido eliminado o desactivado. Sesión cerrada.');
        } else if (currentUser.pinSignature && res.pinSignature && currentUser.pinSignature !== res.pinSignature) {
          handleLogout();
          alert('⚠️ La contraseña/PIN de tu cuenta fue modificada por el administrador. Sesión cerrada.');
        } else if (res.rol !== currentUser.rol || JSON.stringify(res.permisos) !== JSON.stringify(currentUser.permisos)) {
          const syncedUser = {
            ...currentUser,
            nombre: res.nombre,
            rol: res.rol,
            permisos: res.permisos,
            pinSignature: res.pinSignature,
          };
          setCurrentUser(syncedUser);
          localStorage.setItem('currentUser', JSON.stringify(syncedUser));
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
    return <LoginGate onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout title="Resumen de Ventas" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><DashboardPage /></ProtectedRoute></Layout>} />
        <Route path="/salon" element={<Layout title="Gestión de Salón" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Salon" currentUser={currentUser}><SalonPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/cocina" element={<Layout title="Monitor de Preparación" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Cocina" currentUser={currentUser}><CocinaPage /></ProtectedRoute></Layout>} />
        <Route path="/barra" element={<Layout title="Monitor de Barra" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Barra" currentUser={currentUser}><BarraPage /></ProtectedRoute></Layout>} />
        <Route path="/caja" element={<Layout title="Punto de Cobro" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><CajaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/creditos" element={<Layout title="Módulo de Créditos" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><CreditosPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/compras" element={<Layout title="Registro de Compras" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><ComprasPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/reportes" element={<Layout title="Panel Contable" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Reportes" currentUser={currentUser}><ReportesPage /></ProtectedRoute></Layout>} />
        <Route path="/carta" element={<Layout title="Carta e Inventario" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><CartaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/usuarios" element={<Layout title="Personal y Accesos" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Usuarios" currentUser={currentUser}><UsuariosPage /></ProtectedRoute></Layout>} />
        <Route path="/configuracion" element={<Layout title="Configuración de Empresa" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><ConfiguracionPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
