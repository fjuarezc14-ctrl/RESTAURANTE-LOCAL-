// ================================================================
// Carga de los datos de Caja. full: todo el turno (ventas, clientes, abonos, cierre, usuarios);
// liviana: solo mesas, pedidos para llevar y estado de la caja. Una sola carga a la vez.
// Recibe los set... de la página (todos de useState, estables).
// ================================================================
import { useCallback, useRef } from 'react';
import { api } from '../../../api';

export function useDatosCaja({ setMesas, setPedidosLlevar, setVentas, setProductosMenu, setUsuariosSistema, setClientes, setAbonos, setCajaEstado, setCajeroNombre, setUltimoCierre, setLoading }) {
  const isFetchingCajaRef = useRef(false);

  return useCallback(async (options = { full: true }) => {
    if (isFetchingCajaRef.current) return;
    isFetchingCajaRef.current = true;

    try {
      if (options?.full) {
        const [mesasData, llevarData, ventasData, prods, clientsList, abonosList, ultimoCierreRes, estadoCajaRes, usuariosList] = await Promise.all([
          api.getMesas().catch(() => null),
          api.getPedidosLlevar().catch(() => null),
          api.getHistorialVentas().catch(() => null),
          api.getProductos().catch(() => null),
          api.getClientes().catch(() => []),
          api.getAbonos().catch(() => []),
          api.getUltimoCierre().catch(() => null),
          api.getEstadoCaja().catch(() => null),
          api.getUsuarios().catch(() => []),
        ]);
        if (mesasData) setMesas(mesasData);
        if (llevarData) setPedidosLlevar(llevarData);
        if (ventasData) setVentas(ventasData);
        if (prods) setProductosMenu(prods);
        if (usuariosList && Array.isArray(usuariosList)) setUsuariosSistema(usuariosList);
        setClientes(clientsList || []);
        setAbonos(abonosList || []);

        if (estadoCajaRes && typeof estadoCajaRes.abierto === 'boolean') {
          setCajaEstado(estadoCajaRes);
          if (estadoCajaRes.abierto && estadoCajaRes.turno?.cajeroNombre) {
            setCajeroNombre(estadoCajaRes.turno.cajeroNombre);
          }
          if (estadoCajaRes.abierto && estadoCajaRes.turno?.fechaApertura) {
            const fAperturaISO = new Date(estadoCajaRes.turno.fechaApertura).toISOString();
            setUltimoCierre(fAperturaISO);
          } else if (estadoCajaRes.ultimoCierre?.fechaCierre) {
            const fCierreISO = new Date(estadoCajaRes.ultimoCierre.fechaCierre).toISOString();
            setUltimoCierre(fCierreISO);
          }
        } else if (ultimoCierreRes?.ultimoCierre?.fechaCierre) {
          const fechaDbISO = new Date(ultimoCierreRes.ultimoCierre.fechaCierre).toISOString();
          setUltimoCierre(prev => (prev !== fechaDbISO ? fechaDbISO : prev));
          localStorage.setItem('ultimoCierre', fechaDbISO);
        }
      } else {
        // Sondeo ligero de alta frecuencia: solo mesas, delivery activo y estado de caja
        const [mesasData, llevarData, estadoCajaRes] = await Promise.all([
          api.getMesas().catch(() => null),
          api.getPedidosLlevar().catch(() => null),
          api.getEstadoCaja().catch(() => null),
        ]);
        if (mesasData) setMesas(mesasData);
        if (llevarData) setPedidosLlevar(llevarData);
        if (estadoCajaRes && typeof estadoCajaRes.abierto === 'boolean') {
          setCajaEstado(estadoCajaRes);
        }
      }
    } catch (err) {
      console.debug('[CajaPage] Micro-latencia en sondeo:', err?.message);
    } finally {
      isFetchingCajaRef.current = false;
      setLoading(false);
    }
  }, [setMesas, setPedidosLlevar, setVentas, setProductosMenu, setUsuariosSistema, setClientes, setAbonos, setCajaEstado, setCajeroNombre, setUltimoCierre, setLoading]);
}
