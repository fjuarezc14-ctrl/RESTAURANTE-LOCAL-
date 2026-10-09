// ================================================================
// HOOK: usePedidoDelivery
// Pedido para llevar, delivery propio y PedidosYa desde Caja: estado del modal,
// productos del pedido, descuentos y pago, y el envío a cocina.
// ================================================================
import { useState, useRef } from 'react';
import { api } from '../../../api';
import { ORDEN_PRIORIDADES_CATEGORIAS } from '../../../config/company';
import { ordenarCategorias } from '../../../utils/busquedaProductos';
import { getComboConfig, tieneComplementos } from '../../../utils/combos';
import { parseDeliveryInfo } from '../../../utils/ventas';
import { pasosProducto } from '../../../utils/pasosProducto';
import { validarDatosDelivery } from '../utils/validarDelivery';
import { pedidoLlevar as pedidoLlevarEsquema } from '@shared/esquemas/pedidos.js';


export function usePedidoDelivery({
  aviso,
  usuarioOperador,
  cajaEstado,
  setModalAperturaOpen,
  productosMenu,
  setProductosMenu,
  fetchCajaData,
  avisarPedidosYaPrueba,
  abrirTicketImpresionDirecto,
}) {
  const [deliveryCodigoPago, setDeliveryCodigoPago] = useState('');
  const [deliveryMotivoCortesia, setDeliveryMotivoCortesia] = useState('');
  const [deliveryTelefono, setDeliveryTelefono] = useState('');
  const [deliveryDireccion, setDeliveryDireccion] = useState('');
  const [deliveryMontoEnvio, setDeliveryMontoEnvio] = useState('');
  const [deliveryConCuanto, setDeliveryConCuanto] = useState('');
  const [deliveryTipoComprobante, setDeliveryTipoComprobante] = useState('Ticket');
  const [deliveryMetodoPago, setDeliveryMetodoPago] = useState('Efectivo');
  const [deliveryMixtoEfectivo, setDeliveryMixtoEfectivo] = useState('');
  const [deliveryMixtoTarjeta, setDeliveryMixtoTarjeta] = useState('');
  const [deliveryMixtoYape, setDeliveryMixtoYape] = useState('');
  const [deliveryClienteNombre, setDeliveryClienteNombre] = useState('');
  const [deliveryNumDocumento, setDeliveryNumDocumento] = useState('');
  const [isBuscando, setIsBuscando] = useState(false);
  const [deliveryMontoCredito, setDeliveryMontoCredito] = useState('');
  const [deliveryClienteCreditoSeleccionado, setDeliveryClienteCreditoSeleccionado] = useState(null);
  const [deliveryDescuentoValor, setDeliveryDescuentoValor] = useState('');
  const [deliveryDescuentoTipo, setDeliveryDescuentoTipo] = useState('porcentaje'); // 'porcentaje' | 'monto'
  const [deliveryVistaMovil, setDeliveryVistaMovil] = useState('productos'); // 'productos' | 'pedido'
  const [pinAdminDelivery, setPinAdminDelivery] = useState('');
  const [cortesiaDeliveryIndices, setCortesiaDeliveryIndices] = useState([]);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [codigoPY, setCodigoPY] = useState('');
  const [deliverySearchQuery, setDeliverySearchQuery] = useState('');
  const [deliveryCategoriaFiltro, setDeliveryCategoriaFiltro] = useState('🔥 Más Pedidos');
  const [deliveryCategoriasModalOpen, setDeliveryCategoriasModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [itemsDelivery, setItemsDelivery] = useState([]);
  const [editingPedidoId, setEditingPedidoId] = useState(null);
  const [enviandoDelivery, setEnviandoDelivery] = useState(false);
  const [tipoDelivery, setTipoDelivery] = useState('PedidosYa'); // 'PedidosYa' | 'ParaLlevar'

  const deliverySearchInputRef = useRef(null);
  const claveIdempotenciaRef = useRef(null);

  const buscarClienteDelivery = async () => {
    if (!deliveryNumDocumento) return;
    setIsBuscando(true);
    const doc = deliveryNumDocumento.trim();

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setDeliveryClienteNombre(data.razonSocial || '');
        setDeliveryDireccion(data.direccion || '');
      } else {
        setDeliveryClienteNombre(data.nombre || '');
        if (data.direccion) setDeliveryDireccion(data.direccion);
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC en delivery:", err);
      aviso.advertencia("No se encontró el cliente o error en la consulta.");
    } finally {
      setIsBuscando(false);
    }
  };

  // --- Modal PedidosYa ---
  const abrirDeliveryModal = async () => {
    if (!cajaEstado.abierto) {
      setModalAperturaOpen(true);
      return;
    }
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(null);
    setItemsDelivery([]);
    setCodigoPY('');
    setDeliverySearchQuery('');
    setDeliveryTelefono('');
    setDeliveryDireccion('');
    setDeliveryMontoEnvio('');
    setDeliveryConCuanto('');
    setDeliveryTipoComprobante('Ticket');
    setDeliveryMetodoPago('Efectivo');
    setDeliveryCodigoPago('');
    setDeliveryClienteNombre('');
    setDeliveryNumDocumento('');
    setTipoDelivery('ParaLlevar');
    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryMotivoCortesia('');
    setDeliveryVistaMovil('productos');
    setDeliveryModal(true);
  };

  const iniciarModificarDelivery = async (p) => {
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(p.pedidoId);
    setItemsDelivery(p.items || []);
    setDeliverySearchQuery('');
    
    // Identificar el tipo de delivery
    let calculatedTipo = 'PedidosYa';
    let codePY = p.codigoPedidosYa || '';
    if (p.codigoPedidosYa?.startsWith('DELIVERY -')) {
      calculatedTipo = 'DeliveryPropio';
    } else if (p.codigoPedidosYa?.startsWith('LLEVAR -')) {
      calculatedTipo = 'ParaLlevar';
    }
    setTipoDelivery(calculatedTipo);
    setDeliveryCodigoPago('');

    // Poblar campos según tipo
    if (calculatedTipo === 'DeliveryPropio') {
      const parsed = parseDeliveryInfo(p.codigoPedidosYa);
      if (parsed) {
        setDeliveryClienteNombre(parsed.nombre);
        setDeliveryTelefono(parsed.telefono);
        setDeliveryDireccion(parsed.direccion);
        setDeliveryConCuanto(parsed.conCuanto || '');
      } else {
        setDeliveryClienteNombre(p.codigoPedidosYa.replace('DELIVERY - ', ''));
        setDeliveryTelefono('');
        setDeliveryDireccion('');
        setDeliveryConCuanto('');
      }
      setCodigoPY('');
    } else if (calculatedTipo === 'ParaLlevar') {
      setCodigoPY(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryClienteNombre(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    } else {
      setCodigoPY(codePY);
      setDeliveryClienteNombre('PEDIDOS YA');
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    }

    // Costo de delivery
    const itemsTotal = (p.items || []).reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = Math.max(0, p.total - itemsTotal);
    setDeliveryMontoEnvio(shippingFee > 0 ? String(shippingFee) : '');

    // Métodos de pago y comprobantes
    if (p.ventaData) {
      setDeliveryTipoComprobante(p.ventaData.tipoComprobante || 'Ticket');
      setDeliveryMetodoPago(p.ventaData.metodoPago || 'Efectivo');
      setDeliveryNumDocumento(p.ventaData.numDocumento || '');
      if (p.ventaData.metodoPago === 'Mixto') {
        setDeliveryMixtoEfectivo(p.ventaData.montoEfectivo ? String(p.ventaData.montoEfectivo) : '');
        setDeliveryMixtoTarjeta(p.ventaData.montoTarjeta ? String(p.ventaData.montoTarjeta) : '');
        setDeliveryMixtoYape(p.ventaData.montoYape ? String(p.ventaData.montoYape) : '');
      } else {
        setDeliveryMixtoEfectivo('');
        setDeliveryMixtoTarjeta('');
        setDeliveryMixtoYape('');
      }
    } else {
      setDeliveryTipoComprobante('Ticket');
      setDeliveryMetodoPago(calculatedTipo === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');
      setDeliveryNumDocumento('');
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
    }

    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryMotivoCortesia('');
    setDeliveryVistaMovil('productos');
    setDeliveryModal(true);
  };

  const getProductSteps = (prod, currentSelections = {}) => pasosProducto(prod, currentSelections, productosMenu);

  const agregarItemDelivery = (prod) => {
    if (!prod) return;

    const hasDynamicOptions = !!prod.opcionesConfig && (() => {
      try {
        const p = typeof prod.opcionesConfig === 'string' ? JSON.parse(prod.opcionesConfig) : prod.opcionesConfig;
        return Array.isArray(p) && p.length > 0;
      } catch { return false; }
    })();

    const isVirtualGroup = !!prod.esAgrupado;
    const traeComplementos = tieneComplementos(prod);
    const isMenu = prod && (prod.categoria === 'Menú' || prod.categoria?.toLowerCase().includes('menú') || prod.categoria?.toLowerCase().includes('menu'));
    const hasLegacyCombo = !prod.opcionesConfig && prod.requiereGuarnicion && !!getComboConfig(prod.nombre);
    const isLegacyMenu = !prod.opcionesConfig && prod.requiereGuarnicion && isMenu;
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
    
    agregarItemDeliveryDirecto(prod, null);
  };

  const agregarItemDeliveryDirecto = (prod, notas = null, extras = null) => {
    const cleanNotas = notas && String(notas).trim() ? String(notas).trim() : null;
    const opcionesElegidas = extras?.opciones || [];
    const precioExtra = extras?.precioExtra || 0;
    const idx = itemsDelivery.findIndex(i => i.id === String(prod.id) && i.notas === cleanNotas);
    
    // Contabilizar total de este producto en delivery actual (evita fuga de stock con notas distintas)
    const cantTotalEnTicket = itemsDelivery
      .filter(i => String(i.id) === String(prod.id))
      .reduce((sum, item) => sum + item.cant, 0);
    
    // Validar stock si es limitado
    if (prod.tipoStock === 'limitado' && cantTotalEnTicket >= prod.stock) {
      aviso.advertencia(`Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
      return;
    }

    const precioBase = prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio;
    const precioFinal = precioBase + precioExtra;

    if (idx >= 0) {
      const nuevo = [...itemsDelivery];
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
      setItemsDelivery(nuevo);
    } else {
      setItemsDelivery([...itemsDelivery, { 
        id: String(prod.id), 
        nombre: prod.nombre, 
        precio: precioFinal, 
        cant: 1,
        ofertaNombre: prod.ofertaNombre,
        precioOriginal: prod.precio,
        notas: cleanNotas,
        opciones: opcionesElegidas
      }]);
    }
  };

  const alterarItemDelivery = (idx, op) => {
    const nuevo = [...itemsDelivery];
    if (op === '+') {
      const prodOriginal = productosMenu.find(p => String(p.id) === String(nuevo[idx].id));
      const cantTotal = nuevo
        .filter(i => String(i.id) === String(nuevo[idx].id))
        .reduce((sum, item) => sum + item.cant, 0);
      if (prodOriginal && prodOriginal.tipoStock === 'limitado' && cantTotal >= prodOriginal.stock) {
        aviso.advertencia(`Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
        return;
      }
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
    } else {
      const nuevaCant = nuevo[idx].cant - 1;
      if (nuevaCant <= 0) {
        nuevo.splice(idx, 1);
      } else {
        nuevo[idx] = { ...nuevo[idx], cant: nuevaCant };
      }
    }
    setItemsDelivery(nuevo);
  };

  const alterarNotasDelivery = (idx, value) => {
    const nuevo = [...itemsDelivery];
    nuevo[idx] = { ...nuevo[idx], notas: value };
    setItemsDelivery(nuevo);
  };

  const enviarDeliveryACocina = async () => {
    if (itemsDelivery.length === 0) { aviso.advertencia('Debes agregar al menos un producto.'); return; }
    // Pedidos nuevos por PedidosYa deshabilitados (versión de prueba)
    if (tipoDelivery === 'PedidosYa' && !editingPedidoId) { avisarPedidosYaPrueba(); return; }

    // Validar datos según el canal seleccionado
    const errorDatos = validarDatosDelivery({
      tipoDelivery, codigoPY, deliveryTipoComprobante, deliveryNumDocumento,
      deliveryClienteNombre, deliveryDireccion, deliveryTelefono,
    });
    if (errorDatos) { aviso.advertencia(errorDatos); return; }

    // Validar PIN de administrador si el método de pago es Consumo o Cortesía, o si hay ítems de cortesía
    const tieneCortesias = deliveryMetodoPago === 'Consumo' || deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0;
    if (tieneCortesias) {
      if (!pinAdminDelivery.trim()) {
        aviso.advertencia(`Debes ingresar el PIN del administrador/cajero para autorizar ${deliveryMetodoPago === "Consumo" ? "un Consumo de Personal" : "la Cortesía"}.`);
        return;
      }
      const authResult = await api.validateAuth(pinAdminDelivery.trim());
      if (!authResult || !authResult.ok) {
        aviso.error(`PIN incorrecto. Solo el administrador/cajero puede autorizar ${deliveryMetodoPago === "Consumo" ? "un Consumo de Personal" : "la Cortesía"}.`);
        setPinAdminDelivery('');
        return;
      }
    }

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Crédito') {
      if (!deliveryClienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Mapear items finales marcando a S/ 0.00 los que sean de cortesía
    const itemsFinales = itemsDelivery.map((item, idx) => {
      const esCortesia = deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx);
      if (esCortesia) {
        return {
          ...item,
          precio: 0,
          notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
        };
      }
      return item;
    });

    // Validar y calcular montos si es Pago Mixto
    let deliveryFinalMontoEfectivo = 0;
    let deliveryFinalMontoTarjeta = 0;
    let deliveryFinalMontoYape = 0;
    let deliveryFinalMontoCredito = 0;
    
    const itemsTotal = itemsFinales.reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;

    // Descuento para llevar/delivery: porcentual o monto fijo en soles
    const descVal = Math.max(0, parseFloat(deliveryDescuentoValor || 0) || 0);
    const descEsPct = deliveryDescuentoTipo === 'porcentaje';
    const descPct = descEsPct ? Math.min(100, descVal) : 0;
    const descuentoMonto = (descVal > 0 && itemsTotal > 0)
      ? parseFloat((descEsPct ? itemsTotal * (descPct / 100) : Math.min(descVal, itemsTotal)).toFixed(2))
      : 0;
    const totalConDescuento = Math.max(0, itemsTotal - descuentoMonto);
    const grandTotal = deliveryMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = descuentoMonto;
    const descuentoEtiqueta = descEsPct ? `${descPct}%` : `S/ ${descuentoMonto.toFixed(2)}`;

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Mixto') {
      const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
      const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
      const yapeVal = parseFloat(deliveryMixtoYape || 0);
      const credVal = parseFloat(deliveryMontoCredito || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0 || credVal < 0) {
        aviso.advertencia('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (credVal > 0 && !deliveryClienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente para la porción de pago a crédito.');
        return;
      }

      if (tarjVal + yapeVal + credVal > (grandTotal + 0.01)) {
        aviso.advertencia('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar.');
        return;
      }

      const restante = parseFloat(Math.max(0, grandTotal - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, restante - efecVal).toFixed(2));
        aviso.error(`Monto insuficiente. Debes cubrir el total de S/ ${grandTotal.toFixed(2)}. Faltan S/ ${faltante.toFixed(2)}`);
        return;
      }

      deliveryFinalMontoEfectivo = restante;
      deliveryFinalMontoTarjeta = tarjVal;
      deliveryFinalMontoYape = yapeVal;
      deliveryFinalMontoCredito = credVal;
    }

    setEnviandoDelivery(true);
    try {
      let codigoFormateado = '';
      const vueltoVal = (() => {
        const conC = parseFloat(deliveryConCuanto);
        return (!isNaN(conC) && conC >= grandTotal) ? (conC - grandTotal).toFixed(2) : '0.00';
      })();

      if (tipoDelivery === 'PedidosYa') {
        codigoFormateado = codigoPY.trim().toUpperCase();
      } else if (tipoDelivery === 'ParaLlevar') {
        codigoFormateado = `LLEVAR - ${codigoPY.trim().toUpperCase()}`;
      } else if (tipoDelivery === 'DeliveryPropio') {
        codigoFormateado = `DELIVERY - ${deliveryClienteNombre.trim().toUpperCase()} | TEL: ${deliveryTelefono.trim()} | DIR: ${deliveryDireccion.trim()} | PAGA: ${deliveryConCuanto || '0.00'} | VUELTO: ${vueltoVal}`;
      }

      const payload = {
        codigoPedidosYa: codigoFormateado,
        cajero: usuarioOperador,
        items: itemsFinales,
        total: grandTotal,
        tipoDelivery,
        tipoComprobante: tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante,
        metodoPago: tipoDelivery === 'PedidosYa' ? 'PedidosYa' : deliveryMetodoPago,
        montoEfectivo: deliveryMetodoPago === 'Efectivo' ? grandTotal : deliveryFinalMontoEfectivo,
        montoTarjeta: deliveryMetodoPago === 'Tarjeta' ? grandTotal : deliveryFinalMontoTarjeta,
        montoYape: deliveryMetodoPago === 'Yape' ? grandTotal : deliveryFinalMontoYape,
        montoCredito: deliveryMetodoPago === 'Crédito' ? grandTotal : deliveryFinalMontoCredito,
        clienteCreditoId: deliveryClienteCreditoSeleccionado?.id || null,
        numDocumento: tipoDelivery === 'PedidosYa' ? codigoFormateado : (deliveryNumDocumento || 'S/D'),
        nombreCliente: tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'),
        clienteDireccion: tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : (deliveryDireccion || ''),
        montoDelivery: shippingFee,
        telefono: deliveryTelefono || null,
        descuentoPorcentaje: descPct,
        descuentoMonto: descEsPct ? 0 : descuentoMonto,
        descuentoDescripcion: descuentoFinal > 0 ? `Descuento manual ${descuentoEtiqueta}` : null,
        motivoCortesia: deliveryMotivoCortesia.trim() || null,
        // El backend vuelve a validar el PIN de quien autorizó la cortesía o el consumo
        ...(tieneCortesias ? { autorizacion: { pin: pinAdminDelivery.trim() } } : {}),
        codigoPago: deliveryCodigoPago.trim() || null,
      };

      // Mismas reglas que el backend (backend/shared/esquemas/pedidos.js)
      const validacionPedido = pedidoLlevarEsquema.safeParse(payload);
      if (!validacionPedido.success) {
        aviso.advertencia(validacionPedido.error.issues?.[0]?.message || 'Revisa los datos del pedido.');
        return;
      }

      // La misma clave en los reintentos de este pedido; se renueva cuando sale bien
      if (!claveIdempotenciaRef.current) claveIdempotenciaRef.current = crypto.randomUUID();
      const result = editingPedidoId
        ? await api.actualizarDelivery(editingPedidoId, validacionPedido.data)
        : await api.crearPedidoLlevar(validacionPedido.data, claveIdempotenciaRef.current);

      if (result.error) throw new Error(result.error);
      claveIdempotenciaRef.current = null;

      // Cerrar modal y recargar datos de Caja
      setDeliveryModal(false);
      setEditingPedidoId(null);
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
      setDeliveryMontoCredito('');
      setDeliveryClienteCreditoSeleccionado(null);
      setDeliveryDescuentoValor('');
      setPinAdminDelivery('');
      setCortesiaDeliveryIndices([]);
      setDeliveryMotivoCortesia('');
      await fetchCajaData();
      
      // Si es Para Llevar o Delivery Propio con comprobante Boleta o Factura (o Ticket), activamos el ticket de impresión
      if (tipoDelivery !== 'PedidosYa') {
        // Para que en la impresión figuren los items reales del ticket
        const itemsImpresion = [...itemsFinales];
        if (shippingFee > 0) {
          itemsImpresion.push({
            id: '9999',
            nombre: 'Servicio de Delivery',
            precio: shippingFee,
            cant: 1
          });
        }
        
        const deliveryInfo = tipoDelivery === 'DeliveryPropio' ? {
          nombre: deliveryClienteNombre,
          telefono: deliveryTelefono,
          direccion: deliveryDireccion,
          montoDelivery: shippingFee,
          conCuanto: deliveryConCuanto || '0.00',
          vuelto: vueltoVal,
        } : null;

        const descCortesiaTicket = (deliveryMetodoPago === 'Cortesía')
          ? (payload.motivoCortesia ? `Cortesía total (${payload.motivoCortesia})` : 'Cortesía total del pedido')
          : (cortesiaDeliveryIndices.length > 0
              ? (payload.motivoCortesia ? `Cortesía de ítems (${payload.motivoCortesia})` : 'Cortesía de ítems')
              : (descuentoFinal > 0 ? `Descuento ${descuentoEtiqueta}` : null));

        abrirTicketImpresionDirecto(
          grandTotal, 
          result.venta, 
          tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante, 
          tipoDelivery === 'PedidosYa' ? null : (deliveryNumDocumento || null), 
          tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'), 
          tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : '', 
          itemsImpresion, 
          tipoDelivery === 'DeliveryPropio' ? 'Delivery' : 'Llevar',
          deliveryInfo,
          descuentoFinal,
          descCortesiaTicket
        );
      } else {
        aviso.exito(`Pedido ${codigoPY.toUpperCase()} enviado a Cocina. Venta registrada.`);
      }
    } catch (err) {
      aviso.error('Error: ' + err.message);
    } finally {
      setEnviandoDelivery(false);
    }
  };

  const cortesiaDeliveryItemsTotal = itemsDelivery.reduce((s, i, idx) => {
    if (deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx)) return s;
    return s + i.cant * i.precio;
  }, 0);

  const totalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : cortesiaDeliveryItemsTotal;

  const deliveryDescVal = Math.max(0, parseFloat(deliveryDescuentoValor || 0) || 0);

  const deliveryDescPct = deliveryDescuentoTipo === 'porcentaje' ? Math.min(100, deliveryDescVal) : 0;

  const deliveryDescuentoMonto = (deliveryDescVal > 0 && totalDelivery > 0)
    ? parseFloat((deliveryDescuentoTipo === 'porcentaje' ? totalDelivery * (deliveryDescPct / 100) : Math.min(deliveryDescVal, totalDelivery)).toFixed(2))
    : 0;

  const deliveryTotalConDescuento = Math.max(0, totalDelivery - deliveryDescuentoMonto);

  const deliveryShippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;

  const grandTotalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : (deliveryTotalConDescuento + deliveryShippingFee);

  // ── Categorías del modal de nuevo pedido: unas pocas en la barra + "Ver todas" ──
  const CATEGORIAS_VISIBLES = 5;

  const deliveryCategoriasOrdenadas = ordenarCategorias(
    ['🔥 Más Pedidos', 'Todos', ...new Set(productosMenu.filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas').map(p => p.categoria))],
    ORDEN_PRIORIDADES_CATEGORIAS
  );

  const deliveryCategoriasBarra = deliveryCategoriasOrdenadas.slice(0, CATEGORIAS_VISIBLES);

  const contarProductosCategoriaDelivery = (cat) => {
    const activos = productosMenu.filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas');
    if (cat === '🔥 Más Pedidos') return Math.min(8, activos.length);
    return cat === 'Todos' ? activos.length : activos.filter(p => p.categoria === cat).length;
  };

  return {
    deliveryCodigoPago,
    deliveryMotivoCortesia,
    deliveryTelefono,
    deliveryDireccion,
    deliveryMontoEnvio,
    deliveryConCuanto,
    deliveryTipoComprobante,
    deliveryMetodoPago,
    deliveryMixtoEfectivo,
    deliveryMixtoTarjeta,
    deliveryMixtoYape,
    deliveryClienteNombre,
    deliveryNumDocumento,
    isBuscando,
    deliveryMontoCredito,
    deliveryClienteCreditoSeleccionado,
    deliveryDescuentoValor,
    deliveryDescuentoTipo,
    deliveryVistaMovil,
    pinAdminDelivery,
    cortesiaDeliveryIndices,
    deliveryModal,
    codigoPY,
    deliverySearchQuery,
    deliveryCategoriaFiltro,
    deliveryCategoriasModalOpen,
    optionsModalOpen,
    selectedProduct,
    itemsDelivery,
    editingPedidoId,
    enviandoDelivery,
    tipoDelivery,
    setDeliveryCodigoPago,
    setDeliveryMotivoCortesia,
    setDeliveryTelefono,
    setDeliveryDireccion,
    setDeliveryMontoEnvio,
    setDeliveryConCuanto,
    setDeliveryTipoComprobante,
    setDeliveryMetodoPago,
    setDeliveryMixtoEfectivo,
    setDeliveryMixtoTarjeta,
    setDeliveryMixtoYape,
    setDeliveryClienteNombre,
    setDeliveryNumDocumento,
    setDeliveryMontoCredito,
    setDeliveryClienteCreditoSeleccionado,
    setDeliveryDescuentoValor,
    setDeliveryDescuentoTipo,
    setDeliveryVistaMovil,
    setPinAdminDelivery,
    setCortesiaDeliveryIndices,
    setDeliveryModal,
    setCodigoPY,
    setDeliverySearchQuery,
    setDeliveryCategoriaFiltro,
    setDeliveryCategoriasModalOpen,
    setOptionsModalOpen,
    setSelectedProduct,
    setItemsDelivery,
    setEditingPedidoId,
    setTipoDelivery,
    deliverySearchInputRef,
    buscarClienteDelivery,
    abrirDeliveryModal,
    iniciarModificarDelivery,
    getProductSteps,
    agregarItemDelivery,
    agregarItemDeliveryDirecto,
    alterarItemDelivery,
    alterarNotasDelivery,
    enviarDeliveryACocina,
    totalDelivery,
    deliveryDescVal,
    deliveryDescPct,
    deliveryDescuentoMonto,
    deliveryShippingFee,
    grandTotalDelivery,
    CATEGORIAS_VISIBLES,
    deliveryCategoriasOrdenadas,
    deliveryCategoriasBarra,
    contarProductosCategoriaDelivery,
  };
}
