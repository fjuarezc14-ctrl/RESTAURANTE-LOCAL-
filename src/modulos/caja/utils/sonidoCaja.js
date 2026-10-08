// Campana de Caja: suena cuando un pedido para llevar o delivery queda listo
export const sonarCampanaCaja = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(784, audioCtx.currentTime, 0.6);
    playTone(1046.5, audioCtx.currentTime + 0.12, 0.8);
  } catch (e) {
    console.error('AudioContext no soportado:', e);
  }
};
