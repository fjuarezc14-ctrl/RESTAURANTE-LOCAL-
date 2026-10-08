// Puerta de acceso: muestra el teclado de PIN o la activación del equipo
import { useState } from 'react';
import { ActivarDispositivoGate } from './ActivarDispositivoGate';
import { LoginGate } from './LoginGate';

// === COMPONENTE PUERTA DE AUTENTICACIÓN (PIN O ACTIVACIÓN) ===
export const AuthGate = ({ onLoginSuccess, aviso, inicialModo = 'pin' }) => {
  const [modo, setModo] = useState(inicialModo);
  const [mensajeModo, setMensajeModo] = useState(aviso);
  // Llega un aviso nuevo (ej. "tu sesión expiró"): se muestra (ajuste durante el render, sin efecto)
  const [avisoVisto, setAvisoVisto] = useState(aviso);
  if (aviso && aviso !== avisoVisto) {
    setAvisoVisto(aviso);
    setMensajeModo(aviso);
  }

  if (modo === 'activar') {
    return (
      <ActivarDispositivoGate
        onLoginSuccess={onLoginSuccess}
        onVolverPin={() => setModo('pin')}
        aviso={mensajeModo}
      />
    );
  }

  return (
    <LoginGate
      onLoginSuccess={onLoginSuccess}
      aviso={mensajeModo}
      onActivarClick={(msg) => {
        if (msg) setMensajeModo(msg);
        setModo('activar');
      }}
    />
  );
};
