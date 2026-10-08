// API de Usuarios, activación de equipos, PIN y sesiones
import { apiRequest } from '../../apiCliente';

export const apiUsuarios = {
  getUsuarios: () => apiRequest('/api/usuarios'),
  crearUsuario: (body) => apiRequest('/api/usuarios', {
    method: 'POST', body: JSON.stringify(body)
  }),
  eliminarUsuario: (id) => apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' }),
  editarUsuario: (id, body) => apiRequest(`/api/usuarios/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  getMarcaAuth: () => apiRequest('/api/auth/marca'),
  activarDispositivo: (body) => apiRequest('/api/auth/activar', {
    method: 'POST', body: JSON.stringify(body)
  }),
  loginPin: (pin) => apiRequest('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ pin })
  }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  getSesionYo: () => apiRequest('/api/auth/yo'),
  autorizarPin: (pin) => apiRequest('/api/auth/autorizar', {
    method: 'POST', body: JSON.stringify({ pin })
  }),
  cambiarContrasena: (body) => apiRequest('/api/auth/contrasena', {
    method: 'PUT', body: JSON.stringify(body)
  }),
  login: async (pin) => {
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ pin })
      });
      return { ok: true, user: res.usuario };
    } catch (err) {
      if (err.codigo === 'DISPOSITIVO_NO_ACTIVADO') {
        throw err;
      }
      if (err.codigo === 'PIN_INCORRECTO' || err.codigo === 'DEMASIADOS_INTENTOS') {
        throw err;
      }
      return apiRequest('/api/usuarios/login', {
        method: 'POST', body: JSON.stringify({ pin })
      });
    }
  },
  validateAuth: async (pin) => {
    try {
      const res = await apiRequest('/api/auth/autorizar', {
        method: 'POST', body: JSON.stringify({ pin })
      });
      return {
        ok: true,
        nombre: res.autorizadoPor?.nombre,
        rol: res.autorizadoPor?.rol,
        autorizadoPor: res.autorizadoPor
      };
    } catch (err) {
      if (err.codigo === 'PIN_INCORRECTO' || err.codigo === 'SIN_PERMISO') {
        throw err;
      }
      return apiRequest('/api/usuarios/validate-auth', {
        method: 'POST', body: JSON.stringify({ pin })
      });
    }
  },
  checkUserStatus: (id) => apiRequest(`/api/usuarios/check/${id}`).catch(() => ({ exists: true, activo: true })),
};
