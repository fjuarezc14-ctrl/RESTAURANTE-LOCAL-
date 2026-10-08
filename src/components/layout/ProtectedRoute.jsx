// Protege una ruta según los permisos del usuario
import { Navigate } from 'react-router-dom';

// === PROTECTED ROUTE NAVIGATION GUARD ===
export const ProtectedRoute = ({ children, permission, currentUser }) => {
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
