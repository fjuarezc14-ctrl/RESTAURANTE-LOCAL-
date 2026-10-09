// ================================================================
// MEMORIA COMPARTIDA DE CONSULTAS (carta y personal)
// Al pasar de Salón a Caja y volver, la carta y la lista de mozos no se piden de nuevo al servidor.
// Se descarta cuando el servidor avisa que cambió algo de lo suyo (SSE, hooks/useEventos.js),
// al guardar cambios desde esta pantalla, al entrar o salir de la sesión, y a los 30 s como respaldo.
// ================================================================
import { alCambiarDatos } from '../hooks/useEventos';

const VIGENCIA_MS = 30000;
const memorias = new Set();

/**
 * @param {() => Promise<any>} cargar la consulta real
 * @param {string[]} temas avisos del servidor que la dejan vieja (ej. ['carta', 'ventas'])
 * @returns {(() => Promise<any>) & { invalidar: () => void }}
 */
export function conMemoria(cargar, temas) {
  let valor;
  let cuando = 0;
  let enCurso = null;
  let version = 0; // si se invalida mientras llega una respuesta, esa respuesta ya no se guarda

  const invalidar = () => {
    version += 1;
    valor = undefined;
    cuando = 0;
    enCurso = null;
  };
  alCambiarDatos((t) => { if (t.includes('*') || t.some((x) => temas.includes(x))) invalidar(); });

  // Copia del arreglo: una pantalla que lo ordena o filtra no cambia lo que ven las demás
  const copia = (v) => (Array.isArray(v) ? [...v] : v);

  const obtener = () => {
    if (valor !== undefined && Date.now() - cuando < VIGENCIA_MS) return Promise.resolve(copia(valor));
    if (!enCurso) {
      const miVersion = version;
      const peticion = cargar().then((v) => {
        if (miVersion === version) { valor = v; cuando = Date.now(); }
        return v;
      }).finally(() => { if (enCurso === peticion) enCurso = null; });
      enCurso = peticion;
    }
    return enCurso.then(copia);
  };
  obtener.invalidar = invalidar;
  memorias.add(obtener);
  return obtener;
}

/** Descarta todo (ej. al cambiar de usuario: la lista de personal depende de los permisos) */
export const invalidarMemorias = () => memorias.forEach((m) => m.invalidar());

/** Envuelve una escritura: si sale bien, descarta la memoria afectada */
export const yLuegoInvalidar = (memoria, escribir) => async (...args) => {
  const res = await escribir(...args);
  memoria.invalidar();
  return res;
};
