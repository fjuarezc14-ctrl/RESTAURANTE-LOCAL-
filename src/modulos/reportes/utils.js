// ================================================================
// REPORTES: cómo se muestra cada venta (origen, cliente, método) y formato de montos
// ================================================================
import { parseDeliveryInfo } from '../../utils/ventas';

export const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export const metodoReal = (v) => {
  if (v.metodoPago === 'PedidosYa' && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.codigoPedidosYa?.startsWith('LLEVAR -'))) return 'Efectivo';
  return v.metodoPago;
};

export const clienteDeVenta = (v) => {
  const info = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
  if (info) return info.nombre;
  if (v.nombreCliente?.startsWith('DELIVERY -')) return v.nombreCliente.replace('DELIVERY - ', '');
  return v.nombreCliente || 'Consumidor Final';
};

export const origenDeVenta = (v) => {
  if (!v.codigoPedidosYa) return `Mesa ${v.mesaNum || 'S/M'}`;
  if (v.codigoPedidosYa.startsWith('DELIVERY -')) return 'Delivery';
  if (v.codigoPedidosYa.startsWith('LLEVAR -')) return 'Para llevar';
  return `PedidosYa · ${v.codigoPedidosYa}`;
};

export const esPedidosYa = (v) => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -');

export const fechaVenta = (v) => v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE');
