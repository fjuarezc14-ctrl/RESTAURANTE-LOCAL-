// ================================================================
// CAMPANA Y VIBRACIÓN DEL SALÓN (aviso al mozo cuando un plato está listo)
// El navegador solo deja sonar audio después del primer toque: por eso se
// desbloquea el AudioContext con el primer gesto del usuario.
// ================================================================

// --- SISTEMA DE AUDIO Y VIBRACIÓN OPTIMIZADO PARA SALÓN / MOZOS ---
let globalAudioCtx = null;
let userHasInteracted = false;

function getAudioContext() {
  if (typeof window === 'undefined' || !userHasInteracted) return null;
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

// Desbloquear AudioContext tras el primer gesto táctil o click del usuario
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    userHasInteracted = true;
    try {
      if (!globalAudioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          globalAudioCtx = new AudioContextClass();
        }
      }
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume().catch(() => {});
      }
    } catch {
      // Ignorar restricciones de audio del navegador
    }
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });
}

// Sintetizador Web Audio API de Campana de Restaurante Premium (E5 -> G5 -> C6) + Vibración Háptica
export function playChimeNotification() {
  try {
    // 1. Vibración háptica en dispositivos móviles de mozos
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250]);
      } catch (err) {
        // Dispositivo sin hardware de vibración o bloqueado por permisos
        console.debug('[SalonPage] Vibración no disponible:', err?.message);
      }
    }

    // 2. Campana sonora Web Audio API
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const playTone = (freq, startTime, duration, gainLevel = 0.35) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(gainLevel, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Melodía de aviso de 3 notas brillantes (E5 -> G5 -> C6) con volumen audible
    playTone(659.25, now, 0.45, 0.3);
    playTone(783.99, now + 0.12, 0.55, 0.35);
    playTone(1046.50, now + 0.25, 0.85, 0.4);
  } catch (e) {
    console.error('AudioContext bloqueado/no soportado:', e);
  }
}
