// Esquemas de usuarios y login por PIN
import { z } from 'zod';
import { PERMISOS } from '../permisos.js';
import { booleanoOpcional, nombre, pin, pinOpcional, textoOpcional, LARGO } from './comunes.js';

export const ROLES = ['Administrador', 'Cajero', 'Mozo', 'Cocinero', 'Contador'];
const rol = z.enum(ROLES, { error: 'Rol inválido.' });
const permisos = z.array(z.enum([...PERMISOS, 'Usuarios'], { error: 'Permiso inválido.' })).max(20).optional();

export const usuarioNuevo = z.looseObject({ nombre, rol, pin, permisos });
export const usuarioEdicion = z.looseObject({
  nombre: textoOpcional(LARGO.nombre),
  rol: rol.optional(),
  pin: pinOpcional,
  permisos,
  activo: booleanoOpcional,
});
export const loginPin = z.looseObject({ pin });
