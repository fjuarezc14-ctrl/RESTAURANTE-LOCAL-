// ================================================================
// VENTAS Y PEDIDOS DEL TURNO EN CAJA: cómo se muestran (origen, cliente, ítems)
// y cuánto entró por cada medio de pago
// ================================================================
import { Bike, ShoppingBag, Truck } from 'lucide-react';
import { parseDeliveryInfo, parsearCreditoSplit } from '../../../utils/ventas';

export const esPedidoListo = (p) => {
  if (!p) return false;
  const e = (p.estado || '').toUpperCase();
  return p.estado === 'Servido' || e.includes('LISTO') || e.includes('SERVIDO');
};

export const origenPedido = (codigo = '', pedido = null) => {
  const cod = typeof codigo === 'string' ? codigo : (codigo != null ? String(codigo) : '');
  if (cod.startsWith('DELIVERY -')) {
    const info = parseDeliveryInfo(cod);
    return { tipo: 'delivery', etiqueta: 'Delivery', nombre: info ? info.nombre : cod.replace('DELIVERY - ', ''), info, Icon: Bike, color: 'bg-indigo-50 text-indigo-600' };
  }
  if (cod.startsWith('LLEVAR -')) {
    const nom = cod.replace('LLEVAR - ', '').trim();
    return { tipo: 'llevar', etiqueta: 'Para llevar', nombre: nom || 'Para Llevar', info: null, Icon: ShoppingBag, color: 'bg-cyan-50 text-cyan-700' };
  }
  if (cod) {
    return { tipo: 'pedidosya', etiqueta: 'PedidosYa', nombre: cod, info: null, Icon: Truck, color: 'bg-rose-50 text-rose-600' };
  }
  // Si no tiene código de PedidosYa, deducir por tipo de pedido o nombre de cliente
  if (pedido?.tipoEntrega === 'delivery') {
    return { tipo: 'delivery', etiqueta: 'Delivery', nombre: pedido?.ventaData?.nombreCliente || 'Delivery Local', info: null, Icon: Bike, color: 'bg-indigo-50 text-indigo-600' };
  }
  return { tipo: 'llevar', etiqueta: 'Para llevar', nombre: pedido?.ventaData?.nombreCliente || (pedido?.pedidoId ? `Pedido #${pedido.pedidoId}` : 'Para Llevar'), info: null, Icon: ShoppingBag, color: 'bg-cyan-50 text-cyan-700' };
};

export const clienteDeVenta = (v) => {
  if (!v) return 'Consumidor Final';
  const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
  if (info) return info.nombre;
  if (typeof v.nombreCliente === 'string' && v.nombreCliente.startsWith('DELIVERY -')) {
    return v.nombreCliente.replace('DELIVERY - ', '');
  }
  return v.nombreCliente || 'Consumidor Final';
};

export const origenDeVenta = (v) => (v?.codigoPedidosYa ? origenPedido(v.codigoPedidosYa).etiqueta : (v?.mesaNum ? `Mesa ${v.mesaNum}` : 'Para Llevar'));

export const itemsDeVenta = (v) => {
  if (v.items?.length) return v.items.map(i => ({ cant: i.cant, nombre: i.nombre, subtotal: i.cant * i.precio }));
  return (v.itemsResumen ? v.itemsResumen.split(', ') : []).map(str => {
    const match = str.match(/^(\d+)x\s+(.+)$/);
    return match ? { cant: parseInt(match[1]), nombre: match[2], subtotal: null } : { cant: null, nombre: str, subtotal: null };
  });
};

export const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export const obtenerMontosVentaFrontend = (v) => {
  if (!v || v.anulado || v.estadoPedido === 'Cancelado') return { efec: 0, tarj: 0, yape: 0 };
  if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') return { efec: 0, tarj: 0, yape: 0 };

  let efec = parseFloat(v.montoEfectivo || 0);
  let tarj = parseFloat(v.montoTarjeta || 0);
  let yape = parseFloat(v.montoYape || 0);
  const total = parseFloat(v.total || 0);

  if (total <= 0) return { efec: 0, tarj: 0, yape: 0 };
  if (v.metodoPago === 'Efectivo') return { efec: total, tarj: 0, yape: 0 };
  if (v.metodoPago === 'Tarjeta') return { efec: 0, tarj: total, yape: 0 };
  if (v.metodoPago === 'Yape') return { efec: 0, tarj: 0, yape: total };

  // Restar la parte a crédito si es mixto
  const creditAmount = parseFloat(v.montoCredito || 0);
  const totalFisico = Math.max(0, total - creditAmount);
  const suma = efec + tarj + yape;
  if (Math.abs(suma - totalFisico) > 0.01) {
    if (suma === 0) efec = totalFisico;
    else if (totalFisico > suma) efec += (totalFisico - suma);
  }
  return { efec, tarj, yape };
};

export const horaMovimiento = (fecha) => new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

// Totales del turno (o del día, con mostrarTodoElDia): lo que entró por cada medio, cortesías y créditos.
// Los abonos de créditos también entran a caja. Los créditos de trabajadores van a planilla.
export function resumenTurno({ ventas, abonos, clientes, ultimoCierre, mostrarTodoElDia }) {
  const ventasTurno = (ultimoCierre && !mostrarTodoElDia)
    ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
    : ventas;
  const abonosTurno = (ultimoCierre && !mostrarTodoElDia)
    ? abonos.filter(a => new Date(a.creadoEn) > new Date(ultimoCierre))
    : abonos;

  let activeEfectivo = 0;
  let activeTarjeta = 0;
  let activeYape = 0;
  ventasTurno.forEach(v => {
    const { efec, tarj, yape } = obtenerMontosVentaFrontend(v);
    activeEfectivo += efec;
    activeTarjeta += tarj;
    activeYape += yape;
  });
  // Sumar abonos a la caja real
  abonosTurno.forEach(a => {
    activeEfectivo += a.montoEfectivo || 0;
    activeTarjeta += a.montoTarjeta || 0;
    activeYape += a.montoYape || 0;
  });
  const activeIngresosCaja = activeEfectivo + activeTarjeta + activeYape;
  const activeCortesias = ventasTurno
    .filter(v => v.metodoPago === 'Cortesía' && !v.anulado && v.estadoPedido !== 'Cancelado')
    .reduce((sum, v) => sum + (parseFloat(v.descuentoAplicado || v.total) || (v.items?.reduce((s, i) => s + (i.cant * i.precio), 0) || 0)), 0);

  const clienteEsTrabajador = new Map(clientes.map(c => [c.id, c.esTrabajador]));
  let activeConsumoPlanilla = 0;
  let activeConsumoClientes = 0;
  ventasTurno.forEach(v => {
    if (v.anulado || v.estadoPedido === 'Cancelado') return;
    if (v.metodoPago === 'Consumo') {
      activeConsumoPlanilla += (v.descuentoAplicado || v.total || 0);
    } else {
      const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      if (splits.length > 0) {
        splits.forEach(s => {
          if (clienteEsTrabajador.get(s.clienteId)) activeConsumoPlanilla += s.monto;
          else activeConsumoClientes += s.monto;
        });
      } else if (v.metodoPago === 'Crédito') {
        activeConsumoClientes += (v.total || 0);
      } else if (parseFloat(v.montoCredito || 0) > 0) {
        activeConsumoClientes += parseFloat(v.montoCredito);
      }
    }
  });
  const totalCreditosTurno = activeConsumoClientes + activeConsumoPlanilla;
  return { ventasTurno, abonosTurno, activeEfectivo, activeTarjeta, activeYape, activeIngresosCaja, activeCortesias, activeConsumoPlanilla, activeConsumoClientes, totalCreditosTurno };
}

// Lista de ventas y movimientos de caja del turno, filtrada por método de pago y búsqueda, de la más reciente a la más antigua
export function listaVentasTurno({ ventasTurno, movimientos, ultimoCierre, mostrarTodoElDia, busquedaVentas, filtroMetodoPago, ventasLimite }) {
  // ── Lista de ventas (filtro + búsqueda) ──
  const busquedaVentasNorm = busquedaVentas.trim().toLowerCase();
  const soloSalidas = filtroMetodoPago === 'Salidas';
  const ventasFiltradas = soloSalidas ? [] : ventasTurno.filter(v => {
    if (filtroMetodoPago !== 'Todos') {
      let method = v.metodoPago;
      if (method === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) {
        method = 'Efectivo';
      }
      if (method !== filtroMetodoPago) return false;
    }
    if (!busquedaVentasNorm) return true;
    return [`vt-${v.id}`, String(v.id), clienteDeVenta(v), origenDeVenta(v), v.itemsResumen, v.serie && `${v.serie}-${v.numero}`, v.codigoPago]
      .some(s => s && String(s).toLowerCase().includes(busquedaVentasNorm));
  });

  // Salidas (y entradas) de efectivo del turno abierto, mezcladas con las ventas por hora
  const movimientosTurno = (movimientos || []).filter(m =>
    !(ultimoCierre && !mostrarTodoElDia) || new Date(m.creadoEn) >= new Date(ultimoCierre)
  );
  const movimientosFiltrados = (filtroMetodoPago === 'Todos' || soloSalidas)
    ? movimientosTurno.filter(m => {
        if (!busquedaVentasNorm) return true;
        return [m.motivo, m.cajeroNombre, m.tipo === 'INGRESO' ? 'ingreso de caja' : 'salida de caja']
          .some(s => s && String(s).toLowerCase().includes(busquedaVentasNorm));
      })
    : [];
  const ventasLista = [
    ...ventasFiltradas.map(v => ({ tipoFila: 'venta', fecha: new Date(v.createdAt).getTime() || 0, venta: v })),
    ...movimientosFiltrados.map(m => ({ tipoFila: 'movimiento', fecha: new Date(m.creadoEn).getTime() || 0, mov: m })),
  ].sort((a, b) => b.fecha - a.fecha);
  const ventasVisibles = ventasLista.slice(0, ventasLimite);
  return { busquedaVentasNorm, soloSalidas, ventasFiltradas, movimientosTurno, movimientosFiltrados, ventasLista, ventasVisibles };
}
