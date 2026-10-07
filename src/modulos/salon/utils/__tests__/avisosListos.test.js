import { describe, it, expect } from 'vitest';
import { avisosDePlatosListos } from '../avisosListos';

// historial: ya salió de cocina/barra; entregado: el mozo ya lo llevó a la mesa
const mesa = (num, estado, mesero, items) => ({ num, estado, pedidoData: { mesero, items } });
const opciones = { meseroActivo: 'carlos', esMesaCompartida: () => false, esRolMozo: false, barraCategorias: ['Bebidas'] };

describe('avisosDePlatosListos()', () => {
  it('avisa solo de lo que acaba de salir de cocina o barra', () => {
    const antes = [mesa(1, 'Cocina', 'Carlos', [{ itemId: 1, historial: true }, { itemId: 2, historial: false }])];
    const despues = [mesa(1, 'Cocina', 'Carlos', [
      { itemId: 1, historial: true, nombre: 'Ceviche', categoria: 'Fondos' },
      { itemId: 2, historial: true, nombre: 'Chicha', categoria: 'Bebidas' },
    ])];
    const { platos } = avisosDePlatosListos(antes, despues, opciones);
    expect(platos).toEqual([
      { tipo: 'listo', mesa: 1, esMiMesa: true, mensaje: '🍹 Bebida lista en BARRA: Chicha · Mesa 1 (⭐ ¡Tu Mesa!)' },
    ]);
  });

  it('no avisa de lo que el mozo ya entregó', () => {
    const antes = [mesa(2, 'Cocina', 'Ana', [{ itemId: 5, historial: false }])];
    const despues = [mesa(2, 'Cocina', 'Ana', [{ itemId: 5, historial: true, entregado: true, nombre: 'Lomo' }])];
    expect(avisosDePlatosListos(antes, despues, opciones).platos).toEqual([]);
  });

  it('un Mozo solo recibe avisos de sus mesas; Admin y Cajero ven todo', () => {
    const antes = [mesa(3, 'Cocina', 'Ana', [{ itemId: 9, historial: false }])];
    const despues = [mesa(3, 'Cocina', 'Ana', [{ itemId: 9, historial: true, nombre: 'Arroz' }])];
    expect(avisosDePlatosListos(antes, despues, { ...opciones, esRolMozo: true }).platos).toEqual([]);
    const { platos } = avisosDePlatosListos(antes, despues, opciones);
    expect(platos[0].mensaje).toBe('🍽️ Plato listo en COCINA: Arroz · Mesa 3 (Atiende: Ana)');
  });

  it('como máximo 4 avisos de platos por sondeo', () => {
    const items = (listo) => Array.from({ length: 6 }, (_, k) => ({ itemId: k, historial: listo, nombre: `P${k}` }));
    const r = avisosDePlatosListos([mesa(4, 'Cocina', 'Carlos', items(false))], [mesa(4, 'Cocina', 'Carlos', items(true))], opciones);
    expect(r.platos).toHaveLength(4);
  });

  it('avisa cuando la mesa completa pasa de Cocina a Servido', () => {
    const antes = [mesa(5, 'Cocina', 'Carlos', []), mesa(6, 'Cocina', 'Ana', [])];
    const despues = [mesa(5, 'Servido', 'Carlos', []), mesa(6, 'Servido', 'Ana', [])];
    const { mesasListas } = avisosDePlatosListos(antes, despues, opciones);
    expect(mesasListas.map(a => a.mensaje)).toEqual([
      '🛎️ ¡Tu Mesa 5 está lista para servir!',
      '🛎️ ¡Mesa 6 lista para servir! (Ana)',
    ]);
  });

  it('las mesas atendidas por Admin o Cajero cuentan como propias', () => {
    const antes = [mesa(7, 'Cocina', 'Administrador', [])];
    const despues = [mesa(7, 'Servido', 'Administrador', [])];
    const r = avisosDePlatosListos(antes, despues, { ...opciones, esRolMozo: true, esMesaCompartida: (n) => n === 'administrador' });
    expect(r.mesasListas[0].esMiMesa).toBe(true);
  });
});
