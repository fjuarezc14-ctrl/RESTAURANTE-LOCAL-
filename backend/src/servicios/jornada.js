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

module.exports = { las3DeLima, inicioJornadaActual };
