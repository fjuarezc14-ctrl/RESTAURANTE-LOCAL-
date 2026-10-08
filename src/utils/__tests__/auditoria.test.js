import { describe, expect, it } from 'vitest';
import { resumenCambio } from '../../modulos/admin/auditoria';

describe('resumenCambio', () => {
  it('muestra cada campo que cambió con antes → después', () => {
    expect(resumenCambio({ precio: 18, nombre: 'Lomo' }, { precio: 20, nombre: 'Lomo' })).toBe('precio: 18 → 20\nnombre: Lomo');
  });

  it('campos solo en "después" o solo en "antes"; listas y vacíos legibles', () => {
    expect(resumenCambio(null, { permisos: ['Caja', 'Salon'], correo: null })).toBe('permisos: Caja, Salon\ncorreo: —');
    expect(resumenCambio({ item: 'Inca Kola', cantidad: 1 }, { cantidad: 0 })).toBe('item: Inca Kola (antes)\ncantidad: 1 → 0');
    // Solo "antes" (equipo revocado): sin "(antes)" ni campos vacíos
    expect(resumenCambio({ nombre: 'Tablet', revocadoEn: null }, null)).toBe('nombre: Tablet');
  });

  it('sin datos devuelve texto vacío', () => {
    expect(resumenCambio(null, null)).toBe('');
  });
});
