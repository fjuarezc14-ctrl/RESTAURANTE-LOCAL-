import { describe, it, expect } from 'vitest';
import { clienteDeVenta, esPedidosYa, metodoReal, origenDeVenta, soles } from '../utils';

describe('utils de Reportes', () => {
  it('formato de soles', () => {
    expect(soles(12.5)).toBe('S/ 12.50');
    expect(soles(null)).toBe('S/ 0.00');
  });

  it('para llevar y delivery propio cobrados en caja cuentan como efectivo', () => {
    expect(metodoReal({ metodoPago: 'PedidosYa', codigoPedidosYa: 'LLEVAR - 4' })).toBe('Efectivo');
    expect(metodoReal({ metodoPago: 'PedidosYa', codigoPedidosYa: 'DELIVERY - ANA | TEL: 9' })).toBe('Efectivo');
    expect(metodoReal({ metodoPago: 'PedidosYa', codigoPedidosYa: 'FG-1' })).toBe('PedidosYa');
    expect(esPedidosYa({ metodoPago: 'PedidosYa', codigoPedidosYa: 'FG-1' })).toBe(true);
    expect(esPedidosYa({ metodoPago: 'PedidosYa', codigoPedidosYa: 'LLEVAR - 4' })).toBe(false);
  });

  it('origen y cliente de la venta', () => {
    expect(origenDeVenta({ mesaNum: 3 })).toBe('Mesa 3');
    expect(origenDeVenta({ codigoPedidosYa: 'DELIVERY - ANA' })).toBe('Delivery');
    expect(origenDeVenta({ codigoPedidosYa: 'FG-1' })).toBe('PedidosYa · FG-1');
    expect(clienteDeVenta({ codigoPedidosYa: 'DELIVERY - ANA | TEL: 9' })).toBe('ANA');
    expect(clienteDeVenta({})).toBe('Consumidor Final');
  });
});
