// Estructura de cada página: menú lateral, encabezado y contenido
import { Menu, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BotonPantallaCompleta } from './PantallaCompleta';
import { Sidebar } from './Sidebar';

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

export const Layout = ({ children, title, currentUser, onLogout, modoInstalacion }) => {
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
