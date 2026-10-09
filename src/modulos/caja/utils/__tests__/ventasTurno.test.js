import { describe, it, expect } from 'vitest';
import { clienteDeVenta, itemsDeVenta, listaVentasTurno, obtenerMontosVentaFrontend, origenDeVenta, origenPedido, resumenTurno } from '../ventasTurno';

describe('obtenerMontosVentaFrontend(): lo que entró a caja por cada medio', () => {
  it('pagos simples van completos a su medio', () => {
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Efectivo', total: 30 })).toEqual({ efec: 30, tarj: 0, yape: 0 });
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Tarjeta', total: '45.50' })).toEqual({ efec: 0, tarj: 45.5, yape: 0 });
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Yape', total: 12 })).toEqual({ efec: 0, tarj: 0, yape: 12 });
  });

  it('crédito, cortesía, consumo, PedidosYa y anuladas no suman a caja', () => {
    for (const metodoPago of ['Crédito', 'Cortesía', 'Consumo', 'PedidosYa']) {
      expect(obtenerMontosVentaFrontend({ metodoPago, total: 20 })).toEqual({ efec: 0, tarj: 0, yape: 0 });
    }
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Efectivo', total: 20, anulado: true })).toEqual({ efec: 0, tarj: 0, yape: 0 });
  });

  it('mixto: respeta el reparto y descuenta la parte a crédito', () => {
    const v = { metodoPago: 'Mixto', total: 100, montoEfectivo: 30, montoTarjeta: 20, montoYape: 10, montoCredito: 40 };
    expect(obtenerMontosVentaFrontend(v)).toEqual({ efec: 30, tarj: 20, yape: 10 });
  });

  it('mixto incompleto: lo que falta se cuenta como efectivo', () => {
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Mixto', total: 50, montoTarjeta: 20 })).toEqual({ efec: 30, tarj: 20, yape: 0 });
    expect(obtenerMontosVentaFrontend({ metodoPago: 'Mixto', total: 50 })).toEqual({ efec: 50, tarj: 0, yape: 0 });
  });
});

describe('Origen y cliente de pedidos y ventas', () => {
  it('distingue delivery propio, para llevar y PedidosYa', () => {
    expect(origenPedido('DELIVERY - ANA | TEL: 9 | DIR: X').tipo).toBe('delivery');
    expect(origenPedido('DELIVERY - ANA | TEL: 9 | DIR: X').nombre).toBe('ANA');
    expect(origenPedido('LLEVAR - T-12')).toMatchObject({ tipo: 'llevar', nombre: 'T-12' });
    expect(origenPedido('FG-4821')).toMatchObject({ tipo: 'pedidosya', nombre: 'FG-4821' });
    expect(origenPedido('', { pedidoId: 7 })).toMatchObject({ tipo: 'llevar', nombre: 'Pedido #7' });
  });

  it('cliente y origen de una venta', () => {
    expect(clienteDeVenta({ codigoPedidosYa: 'DELIVERY - LUIS | TEL: 1' })).toBe('LUIS');
    expect(clienteDeVenta({ nombreCliente: '' })).toBe('Consumidor Final');
    expect(origenDeVenta({ mesaNum: 4 })).toBe('Mesa 4');
    expect(origenDeVenta({ codigoPedidosYa: 'LLEVAR - 3' })).toBe('Para llevar');
  });

  it('ítems desde la lista o desde el resumen de texto', () => {
    expect(itemsDeVenta({ items: [{ cant: 2, nombre: 'Ceviche', precio: 25 }] })).toEqual([{ cant: 2, nombre: 'Ceviche', subtotal: 50 }]);
    expect(itemsDeVenta({ itemsResumen: '2x Ceviche, Chicha' })).toEqual([
      { cant: 2, nombre: 'Ceviche', subtotal: null },
      { cant: null, nombre: 'Chicha', subtotal: null },
    ]);
  });
});

describe('resumenTurno(): totales que muestra Caja', () => {
  const cierre = '2026-10-07T13:00:00.000Z';
  const ventas = [
    { id: 1, createdAt: '2026-10-07T12:00:00.000Z', metodoPago: 'Efectivo', total: 99 }, // turno anterior
    { id: 2, createdAt: '2026-10-07T14:00:00.000Z', metodoPago: 'Efectivo', total: 30 },
    { id: 3, createdAt: '2026-10-07T14:10:00.000Z', metodoPago: 'Mixto', total: 50, montoTarjeta: 20, montoYape: 10, montoEfectivo: 20 },
    { id: 4, createdAt: '2026-10-07T14:20:00.000Z', metodoPago: 'Cortesía', total: 0, descuentoAplicado: 18 },
    { id: 5, createdAt: '2026-10-07T14:30:00.000Z', metodoPago: 'Crédito', total: 25, clienteCreditoId: 7 }, // cliente
    { id: 6, createdAt: '2026-10-07T14:40:00.000Z', metodoPago: 'Crédito', total: 15, clienteCreditoId: 8 }, // trabajador
    { id: 7, createdAt: '2026-10-07T14:50:00.000Z', metodoPago: 'Efectivo', total: 40, anulado: true },
  ];
  const abonos = [
    { creadoEn: '2026-10-07T12:30:00.000Z', montoEfectivo: 500 }, // turno anterior
    { creadoEn: '2026-10-07T15:00:00.000Z', montoEfectivo: 10, montoYape: 5 },
  ];
  const clientes = [{ id: 7, esTrabajador: false }, { id: 8, esTrabajador: true }];

  it('solo cuenta el turno abierto y suma los abonos a caja', () => {
    const r = resumenTurno({ ventas, abonos, clientes, ultimoCierre: cierre, mostrarTodoElDia: false });
    expect(r.ventasTurno.map(v => v.id)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(r.activeEfectivo).toBe(30 + 20 + 10);
    expect(r.activeTarjeta).toBe(20);
    expect(r.activeYape).toBe(10 + 5);
    expect(r.activeIngresosCaja).toBe(60 + 20 + 15);
  });

  it('separa cortesías, créditos de clientes y consumo de trabajadores (planilla)', () => {
    const r = resumenTurno({ ventas, abonos, clientes, ultimoCierre: cierre, mostrarTodoElDia: false });
    expect(r.activeCortesias).toBe(18);
    expect(r.activeConsumoClientes).toBe(25);
    expect(r.activeConsumoPlanilla).toBe(15);
    expect(r.totalCreditosTurno).toBe(40);
  });

  it('con "todo el día" incluye lo anterior al último cierre', () => {
    const r = resumenTurno({ ventas, abonos, clientes, ultimoCierre: cierre, mostrarTodoElDia: true });
    expect(r.activeEfectivo).toBe(99 + 30 + 20 + 500 + 10);
  });
});

describe('listaVentasTurno(): lista filtrada', () => {
  const ventasTurno = [
    { id: 10, createdAt: '2026-10-07T14:00:00.000Z', metodoPago: 'Yape', total: 12, nombreCliente: 'Rosa' },
    { id: 11, createdAt: '2026-10-07T15:00:00.000Z', metodoPago: 'Efectivo', total: 30 },
    { id: 12, createdAt: '2026-10-07T16:00:00.000Z', metodoPago: 'PedidosYa', codigoPedidosYa: 'LLEVAR - 5', total: 20 },
  ];
  const movimientos = [{ tipo: 'RETIRO', motivo: 'Compra de hielo', creadoEn: '2026-10-07T15:30:00.000Z' }];
  const base = { ventasTurno, movimientos, ultimoCierre: null, mostrarTodoElDia: false, busquedaVentas: '', ventasLimite: 20 };

  it('mezcla ventas y salidas, de la más reciente a la más antigua', () => {
    const r = listaVentasTurno({ ...base, filtroMetodoPago: 'Todos' });
    expect(r.ventasLista.map(f => f.venta?.id ?? f.mov.motivo)).toEqual([12, 'Compra de hielo', 11, 10]);
  });

  it('para llevar cobrado en caja cuenta como efectivo al filtrar', () => {
    const r = listaVentasTurno({ ...base, filtroMetodoPago: 'Efectivo' });
    expect(r.ventasLista.map(f => f.venta.id)).toEqual([12, 11]);
  });

  it('"Salidas" muestra solo movimientos y la búsqueda filtra', () => {
    expect(listaVentasTurno({ ...base, filtroMetodoPago: 'Salidas' }).ventasLista).toHaveLength(1);
    expect(listaVentasTurno({ ...base, filtroMetodoPago: 'Todos', busquedaVentas: 'rosa' }).ventasLista.map(f => f.venta.id)).toEqual([10]);
  });
});

describe('cortesías de ítems', () => {
  it('suma lo regalado en ventas cobradas con otro método (montoCortesia del servidor)', () => {
    const ventas = [
      { id: 1, metodoPago: 'Efectivo', total: 40, montoCortesia: 12.5, createdAt: '2026-10-09T15:00:00Z' },
      { id: 2, metodoPago: 'Cortesía', total: 0, descuentoAplicado: 30, montoCortesia: 30, createdAt: '2026-10-09T15:05:00Z' },
      { id: 3, metodoPago: 'Yape', total: 20, montoCortesia: 8, anulado: true, createdAt: '2026-10-09T15:10:00Z' },
    ];
    const r = resumenTurno({ ventas, abonos: [], clientes: [], ultimoCierre: null, mostrarTodoElDia: false });
    expect(r.activeCortesias).toBe(42.5);
  });
});
