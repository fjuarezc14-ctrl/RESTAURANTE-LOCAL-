// Contexto y hooks del sistema de avisos (el proveedor está en AvisoContext.jsx).
// Separados del componente para que el recargado en caliente de Vite funcione.
import { createContext, useContext } from 'react';

export const AvisoContext = createContext(null);

// Para avisar desde fuera de React (ej. api.js): el proveedor registra aquí su función
let avisoGlobal = null;

export function registrarAvisoGlobal(fn) {
  avisoGlobal = fn;
  return () => { if (avisoGlobal === fn) avisoGlobal = null; };
}

export function mostrarAvisoGlobal(tipo, mensaje, duracion) {
  if (avisoGlobal) avisoGlobal(tipo, mensaje, duracion);
  else console.warn(`[Aviso ${tipo}]:`, mensaje);
}

function useContextoAvisos(hook) {
  const ctx = useContext(AvisoContext);
  if (!ctx) throw new Error(`${hook} debe usarse dentro de un AvisoProvider`);
  return ctx;
}

export const useAviso = () => useContextoAvisos('useAviso').aviso;
export const useConfirmar = () => useContextoAvisos('useConfirmar').confirmar;
export const usePedirDato = () => useContextoAvisos('usePedirDato').pedirDato;
export const useNotificaciones = () => useContextoAvisos('useNotificaciones');
