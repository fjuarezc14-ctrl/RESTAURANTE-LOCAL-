// @ts-check
// ============================================================
// JORNADA DEL RESTAURANTE: de 03:00 a 03:00 de Lima (lo de la madrugada cuenta para la noche anterior).
// Lima es UTC-5 todo el año. Se calcula sin depender de la zona horaria del proceso
// (antes, con el servidor en hora de Lima, "hoy" salía corrido 5 horas).
// ============================================================
const DESFASE_LIMA_MS = 5 * 3600 * 1000;

/** 03:00 de Lima del día (de Lima) de `ahora`, menos `diasAtras` días */
function las3DeLima(diasAtras = 0, ahora = new Date()) {
  const lima = new Date(ahora.getTime() - DESFASE_LIMA_MS); // los campos UTC muestran la hora de Lima
  lima.setUTCDate(lima.getUTCDate() - diasAtras);
  lima.setUTCHours(3, 0, 0, 0);
  return new Date(lima.getTime() + DESFASE_LIMA_MS);
}

/** Inicio de la jornada en curso: antes de las 03:00 de Lima sigue siendo la del día anterior */
function inicioJornadaActual(ahora = new Date()) {
  const madrugada = new Date(ahora.getTime() - DESFASE_LIMA_MS).getUTCHours() < 3;
  return las3DeLima(madrugada ? 1 : 0, ahora);
}

/** Día 1 del mes en curso de Lima, a la `hora` de Lima (0 = medianoche, 3 = inicio de la jornada) */
function inicioMesLima(hora = 0, ahora = new Date()) {
  const lima = new Date(ahora.getTime() - DESFASE_LIMA_MS);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), 1, hora) + DESFASE_LIMA_MS);
}

/** Día 1 del mes en curso de Lima a las 00:00 UTC: para fechas de calendario que se filtran por día UTC */
function inicioMesCalendario(ahora = new Date()) {
  const lima = new Date(ahora.getTime() - DESFASE_LIMA_MS);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), 1));
}

module.exports = { las3DeLima, inicioJornadaActual, inicioMesLima, inicioMesCalendario };
