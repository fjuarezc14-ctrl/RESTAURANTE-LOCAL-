// Jornada de 03:00 a 03:00 de Lima, sin depender de la zona horaria del proceso
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { las3DeLima, inicioJornadaActual } = require('../src/servicios/jornada.js');
const lima = (texto) => new Date(`${texto}-05:00`);

describe('jornada', () => {
  it('de día, la jornada empezó a las 03:00 de hoy', () => {
    expect(inicioJornadaActual(lima('2026-10-08T21:30:00'))).toEqual(lima('2026-10-08T03:00:00'));
  });

  it('de madrugada (antes de las 03:00) sigue la jornada de ayer', () => {
    expect(inicioJornadaActual(lima('2026-10-08T01:15:00'))).toEqual(lima('2026-10-07T03:00:00'));
    expect(inicioJornadaActual(lima('2026-10-08T03:00:00'))).toEqual(lima('2026-10-08T03:00:00'));
  });

  it('las 03:00 de ayer, también cruzando de mes', () => {
    expect(las3DeLima(1, lima('2026-11-01T10:00:00'))).toEqual(lima('2026-10-31T03:00:00'));
  });
});
