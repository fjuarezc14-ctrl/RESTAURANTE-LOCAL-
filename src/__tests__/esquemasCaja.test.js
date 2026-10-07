import { describe, it, expect } from 'vitest';
import { cobro } from '@shared/esquemas/ventas.js';
import { pedidoLlevar } from '@shared/esquemas/pedidos.js';

// Los mismos esquemas valida el backend: si el frontend los pasa, el backend no rechaza por formato
describe('Esquemas compartidos de Caja', () => {
  const item = { productoId: 1, nombre: 'Pollo a la brasa', cant: 1, precio: 45 };

  it('acepta el código largo del delivery propio (nombre, teléfono, dirección, pago y vuelto)', () => {
    const codigo = 'DELIVERY - MARIA FERNANDA LOPEZ | TEL: 987654321 | DIR: AV. LOS ALAMOS 1234 DPTO 502, URB. SANTA PATRICIA, LA MOLINA | PAGA: 100.00 | VUELTO: 12.50';
    const r = pedidoLlevar.safeParse({ items: [item], tipoDelivery: 'DeliveryPropio', codigoPedidosYa: codigo });
    expect(r.success).toBe(true);
  });

  it('rechaza un pedido sin la lista de ítems o con un ítem sin cantidad', () => {
    expect(pedidoLlevar.safeParse({}).success).toBe(false);
    expect(pedidoLlevar.safeParse({ items: [{ productoId: 1, precio: 10 }] }).success).toBe(false);
  });

  it('acepta un cobro de mesa normal', () => {
    const r = cobro.safeParse({ pedidoIds: [10, 11], metodoPago: 'Efectivo', total: 87.5, montoEfectivo: 87.5, numDocumento: null });
    expect(r.success).toBe(true);
  });

  it('rechaza un cobro sin pedido o con un método de pago inventado', () => {
    expect(cobro.safeParse({ metodoPago: 'Efectivo' }).success).toBe(false);
    const r = cobro.safeParse({ pedidoIds: [10], metodoPago: 'Bitcoin' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe('Método de pago inválido.');
  });
});
