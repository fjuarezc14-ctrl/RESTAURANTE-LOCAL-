import { describe, expect, it } from 'vitest';
import { fechaJornada, primerDiaDelMesJornada } from '../jornada';

const lima = (texto) => new Date(`${texto}-05:00`).getTime();

describe('fechaJornada', () => {
  it('de día es la fecha de hoy; de madrugada (antes de las 03:00) la de ayer', () => {
    expect(fechaJornada(0, lima('2026-10-08T21:00:00'))).toBe('2026-10-08');
    expect(fechaJornada(0, lima('2026-10-08T01:40:00'))).toBe('2026-10-07');
    expect(fechaJornada(1, lima('2026-10-08T01:40:00'))).toBe('2026-10-06');
  });

  it('el mes también sigue a la jornada', () => {
    expect(primerDiaDelMesJornada(lima('2026-11-01T02:00:00'))).toBe('2026-10-01');
    expect(primerDiaDelMesJornada(lima('2026-11-01T09:00:00'))).toBe('2026-11-01');
  });
});
