// ================================================================
// HOOK PERSONALIZADO: useVentasTurno
// VT VALETEC — Gestión de Ventas, Filtros y Acciones del Turno
// ================================================================
import { useState, useCallback, useMemo } from 'react';

/**
 * Hook para administrar el historial de ventas del turno, filtros por medio de pago
 * y las aperturas de modales de anulación, corrección de método y corrección de entrega.
 */
export function useVentasTurno() {
  // Lista de ventas realizadas en el turno
  const [ventas, setVentas] = useState([]);

  // Filtro activo de método de pago en la vista
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');

  // Modal y venta para Anulación / Devolución
  const [anularVentaModal, setAnularVentaModal] = useState(false);
  const [ventaAAnular, setVentaAAnular] = useState(null);

  // Modal y venta para Corregir Método de Pago
  const [cambioMetodoModal, setCambioMetodoModal] = useState(false);
  const [ventaACambiar, setVentaACambiar] = useState(null);

  // Modal y venta para Corregir Tipo de Entrega (Mesa / Llevar / Delivery)
  const [cambioTipoEntregaModal, setCambioTipoEntregaModal] = useState(false);
  const [ventaATipoCambiar, setVentaATipoCambiar] = useState(null);

  // Modal de Detalle de Venta para inspección o reimpresión
  const [detalleVentaModalOpen, setDetalleVentaModalOpen] = useState(false);
  const [ventaDetalleSeleccionada, setVentaDetalleSeleccionada] = useState(null);

  /**
   * Abre el modal de anulación para una venta
   */
  const abrirAnulacionVenta = useCallback((venta) => {
    setVentaAAnular(venta);
    setAnularVentaModal(true);
  }, []);

  /**
   * Abre el modal de corrección de método de pago
   */
  const abrirCambioMetodo = useCallback((venta) => {
    setVentaACambiar(venta);
    setCambioMetodoModal(true);
  }, []);

  /**
   * Abre el modal de corrección de tipo de entrega
   */
  const abrirCambioTipoEntrega = useCallback((venta) => {
    setVentaATipoCambiar(venta);
    setCambioTipoEntregaModal(true);
  }, []);

  /**
   * Abre el modal de detalle / inspección de venta
   */
  const abrirDetalleVenta = useCallback((venta) => {
    setVentaDetalleSeleccionada(venta);
    setDetalleVentaModalOpen(true);
  }, []);

  /**
   * Ventas filtradas según el método de pago seleccionado
   */
  const ventasFiltradas = useMemo(() => {
    if (filtroMetodoPago === 'Todos') return ventas;
    return ventas.filter((v) => {
      if (filtroMetodoPago === 'Efectivo') return v.metodoPago === 'Efectivo';
      if (filtroMetodoPago === 'Tarjeta') return v.metodoPago === 'Tarjeta';
      if (filtroMetodoPago === 'Yape') return v.metodoPago === 'Yape' || v.metodoPago === 'Plin';
      if (filtroMetodoPago === 'PedidosYa') return v.metodoPago === 'PedidosYa';
      if (filtroMetodoPago === 'Crédito') return v.metodoPago === 'Crédito';
      if (filtroMetodoPago === 'Mixto') return v.metodoPago === 'Mixto';
      return true;
    });
  }, [ventas, filtroMetodoPago]);

  return {
    // Estado y lista
    ventas,
    setVentas,
    filtroMetodoPago,
    setFiltroMetodoPago,
    ventasFiltradas,

    // Modales de acciones sobre ventas
    anularVentaModal,
    setAnularVentaModal,
    ventaAAnular,
    setVentaAAnular,
    abrirAnulacionVenta,

    cambioMetodoModal,
    setCambioMetodoModal,
    ventaACambiar,
    setVentaACambiar,
    abrirCambioMetodo,

    cambioTipoEntregaModal,
    setCambioTipoEntregaModal,
    ventaATipoCambiar,
    setVentaATipoCambiar,
    abrirCambioTipoEntrega,

    detalleVentaModalOpen,
    setDetalleVentaModalOpen,
    ventaDetalleSeleccionada,
    setVentaDetalleSeleccionada,
    abrirDetalleVenta,
  };
}
