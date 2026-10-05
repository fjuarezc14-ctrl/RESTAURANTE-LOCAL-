import React, { useState, useEffect } from 'react';
import { UserPlus, X, Trash2, Edit, LayoutDashboard, LayoutGrid, ChefHat, GlassWater, Calculator, PieChart, UsersRound, Save, Salad, BookOpen, Wallet, Tags } from 'lucide-react';
import { api } from '../api';
import { safeJsonParse } from '../utils/safeJson';
import { useAviso, useConfirmar } from '../components/ui';
import { pin as pinEsquema, nombre as nombreEsquema } from '@shared/esquemas/comunes.js';

// El Administrador siempre tiene acceso a todos los módulos
const TODOS_LOS_PERMISOS = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Creditos', 'Compras', 'Reportes', 'Carta', 'Categorias', 'Usuarios'];

export default function UsuariosPage({ currentUser: currentUserProp }) {
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', rol: '', pin: '', permisos: [] });
  const [editingUser, setEditingUser] = useState(null); // null si es nuevo

  // La sesión vive en sessionStorage (ver App.jsx); se prefiere el usuario que pasa App
  const currentUser = currentUserProp || safeJsonParse(sessionStorage.getItem('currentUser'), {});

  const fetchUsuarios = async () => {
    try {
      const data = await api.getUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleRolChange = (rol) => {
    let permisos = [];
    if (rol === 'Administrador') permisos = [...TODOS_LOS_PERMISOS];
    else if (rol === 'Mozo') permisos = ['Salon', 'Barra'];
    else if (rol === 'Cocinero') permisos = ['Cocina'];
    else if (rol === 'Cajero') permisos = ['Salon', 'Caja', 'Creditos'];
    else if (rol === 'Contador') permisos = ['Dashboard', 'Compras', 'Reportes'];
    setNewUser({ ...newUser, rol, permisos });
  };

  const handlePermisoToggle = (permiso) => {
    if (newUser.rol === 'Administrador') return;
    const current = newUser.permisos;
    setNewUser({ ...newUser, permisos: current.includes(permiso) ? current.filter(p => p !== permiso) : [...current, permiso] });
  };

  const abrirModalNuevo = () => {
    setEditingUser(null);
    setNewUser({ nombre: '', rol: '', pin: '', permisos: [] });
    setModalOpen(true);
  };

  const abrirModalEditar = (u) => {
    setEditingUser(u);
    setNewUser({ nombre: u.nombre, rol: u.rol, pin: u.pin || '', permisos: u.rol === 'Administrador' ? [...TODOS_LOS_PERMISOS] : (u.permisos || []) });
    setModalOpen(true);
  };

  const guardarUsuario = async () => {
    const validacionNombre = nombreEsquema.safeParse(newUser.nombre);
    if (!validacionNombre.success) {
      aviso.advertencia(validacionNombre.error.issues?.[0]?.message || 'El nombre es obligatorio.');
      return;
    }
    const validacionPin = pinEsquema.safeParse(newUser.pin);
    if (!validacionPin.success) {
      aviso.advertencia(validacionPin.error.issues?.[0]?.message || 'El PIN debe tener exactamente 4 dígitos numéricos.');
      return;
    }
    if (!newUser.rol || newUser.permisos.length === 0) {
      aviso.advertencia('Selecciona un rol y asigna al menos un permiso.');
      return;
    }
    if (editingUser && editingUser.id === currentUser?.id && newUser.rol !== editingUser.rol) {
      aviso.advertencia('No puedes cambiar tu propio rol.');
      return;
    }
    const datos = newUser.rol === 'Administrador' ? { ...newUser, permisos: [...TODOS_LOS_PERMISOS] } : newUser;
    setGuardando(true);
    try {
      if (editingUser) {
        // Modo Edición
        const res = await api.editarUsuario(editingUser.id, datos);
        if (res.error) throw new Error(res.error);
        aviso.exito('Usuario actualizado correctamente.');
      } else {
        // Modo Creación
        const res = await api.crearUsuario(datos);
        if (res.error) throw new Error(res.error);
        aviso.exito('Usuario creado correctamente.');
      }
      await fetchUsuarios();
      setModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      aviso.error('Error guardando usuario: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarUsuario = async (id) => {
    if (id === currentUser.id) {
      aviso.advertencia('No puedes eliminar tu propio usuario de la sesión activa.');
      return;
    }
    const confirmado = await confirmar({
      titulo: 'Eliminar colaborador',
      mensaje: '¿Estás seguro de eliminar este usuario del sistema?',
      peligro: true,
      botonConfirmar: 'Sí, eliminar',
      botonCancelar: 'Cancelar',
    });
    if (confirmado) {
      try {
        const res = await api.eliminarUsuario(id);
        if (res.error) throw new Error(res.error);
        aviso.exito('Usuario eliminado correctamente.');
        await fetchUsuarios();
      } catch (err) {
        aviso.error('Error al eliminar: ' + err.message);
      }
    }
  };

  const permisosDisponibles = [
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'Salon', icon: LayoutGrid, label: 'Salón / Mesas' },
    { id: 'Cocina', icon: ChefHat, label: 'Cocina / Pedidos' },
    { id: 'Barra', icon: GlassWater, label: 'Barra / Bebidas' },
    { id: 'Caja', icon: Calculator, label: 'Caja / Cobros' },
    { id: 'Creditos', icon: Wallet, label: 'Créditos / Clientes' },
    { id: 'Compras', icon: BookOpen, label: 'Compras / Gastos' },
    { id: 'Reportes', icon: PieChart, label: 'Reportes' },
    { id: 'Carta', icon: BookOpen, label: 'Carta e Inventario' },
    { id: 'Categorias', icon: Tags, label: 'Categorías' },
    { id: 'Usuarios', icon: UsersRound, label: 'Personal y Roles' },
  ];

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando usuarios...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Gestión de Usuarios</h1>
          <p className="text-xs md:text-sm text-slate-500">Crea cuentas, edita PINs o asigna roles y permisos a tu personal.</p>
        </div>
        <button onClick={abrirModalNuevo} className="self-start sm:self-auto bg-amber-500 text-slate-900 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2">
          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4 text-center">Rol</th>
                <th className="px-6 py-4">Módulos Permitidos</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {usuarios.map(u => {
                let colorRol = 'bg-slate-100 text-slate-600 border-slate-200';
                if (u.rol === 'Administrador') colorRol = 'bg-amber-100 text-amber-800 border-amber-200';
                if (u.rol === 'Mozo') colorRol = 'bg-blue-100 text-blue-800 border-blue-200';
                if (u.rol === 'Cocinero') colorRol = 'bg-red-100 text-red-800 border-red-200';
                if (u.rol === 'Cajero') colorRol = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                if (u.rol === 'Contador') colorRol = 'bg-purple-100 text-purple-800 border-purple-200';
                
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">{u.nombre.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <p className="font-bold text-slate-800">{u.nombre}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                            <span>PIN: ••••</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`border px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide ${colorRol}`}>{u.rol}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {(u.permisos || []).map(p => (
                        <span key={p} className="inline-block bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase mr-1 mb-1">{p}</span>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => abrirModalEditar(u)} 
                          title="Editar usuario"
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                        >
                          <Edit className="w-4.5 h-4.5" />
                        </button>
                        {(() => {
                          const esAdminPrincipal = u.id === 1;
                          const esMiUsuario = u.id === currentUser?.id;
                          if (!esAdminPrincipal && !esMiUsuario) {
                            return (
                              <button 
                                onClick={() => eliminarUsuario(u.id)} 
                                title="Eliminar usuario"
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all font-bold"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2"><UserPlus className="w-5 h-5 text-amber-500" /> {editingUser ? 'Modificar Empleado' : 'Registrar Empleado'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const isEditingInmutable = Boolean(editingUser && editingUser.id === 1 && editingUser.nombre.toLowerCase().trim() === 'admin principal');
                  const editandoMiUsuario = Boolean(editingUser && editingUser.id === currentUser?.id);
                  return (
                    <>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nombre completo</label>
                        <input 
                          type="text" 
                          value={newUser.nombre} 
                          onChange={e => setNewUser({ ...newUser, nombre: e.target.value })} 
                          disabled={isEditingInmutable}
                          placeholder="Ej. Juan Pérez" 
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed" 
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Rol Asignado</label>
                        <select 
                          value={newUser.rol} 
                          onChange={e => handleRolChange(e.target.value)} 
                          disabled={isEditingInmutable || editandoMiUsuario}
                          title={editandoMiUsuario ? 'No puedes cambiar tu propio rol' : undefined}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                          <option value="">Selecciona un rol...</option>
                          <option value="Administrador">Administrador</option>
                          <option value="Cajero">Cajero / Recepción</option>
                          <option value="Mozo">Mozo / Mesero</option>
                          <option value="Cocinero">Jefe de Cocina</option>
                          <option value="Contador">Contador</option>
                        </select>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">PIN de Acceso (4 dígitos únicos)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  autoComplete="new-password"
                  data-lpignore="true"
                  value={newUser.pin} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewUser({ ...newUser, pin: val });
                  }} 
                  placeholder="Ej. 1234" 
                  className="w-full sm:w-1/2 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center text-lg font-black" 
                  maxLength="4" 
                />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">Permisos de Acceso</label>
                <p className="text-xs text-slate-500 mb-4">
                  {newUser.rol === 'Administrador' ? 'El Administrador siempre tiene acceso a todos los módulos.' : 'Marca los módulos que podrá usar.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
                    const isEditingInmutable = editingUser && nombresInmutables.includes(editingUser.nombre.toLowerCase().trim());
                    const esAdministrador = newUser.rol === 'Administrador';
                    return permisosDisponibles.map(p => {
                      const Icon = p.icon;
                      return (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                          <input 
                            type="checkbox" 
                            checked={esAdministrador || newUser.permisos.includes(p.id)} 
                            onChange={() => handlePermisoToggle(p.id)} 
                            disabled={isEditingInmutable || esAdministrador}
                            className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500 cursor-pointer animate-pulse disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Icon className="w-4 h-4 text-slate-400" /> {p.label}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              <button onClick={guardarUsuario} disabled={guardando} className="px-5 py-2 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
