// Pantalla completa (celulares Android de los mozos)
import { Maximize, Minimize } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PANTALLA_COMPLETA_KEY, entrarPantallaCompleta, pantallaCompletaSoportada } from '../../utils/pantallaCompleta';

// === PANTALLA COMPLETA (celulares Android de los mozos) ===
// Se recuerda la preferencia en el dispositivo: si el navegador sale solo de la pantalla
// completa (gesto de atrás, cambio de app), se vuelve a activar con el siguiente toque.
// Solo el botón la desactiva de forma definitiva.
export const BotonPantallaCompleta = () => {
  const [activa, setActiva] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const actualizar = () => setActiva(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', actualizar);
    return () => document.removeEventListener('fullscreenchange', actualizar);
  }, []);

  if (!pantallaCompletaSoportada()) return null;

  const alternar = () => {
    if (document.fullscreenElement) {
      localStorage.removeItem(PANTALLA_COMPLETA_KEY);
      document.exitFullscreen().catch(() => {});
    } else {
      localStorage.setItem(PANTALLA_COMPLETA_KEY, '1');
      entrarPantallaCompleta();
    }
  };

  return (
    <button
      type="button"
      onClick={alternar}
      title={activa ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className={`p-2 rounded-xl border transition-all active:scale-90 shrink-0 ${
        activa ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
      }`}
    >
      {activa ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
    </button>
  );
};
