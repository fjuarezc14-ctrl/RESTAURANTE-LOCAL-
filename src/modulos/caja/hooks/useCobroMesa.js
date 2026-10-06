// ================================================================
// HOOK PERSONALIZADO: useCobroMesa
// VT VALETEC — Estado y Cálculos del Cobro de Mesas en Caja
// ================================================================
import { useState, useCallback } from 'react';
import { api } from '../../../api';

/**
 * Hook para centralizar los estados del formulario de cobro de mesa,
 * métodos de pago, comprobantes, cortesías y créditos.
 */
export function useCobroMesa() {
  // Modal de cobro de mesa y mesa activa
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

  // Comprobante y datos de cliente
  const [tipoComprobante, setTipoComprobante] = useState('Ticket');
  const [numDocumento, setNumDocumento] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [isBuscando, setIsBuscando] = useState(false);

  // Método de pago y trazabilidad
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [codigoPago, setCodigoPago] = useState('');
  const [pagaConEfectivoMesa, setPagaConEfectivoMesa] = useState('');

  // Desglose para Pago Mixto
  const [mixtoEfectivo, setMixtoEfectivo] = useState('');
  const [mixtoTarjeta, setMixtoTarjeta] = useState('');
  const [mixtoYape, setMixtoYape] = useState('');
  const [montoCreditoMixto, setMontoCreditoMixto] = useState('');

  // Crédito
  const [clienteCreditoSeleccionado, setClienteCreditoSeleccionado] = useState(null);
  const [clientesCreditoMixto, setClientesCreditoMixto] = useState([{ clienteId: '', monto: '', nombre: '' }]);
  const [incluirCreditoMixto, setIncluirCreditoMixto] = useState(false);

  // Cortesías
  const [cortesiaItemIds, setCortesiaItemIds] = useState([]);
  const [motivoCortesia, setMotivoCortesia] = useState('');

  // Consumo personal / PIN
  const [consumoPin, setConsumoPin] = useState('');
  const [consumoPinError, setConsumoPinError] = useState('');

  // Modal de confirmación final antes de enviar a API
  const [modalConfirmarCobro, setModalConfirmarCobro] = useState(false);
  const [datosConfirmacionCobro, setDatosConfirmacionCobro] = useState(null);
  const [cobrando, setCobrando] = useState(false);

  /**
   * Resetea todos los campos del cobro al estado inicial limpio
   */
  const limpiarFormularioCobro = useCallback(() => {
    setNumDocumento('');
    setClienteNombre('');
    setClienteDireccion('');
    setMetodoPago('Efectivo');
    setCodigoPago('');
    setPagaConEfectivoMesa('');
    setMixtoEfectivo('');
    setMixtoTarjeta('');
    setMixtoYape('');
    setMontoCreditoMixto('');
    setClienteCreditoSeleccionado(null);
    setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
    setIncluirCreditoMixto(false);
    setCortesiaItemIds([]);
    setMotivoCortesia('');
    setConsumoPin('');
    setConsumoPinError('');
    setDatosConfirmacionCobro(null);
    setModalConfirmarCobro(false);
  }, []);

  /**
   * Abre el modal de cobro para una mesa específica
   */
  const abrirCobroParaMesa = useCallback((mesa) => {
    limpiarFormularioCobro();
    setTipoComprobante('Ticket');
    setMesaSeleccionada(mesa);
    setModalOpen(true);
  }, [limpiarFormularioCobro]);

  /**
   * Cierra el modal de cobro y limpia el formulario
   */
  const cerrarCobroMesa = useCallback(() => {
    setModalOpen(false);
    setMesaSeleccionada(null);
    limpiarFormularioCobro();
  }, [limpiarFormularioCobro]);

  /**
   * Búsqueda automática de RUC o DNI
   */
  const buscarDatosCliente = useCallback(async (doc) => {
    if (!doc || !doc.trim()) return;
    setIsBuscando(true);
    const cleaned = doc.trim();
    try {
      const data = await api.consultarCliente(cleaned);
      if (cleaned.length === 11) {
        setClienteNombre(data?.razonSocial || data?.nombre || '');
        setClienteDireccion(data?.direccion || '');
        setTipoComprobante('Factura');
      } else {
        setClienteNombre(data?.nombre || '');
        setClienteDireccion(data?.direccion || '');
        setTipoComprobante('Boleta');
      }
    } catch (err) {
      console.warn('Error al consultar cliente:', err);
    } finally {
      setIsBuscando(false);
    }
  }, []);

  return {
    modalOpen,
    setModalOpen,
    mesaSeleccionada,
    setMesaSeleccionada,

    tipoComprobante,
    setTipoComprobante,
    numDocumento,
    setNumDocumento,
    clienteNombre,
    setClienteNombre,
    clienteDireccion,
    setClienteDireccion,
    isBuscando,

    metodoPago,
    setMetodoPago,
    codigoPago,
    setCodigoPago,
    pagaConEfectivoMesa,
    setPagaConEfectivoMesa,

    mixtoEfectivo,
    setMixtoEfectivo,
    mixtoTarjeta,
    setMixtoTarjeta,
    mixtoYape,
    setMixtoYape,
    montoCreditoMixto,
    setMontoCreditoMixto,

    clienteCreditoSeleccionado,
    setClienteCreditoSeleccionado,
    clientesCreditoMixto,
    setClientesCreditoMixto,
    incluirCreditoMixto,
    setIncluirCreditoMixto,

    cortesiaItemIds,
    setCortesiaItemIds,
    motivoCortesia,
    setMotivoCortesia,

    consumoPin,
    setConsumoPin,
    consumoPinError,
    setConsumoPinError,

    modalConfirmarCobro,
    setModalConfirmarCobro,
    datosConfirmacionCobro,
    setDatosConfirmacionCobro,
    cobrando,
    setCobrando,

    limpiarFormularioCobro,
    abrirCobroParaMesa,
    cerrarCobroMesa,
    buscarDatosCliente,
  };
}
