// ================================================================
// HOOK: useCobroMesa
// Cobro de una mesa: formulario (comprobante, cliente, método de pago, mixto,
// crédito, cortesías y consumo), confirmación y registro de la venta.
// ================================================================
import { useState } from 'react';
import { api } from '../../../api';
import { parseMonto } from '../../../utils/ventas';
import { itemsSinServir, mesaEnPreparacion, platosEnPreparacion, platosSinServir } from '../utils/mesas';
import { cobro as cobroEsquema } from '@shared/esquemas/ventas.js';


export function useCobroMesa({
  aviso,
  addToast,
  clientes,
  cajaEstado,
  setModalAperturaOpen,
  usuarioOperador,
  fetchCajaData,
  abrirTicketImpresionDirecto,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState('Ticket');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [codigoPago, setCodigoPago] = useState('');
  const [mixtoEfectivo, setMixtoEfectivo] = useState('');
  const [mixtoTarjeta, setMixtoTarjeta] = useState('');
  const [mixtoYape, setMixtoYape] = useState('');
  const [numDocumento, setNumDocumento] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [cortesiaItemIds, setCortesiaItemIds] = useState([]);
  const [motivoCortesia, setMotivoCortesia] = useState('');
  const [modalConfirmarCobro, setModalConfirmarCobro] = useState(false);
  const [datosConfirmacionCobro, setDatosConfirmacionCobro] = useState(null);
  const [consumoPin, setConsumoPin] = useState('');
  const [consumoPinError, setConsumoPinError] = useState('');
  const [clienteCreditoSeleccionado, setClienteCreditoSeleccionado] = useState(null);
  const [clientesCreditoMixto, setClientesCreditoMixto] = useState([{ clienteId: '', monto: '', nombre: '' }]);
  const [incluirCreditoMixto, setIncluirCreditoMixto] = useState(false);
  const [pagaConEfectivoMesa, setPagaConEfectivoMesa] = useState('');

  const handleDocumentoChange = (val) => {
    setNumDocumento(val);
    const cleaned = val.trim();
    if (cleaned === '20613857321') {
      setClienteNombre('FIRST FISH S.A.C.');
      setClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setTipoComprobante('Factura');
    } else if (cleaned === '10404040404') {
      setClienteNombre('JUAN PEREZ SOTO');
      setClienteDireccion('CALLE SAN MARTÍN 109');
      setTipoComprobante('Boleta');
    }
  };

  const procesarCobroYFacturar = async () => {
    if (cobrando) return;
    if (!mesaSeleccionada || !mesaSeleccionada.pedidoData) return;
    if (tipoComprobante === 'Factura') {
      if (!numDocumento || numDocumento.trim().length !== 11) {
        aviso.advertencia('Para emitir Factura, el RUC debe tener 11 dígitos.');
        return;
      }
      if (!clienteNombre || !clienteNombre.trim()) {
        aviso.advertencia('Por favor, busca y valida el RUC del cliente antes de cobrar.');
        return;
      }
      if (!clienteDireccion || !clienteDireccion.trim()) {
        aviso.advertencia('La Dirección fiscal del cliente es obligatoria para emitir una Factura. Por favor, ingrésala.');
        return;
      }
    }

    const items = mesaSeleccionada.pedidoData.items || [];
    const itemsNormales = items.filter(i => !cortesiaItemIds.includes(i.itemId));
    // Cortesía total: todos los productos van a S/ 0.00
    const total = metodoPago === 'Cortesía' ? 0 : itemsNormales.reduce((s, i) => s + (i.cant * i.precio), 0);
    const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;

    // Si es Consumo o Cortesía (total o individual), requerir PIN de supervisor/cajero en el modal
    if (metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales) {
      if (!consumoPin.trim()) {
        setConsumoPinError(`El PIN es requerido para autorizar la Cortesía / Consumo.`);
        return;
      }
      
      try {
        const auth = await api.validateAuth(consumoPin.trim());
        if (auth.error) throw new Error(auth.error);
      } catch (err) {
        setConsumoPinError("PIN de autorización incorrecto o no autorizado.");
        return;
      }
    }

    if (metodoPago === 'Crédito') {
      if (!clienteCreditoSeleccionado) {
        aviso.advertencia('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Validar y calcular montos
    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;
    let finalCreditosDetalle = [];
    let finalClienteCreditoId = null;

    if (metodoPago === 'Efectivo') {
      finalMontoEfectivo = total;
    } else if (metodoPago === 'Tarjeta') {
      finalMontoTarjeta = total;
    } else if (metodoPago === 'Yape') {
      finalMontoYape = total;
    } else if (metodoPago === 'Mixto') {
      const efecVal = parseMonto(mixtoEfectivo);
      const tarjVal = parseMonto(mixtoTarjeta);
      const yapeVal = parseMonto(mixtoYape);
      
      let credVal = 0;
      if (incluirCreditoMixto) {
        const validos = (clientesCreditoMixto || []).filter(c => c.clienteId && parseMonto(c.monto) > 0);
        if (validos.length === 0) {
          aviso.advertencia('Has marcado incluir crédito en Pago Mixto. Debes seleccionar al menos un cliente de crédito e ingresar su monto.');
          return;
        }

        credVal = validos.reduce((s, c) => s + parseMonto(c.monto), 0);
        finalCreditosDetalle = validos.map(c => {
          const found = clientes.find(cli => String(cli.id) === String(c.clienteId));
          return {
            clienteId: parseInt(c.clienteId),
            nombre: found?.nombre || c.nombre || '',
            monto: parseMonto(c.monto)
          };
        });
        finalClienteCreditoId = finalCreditosDetalle[0].clienteId;
      }

      if (tarjVal + yapeVal + credVal > (total + 0.01)) {
        aviso.advertencia('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar. El vuelto solo aplica sobre Efectivo.');
        return;
      }

      const restante = parseFloat(Math.max(0, total - (tarjVal + yapeVal + credVal)).toFixed(2));
      if (efecVal < (restante - 0.01)) {
        const faltante = parseFloat(Math.max(0, total - (efecVal + tarjVal + yapeVal + credVal)).toFixed(2));
        aviso.error(`Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}. Faltan S/ ${faltante.toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
      finalMontoCredito = credVal;
    } else if (metodoPago === 'Crédito') {
      finalCreditosDetalle = [{
        clienteId: clienteCreditoSeleccionado.id,
        nombre: clienteCreditoSeleccionado.nombre,
        monto: total
      }];
      finalClienteCreditoId = clienteCreditoSeleccionado.id;
      finalMontoCredito = total;
    }

    let pagaConNum = total;
    let vueltoNum = 0;

    if (metodoPago === 'Efectivo') {
      pagaConNum = parseMonto(pagaConEfectivoMesa) || total;
      vueltoNum = pagaConNum > total ? Math.round((pagaConNum - total) * 100) / 100 : 0;
    } else if (metodoPago === 'Mixto') {
      const efecIngresado = parseMonto(mixtoEfectivo);
      pagaConNum = efecIngresado > 0 ? efecIngresado : finalMontoEfectivo;
      vueltoNum = efecIngresado > finalMontoEfectivo ? Math.round((efecIngresado - finalMontoEfectivo) * 100) / 100 : 0;
    }

    const payloadCobro = {
      pedidoIds: mesaSeleccionada.pedidoData.pedidoIds,
      tipoComprobante,
      numDocumento: numDocumento || null,
      nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
      total,
      metodoPago,
      montoEfectivo: finalMontoEfectivo,
      montoTarjeta: finalMontoTarjeta,
      montoYape: finalMontoYape,
      montoCredito: finalMontoCredito,
      clienteCreditoId: finalClienteCreditoId,
      creditosDetalle: finalCreditosDetalle,
      clienteDireccion: clienteDireccion || '',
      cortesiaItemIds: cortesiaItemIds,
      motivoCortesia: motivoCortesia.trim() || null,
      cajeroNombre: usuarioOperador,
      codigoPago: codigoPago.trim() || null,
    };
    // Mismas reglas que el backend (backend/shared/esquemas/ventas.js)
    const validacionCobro = cobroEsquema.safeParse(payloadCobro);
    if (!validacionCobro.success) {
      aviso.advertencia(validacionCobro.error.issues?.[0]?.message || 'Revisa los datos del cobro.');
      return;
    }

    // Guardar los datos preparados para la confirmación
    setDatosConfirmacionCobro({
      mesaNum: mesaSeleccionada.num,
      esDelivery: mesaSeleccionada.num === 'DELIVERY',
      tipoComprobante,
      nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
      numDocumento: numDocumento || null,
      clienteDireccion: clienteDireccion || '',
      metodoPago,
      total,
      pagaCon: pagaConNum,
      vuelto: vueltoNum,
      finalMontoEfectivo,
      finalMontoTarjeta,
      finalMontoYape,
      finalMontoCredito,
      finalClienteCreditoId,
      finalCreditosDetalle,
      cortesiaItemIds,
      itemsParaImpresion: items,
      payload: validacionCobro.data,
    });

    // Abrir modal de confirmación antes de ejecutar la transacción
    setModalConfirmarCobro(true);
  };

  const ejecutarCobroFinal = async () => {
    if (cobrando || !datosConfirmacionCobro) return;
    setCobrando(true);
    try {
      const { payload, total, itemsParaImpresion, mesaNum, tipoComprobante: tComp, numDocumento: nDoc, nombreCliente: nomCli, clienteDireccion: dirCli, metodoPago: mPago } = datosConfirmacionCobro;

      const response = await api.cobrar(payload);

      setModalConfirmarCobro(false);
      setDatosConfirmacionCobro(null);
      setPagaConEfectivoMesa('');
      setModalOpen(false);
      setNumDocumento('');
      setClienteNombre('');
      setClienteDireccion('');
      setConsumoPin('');
      setConsumoPinError('');
      setMixtoEfectivo('');
      setMixtoTarjeta('');
      setMixtoYape('');
      setClienteCreditoSeleccionado(null);
      setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
      setIncluirCreditoMixto(false);
      setCortesiaItemIds([]);
      setMotivoCortesia('');

      // Desencadenar la visualización e impresión del comprobante (solo si no es Consumo Personal)
      if (mPago !== 'Consumo') {
        const itemsCortesiaDescuento = (itemsParaImpresion || [])
          .filter(item => payload.cortesiaItemIds?.includes(item.itemId))
          .reduce((sum, item) => sum + (parseFloat(item.precio || 0) * parseInt(item.cant || 1)), 0);

        const itemsFormat = (itemsParaImpresion || []).map(item => {
          if (payload.cortesiaItemIds?.includes(item.itemId)) {
            return {
              ...item,
              precio: 0,
              notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
            };
          }
          return item;
        });

        const descCortesiaTicket = itemsCortesiaDescuento > 0 
          ? (payload.motivoCortesia ? `Cortesía de ítems (${payload.motivoCortesia})` : 'Cortesía de ítems')
          : (mPago === 'Cortesía' ? (payload.motivoCortesia ? `Cortesía total (${payload.motivoCortesia})` : 'Cortesía total') : null);

        abrirTicketImpresionDirecto(
          total,
          response,
          tComp,
          nDoc || null,
          nomCli || 'Consumidor Final',
          dirCli || '',
          itemsFormat,
          mesaNum,
          null,
          itemsCortesiaDescuento,
          descCortesiaTicket
        );
      } else {
        aviso.exito('Consumo Personal registrado. Mesa liberada.');
      }

      await fetchCajaData();
    } catch (err) {
      aviso.error('Error al procesar cobro: ' + err.message);
    } finally {
      setCobrando(false);
    }
  };

  const abrirCobroMesa = (m) => {
    if (!cajaEstado.abierto) {
      setModalAperturaOpen(true);
      return;
    }
    // No se cobra una mesa con platos en preparación: se perderían de cocina y barra
    if (mesaEnPreparacion(m)) {
      const n = platosEnPreparacion(m);
      addToast(`⏳ La Mesa ${m.num} aún tiene ${n > 0 ? `${n} plato(s)` : 'pedidos'} en preparación. Podrás cobrarla cuando cocina y barra los marquen como listos.`, 'warning');
      return;
    }
    // Tampoco si hay platos listos que el mozo todavía no llevó a la mesa
    if (platosSinServir(m) > 0) {
      const detalle = itemsSinServir(m).map(i => `${i.cant}× ${i.nombre}`).join(', ');
      addToast(`🍽️ La Mesa ${m.num} tiene platos sin servir: ${detalle}. Podrás cobrarla cuando el mozo los marque como servidos.`, 'warning');
      return;
    }
    setMesaSeleccionada(m);
    setTipoComprobante('Boleta');
    setMetodoPago('Efectivo');
    setCodigoPago('');
    setPagaConEfectivoMesa('');
    setNumDocumento('');
    setClienteNombre('');
    setClienteDireccion('');
    setConsumoPin('');
    setConsumoPinError('');
    setMotivoCortesia('');
    setCortesiaItemIds([]);
    setClienteCreditoSeleccionado(null);
    setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
    setIncluirCreditoMixto(false);
    setMixtoEfectivo('');
    setMixtoTarjeta('');
    setMixtoYape('');
    setModalOpen(true);
  };

  return {
    modalOpen,
    mesaSeleccionada,
    tipoComprobante,
    metodoPago,
    codigoPago,
    mixtoEfectivo,
    mixtoTarjeta,
    mixtoYape,
    numDocumento,
    clienteNombre,
    clienteDireccion,
    cobrando,
    cortesiaItemIds,
    motivoCortesia,
    modalConfirmarCobro,
    datosConfirmacionCobro,
    consumoPin,
    consumoPinError,
    clienteCreditoSeleccionado,
    clientesCreditoMixto,
    incluirCreditoMixto,
    pagaConEfectivoMesa,
    setModalOpen,
    setMesaSeleccionada,
    setTipoComprobante,
    setMetodoPago,
    setCodigoPago,
    setMixtoEfectivo,
    setMixtoTarjeta,
    setMixtoYape,
    setNumDocumento,
    setClienteNombre,
    setClienteDireccion,
    setCortesiaItemIds,
    setMotivoCortesia,
    setModalConfirmarCobro,
    setConsumoPin,
    setConsumoPinError,
    setClienteCreditoSeleccionado,
    setClientesCreditoMixto,
    setIncluirCreditoMixto,
    setPagaConEfectivoMesa,
    handleDocumentoChange,
    procesarCobroYFacturar,
    ejecutarCobroFinal,
    abrirCobroMesa,
  };
}
