/**
 * Utilidad segura para deserializar JSON sin riesgo de lanzar excepciones no controladas.
 * Especialmente útil para localStorage y respuestas de APIs que puedan contener datos corruptos.
 * 
 * @param {string|null|undefined} raw - Cadena de texto JSON a parsear
 * @param {any} fallback - Valor por defecto a retornar si el parseo falla o el texto es inválido
 * @returns {any}
 */
export function safeJsonParse(raw, fallback = null) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[safeJsonParse] Error parseando JSON, usando fallback:', err.message);
    return fallback;
  }
}
