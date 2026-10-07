import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bell, Wifi, WifiOff, Receipt, ChefHat, CheckCircle, Link2 } from 'lucide-react';
import { api } from '../api';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS } from '../config/company';
import { useAviso, useConfirmar } from '../components/ui';
import {
  ModalCancelarPedido,
  ModalAutorizacionPin,
  ModalUnionMesas,
  ModalPrecuentaMesa,
  ModalPedidoMesa,
  DrawerBandejaDespacho,
  ModalAdminMesas,
  ModalCancelarItem,
} from '../modulos/salon/modales';
import ModalTodasCategorias from '../components/modales/ModalTodasCategorias';
import AvisosFlotantes from '../modulos/salon/componentes/AvisosFlotantes';
import ModalOpcionesProducto from '../modulos/caja/modales/ModalOpcionesProducto';
import { playChimeNotification } from '../modulos/salon/utils/sonido';
import { avisosDePlatosListos } from '../modulos/salon/utils/avisosListos';
import { usePedidoMesa } from '../modulos/salon/hooks/usePedidoMesa';
import { useCompany } from '../context/CompanyContext';

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

export default function SalonPage({ currentUser }) {
  const { empresa } = useCompany();
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meseroGlobal, setMeseroGlobal] = useState(currentUser?.nombre || 'Carlos');
  // Cancelación

  // Anulación individual de ítem

  // Modal de Autorización PIN
  const [precuentaMesa, setPrecuentaMesa] = useState(null);

  // Estados de Notificación en Tiempo Real
  const prevMesasRef = useRef([]);
  const [toasts, setToasts] = useState([]); // avisos flotantes (AvisosFlotantes)
  const [unionDropdownOpen, setUnionDropdownOpen] = useState(false);
  const [bandejaOpen, setBandejaOpen] = useState(false);
  const [servirConfirm, setServirConfirm] = useState(null); // { mesaNum, items, onConfirm }
  const [sirviendo, setSirviendo] = useState(false);

  // Al abrir la bandeja se quitan las notificaciones flotantes para que no la tapen
  const abrirBandeja = () => {
    setToasts([]);
    setBandejaOpen(true);
  };
  
  // Administración de Mesas (solo Admin/Cajero)
  const [adminMesasOpen, setAdminMesasOpen] = useState(false);

  // Modo de visualización (Tarjetas vs Compacto) y Semáforo Wi-Fi Local
  const [modoVista, setModoVista] = useState(() => localStorage.getItem('pos_vista_mozo') || 'tarjetas'); // 'tarjetas' | 'compacto'
  const [wifiStatus, setWifiStatus] = useState('online'); // 'online' | 'warning' | 'offline'

  useEffect(() => {
    const handleOnline = () => setWifiStatus('online');
    const handleOffline = () => setWifiStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkWifi = async () => {
      try {
        const start = Date.now();
        await api.getStatus();
        const latency = Date.now() - start;
        setWifiStatus(latency > 800 ? 'warning' : 'online');
      } catch (e) {
        setWifiStatus('offline');
      }
    };

    const wifiInterval = setInterval(checkWifi, 15000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(wifiInterval);
    };
  }, []);

  const toggleModoVista = () => {
    const nuevo = modoVista === 'tarjetas' ? 'compacto' : 'tarjetas';
    setModoVista(nuevo);
    localStorage.setItem('pos_vista_mozo', nuevo);
  };
  const [nuevaMesaNum, setNuevaMesaNum] = useState('');
  const [editandoMesas, setEditandoMesas] = useState({}); // { [mesaNum]: nuevoMesaNum }

  // Estados para el Modal de Opciones y Combos

  const isFetchingMesasRef = useRef(false);

  // Cargar mesas desde el API real con semáforo contra ráfagas concurrentes
  const fetchMesas = useCallback(async () => {
    if (isFetchingMesasRef.current) return;
    isFetchingMesasRef.current = true;
    try {
      const data = await api.getMesas();
      setMesas(data);
    } catch (err) {
      // Si fue abort o timeout, evitar llenar la consola en bucle si ya es un sondeo recurrente
      if (err?.codigo !== 'TIEMPO_AGOTADO') {
        console.error('Error cargando mesas:', err);
      }
    } finally {
      isFetchingMesasRef.current = false;
      setLoading(false);
    }
  }, []);

  // Cargar productos activos desde el API real
  const fetchProductos = useCallback(async () => {
    try {
      const data = await api.getProductos();
      setProductos(data);
    } catch (err) {
      console.error('Error cargando productos:', err);
    }
  }, []);

  // Cargar usuarios para el listado de mozos
  const fetchUsuarios = useCallback(async () => {
    try {
      const data = await api.getUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  }, []);

  // Mesas abiertas por Cajero o Administrador quedan "compartidas": cualquier mozo
  // puede entrar a atenderlas y recibe sus avisos como si fueran suyas.
  const nombresRolElevado = useMemo(() => new Set(
    (usuarios || [])
      .filter(u => ['Administrador', 'Cajero'].includes(u.rol))
      .map(u => String(u.nombre || '').trim().toLowerCase())
  ), [usuarios]);
  const esMesaCompartida = useCallback(
    (meseroNombre) => nombresRolElevado.has(String(meseroNombre || '').trim().toLowerCase()),
    [nombresRolElevado]
  );

  // Pedido de la mesa abierta (carta, ticket, envío a cocina y anulaciones)
  const {
    modalOpen,
    mesaActual,
    ticketActual,
    mobileTab,
    categoriaActiva,
    enviando,
    cancelModal,
    cancelMotivo,
    cancelandoPedido,
    itemACancelar,
    cancelandoItem,
    authModal,
    searchQuery,
    categoriasModalOpen,
    optionsModalOpen,
    selectedProduct,
    setModalOpen,
    setTicketActual,
    setMobileTab,
    setCategoriaActiva,
    setCancelModal,
    setCancelMotivo,
    setItemACancelar,
    setSupervisorItem,
    setAuthModal,
    setSupervisorAprobador,
    setEsReclamo,
    setSearchQuery,
    setCategoriasModalOpen,
    setOptionsModalOpen,
    setSelectedProduct,
    searchInputRef,
    abrirModal,
    getProductSteps,
    agregarAlTicket,
    agregarAlTicketDirecto,
    alterarCantidad,
    handleCancelarPedido,
    handleCancelarItem,
    confirmarCancelacionItem,
    submitAuthPin,
    requestSupervisorAuth,
    enviarACocina,
    menuFiltrado,
    categoriasOrdenadas,
    CATEGORIAS_VISIBLES,
    categoriasBarra,
    contarProductosCategoria,
    cerrarTecladoSiTocaFuera,
    totalTicket,
    badgeEstado,
    badgeTexto,
  } = usePedidoMesa({
    aviso,
    confirmar,
    currentUser,
    esMesaCompartida,
    fetchMesas,
    meseroGlobal,
    productos,
    setMesas,
    setToasts,
  });

  // Mantener meseroGlobal sincronizado con currentUser si este se carga después
  useEffect(() => {
    if (currentUser?.nombre) {
      setMeseroGlobal(currentUser.nombre);
    }
  }, [currentUser]);

  // Carga inicial al montar salón
  useEffect(() => {
    fetchMesas();
    fetchProductos();
    fetchUsuarios();
  }, [fetchMesas, fetchProductos, fetchUsuarios]);

  // Sondeo en tiempo real de mesas (solo cuando la pestaña está activa para ahorrar red y evitar saturación)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchMesas();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMesas]);

  const handleUnirMesa = async (numToJoin) => {
    try {
      const res = await api.unirMesa(mesaActual.num, numToJoin);
      if (res.ok) {
        aviso.exito(`Mesa ${numToJoin} unida correctamente a la Mesa ${mesaActual.num}`);
        setUnionDropdownOpen(false);
        fetchMesas();
      } else {
        aviso.error(`Error: ${res.error}`);
      }
    } catch (err) {
      aviso.error(`Error: ${err.message}`);
    }
  };

  // Mesas unidas a una principal (solo las de ese grupo)
  const mesasUnidasA = (num) => mesas.filter(m => m.estado === `Unida a Mesa ${num}`);

  // numeroMesa opcional: separa solo esa mesa; sin él, todas las del grupo de la mesa actual
  const handleSepararMesas = async (numeroMesa = null, numPrincipal = mesaActual?.num) => {
    const grupo = mesasUnidasA(numPrincipal).map(m => m.num);
    const texto = numeroMesa != null
      ? `¿Separar la Mesa ${numeroMesa} de la Mesa ${numPrincipal}?`
      : `¿Separar ${grupo.length > 1 ? 'las mesas' : 'la mesa'} ${grupo.join(', ')} de la Mesa ${numPrincipal}?`;
    const okSep = await confirmar({
      titulo: 'Separar Mesas',
      mensaje: texto,
      textoConfirmar: 'Separar',
      peligro: true
    });
    if (okSep) {
      try {
        const res = await api.separarMesas(numPrincipal, numeroMesa);
        if (res.ok) {
          aviso.exito(res.mensaje || 'Mesas separadas con éxito');
          if (numeroMesa == null || grupo.length <= 1) setUnionDropdownOpen(false);
          fetchMesas();
        } else {
          aviso.error(res.error || 'Error al separar mesas');
        }
      } catch (err) {
        aviso.error('Error: ' + err.message);
      }
    }
  };

  // Auto-guardado en caché local del borrador de pedido en curso
  useEffect(() => {
    if (modalOpen && mesaActual) {
      const mesaNum = mesaActual.numero || mesaActual.num;
      if (mesaNum) {
        const draftKey = `${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`;
        const legacyDraftKey = `hernandez_draft_mesa_${mesaNum}`;
        const unsubmitted = ticketActual.filter(i => !i.yaEnviado);
        if (unsubmitted.length > 0) {
          localStorage.setItem(draftKey, JSON.stringify(unsubmitted));
        } else {
          localStorage.removeItem(draftKey);
          localStorage.removeItem(legacyDraftKey);
        }
      }
    }
  }, [ticketActual, modalOpen, mesaActual]);

  // Detector de pedidos y platos listos (Sonido + Vibración + aviso flotante para el personal de salón)
  useEffect(() => {
    if (mesas.length === 0) {
      if (prevMesasRef.current.length === 0) prevMesasRef.current = mesas;
      return;
    }
    if (prevMesasRef.current.length > 0) {
      const { platos, mesasListas } = avisosDePlatosListos(prevMesasRef.current, mesas, {
        meseroActivo: (currentUser?.nombre || meseroGlobal || '').trim().toLowerCase(),
        esMesaCompartida,
        esRolMozo: currentUser?.rol === 'Mozo',
        barraCategorias: BARRA_CATEGORIAS,
      });
      // Una campana por grupo de avisos; cada aviso se va solo a los 6,5 s
      for (const grupo of [platos, mesasListas]) {
        if (grupo.length === 0) continue;
        playChimeNotification();
        grupo.forEach(nuevo => {
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, { id: toastId, ...nuevo }]);
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6500);
        });
      }
    }
    prevMesasRef.current = mesas;
  }, [mesas, meseroGlobal, currentUser, esMesaCompartida]);

  const handleCrearMesa = async (e) => {
    e.preventDefault();
    if (!nuevaMesaNum.trim()) return;
    const num = parseInt(nuevaMesaNum);
    if (isNaN(num) || num <= 0) {
      aviso.advertencia("El número de mesa debe ser un entero positivo.");
      return;
    }
    try {
      const res = await api.crearMesa({ numero: num });
      if (res.error) throw new Error(res.error);
      setNuevaMesaNum('');
      await fetchMesas();
    } catch (err) {
      aviso.error(`Error al crear mesa: ${err.message}`);
    }
  };

  const handleEditarMesa = async (numeroActual) => {
    const nuevoNumRaw = editandoMesas[numeroActual];
    if (!nuevoNumRaw || !nuevoNumRaw.trim()) return;
    const nuevoNum = parseInt(nuevoNumRaw);
    if (isNaN(nuevoNum) || nuevoNum <= 0) {
      aviso.advertencia("El número de mesa debe ser un entero positivo.");
      return;
    }
    try {
      const res = await api.editarMesa(numeroActual, { nuevoNumero: nuevoNum });
      if (res.error) throw new Error(res.error);
      setEditandoMesas(prev => {
        const copy = { ...prev };
        delete copy[numeroActual];
        return copy;
      });
      await fetchMesas();
      aviso.exito(`Mesa ${numeroActual} modificada a Mesa ${nuevoNum} con éxito.`);
    } catch (err) {
      aviso.error(`Error al modificar mesa: ${err.message}`);
    }
  };

  const handleEliminarMesa = async (numero) => {
    const okDel = await confirmar({
      titulo: 'Eliminar Mesa',
      mensaje: `¿Estás seguro de que deseas eliminar la Mesa ${numero}? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar Mesa',
      peligro: true
    });
    if (!okDel) return;
    try {
      const res = await api.eliminarMesa(numero);
      if (res.error) throw new Error(res.error);
      await fetchMesas();
      aviso.exito(`Mesa ${numero} eliminada`);
    } catch (err) {
      aviso.error(`Error al eliminar mesa: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando mesas...</p>
      </div>
    </div>
  );

  const activeMeseroName = (currentUser?.nombre || meseroGlobal || '').trim().toLowerCase();
  const isElevatedRole = ['Administrador', 'Cajero'].includes(currentUser?.rol);

  const platosListosDespacho = mesas.flatMap(m => {
    if (!m.pedidoData || !m.pedidoData.items) return [];
    
    const mesaMesero = (m.pedidoData.mesero || '').trim().toLowerCase();
    const esMiMesa = !activeMeseroName || mesaMesero === activeMeseroName || esMesaCompartida(mesaMesero);

    // Listo para llevar a la mesa: lo despachado por cocina y también por barra
    const itemsListos = m.pedidoData.items.filter(i => i.historial && !i.entregado);

    return itemsListos.map(item => ({
      ...item,
      mesaNum: m.num,
      mesero: m.pedidoData.mesero,
      esMiMesa,
      pedidoId: item.pedidoId,
      estacion: BARRA_CATEGORIAS.includes(item.categoria) ? 'Barra' : 'Cocina',
    }));
  });

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Atención en Salón</h1>
            <p className="text-xs md:text-sm text-slate-500">Toca una mesa para tomar, editar o agregar un pedido adicional.</p>
          </div>
          {isElevatedRole && (
            <button
              onClick={() => {
                const nums = mesas.map(m => m.num).filter(n => !isNaN(n));
                const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
                setNuevaMesaNum(String(maxNum + 1));
                setAdminMesasOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-black text-[10px] md:text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all uppercase tracking-wider shrink-0"
            >
              ⚙️ Ajustes de Mesas
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Libre</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div> Cocina</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div> Platos Listos</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-600 uppercase bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Servido</div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Sync BD Activo
          </div>
          {/* Semáforo Wi-Fi Local */}
          {wifiStatus === 'online' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm whitespace-nowrap" title="Conexión Wi-Fi excelente con el servidor local">
              <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">Wi-Fi OK</span>
            </div>
          )}
          {wifiStatus === 'warning' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-700 uppercase bg-amber-50 px-2.5 sm:px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm whitespace-nowrap" title="Señal Wi-Fi inestable o lenta">
              <Wifi className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>Wi-Fi Lento</span>
            </div>
          )}
          {wifiStatus === 'offline' && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-red-700 uppercase bg-red-100 px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-300 shadow-sm whitespace-nowrap animate-bounce" title="Sin señal Wi-Fi. Acércate a la barra">
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span>Sin Wi-Fi</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid-mesas-dinamico gap-3 md:gap-5 pb-20 md:pb-0">
        {mesas.map((m, idx) => {
          const esMiMesa = m.pedidoData?.mesero === activeMeseroName || isElevatedRole || esMesaCompartida(m.pedidoData?.mesero);
          const tieneListos = esMiMesa && (m.pedidoData?.items?.some(i => 
            i.historial && 
            !i.entregado
          ) || false);

          let colorBg = 'bg-white hover:bg-emerald-50', colorText = 'text-emerald-500', colorBorder = 'border-slate-200', Icon = Receipt;
          
          if (tieneListos) {
            colorBg = 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-400 shadow-lg';
            colorText = 'text-indigo-600';
            colorBorder = 'border-indigo-400';
            Icon = Bell;
          } else if (m.estado === 'Cocina') { 
            colorBg = 'bg-amber-50'; colorText = 'text-cyan-500'; colorBorder = 'border-amber-300 shadow-md'; Icon = ChefHat; 
          } else if (m.estado === 'Servido') { 
            colorBg = 'bg-blue-50'; colorText = 'text-blue-500'; colorBorder = 'border-blue-300 shadow-md'; Icon = CheckCircle; 
          } else if (m.estado && m.estado.startsWith("Unida a ")) {
            colorBg = 'bg-slate-50/70 border-dashed opacity-80'; colorText = 'text-slate-400'; colorBorder = 'border-slate-300 border-dashed'; Icon = Link2;
          }

          return (
            <div key={idx} onClick={() => abrirModal(m)} className={`relative rounded-2xl md:rounded-3xl border-2 ${colorBorder} ${colorBg} p-3 md:p-5 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 hover:-translate-y-1 aspect-square md:aspect-auto md:h-40 group`}>
              {tieneListos && (
                <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1.5 animate-bounce shadow-md" title="¡Platos listos en cocina!">
                  <Bell className="w-3.5 h-3.5 animate-ring" />
                </div>
              )}
              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center ${colorText} mb-1 md:mb-2 bg-white shadow-sm border border-slate-100`}>
                <Icon className="w-4 h-4 md:w-6 md:h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-sm md:text-lg uppercase tracking-tight">Mesa {m.num}</h3>
              {m.estado && m.estado.startsWith("Unida a ") ? (
                <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full mt-1.5">
                  🔗 {m.estado}
                </span>
              ) : null}
              {!(m.estado && m.estado.startsWith("Unida a ")) && mesasUnidasA(m.num).length > 0 && (
                <span className="absolute top-2 left-2 text-[9px] md:text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full" title="Mesas unidas a esta">
                  🔗 +{mesasUnidasA(m.num).map(u => u.num).join(', ')}
                </span>
              )}
              {m.estado && m.estado.startsWith("Unida a ") ? null : m.pedidoData ? (
                <div className="flex flex-col items-center">
                  <p className="font-mono font-black text-sm md:text-lg mt-1 text-slate-800">S/ {m.pedidoData.total.toFixed(2)}</p>
                  <span className="text-[8px] md:text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1.5 uppercase truncate max-w-[110px] text-center">
                    👤 {m.pedidoData.mesero}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] md:text-xs mt-1 text-slate-400 font-medium">Disponible</p>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL PRINCIPAL DE PEDIDO DE MESA (PUNTOS 13 Y 23) */}
      <ModalPedidoMesa
        abierto={modalOpen && !!mesaActual}
        mesa={mesaActual}
        currentUser={currentUser}
        meseroGlobal={meseroGlobal}
        cerrarTecladoSiTocaFuera={cerrarTecladoSiTocaFuera}
        onCerrar={() => setModalOpen(false)}
        onAbrirUnion={() => setUnionDropdownOpen(true)}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        menuFiltrado={menuFiltrado}
        ticketActual={ticketActual}
        totalTicket={totalTicket}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        modoVista={modoVista}
        toggleModoVista={toggleModoVista}
        categoriaActiva={categoriaActiva}
        setCategoriaActiva={setCategoriaActiva}
        categoriasBarra={categoriasBarra}
        categoriasOrdenadas={categoriasOrdenadas}
        categoriasVisiblesCount={CATEGORIAS_VISIBLES}
        onAbrirCategoriasModal={() => setCategoriasModalOpen(true)}
        agregarAlTicket={agregarAlTicket}
        alterarCantidad={alterarCantidad}
        badgeEstado={badgeEstado}
        badgeTexto={badgeTexto}
        productos={productos}
        requestSupervisorAuth={requestSupervisorAuth}
        handleCancelarItem={handleCancelarItem}
        setTicketActual={setTicketActual}
        api={api}
        aviso={aviso}
        setSupervisorAprobador={setSupervisorAprobador}
        setEsReclamo={setEsReclamo}
        setCancelModal={setCancelModal}
        setPrecuentaMesa={setPrecuentaMesa}
        confirmar={confirmar}
        enviarACocina={enviarACocina}
        enviando={enviando}
      />

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      <ModalCancelarPedido
        abierto={cancelModal}
        mesa={mesaActual}
        mesero={meseroGlobal}
        motivo={cancelMotivo}
        onMotivoChange={setCancelMotivo}
        onCerrar={() => { setCancelModal(false); setCancelMotivo(''); }}
        onConfirmar={handleCancelarPedido}
        cancelando={cancelandoPedido}
      />

      {/* MODAL DE ANULACIÓN DE ÍTEM INDIVIDUAL */}
      <ModalCancelarItem
        abierto={!!itemACancelar}
        item={itemACancelar}
        onCerrar={() => { setItemACancelar(null); setSupervisorItem(null); }}
        onConfirmar={confirmarCancelacionItem}
        cancelando={cancelandoItem}
      />

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO) */}
      <ModalOpcionesProducto
        abierto={optionsModalOpen && !!selectedProduct}
        producto={selectedProduct}
        onCerrar={() => {
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirmarItem={(item, notas, extras) => {
          agregarAlTicketDirecto(item, notas, extras);
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        getProductSteps={getProductSteps}
      />

      {/* MODAL DE AUTORIZACIÓN POR PIN (SUPERVISOR) */}
      <ModalAutorizacionPin
        abierto={authModal.open}
        promptText={authModal.promptText}
        pin={authModal.pin}
        error={authModal.error}
        onPinChange={(val) => setAuthModal(prev => ({ ...prev, pin: val, error: '' }))}
        onCerrar={() => setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' })}
        onSubmit={(pin) => submitAuthPin(pin)}
      />

      {/* UNION DE MESAS COMPONENTE DIALOG */}
      <ModalUnionMesas
        abierto={unionDropdownOpen && !!mesaActual}
        mesaActual={mesaActual}
        mesas={mesas}
        mesasUnidas={mesaActual ? mesasUnidasA(mesaActual.num) : []}
        onCerrar={() => setUnionDropdownOpen(false)}
        onUnirMesa={(num) => handleUnirMesa(num)}
        onSepararMesas={(num) => handleSepararMesas(num)}
      />

      {/* MODAL: TODAS LAS CATEGORÍAS */}
      <ModalTodasCategorias
        abierto={categoriasModalOpen}
        onCerrar={() => setCategoriasModalOpen(false)}
        categorias={categoriasOrdenadas}
        categoriaActiva={categoriaActiva}
        onSeleccionar={(cat) => {
          setCategoriaActiva(cat);
          setCategoriasModalOpen(false);
        }}
        contarProductos={contarProductosCategoria}
        tema="oscuro"
      />

      {!modalOpen && !optionsModalOpen && !cancelModal && !authModal.open && (
      <button
        onClick={abrirBandeja}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[220] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm p-3 md:px-4 md:py-3 rounded-2xl shadow-2xl transition-all active:scale-95 hover:-translate-y-1 uppercase tracking-wider border border-indigo-500/30"
      >
        <Bell className={`w-5 h-5 ${platosListosDespacho.length > 0 ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">Bandeja de Despacho</span>
        {platosListosDespacho.length > 0 ? (
          <span className="bg-red-500 text-white font-black text-xs px-2 py-0.5 rounded-full border border-white shadow ml-1 animate-pulse">
            {platosListosDespacho.length}
          </span>
        ) : (
          <span className="bg-indigo-800 text-indigo-200 text-[10px] px-1.5 py-0.5 rounded-full ml-1">0</span>
        )}
      </button>
      )}

      {/* AVISOS FLOTANTES: plato listo, mesa lista, comanda enviada (se ocultan con la bandeja abierta) */}
      {!bandejaOpen && (
        <AvisosFlotantes
          avisos={toasts}
          onAbrirBandeja={abrirBandeja}
          onCerrarAviso={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
        />
      )}

      {/* DRAWER / BANDEJA DE DESPACHO Y CONFIRMACIÓN DE ENTREGA */}
      <DrawerBandejaDespacho
        abierto={bandejaOpen}
        onCerrar={() => setBandejaOpen(false)}
        platosListosDespacho={platosListosDespacho}
        servirConfirm={servirConfirm}
        setServirConfirm={setServirConfirm}
        sirviendo={sirviendo}
        setSirviendo={setSirviendo}
        api={api}
        fetchMesas={fetchMesas}
        aviso={aviso}
      />

      {/* MODAL DE ADMINISTRACIÓN DE MESAS */}
      <ModalAdminMesas
        abierto={adminMesasOpen}
        onCerrar={() => setAdminMesasOpen(false)}
        handleCrearMesa={handleCrearMesa}
        nuevaMesaNum={nuevaMesaNum}
        setNuevaMesaNum={setNuevaMesaNum}
        mesas={mesas}
        editandoMesas={editandoMesas}
        setEditandoMesas={setEditandoMesas}
        handleEditarMesa={handleEditarMesa}
        handleEliminarMesa={handleEliminarMesa}
      />

      {/* MODAL DE PRECUENTA DE MESA (IMPRESIÓN) */}
      <ModalPrecuentaMesa
        mesa={precuentaMesa}
        onCerrar={() => setPrecuentaMesa(null)}
        empresa={empresa}
        mesero={currentUser?.nombre || meseroGlobal}
      />

      <style>{`
        .grid-mesas-dinamico {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }
        @media (max-width: 640px) {
          .grid-mesas-dinamico {
            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
          }
        }
        .animate-slide-left { animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-ring { animation: ring 1.5s ease-in-out infinite; }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-10deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(0); }
          100% { transform: rotate(0); }
        }

      `}</style>
    </section>
  );
}
