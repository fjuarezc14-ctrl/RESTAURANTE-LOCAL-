// Menú lateral
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LayoutGrid, ChefHat, GlassWater, Calculator, PieChart, BookOpen, UsersRound, X, LogOut, Wallet, Tags, Building2, Share2, ShieldCheck, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import logoUrl from '../../assets/logo.png';
import { useCompany } from '../../context/CompanyContext';
import { splitBrand } from '../../utils/marca';
import { ModalCompartirDireccion } from './ModalCompartirDireccion';

// === COMPONENTS ===
// Divide la marca para resaltar la última palabra (ej. "VALETEC GOURMET" → VALETEC + GOURMET)

export const Sidebar = ({ isOpen, toggleSidebar, currentUser, onLogout, modoInstalacion = 'local' }) => {
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
            <Link to="/equipos" onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }} className={`sidebar-item flex items-center gap-3 p-3 text-sm ${location.pathname === '/equipos' ? 'sidebar-active' : ''}`}><MonitorSmartphone className="w-5 h-5"/> Equipos y Sesiones</Link>
          )}
          {isAdmin && (
            <Link to="/auditoria" onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }} className={`sidebar-item flex items-center gap-3 p-3 text-sm ${location.pathname === '/auditoria' ? 'sidebar-active' : ''}`}><ShieldCheck className="w-5 h-5"/> Auditoría</Link>
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
