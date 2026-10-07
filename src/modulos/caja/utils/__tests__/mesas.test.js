import { describe, it, expect } from 'vitest';
import { mesaCobrable, platosEnPreparacion, platosSinServir, textoBloqueoMesa } from '../mesas';

// historial: ya salió de cocina/barra; entregado: el mozo ya lo llevó a la mesa
const mesa = (estado, items) => ({ num: 3, estado, pedidoData: { items } });

describe('Estado de una mesa en Caja', () => {
  it('se puede cobrar cuando todo está servido', () => {
    const m = mesa('Servido', [{ cant: 2, historial: true, entregado: true }]);
    expect(mesaCobrable(m)).toBe(true);
  });

  it('no se cobra con platos en cocina', () => {
    const m = mesa('Cocina', [{ cant: 2, historial: false }, { cant: 1, historial: true, entregado: true }]);
    expect(mesaCobrable(m)).toBe(false);
    expect(platosEnPreparacion(m)).toBe(2);
    expect(textoBloqueoMesa(m)).toBe('2 en preparación');
  });

  it('no se cobra con platos listos que el mozo no llevó', () => {
    const m = mesa('Servido', [{ cant: 1, historial: true, entregado: false }, { cant: 3, historial: true, entregado: false }]);
    expect(platosSinServir(m)).toBe(4);
    expect(mesaCobrable(m)).toBe(false);
    expect(textoBloqueoMesa(m)).toBe('4 por servir');
  });

  it('tolera mesas sin pedido', () => {
    expect(mesaCobrable({ estado: 'Libre' })).toBe(true);
    expect(textoBloqueoMesa({ estado: 'Cocina' })).toBe('En cocina');
  });
});
