// API de Usuarios, activación de equipos, PIN y sesiones
import { apiRequest } from '../../apiCliente';
import { conMemoria, invalidarMemorias, yLuegoInvalidar } from '../../utils/cacheApi';

// La lista del personal se comparte entre pantallas (Salón, Caja, Créditos…)
const usuarios = conMemoria(() => apiRequest('/api/usuarios'), ['usuarios']);
// Al entrar o salir cambia quién ve qué (ej. el usuario de acceso del personal): se descarta todo lo guardado
const yLuegoOlvidar = (llamar) => async (...args) => {
  const res = await llamar(...args);
  invalidarMemorias();
  return res;
};

export const apiUsuarios = {
  getUsuarios: usuarios,
  crearUsuario: yLuegoInvalidar(usuarios, (body) => apiRequest('/api/usuarios', {
    method: 'POST', body: JSON.stringify(body)
  })),
  eliminarUsuario: yLuegoInvalidar(usuarios, (id) => apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' })),
  editarUsuario: yLuegoInvalidar(usuarios, (id, body) => apiRequest(`/api/usuarios/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  })),
  getMarcaAuth: () => apiRequest('/api/auth/marca'),
  activarDispositivo: yLuegoOlvidar((body) => apiRequest('/api/auth/activar', {
    method: 'POST', body: JSON.stringify(body)
  })),
  loginPin: yLuegoOlvidar((pin) => apiRequest('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ pin })
  })),
  logout: () => {
    invalidarMemorias();
    return apiRequest('/api/auth/logout', { method: 'POST' });
  },
  getSesionYo: () => apiRequest('/api/auth/yo'),
  autorizarPin: (pin) => apiRequest('/api/auth/autorizar', {
    method: 'POST', body: JSON.stringify({ pin })
  }),
  cambiarContrasena: (body) => apiRequest('/api/auth/contrasena', {
    method: 'PUT', body: JSON.stringify(body)
  }),
  login: async (pin) => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ pin })
    });
    invalidarMemorias();
    return { ok: true, user: res.usuario };
  },
  // PIN de un Administrador o Cajero para autorizar (anular, cortesía, consumo); el backend lo vuelve a validar
  validateAuth: async (pin) => {
    const res = await apiRequest('/api/auth/autorizar', {
      method: 'POST', body: JSON.stringify({ pin })
    });
    return {
      ok: true,
      nombre: res.autorizadoPor?.nombre,
      rol: res.autorizadoPor?.rol,
      autorizadoPor: res.autorizadoPor
    };
  },
};
