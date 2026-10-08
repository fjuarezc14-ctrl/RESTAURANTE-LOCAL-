// ================================================================
// CLIENTE HTTP DE LA API — VT VALETEC
// Las funciones de cada pantalla están en src/modulos/<módulo>/api.js
// ================================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

// Si el backend dice que la sesión ya no vale (expiró, fue revocada o el equipo se desactivó),
// App vuelve a la pantalla de PIN o de activación. Las rutas /api/auth/* manejan esos códigos solas.
const CODIGOS_SIN_SESION = ['NO_AUTENTICADO', 'SESION_EXPIRADA', 'DISPOSITIVO_NO_ACTIVADO'];
let alPerderSesion = null;

export const esErrorDeSesion = (err) => CODIGOS_SIN_SESION.includes(err?.codigo);

export function onSesionPerdida(fn) {
  alPerderSesion = fn;
  return () => {
    if (alPerderSesion === fn) alPerderSesion = null;
  };
}

/**
 * Cliente HTTP seguro con validación de cabeceras, manejo de errores de proxy (502/504)
 * y protección contra parseo inválido de HTML.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {})
  };

  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json().catch(() => ({}));
        let mensaje = '';
        let codigo = 'ERROR_INTERNO';
        let campo = null;
        let datos = null;

        if (errorData.error && typeof errorData.error === 'object') {
          codigo = errorData.error.codigo || 'ERROR_INTERNO';
          mensaje = errorData.error.mensaje || 'Ocurrió un error inesperado.';
          campo = errorData.error.campo || null;
          datos = errorData.error.datos || null;
        } else if (typeof errorData.error === 'string') {
          mensaje = errorData.error;
        } else {
          mensaje = `Error HTTP ${response.status}: ${response.statusText}`;
        }

        const err = new Error(mensaje);
        err.codigo = codigo;
        err.campo = campo;
        err.datos = datos;
        err.status = response.status;
        if (esErrorDeSesion(err) && !endpoint.startsWith('/api/auth/')) alPerderSesion?.(err);
        throw err;
      } else {
        if (response.status === 502) {
          const err = new Error('502 Bad Gateway: El servidor backend no está respondiendo o se encuentra en reinicio.');
          err.codigo = 'SIN_CONEXION';
          err.status = 502;
          throw err;
        }
        if (response.status === 504) {
          const err = new Error('504 Gateway Timeout: El servidor tardó demasiado en responder.');
          err.codigo = 'TIEMPO_AGOTADO';
          err.status = 504;
          throw err;
        }
        const err = new Error(`Error ${response.status}: El servidor no devolvió una respuesta JSON válida.`);
        err.codigo = 'ERROR_INTERNO';
        err.status = response.status;
        throw err;
      }
    }

    if (!isJson) {
      console.warn(`API ${endpoint}: respuesta no-JSON recibida.`);
      return [];
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s). Verifica la conexión Wi-Fi con el servidor.`);
      timeoutErr.codigo = 'TIEMPO_AGOTADO';
      throw timeoutErr;
    }
    if (!err.codigo && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))) {
      err.codigo = 'SIN_CONEXION';
      err.message = 'No se pudo conectar con el servidor. Verifica tu conexión de red.';
    }
    throw err;
  }
}

// Header Idempotency-Key: un reintento con la misma clave no repite la operación en el backend
export const conClave = (clave) => (clave ? { headers: { 'Idempotency-Key': clave } } : {});
