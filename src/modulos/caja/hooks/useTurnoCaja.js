// ================================================================
// HOOK PERSONALIZADO: useTurnoCaja
// VT VALETEC — Gestión del Ciclo de Turnos, Arqueo, Cierre y Salidas de Caja
// ================================================================
import { useState, useCallback } from 'react';
import { api } from '../../../api';

/**
 * Hook para centralizar el estado y control de turnos de caja en PostgreSQL.
 * Administra apertura, cierre, historial de auditoría y movimientos de gaveta.
 */
export function useTurnoCaja({ onNotificar } = {}) {
  // Estado del turno activo en base de datos
  const [cajaEstado, setCajaEstado] = useState({
    abierto: false,
    turno: null,
    cargando: true,
  });

  // Modal de apertura de turno
  const [modalAperturaOpen, setModalAperturaOpen] = useState(false);

  // Modal de arqueo y cierre formal de turno
  const [cierreModalOpen, setCierreModalOpen] = useState(false);

  // Modal de movimientos de gaveta (ingreso / retiro)
  const [modalSalidaCajaOpen, setModalSalidaCajaOpen] = useState(false);
  const [tipoMovimientoCaja, setTipoMovimientoCaja] = useState('RETIRO'); // 'RETIRO' | 'INGRESO'

  // Historial de cierres de caja para reimpresión y auditoría
  const [historialCierresModalOpen, setHistorialCierresModalOpen] = useState(false);
  const [historialCierres, setHistorialCierres] = useState([]);
  const [cargandoHistorialCierres, setCargandoHistorialCierres] = useState(false);
  const [cierreAImprimir, setCierreAImprimir] = useState(null);

  // Timestamp del último cierre para filtrar ventas del turno actual
  const [ultimoCierre, setUltimoCierre] = useState(() => {
    const stored = localStorage.getItem('ultimoCierre');
    if (stored) {
      if (new Date(stored) <= new Date()) return stored;
      localStorage.removeItem('ultimoCierre');
    }
    const d = new Date();
    if (d.getHours() < 3) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(3, 0, 0, 0);
    return d.toISOString();
  });

  /**
   * Consulta el estado de turno activo y gaveta en el backend
   */
  const actualizarEstadoCaja = useCallback(async () => {
    try {
      const res = await api.getEstadoCaja();
      if (res && typeof res.abierto === 'boolean') {
        setCajaEstado({
          abierto: res.abierto,
          turno: res.turno || null,
          cargando: false,
        });
        if (res.turno?.fechaApertura) {
          setUltimoCierre(res.turno.fechaApertura);
          localStorage.setItem('ultimoCierre', res.turno.fechaApertura);
        }
      } else {
        setCajaEstado((prev) => ({ ...prev, cargando: false }));
      }
      return res;
    } catch (err) {
      console.warn('No se pudo verificar el estado de caja:', err);
      setCajaEstado((prev) => ({ ...prev, cargando: false }));
      return null;
    }
  }, []);

  /**
   * Abre el modal de historial y consulta los últimos cierres
   */
  const abrirHistorialCierres = useCallback(async () => {
    setHistorialCierresModalOpen(true);
    setCargandoHistorialCierres(true);
    try {
      const res = await api.getHistorialCierres(50);
      const list = Array.isArray(res) ? res : (res?.cierres || []);
      setHistorialCierres(list);
    } catch (err) {
      console.error('Error al cargar historial de cierres:', err);
      if (onNotificar) onNotificar('Error al cargar historial de cierres', 'error');
    } finally {
      setCargandoHistorialCierres(false);
    }
  }, [onNotificar]);

  /**
   * Abre el modal de retiro o ingreso de gaveta
   */
  const abrirMovimientoGaveta = useCallback((tipo = 'RETIRO') => {
    setTipoMovimientoCaja(tipo);
    setModalSalidaCajaOpen(true);
  }, []);

  return {
    // Estados principales
    cajaEstado,
    setCajaEstado,
    ultimoCierre,
    setUltimoCierre,

    // Modales de turno
    modalAperturaOpen,
    setModalAperturaOpen,
    cierreModalOpen,
    setCierreModalOpen,
    modalSalidaCajaOpen,
    setModalSalidaCajaOpen,
    tipoMovimientoCaja,
    setTipoMovimientoCaja,

    // Historial y reimpresión
    historialCierresModalOpen,
    setHistorialCierresModalOpen,
    historialCierres,
    cargandoHistorialCierres,
    cierreAImprimir,
    setCierreAImprimir,

    // Métodos de acción
    actualizarEstadoCaja,
    abrirHistorialCierres,
    abrirMovimientoGaveta,
  };
}
