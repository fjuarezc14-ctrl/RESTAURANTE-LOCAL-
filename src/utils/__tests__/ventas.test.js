import { describe, it, expect } from 'vitest';
import { parseDeliveryInfo, parsearCreditoSplit, parseMonto } from '../ventas';

describe('parseDeliveryInfo()', () => {
  it('lee los datos del delivery propio', () => {
    const info = parseDeliveryInfo('DELIVERY - ANA RUIZ | TEL: 987654321 | DIR: AV. SOL 123 | PAGA: 50.00 | VUELTO: 4.50');
    expect(info).toEqual({ nombre: 'ANA RUIZ', telefono: '987654321', direccion: 'AV. SOL 123', conCuanto: '50.00', vuelto: '4.50' });
  });

  it('devuelve null si no es un delivery propio', () => {
    expect(parseDeliveryInfo('FG-4821')).toBeNull();
    expect(parseDeliveryInfo('LLEVAR - 12')).toBeNull();
    expect(parseDeliveryInfo(null)).toBeNull();
    expect(parseDeliveryInfo(123)).toBeNull();
  });
});

describe('parsearCreditoSplit()', () => {
  it('lee el reparto entre varios clientes', () => {
    const desc = 'Descuento 10% [CREDITO_SPLIT:[{"clienteId":3,"nombre":"Luis","monto":20},{"clienteId":5,"monto":"15.5"}]]';
    expect(parsearCreditoSplit(desc)).toEqual([
      { clienteId: 3, nombre: 'Luis', monto: 20 },
      { clienteId: 5, nombre: '', monto: 15.5 },
    ]);
  });

  it('sin reparto usa el cliente y el monto por defecto', () => {
    expect(parsearCreditoSplit(null, '7', '30')).toEqual([{ clienteId: 7, monto: 30, nombre: '' }]);
    expect(parsearCreditoSplit('', null, 0)).toEqual([]);
  });
});

describe('parseMonto()', () => {
  it('acepta coma decimal y nunca devuelve negativos', () => {
    expect(parseMonto('12,50')).toBe(12.5);
    expect(parseMonto(' 8 ')).toBe(8);
    expect(parseMonto('-3')).toBe(0);
    expect(parseMonto('')).toBe(0);
    expect(parseMonto('abc')).toBe(0);
  });
});
