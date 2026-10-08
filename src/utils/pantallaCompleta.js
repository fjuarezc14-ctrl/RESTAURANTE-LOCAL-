// Pantalla completa (celulares Android de los mozos). Se recuerda la preferencia en el dispositivo.
export const PANTALLA_COMPLETA_KEY = 'pantallaCompleta';

export const pantallaCompletaSoportada = () => !!document.documentElement.requestFullscreen;

export const quierePantallaCompleta = () => localStorage.getItem(PANTALLA_COMPLETA_KEY) === '1';

export const entrarPantallaCompleta = () => {
  if (document.fullscreenElement || !pantallaCompletaSoportada()) return Promise.resolve();
  return document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
};
