// ================================================================
// AVISOS EN VIVO (SSE): la pantalla recarga cuando el servidor avisa que cambió algo suyo,
// en vez de consultar cada pocos segundos (tarea 16). Una sola conexión para toda la app.
//   useEventos(['mesas', 'pedidos'], fetchMesas)
// Además consulta cada 60 s (respaldo) por si la conexión se cortó sin que el navegador lo note,
// y al reconectarse recarga todo lo suscrito (pudo perder avisos mientras estaba caída).
// ================================================================
import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const RESPALDO_MS = 60000;
const ESPERA_MS = 250; // varios avisos seguidos → una sola recarga

const suscriptores = new Set(); // { temas: Set, avisar: () => void }
const oyentes = new Set(); // (temas: string[]) => void — no abren la conexión (ej. la memoria de utils/cacheApi.js)
let fuente = null;
let huboError = false;

// '*' = pudieron perderse avisos (conexión nueva o reconectada): todo puede haber cambiado
const avisarOyentes = (temas) => { for (const fn of oyentes) fn(temas); };

/** Escucha los avisos sin mantener abierta la conexión (solo los recibe mientras alguna pantalla escucha) */
export function alCambiarDatos(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

const pestanaVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function abrirConexion() {
  if (fuente || typeof EventSource === 'undefined') return;
  fuente = new EventSource(`${API_BASE}/api/eventos`, { withCredentials: true });
  fuente.addEventListener('cambio', (e) => {
    let temas;
    try { temas = JSON.parse(e.data).temas || []; } catch { return; }
    avisarOyentes(temas);
    for (const s of suscriptores) if (temas.some((t) => s.temas.has(t))) s.avisar();
  });
  avisarOyentes(['*']); // mientras no había conexión no llegaban avisos
  fuente.onopen = () => {
    if (huboError) {
      avisarOyentes(['*']);
      for (const s of suscriptores) s.avisar(); // volvió la conexión: ponerse al día
    }
    huboError = false;
  };
  fuente.onerror = () => { huboError = true; }; // EventSource reintenta solo (retry: 3000)
}

function cerrarSiNadieEscucha() {
  if (suscriptores.size === 0 && fuente) {
    fuente.close();
    fuente = null;
  }
}

/**
 * @param {string[]} temas mesas, pedidos, cancelaciones, caja, ventas, carta, usuarios, compras, clientes
 * @param {() => void} alCambiar recarga de la pantalla (puede cambiar en cada render)
 * @param {{ activo?: boolean }} [opciones] activo=false pausa los avisos (ej. con un modal abierto)
 */
export function useEventos(temas, alCambiar, { activo = true } = {}) {
  const alCambiarRef = useRef(alCambiar);
  useEffect(() => { alCambiarRef.current = alCambiar; });
  const clave = temas.join(',');

  useEffect(() => {
    if (!activo) return undefined;
    let espera = null;
    const avisar = () => {
      if (!pestanaVisible()) return;
      clearTimeout(espera);
      espera = setTimeout(() => alCambiarRef.current?.(), ESPERA_MS);
    };
    const suscriptor = { temas: new Set(clave.split(',')), avisar };
    suscriptores.add(suscriptor);
    abrirConexion();
    const respaldo = setInterval(avisar, RESPALDO_MS);
    // Al volver a la pestaña: recargar (los avisos se ignoran mientras está oculta)
    const alVolver = () => { if (pestanaVisible()) avisar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(espera);
      clearInterval(respaldo);
      document.removeEventListener('visibilitychange', alVolver);
      suscriptores.delete(suscriptor);
      cerrarSiNadieEscucha();
    };
  }, [clave, activo]);
}
