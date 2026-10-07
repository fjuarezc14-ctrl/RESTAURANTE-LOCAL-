import { describe, it, expect } from 'vitest';
import { numeroALetras } from '../numeroALetras';

describe('numeroALetras()', () => {
  it.each([
    [0, 'CERO CON 00/100 SOLES'],
    [1, 'UN CON 00/100 SOLES'],
    [15.5, 'QUINCE CON 50/100 SOLES'],
    [21, 'VEINTIUN CON 00/100 SOLES'],
    [35.9, 'TREINTA Y CINCO CON 90/100 SOLES'],
    [100, 'CIEN CON 00/100 SOLES'],
    [101, 'CIENTO UN CON 00/100 SOLES'],
    [250.05, 'DOSCIENTOS CINCUENTA CON 05/100 SOLES'],
    [999.99, 'NOVECIENTOS NOVENTA Y NUEVE CON 99/100 SOLES'],
  ])('%s → %s', (monto, texto) => {
    expect(numeroALetras(monto)).toBe(texto);
  });

  it('escribe los miles y los millones (antes salía "undefined" desde S/ 1 000)', () => {
    expect(numeroALetras(1000)).toBe('MIL CON 00/100 SOLES');
    expect(numeroALetras(1250.5)).toBe('MIL DOSCIENTOS CINCUENTA CON 50/100 SOLES');
    expect(numeroALetras(21_100)).toBe('VEINTIUN MIL CIEN CON 00/100 SOLES');
    expect(numeroALetras(1_000_000)).toBe('UN MILLON CON 00/100 SOLES');
    expect(numeroALetras(2_500_000)).toBe('DOS MILLONES QUINIENTOS MIL CON 00/100 SOLES');
  });

  it('redondea los céntimos sin pasar de 99', () => {
    expect(numeroALetras(10.999)).toBe('ONCE CON 00/100 SOLES');
    expect(numeroALetras(0.1 + 0.2)).toBe('CERO CON 30/100 SOLES');
  });

  it('acepta montos como texto (Decimal de la API) y valores vacíos', () => {
    expect(numeroALetras('45.60')).toBe('CUARENTA Y CINCO CON 60/100 SOLES');
    expect(numeroALetras(null)).toBe('CERO CON 00/100 SOLES');
  });
});
