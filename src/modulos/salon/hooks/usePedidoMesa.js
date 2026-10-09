// ================================================================
// HOOK: usePedidoMesa
// Pedido de una mesa desde el Salón: abrir la mesa, carta con búsqueda y categorías,
// ticket (agregar, combos, cantidades), envío a cocina y anulaciones con PIN de supervisor.
// ================================================================
import { COMPANY_CONFIG, ORDEN_PRIORIDADES_CATEGORIAS } from '../../../config/company';
import { api } from '../../../api';
import { getComboConfig, tieneComplementos } from '../../../utils/combos';
import { isMenuProduct, pasosProducto } from '../../../utils/pasosProducto';
import { matchProductSemantic, ordenarCategorias, relevanciaBusqueda } from '../../../utils/busquedaProductos';
import { useRef, useState } from 'react';

// Respuestas del backend que piden el PIN de un Administrador o Cajero para anular
const PIDE_AUTORIZACION = ['LIMITE_ANULACION_VENCIDO', 'AUTORIZACION_REQUERIDA'];

export function usePedidoMesa({
  aviso,
  confirmar,
  currentUser,
  esMesaCompartida,
  fetchMesas,
  meseroGlobal,
  productos,
  setMesas,
  setToasts,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaActual, setMesaActual] = useState(null);
  const [ticketActual, setTicketActual] = useState([]);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' | 'ticket'
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [enviando, setEnviando] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [itemACancelar, setItemACancelar] = useState(null);
  const [supervisorItem, setSupervisorItem] = useState(null);
  const [cancelandoItem, setCancelandoItem] = useState(false);
  const [authModal, setAuthModal] = useState({ open: false, pin: '', error: '', callback: null, promptText: '' });
  const [supervisorAprobador, setSupervisorAprobador] = useState(null);
  const [esReclamo, setEsReclamo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriasModalOpen, setCategoriasModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const searchInputRef = useRef(null);
  // La misma clave en los reintentos de este envío; se renueva cuando sale bien
  const claveEnvioRef = useRef(null);

  const abrirModal = (m) => {
    // Si la mesa está unida a otra, informar al usuario y bloquear ingreso
    if (m.estado && m.estado.startsWith("Unida a ")) {
      const mesaPrincipalNum = parseInt(m.estado.replace("Unida a Mesa ", ""));
      // El consumo se registra en la principal; aquí solo se ofrece separar ESTA mesa del grupo
      confirmar({
        titulo: 'Mesa Unida',
        mensaje: `La Mesa ${m.num} está unida a la Mesa ${mesaPrincipalNum}. Todo el consumo se registra en la Mesa ${mesaPrincipalNum}.\n\n¿Deseas separar la Mesa ${m.num}?`,
        textoConfirmar: 'Separar Mesa',
      }).then(ok => {
        if (!ok) return;
        api.separarMesas(mesaPrincipalNum, m.num)
          .then(res => {
            if (res.ok) fetchMesas();
            else aviso.error(res.error || 'Error al separar mesa');
          })
          .catch(err => aviso.error('Error: ' + err.message));
      });
      return;
    }

    const activeMeseroName = currentUser?.nombre || meseroGlobal;

    // Si la mesa está ocupada y el mesero asignado no es el mesero global activo, y el usuario es un Mozo, bloquear acceso
    if (m.pedidoData && m.pedidoData.mesero && m.pedidoData.mesero !== activeMeseroName && currentUser?.rol === 'Mozo' && !esMesaCompartida(m.pedidoData.mesero)) {
      aviso.advertencia(`Esta mesa está siendo atendida por el Mozo "${m.pedidoData.mesero}". No puedes realizar modificaciones.`);
      return;
    }
    setMesaActual(m);
    const mesaNum = m.numero || m.num;
    let initialItems = [];
    if (m.pedidoData?.items?.length > 0) {
      initialItems = JSON.parse(JSON.stringify(m.pedidoData.items));
      // Cualquier producto ya existente en la mesa se considera comanda histórica
      // para evitar que al agregar items nuevos se reenvíen los antiguos.
      initialItems.forEach(i => i.yaEnviado = true);
    }
    // Helper para claves de borrador con retrocompatibilidad
    const draftKey = `${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`;
    const legacyDraftKey = `hernandez_draft_mesa_${mesaNum}`;

    // Recuperar borrador guardado en caché si se interrumpió la conexión o recargó la vista
    try {
      const savedDraft = localStorage.getItem(draftKey) || localStorage.getItem(legacyDraftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtrar únicamente los ítems que existen en la carta actual
          const validDraftItems = parsed.filter(draftItem => 
            productos.some(p => String(p.id) === String(draftItem.id) || p.nombre.toLowerCase() === (draftItem.nombre || '').toLowerCase())
          );
          if (validDraftItems.length > 0) {
            initialItems = [...initialItems, ...validDraftItems];
          } else {
            localStorage.removeItem(draftKey);
            localStorage.removeItem(legacyDraftKey);
          }
        }
      }
    } catch (err) {
      console.error("Error al leer borrador local:", err);
    }
    setTicketActual(initialItems);
    setCategoriaActiva('Todos');
    setSearchQuery('');
    setMobileTab('menu');
    setModalOpen(true);
  };

  const getProductSteps = (prod, currentSelections = {}) => pasosProducto(prod, currentSelections, productos);

  const agregarAlTicket = (prod) => {
    if (!prod) return;

    const hasDynamicOptions = !!prod.opcionesConfig && (() => {
      try {
        const p = typeof prod.opcionesConfig === 'string' ? JSON.parse(prod.opcionesConfig) : prod.opcionesConfig;
        return Array.isArray(p) && p.length > 0;
      } catch { return false; }
    })();

    const isVirtualGroup = !!prod.esAgrupado;
    const traeComplementos = tieneComplementos(prod);
    const hasLegacyCombo = !prod.opcionesConfig && prod.requiereGuarnicion && !!getComboConfig(prod.nombre);
    const isLegacyMenu = !prod.opcionesConfig && prod.requiereGuarnicion && isMenuProduct(prod);
    const isLegacyCategoryCombo = !prod.opcionesConfig && prod.requiereGuarnicion && (
      String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo')
    );

    if (hasDynamicOptions || isVirtualGroup || hasLegacyCombo || isLegacyMenu || isLegacyCategoryCombo || traeComplementos) {
      const steps = getProductSteps(prod, {});
      if (steps && steps.length > 0) {
        setSelectedProduct(prod);
        setOptionsModalOpen(true);
        return;
      }
    }
    
    agregarAlTicketDirecto(prod, '');
  };

  const agregarAlTicketDirecto = (prod, notas = '', extras = null) => {
    const opcionesElegidas = extras?.opciones || [];
    const precioExtra = extras?.precioExtra || 0;
    setTicketActual(prevItems => {
      let nuevosItems = [...prevItems];
      const index = nuevosItems.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado && t.notas === notas);
      
      // Contabilizar la cantidad total de este producto en el ticket actual (evita fuga de stock con notas distintas)
      const cantTotalEnTicket = nuevosItems
        .filter(t => String(t.id) === String(prod.id) && !t.yaEnviado)
        .reduce((sum, item) => sum + item.cant, 0);
      
      if (prod.tipoStock === 'limitado' && cantTotalEnTicket >= prod.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
        return prevItems;
      }
      
      const precioBase = prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio;
      const precioFinal = precioBase + precioExtra;
      
      if (index >= 0) {
        nuevosItems[index] = {
          ...nuevosItems[index],
          cant: nuevosItems[index].cant + 1
        };
      } else {
        nuevosItems.push({ 
          id: String(prod.id), 
          nombre: prod.nombre, 
          precio: precioFinal, 
          cant: 1, 
          yaEnviado: false, 
          historial: false, 
          notas: notas,
          opciones: opcionesElegidas,
          ofertaNombre: prod.ofertaNombre || null,
          precioOriginal: prod.precio
        });
      }
      return nuevosItems;
    });
  };

  const alterarCantidad = (index, operacion) => {
    let nuevos = [...ticketActual];
    if (nuevos[index].yaEnviado) return;
    if (operacion === '+') {
      // Validar stock de nuevo si es limitado
      const prodOriginal = productos.find(p => String(p.id) === String(nuevos[index].id));
      if (prodOriginal && prodOriginal.tipoStock === 'limitado' && nuevos[index].cant >= prodOriginal.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
        return;
      }
      nuevos[index] = { ...nuevos[index], cant: nuevos[index].cant + 1 };
    } else {
      const nuevaCant = nuevos[index].cant - 1;
      if (nuevaCant <= 0) {
        nuevos.splice(index, 1);
      } else {
        nuevos[index] = { ...nuevos[index], cant: nuevaCant };
      }
    }
    setTicketActual(nuevos);
  };

  const handleCancelarPedido = async () => {
    if (!cancelMotivo.trim()) { aviso.advertencia('Por favor escribe o selecciona un motivo para la cancelación.'); return; }
    setCancelandoPedido(true);
    const mesaNum = mesaActual?.num;
    const pedidoId = mesaActual?.pedidoData?.pedidoId;
    const isForce = esReclamo || mesaActual?.estado === 'Servido';
    const motivoFinal = cancelMotivo.trim();
    const canceladoPor = supervisorAprobador ? `${supervisorAprobador.nombre} (${supervisorAprobador.rol}) | Mozo: ${meseroGlobal}` : meseroGlobal;

    // ⚡ Actualización optimista inmediata en la interfaz:
    // La mesa se muestra libre y los modales se cierran al instante sin colgar la UI del mozo
    setMesas(prev => prev.map(m => m.num === mesaNum ? { ...m, estado: 'Libre', pedidoData: null } : m));
    setCancelModal(false);
    setEsReclamo(false);
    setModalOpen(false);
    setMesaActual(null);
    setCancelMotivo('');

    const enviar = async (pinAutorizacion) => {
      try {
        const result = await api.cancelarPedido(pedidoId, {
          canceladoPor,
          motivo: motivoFinal,
          force: isForce,
          ...(pinAutorizacion ? { autorizacion: { pin: pinAutorizacion } } : {}),
        });
        if (result.error) throw new Error(result.error);

        await fetchMesas();

        if (result.mesaLiberada) {
          aviso.exito(`Pedido cancelado correctamente. Mesa ${mesaNum} ha sido liberada.`);
        } else {
          aviso.exito(`Pedido adicional cancelado correctamente. Mesa ${mesaNum} sigue activa con consumos previos.`);
        }
      } catch (err) {
        fetchMesas(); // Revertir a la realidad de la BD
        // Pasaron los 5 minutos o hace falta autorización: se pide el PIN y se reintenta
        if (!pinAutorizacion && PIDE_AUTORIZACION.includes(err.codigo)) {
          requestSupervisorAuth(`Autorizar anulación · Mesa ${mesaNum}`, (supervisor) => enviar(supervisor.pin));
          return;
        }
        aviso.error('Error al cancelar: ' + err.message);
      } finally {
        setCancelandoPedido(false);
      }
    };
    await enviar(supervisorAprobador?.pin);
  };

  const handleCancelarItem = (item, supervisor) => {
    setItemACancelar(item);
    setSupervisorItem(supervisor);
  };

  const confirmarCancelacionItem = async ({ cantidad, motivo }, pinAutorizacion = supervisorItem?.pin) => {
    if (!itemACancelar) return;
    setCancelandoItem(true);

    const mesaNum = mesaActual?.num || mesaActual?.numero || 'de la mesa';
    const isForce = mesaActual?.estado === 'Servido' || itemACancelar.historial;
    const canceladoPor = supervisorItem ? `${supervisorItem.nombre} (${supervisorItem.rol})` : meseroGlobal;
    const pedidoId = itemACancelar.pedidoId;
    const itemId = itemACancelar.itemId;
    const productoId = itemACancelar.id;
    const nombreProd = itemACancelar.nombre;

    try {
      const res = await api.cancelarItemPedido(pedidoId, {
        productoId,
        itemId,
        cantidadACancelar: cantidad,
        motivo,
        canceladoPor,
        force: isForce,
        ...(pinAutorizacion ? { autorizacion: { pin: pinAutorizacion } } : {}),
      });
      if (res.error) throw new Error(res.error);

      setItemACancelar(null);
      setSupervisorItem(null);

      if (res.pedidoVacio) {
        setModalOpen(false);
        await fetchMesas();
        if (res.mesaLiberada) {
          aviso.exito(`Comanda anulada por completo. Mesa ${mesaNum} ha sido liberada.`);
        } else {
          aviso.exito(`Comanda anulada por completo. Mesa ${mesaNum} sigue activa.`);
        }
      } else {
        // Mantener la pantalla de la mesa abierta y actualizar la comanda en vivo
        setTicketActual(prev => {
          let nuevos = [...prev];
          const idx = nuevos.findIndex(t => (itemId && t.itemId === itemId) || (String(t.id) === String(productoId) && t.yaEnviado));
          if (idx >= 0) {
            if (nuevos[idx].cant <= cantidad) {
              nuevos.splice(idx, 1);
            } else {
              nuevos[idx] = { ...nuevos[idx], cant: nuevos[idx].cant - cantidad };
            }
          }
          return nuevos;
        });
        aviso.exito(`Se canceló "${nombreProd}" (${cantidad} un.) correctamente.`);
        // Refrescar en segundo plano sin cerrar la pantalla del mozo
        fetchMesas();
      }
    } catch (err) {
      // Pasaron los 5 minutos o el plato ya estaba listo: se pide el PIN y se reintenta
      if (!pinAutorizacion && PIDE_AUTORIZACION.includes(err.codigo)) {
        requestSupervisorAuth(`Anular "${nombreProd}"`, (supervisor) => confirmarCancelacionItem({ cantidad, motivo }, supervisor.pin));
        return;
      }
      aviso.error("Error al anular ítem: " + err.message);
    } finally {
      setCancelandoItem(false);
    }
  };

  const submitAuthPin = async (pinToValidate) => {
    const pin = (pinToValidate || authModal.pin || '').trim();
    if (!pin) {
      setAuthModal(prev => ({ ...prev, error: 'Ingresa el PIN de autorización.' }));
      return;
    }
    try {
      const res = await api.validateAuth(pin);
      if (res.error) throw new Error(res.error);
      
      // Autorización exitosa! Ejecutar el callback
      if (typeof authModal.callback === 'function') {
        // El PIN va con la respuesta: el backend lo vuelve a validar al anular
        authModal.callback({ ...res, pin });
      }
      setAuthModal({ open: false, pin: '', error: '', callback: null, promptText: '' });
    } catch (err) {
      setAuthModal(prev => ({ ...prev, pin: '', error: err.message || 'PIN no autorizado o incorrecto' }));
    }
  };

  const requestSupervisorAuth = (promptText, callback) => {
    setAuthModal({
      open: true,
      pin: '',
      error: '',
      callback,
      promptText
    });
  };

  const enviarACocina = async () => {
    const nuevosItems = ticketActual.filter(i => !i.yaEnviado);
    if (nuevosItems.length === 0) { aviso.advertencia('No has agregado ningún producto nuevo.'); return; }

    setEnviando(true);
    try {
      const totalNuevos = nuevosItems.reduce((acc, val) => acc + (val.cant * val.precio), 0);
      const esAdicional = mesaActual.pedidoData?.items?.length > 0;

      const mesaNum = mesaActual.numero || mesaActual.num;
      if (!claveEnvioRef.current) claveEnvioRef.current = crypto.randomUUID();
      await api.enviarACocina(mesaNum, {
        mesero: meseroGlobal,
        items: nuevosItems, // Enviamos UNICAMENTE los nuevos items añadidos
        total: totalNuevos, // Enviamos el total del pedido adicional específico
        adicional: esAdicional,
      }, claveEnvioRef.current);
      claveEnvioRef.current = null;

      if (mesaNum) {
        localStorage.removeItem(`${COMPANY_CONFIG.localStoragePrefix || 'pos_draft_mesa_'}${mesaNum}`);
        localStorage.removeItem(`hernandez_draft_mesa_${mesaNum}`);
      }
      setModalOpen(false);
      await fetchMesas();

      // Feedback visual inmediato para el mozo
      const toastId = Date.now() + Math.random();
      setToasts(prev => [...prev, {
        id: toastId,
        mesa: mesaNum,
        mensaje: `✅ ¡Comanda de Mesa ${mesaNum} enviada a Cocina!`
      }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 4000);
    } catch (err) {
      aviso.error('Error al enviar a cocina: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Top 8 productos con mayor rotación / más pedidos
  const topProductosIds = productos
    .filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas')
    .slice(0, 8)
    .map(p => p.id);

  const menuFiltradoPre = productos.filter(p => {
    if (p.categoria === 'PedidosYa / Ofertas') return false;
    if (categoriaActiva === '🔥 Más Pedidos') {
      return topProductosIds.includes(p.id) && matchProductSemantic(p, searchQuery);
    }
    if (categoriaActiva !== 'Todos' && p.categoria !== categoriaActiva) return false;
    return matchProductSemantic(p, searchQuery);
  });

  const agruparProductos = (items) => {
    const list = [];
    const esTallarin = (p) => p.categoria === 'Tallarines Verdes' || (p.nombre && /tallar[ií]n(es)?\s+verde(s)?/i.test(p.nombre));
    const tallarines = items.filter(esTallarin);
    const otros = items.filter(p => !esTallarin(p));
    
    if (tallarines.length > 1) {
      const ordenados = [...tallarines].sort((a, b) => a.precio - b.precio);
      list.push({
        id: 'group_tallarines_verdes',
        nombre: 'Tallarines Verdes (Variantes)',
        categoria: ordenados[0].categoria || 'Pastas y Tallarines',
        precioMin: ordenados[0].precio,
        precioMax: ordenados[ordenados.length - 1].precio,
        esAgrupado: true,
        variantes: tallarines,
        tipoStock: 'ilimitado',
        stock: 0,
        activo: true
      });
    } else if (tallarines.length === 1) {
      list.push(tallarines[0]);
    }
    
    return [...list, ...otros];
  };

  const menuAgrupado = agruparProductos(menuFiltradoPre);

  const menuFiltrado = searchQuery.trim()
    ? [...menuAgrupado].sort((a, b) => relevanciaBusqueda(a, searchQuery) - relevanciaBusqueda(b, searchQuery))
    : menuAgrupado;

  const categoriasOrdenadas = ordenarCategorias(
    ['🔥 Más Pedidos', 'Todos', ...new Set(productos.filter(p => p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))],
    ORDEN_PRIORIDADES_CATEGORIAS
  );

  // En el celular deslizar la barra era incómodo: solo se muestran unas pocas
  // (más la seleccionada) y el resto se abre en la ventana "Ver todas".
  const CATEGORIAS_VISIBLES = 5;

  const categoriasBarra = categoriasOrdenadas.slice(0, CATEGORIAS_VISIBLES);
  if (!categoriasBarra.includes(categoriaActiva) && categoriasOrdenadas.includes(categoriaActiva)) {
    categoriasBarra.push(categoriaActiva);
  }

  const contarProductosCategoria = (cat) => {
    if (cat === '🔥 Más Pedidos') return topProductosIds.length;
    return productos.filter(p => p.categoria !== 'PedidosYa / Ofertas' && (cat === 'Todos' || p.categoria === cat)).length;
  };

  // Cierra el teclado del celular al tocar cualquier parte fuera del buscador
  const cerrarTecladoSiTocaFuera = (e) => {
    const input = searchInputRef.current;
    if (input && document.activeElement === input && !input.contains(e.target)) input.blur();
  };

  const totalTicket = ticketActual.reduce((acc, item) => acc + (item.cant * item.precio), 0);

  const badgeEstado = mesaActual?.estado === 'Servido' && ticketActual.length > 0
    ? 'text-blue-700 bg-blue-100' : (ticketActual.length > 0 ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100');

  const badgeTexto = mesaActual?.estado === 'Servido' && ticketActual.length > 0
    ? '+ ADICIONAL' : (ticketActual.length > 0 ? 'Editando Pedido' : 'Nueva Orden');

  return {
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
    supervisorItem,
    cancelandoItem,
    authModal,
    supervisorAprobador,
    esReclamo,
    searchQuery,
    categoriasModalOpen,
    optionsModalOpen,
    selectedProduct,
    setModalOpen,
    setMesaActual,
    setTicketActual,
    setMobileTab,
    setCategoriaActiva,
    setEnviando,
    setCancelModal,
    setCancelMotivo,
    setCancelandoPedido,
    setItemACancelar,
    setSupervisorItem,
    setCancelandoItem,
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
    topProductosIds,
    menuFiltradoPre,
    agruparProductos,
    menuAgrupado,
    menuFiltrado,
    categoriasOrdenadas,
    CATEGORIAS_VISIBLES,
    categoriasBarra,
    contarProductosCategoria,
    cerrarTecladoSiTocaFuera,
    totalTicket,
    badgeEstado,
    badgeTexto,
  };
}
