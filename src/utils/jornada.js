// Fecha (YYYY-MM-DD) de la jornada del restaurante: de 03:00 a 03:00 de Lima, como los reportes del
// backend. A la 1 a. m. "hoy" sigue siendo la noche anterior (el cajero revisa lo que está cerrando).
const HORAS_DE_CORTE = 3;

export function fechaJornada(diasAtras = 0, ahora = Date.now()) {
  const momento = new Date(ahora - HORAS_DE_CORTE * 3600000 - diasAtras * 86400000);
  return momento.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

export const primerDiaDelMesJornada = (ahora = Date.now()) => `${fechaJornada(0, ahora).slice(0, 8)}01`;
