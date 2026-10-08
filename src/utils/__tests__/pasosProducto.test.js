import { describe, expect, it } from 'vitest';
import { pasosProducto } from '../pasosProducto';

const tallarinVerde = (id, nombre, precio) => ({ id, nombre, precio, categoria: 'Tallarines Verdes', activo: true });

describe('pasosProducto (Caja y Salón)', () => {
  it('las opciones configuradas en la Carta van primero, aunque el producto sea agrupado', () => {
    const prod = { nombre: 'Tallarines Verdes', esAgrupado: true, variantes: [tallarinVerde(1, 'Tallarín Verde con Bistec', 25)],
      opcionesConfig: JSON.stringify([{ name: 'Término', options: ['Jugoso', 'Bien cocido'] }]) };
    expect(pasosProducto(prod).map((p) => p.name)).toEqual(['Término']);
  });

  it('agrupado sin variantes propias: las busca en la carta', () => {
    const carta = [tallarinVerde(1, 'Tallarín Verde con Bistec', 25), tallarinVerde(2, 'Tallarín Verde con Pollo', 20), { id: 3, nombre: 'Lomo', categoria: 'Criollos', activo: true }];
    const [paso] = pasosProducto({ nombre: 'Tallarines Verdes', esAgrupado: true }, {}, carta);
    expect(paso.options.map((o) => o.label)).toEqual(['Con Bistec (S/ 25.00)', 'Con Pollo (S/ 20.00)']);
  });

  it('"Gaseosa Chiki" se guarda como "Gaseosa Chiki"', () => {
    const pasos = pasosProducto({ nombre: 'Menú Ejecutivo', categoria: 'Menú', requiereGuarnicion: true });
    const bebida = pasos.find((p) => p.key === 'bebida');
    expect(bebida.options.find((o) => o.label === 'Gaseosa Chiki').value).toBe('Gaseosa Chiki');
  });

  it('ya no pregunta la cantidad de ensaladas', () => {
    const pasos = pasosProducto({ nombre: 'Pollo a la brasa entero', categoria: 'Pollos', requiereGuarnicion: true });
    expect(pasos.some((p) => p.key === 'cantidad_ensaladas')).toBe(false);
  });
});
