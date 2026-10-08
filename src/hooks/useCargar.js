// ================================================================
// Carga datos después del render, cada vez que cambia la función `cargar` (pásala con useCallback).
// La llamada va en una microtarea: el efecto no cambia estado de forma síncrona (regla
// react-hooks/set-state-in-effect, evita renders en cascada) y si la pantalla se cerró, no carga.
// ================================================================
import { useEffect } from 'react';

export function useCargar(cargar) {
  useEffect(() => {
    let vigente = true;
    queueMicrotask(() => { if (vigente) cargar(); });
    return () => { vigente = false; };
  }, [cargar]);
}
