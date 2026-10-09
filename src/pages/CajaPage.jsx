import React, { useState, useEffect, useCallback } from 'react';

import { api } from '../api';
import { useEventos } from '../hooks/useEventos';
import { comprobanteDeCobro, comprobanteDeVenta, enlaceWhatsAppVenta } from '../modulos/caja/utils/ticket';
import { AvisosCaja } from '../modulos/caja/componentes/AvisosCaja';
import { useDatosCaja } from '../modulos/caja/hooks/useDatosCaja';
import { useAvisoDeliveryListo } from '../modulos/caja/hooks/useAvisoDeliveryListo';

import { useCompany } from '../context/CompanyContext';
import { useAviso, useConfirmar, usePedirDato } from '../components/ui';
import { ModalAperturaCaja, ModalRetiroCaja, ModalCierreCaja, ModalHistorialCierres, ModalCorregirMetodoPago, ModalCorregirTipoEntrega, ModalCancelarLlevar, ModalAnularVenta, ModalConfirmacionCobro, ModalDetalleMesa, ModalDetallePedidoLlevar, ModalDetalleVenta, ModalCobroMesa, ModalNuevoPedidoDelivery } from '../modulos/caja/modales';
import { ModalComprobanteSunat, ModalOpcionesProducto, ModalReimpresionCierre } from '../components/modales';
import ModalTodasCategorias from '../components/modales/ModalTodasCategorias';
import { useTurnoCaja, useVentasTurno, useCobroMesa, usePedidoDelivery } from '../modulos/caja/hooks';
import { parseDeliveryInfo, parsearCreditoSplit, parseMonto } from '../utils/ventas';
import { mesaCobrable, mesaEnPreparacion, platosEnPreparacion, platosSinServir } from '../modulos/caja/utils/mesas';
import { clienteDeVenta, esPedidoListo, itemsDeVenta, listaVentasTurno, origenDeVenta, origenPedido, resumenTurno, soles } from '../modulos/caja/utils/ventasTurno';
import { getEstiloMetodo as estiloMetodo } from '../modulos/caja/constantes/metodosPago';
import PanelVentasTurno from '../modulos/caja/componentes/PanelVentasTurno';
import PanelPedidosLlevar from '../modulos/caja/componentes/PanelPedidosLlevar';
import PanelMesasPorCobrar from '../modulos/caja/componentes/PanelMesasPorCobrar';
import ResumenTurnoCaja from '../modulos/caja/componentes/ResumenTurnoCaja';
import EncabezadoCaja from '../modulos/caja/componentes/EncabezadoCaja';
import { useCargar } from '../hooks/useCargar';

export default function CajaPage({ currentUser }) {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const FACTURACION_ELECTRONICA = COMPANY_CONFIG?.facturacionElectronica ?? true;
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const pedirDato = usePedirDato();
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [loading, setLoading] = useState(true);
  // Nº de operación de Yape/Plin o voucher de tarjeta
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);

  // Campos para Delivery Propio y Para Llevar en modal


  // Gestión de Turnos de Caja (Hook modular desacoplado)
  const {
    cajaEstado,
    setCajaEstado,
    ultimoCierre,
    setUltimoCierre,
    modalAperturaOpen,
    setModalAperturaOpen,
    cierreModalOpen,
    setCierreModalOpen,
    modalSalidaCajaOpen,
    setModalSalidaCajaOpen,
    tipoMovimientoCaja,
    historialCierresModalOpen,
    setHistorialCierresModalOpen,
    historialCierres,
    cargandoHistorialCierres,
    cierreAImprimir,
    setCierreAImprimir,
    abrirHistorialCierres,
    abrirMovimientoGaveta,
  } = useTurnoCaja({ onNotificar: (msg, tipo) => aviso[tipo] ? aviso[tipo](msg) : aviso.info(msg) });

  // Gestión de Ventas del Turno y Modales de Corrección/Anulación (Hook modular desacoplado)
  const {
    ventas,
    setVentas,
    filtroMetodoPago,
    setFiltroMetodoPago,
    anularVentaModal,
    setAnularVentaModal,
    ventaAAnular,
    cambioMetodoModal,
    setCambioMetodoModal,
    ventaACambiar,
    cambioTipoEntregaModal,
    setCambioTipoEntregaModal,
    ventaATipoCambiar,
    abrirAnulacionVenta,
    abrirCambioMetodo,
    abrirCambioTipoEntrega,
  } = useVentasTurno();


  // Créditos y Clientes
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState([]);

  // Mostrar solo las ventas del turno activo por defecto (false = Turno, true = Día)
  const [mostrarTodoElDia, setMostrarTodoElDia] = useState(false);
  const [historialColapsado, setHistorialColapsado] = useState(false);

  // Detalle en modal (se guarda el id para leer siempre los datos más recientes del polling)
  const [ventaDetalleId, setVentaDetalleId] = useState(null);
  const [mesaDetalleNum, setMesaDetalleNum] = useState(null);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);
  const [busquedaVentas, setBusquedaVentas] = useState('');
  const [ventasLimite, setVentasLimite] = useState(20);
  const [ingresosDesglose, setIngresosDesglose] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setVentaDetalleId(null);
      setMesaDetalleNum(null);
      setPedidoDetalleId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // PIN y Cortesías en modal de Delivery/Para Llevar

  // Modal de autorización de cancelación para Llevar/Delivery
  const [cancelLlevarModalOpen, setCancelLlevarModalOpen] = useState(false);
  const [pedidoACancelarLlevar, setPedidoACancelarLlevar] = useState(null);

  // Modal PedidosYa y Para Llevar
  // cajeroNombre = responsable del turno (apertura/cierre). Las ventas, retiros y
  // cancelaciones se registran con quien tiene la sesión iniciada (usuarioOperador).
  const [cajeroNombre, setCajeroNombre] = useState(currentUser?.nombre || 'María');
  const usuarioOperador = currentUser?.nombre || cajeroNombre || 'Cajero';
  const [usuariosSistema, setUsuariosSistema] = useState([]);

  const cajerosDisponibles = React.useMemo(() => {
    if (!usuariosSistema || usuariosSistema.length === 0) return [];
    const activos = usuariosSistema.filter(u => u.activo !== false);
    return [...activos].sort((a, b) => {
      const peso = (rol) => (rol === 'Cajero' ? 1 : rol === 'Administrador' ? 2 : 3);
      return peso(a.rol) - peso(b.rol) || a.nombre.localeCompare(b.nombre);
    });
  }, [usuariosSistema]);

  // Ajustes durante el render (sin efecto, como recomienda React):
  // - si cambia el usuario con sesión, el cajero pasa a ser él;
  // - al cargar la lista de cajeros con la caja cerrada, si el nombre no está en la lista se elige uno.
  const [usuarioVisto, setUsuarioVisto] = useState(currentUser?.nombre);
  if (currentUser?.nombre && currentUser.nombre !== usuarioVisto) {
    setUsuarioVisto(currentUser.nombre);
    setCajeroNombre(currentUser.nombre);
  }
  const claveCajeros = `${cajaEstado.abierto}|${cajerosDisponibles.map(u => u.nombre).join(',')}`;
  const [claveCajerosVista, setClaveCajerosVista] = useState(null);
  if (claveCajeros !== claveCajerosVista) {
    setClaveCajerosVista(claveCajeros);
    if (!cajaEstado.abierto && cajerosDisponibles.length > 0) {
      const match = cajerosDisponibles.find(u => u.nombre.toLowerCase() === (cajeroNombre || '').toLowerCase());
      const defaultUser = cajerosDisponibles.find(u => u.rol === 'Cajero') || cajerosDisponibles[0];
      if (!match && defaultUser) setCajeroNombre(defaultUser.nombre);
    }
  }


  const [productosMenu, setProductosMenu] = useState([]);
  const [toasts, setToasts] = useState([]);
  const addToast = (mensaje, tipo = 'info') => {
    const toastId = Date.now() + Math.random();
    setToasts(prev => [...prev, { id: toastId, mensaje, tipo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 5000);
  };
  const avisarPedidosYaPrueba = () => addToast('🔒 PedidosYa está en versión de prueba. Contacta con VALETEC para activarlo.', 'warning');


  // Campana de Restaurante Premium (G5 -> C6)

  const fetchCajaData = useDatosCaja({
    setMesas, setPedidosLlevar, setVentas, setProductosMenu, setUsuariosSistema, setClientes, setAbonos, setCajaEstado, setCajeroNombre, setUltimoCierre, setLoading,
  });

  const abrirTicketImpresionDirecto = (total, response, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items, mesaNum = 'Delivery', deliveryInfo = null, descuentoAplicado = 0, ofertaDescripcion = null) => {
    setActiveComprobante(comprobanteDeCobro({
      total, response: response || {}, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items,
      mesaNum, deliveryInfo, descuentoAplicado, ofertaDescripcion, metodoPorDefecto: metodoPago, ruc: COMPANY_CONFIG.ruc,
    }));
    setSunatModalOpen(true);
  };

  // Cobro de mesas (formulario, confirmación y registro de la venta)
  const cobro = useCobroMesa({
    aviso,
    addToast,
    clientes,
    cajaEstado,
    setModalAperturaOpen,
    usuarioOperador,
    fetchCajaData,
    abrirTicketImpresionDirecto,
  });
  const {
    modalOpen,
    mesaSeleccionada,
    metodoPago,
    cobrando,
    modalConfirmarCobro,
    datosConfirmacionCobro,
    setModalOpen,
    setModalConfirmarCobro,
    ejecutarCobroFinal,
    abrirCobroMesa,
  } = cobro;

  // Pedido para llevar / delivery / PedidosYa (estado, productos, pago y envío a cocina)
  const delivery = usePedidoDelivery({
    aviso,
    usuarioOperador,
    cajaEstado,
    setModalAperturaOpen,
    productosMenu,
    setProductosMenu,
    fetchCajaData,
    avisarPedidosYaPrueba,
    abrirTicketImpresionDirecto,
  });
  const {
    deliveryModal,
    deliveryCategoriaFiltro,
    deliveryCategoriasModalOpen,
    optionsModalOpen,
    selectedProduct,
    setDeliveryModal,
    setCodigoPY,
    setDeliveryCategoriaFiltro,
    setDeliveryCategoriasModalOpen,
    setOptionsModalOpen,
    setSelectedProduct,
    setItemsDelivery,
    setEditingPedidoId,
    abrirDeliveryModal,
    iniciarModificarDelivery,
    getProductSteps,
    agregarItemDeliveryDirecto,
    deliveryCategoriasOrdenadas,
    deliveryCategoriasBarra,
    contarProductosCategoriaDelivery,
  } = delivery;



  // Carga inicial completa de todo el turno
  const cargarTurnoCompleto = useCallback(() => fetchCajaData({ full: true }), [fetchCajaData]);
  useCargar(cargarTurnoCompleto);

  // Avisos en vivo (SSE); en pausa mientras hay un modal de cobro o cierre abierto.
  // Mesas y delivery: recarga liviana. Cobros, caja y créditos (p. ej. de otro cajero): el turno completo.
  const sinModalAbierto = !modalOpen && !deliveryModal && !cierreModalOpen && !historialCierresModalOpen;
  useEventos(['mesas', 'pedidos'], () => fetchCajaData({ full: false }), { activo: sinModalAbierto });
  useEventos(['caja', 'ventas', 'clientes'], () => fetchCajaData({ full: true }), { activo: sinModalAbierto });


  // Alerta sonora y visual cuando un pedido para llevar queda listo
  useAvisoDeliveryListo(pedidosLlevar, setToasts);

  const mesasPendientes = mesas.filter(m => m.estado !== 'Libre' && m.pedidoData);




  const reimprimirComprobante = (v) => {
    if (!v) return;
    setActiveComprobante(comprobanteDeVenta(v, COMPANY_CONFIG.ruc));
    setSunatModalOpen(true);
  };



  const enviarPorWhatsApp = async (v) => {
    if (!v) return;
    const telefono = await pedirDato({
      titulo: 'Enviar Comprobante por WhatsApp',
      mensaje: 'Ingresa el número de WhatsApp del cliente:',
      placeholder: '999888777',
      validar: (val) => val.replace(/\D/g, '').length === 9 ? null : 'Ingresa un número de celular válido de 9 dígitos',
    });
    if (!telefono) return;
    const cleanedPhone = telefono.replace(/\D/g, '');
    
    window.open(enlaceWhatsAppVenta(v, cleanedPhone, COMPANY_CONFIG.name), '_blank', 'noopener,noreferrer');
  };











  const confirmarEntregaDelivery = async (pedidoId, codigo) => {
    const ok = await confirmar({
      titulo: 'Confirmar Entrega',
      mensaje: `¿Confirmas la entrega del pedido ${codigo}?`,
      botonConfirmar: 'Confirmar Entrega',
    });
    if (!ok) return;
    try {
      await api.confirmarEntrega(pedidoId);
      await fetchCajaData();
      aviso.exito(`Entrega del pedido ${codigo} confirmada`);
    } catch (err) {
      aviso.error('Error: ' + err.message);
    }
  };

  // --- Cambiar método de pago de una venta existente ---













  if (!deliveryCategoriasBarra.includes(deliveryCategoriaFiltro) && deliveryCategoriasOrdenadas.includes(deliveryCategoriaFiltro)) {
    deliveryCategoriasBarra.push(deliveryCategoriaFiltro);
  }

  const {
    ventasTurno,
    activeEfectivo,
    activeTarjeta,
    activeYape,
    activeIngresosCaja,
    activeCortesias,
    activeConsumoPlanilla,
    activeConsumoClientes,
    totalCreditosTurno,
  } = resumenTurno({ ventas, abonos, clientes, ultimoCierre, mostrarTodoElDia });

  const {
    busquedaVentasNorm,
    soloSalidas,
    ventasLista,
    ventasVisibles,
  } = listaVentasTurno({
    ventasTurno,
    movimientos: cajaEstado?.resumenEnVivo?.movimientos,
    ultimoCierre,
    mostrarTodoElDia,
    busquedaVentas,
    filtroMetodoPago,
    ventasLimite,
  });

  const ventaDetalle = ventaDetalleId != null ? ventas.find(v => v.id === ventaDetalleId) : null;
  const mesaDetalle = mesaDetalleNum != null ? mesasPendientes.find(m => m.num === mesaDetalleNum) : null;
  const pedidoDetalle = pedidoDetalleId != null ? pedidosLlevar.find(p => p.pedidoId === pedidoDetalleId) : null;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando cuentas de caja...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 space-y-5">
        <EncabezadoCaja
          abrirDeliveryModal={abrirDeliveryModal}
          abrirHistorialCierres={abrirHistorialCierres}
          abrirMovimientoGaveta={abrirMovimientoGaveta}
          cajaEstado={cajaEstado}
          cajeroNombre={cajeroNombre}
          setCierreModalOpen={setCierreModalOpen}
          setModalAperturaOpen={setModalAperturaOpen}
        />

        <ResumenTurnoCaja
          activeConsumoClientes={activeConsumoClientes}
          activeConsumoPlanilla={activeConsumoPlanilla}
          activeCortesias={activeCortesias}
          activeEfectivo={activeEfectivo}
          activeIngresosCaja={activeIngresosCaja}
          activeTarjeta={activeTarjeta}
          activeYape={activeYape}
          ingresosDesglose={ingresosDesglose}
          mesasPendientes={mesasPendientes}
          pedidosLlevar={pedidosLlevar}
          setIngresosDesglose={setIngresosDesglose}
          totalCreditosTurno={totalCreditosTurno}
          ventasTurno={ventasTurno}
        />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
          <div className="xl:col-span-3 space-y-5 min-w-0">

            <PanelMesasPorCobrar
              abrirCobroMesa={abrirCobroMesa}
              mesasPendientes={mesasPendientes}
              setMesaDetalleNum={setMesaDetalleNum}
            />

            <PanelPedidosLlevar
              confirmarEntregaDelivery={confirmarEntregaDelivery}
              pedidosLlevar={pedidosLlevar}
              setPedidoDetalleId={setPedidoDetalleId}
            />
          </div>

          <PanelVentasTurno
            busquedaVentas={busquedaVentas}
            busquedaVentasNorm={busquedaVentasNorm}
            filtroMetodoPago={filtroMetodoPago}
            historialColapsado={historialColapsado}
            mostrarTodoElDia={mostrarTodoElDia}
            setBusquedaVentas={setBusquedaVentas}
            setFiltroMetodoPago={setFiltroMetodoPago}
            setHistorialColapsado={setHistorialColapsado}
            setMostrarTodoElDia={setMostrarTodoElDia}
            setVentaDetalleId={setVentaDetalleId}
            setVentasLimite={setVentasLimite}
            soloSalidas={soloSalidas}
            ultimoCierre={ultimoCierre}
            ventasLista={ventasLista}
            ventasVisibles={ventasVisibles}
          />
        </div>
      </div>

      {/* MODAL: DETALLE DE MESA */}
      <ModalDetalleMesa
        mesa={mesaDetalle}
        onCerrar={() => setMesaDetalleNum(null)}
        onCobrar={(m) => { setMesaDetalleNum(null); abrirCobroMesa(m); }}
        esCobrable={mesaDetalle ? mesaCobrable(mesaDetalle) : false}
        enPreparacion={mesaDetalle ? mesaEnPreparacion(mesaDetalle) : false}
        cantPlatosEnPreparacion={mesaDetalle ? platosEnPreparacion(mesaDetalle) : 0}
        cantPlatosSinServir={mesaDetalle ? platosSinServir(mesaDetalle) : 0}
      />

      {/* MODAL: DETALLE DE PEDIDO PARA LLEVAR / DELIVERY */}
      <ModalDetallePedidoLlevar
        pedido={pedidoDetalle}
        onCerrar={() => setPedidoDetalleId(null)}
        origen={pedidoDetalle ? origenPedido(pedidoDetalle.codigoPedidosYa, pedidoDetalle) : {}}
        listo={pedidoDetalle ? esPedidoListo(pedidoDetalle) : false}
        onCancelar={(p) => {
          setPedidoDetalleId(null);
          setPedidoACancelarLlevar(p);
          setCancelLlevarModalOpen(true);
        }}
        onModificar={(p) => {
          setPedidoDetalleId(null);
          iniciarModificarDelivery(p);
        }}
        onConfirmarEntrega={(pedidoId, codigoPY) => {
          setPedidoDetalleId(null);
          confirmarEntregaDelivery(pedidoId, codigoPY);
        }}
      />

      {/* MODAL: DETALLE DE VENTA */}
      <ModalDetalleVenta
        venta={ventaDetalle}
        onCerrar={() => setVentaDetalleId(null)}
        onAbrirAnulacion={(v) => abrirAnulacionVenta(v)}
        onEnviarWhatsApp={(v) => enviarPorWhatsApp(v)}
        onReimprimir={(v) => reimprimirComprobante(v)}
        onEditarMetodoPago={(v) => abrirCambioMetodo(v)}
        onEditarTipoEntrega={(v) => abrirCambioTipoEntrega(v)}
        estiloMetodo={estiloMetodo}
        itemsDeVenta={itemsDeVenta}
        clienteDeVenta={clienteDeVenta}
        origenDeVenta={origenDeVenta}
        parseDeliveryInfo={parseDeliveryInfo}
      />

      {/* MODAL DE COBRO (MESAS) */}
      <ModalCobroMesa
        {...cobro}
        abierto={modalOpen && !!mesaSeleccionada}
        mesa={mesaSeleccionada}
        onCerrar={() => setModalOpen(false)}
        productosMenu={productosMenu}
        clientes={clientes}
        soles={soles}
        parseMonto={parseMonto}
        estiloMetodo={estiloMetodo}
      />

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      <ModalConfirmacionCobro
        abierto={modalConfirmarCobro}
        datos={datosConfirmacionCobro}
        cobrando={cobrando}
        onCerrar={() => setModalConfirmarCobro(false)}
        onConfirmar={ejecutarCobroFinal}
      />

      {/* MODAL: TODAS LAS CATEGORÍAS DEL NUEVO PEDIDO */}
      <ModalTodasCategorias
        abierto={deliveryModal && deliveryCategoriasModalOpen}
        onCerrar={() => setDeliveryCategoriasModalOpen(false)}
        categorias={deliveryCategoriasOrdenadas}
        categoriaActiva={deliveryCategoriaFiltro}
        onSeleccionar={(cat) => {
          setDeliveryCategoriaFiltro(cat);
          setDeliveryCategoriasModalOpen(false);
        }}
        contarProductos={contarProductosCategoriaDelivery}
        tema="claro"
      />

      {/* MODAL PEDIDOS YA */}
      <ModalNuevoPedidoDelivery
        {...delivery}
        abierto={deliveryModal}
        onCerrar={() => {
          setDeliveryModal(false);
          setCodigoPY('');
          setItemsDelivery([]);
          setEditingPedidoId(null);
        }}
        usuarioOperador={usuarioOperador}
        avisarPedidosYaPrueba={avisarPedidosYaPrueba}
        productosMenu={productosMenu}
        clientes={clientes}
        soles={soles}
        estiloMetodo={estiloMetodo}
      />

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO PARA DELIVERY) */}
      <ModalOpcionesProducto
        abierto={optionsModalOpen && !!selectedProduct}
        producto={selectedProduct}
        onCerrar={() => {
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirmarItem={(item, notas, extras) => {
          agregarItemDeliveryDirecto(item, notas, extras);
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        }}
        getProductSteps={getProductSteps}
      />

      {/* MODAL DE CIERRE DE CAJA (ARQUEO DE TURNO) */}
      <ModalCierreCaja
        abierto={cierreModalOpen}
        onCerrar={() => setCierreModalOpen(false)}
        onCierreExitoso={async (newCierreISO) => {
          setUltimoCierre(newCierreISO);
          setMostrarTodoElDia(false);
          setCajaEstado({ abierto: false, turno: null, cargando: false });
          await fetchCajaData();
        }}
        cajaEstado={cajaEstado}
        ventas={ventas}
        abonos={abonos}
        clientes={clientes}
        mesas={mesas}
        ultimoCierre={ultimoCierre}
        empresa={COMPANY_CONFIG}
        cajeroNombre={cajeroNombre || currentUser?.nombre || 'Cajero'}
        parsearCreditoSplit={parsearCreditoSplit}
      />

      {/* MODAL DE APERTURA DE CAJA / INICIO DE TURNO */}
      <ModalAperturaCaja
        abierto={modalAperturaOpen}
        onCerrar={() => setModalAperturaOpen(false)}
        onAperturaExitosa={async () => {
          await fetchCajaData();
          aviso.exito('Turno de caja aperturado exitosamente');
        }}
        cajerosDisponibles={cajerosDisponibles}
        cajeroNombrePorDefecto={cajeroNombre || currentUser?.nombre || ''}
      />

      {/* MODAL DE SALIDA / RETIRO DE EFECTIVO DE CAJA */}
      <ModalRetiroCaja
        abierto={modalSalidaCajaOpen}
        onCerrar={() => setModalSalidaCajaOpen(false)}
        onMovimientoExitoso={async ({ tipo, monto }) => {
          await fetchCajaData();
          aviso.exito(tipo === 'INGRESO'
            ? `Ingreso de S/ ${monto.toFixed(2)} registrado en caja`
            : `Retiro de S/ ${monto.toFixed(2)} registrado correctamente`);
        }}
        cajeroNombre={usuarioOperador}
        tipoInicial={tipoMovimientoCaja}
      />

      {/* MODAL DE HISTORIAL DE CIERRES DE CAJA (POSTGRESQL) */}
      <ModalHistorialCierres
        abierto={historialCierresModalOpen}
        onCerrar={() => setHistorialCierresModalOpen(false)}
        cargandoHistorialCierres={cargandoHistorialCierres}
        historialCierres={historialCierres}
        onReimprimir={(cierre) => setCierreAImprimir(cierre)}
      />

      {/* MODAL DE REIMPRESIÓN DE TICKET DE CIERRE HISTÓRICO */}
      <ModalReimpresionCierre
        cierre={cierreAImprimir}
        onCerrar={() => setCierreAImprimir(null)}
        empresa={COMPANY_CONFIG}
      />

      {/* Modal: Corregir Método de Pago */}
      <ModalCorregirMetodoPago
        abierto={cambioMetodoModal}
        venta={ventaACambiar}
        onCerrar={() => setCambioMetodoModal(false)}
        onGuardar={async ({ ventaId, nuevoMetodo, pin, desgloseMixto }) => {
          const res = await api.cambiarMetodoPago(ventaId, nuevoMetodo, pin, desgloseMixto);
          if (res?.error) {
            throw new Error(res.error);
          }
          await fetchCajaData();
          aviso.exito('Método de pago actualizado exitosamente');
        }}
      />

      {/* Modal: Corregir Tipo de Entrega */}
      <ModalCorregirTipoEntrega
        abierto={cambioTipoEntregaModal}
        venta={ventaATipoCambiar}
        onCerrar={() => setCambioTipoEntregaModal(false)}
        onGuardar={async ({ ventaId, datos }) => {
          const res = await api.cambiarTipoEntrega(ventaId, datos);
          if (res?.error) {
            throw new Error(res.error);
          }
          await fetchCajaData();
          aviso.exito('Tipo de entrega corregido exitosamente');
        }}
      />

      {/* Modal: Autorizar Cancelación de Llevar/Delivery */}
      <ModalCancelarLlevar
        abierto={cancelLlevarModalOpen}
        pedido={pedidoACancelarLlevar}
        onCerrar={() => setCancelLlevarModalOpen(false)}
        onCanceladoExitoso={async () => {
          aviso.exito('Pedido cancelado. Cocina ha sido notificada.');
          await fetchCajaData();
        }}
        usuarioOperador={usuarioOperador}
      />

      {/* Modal Comprobante / Ticket SUNAT */}
      <ModalComprobanteSunat
        abierto={sunatModalOpen}
        comprobante={activeComprobante}
        empresa={COMPANY_CONFIG}
        facturacionElectronica={FACTURACION_ELECTRONICA}
        onCerrar={() => setSunatModalOpen(false)}
      />

      {/* Modal: Anular / Registrar Devolución de Venta */}
      <ModalAnularVenta
        abierto={anularVentaModal}
        venta={ventaAAnular}
        onCerrar={() => setAnularVentaModal(false)}
        onAnulacionExitosa={async () => {
          await fetchCajaData();
          aviso.exito('Devolución / Anulación registrada con éxito');
        }}
      />

      {/* Avisos flotantes de Caja (pedido listo, cancelado, operación exitosa) */}
      <AvisosCaja toasts={toasts} setToasts={setToasts} />
    </section>
  );
}
