// Esquemas de usuarios y login por PIN
import { z } from 'zod';
import { PERMISOS } from '../permisos.js';
import { booleanoOpcional, contrasena, desdeTexto, nombre, pin, pinOpcional, textoOpcional, LARGO } from './comunes.js';

export const ROLES = ['Administrador', 'Cajero', 'Mozo', 'Cocinero', 'Contador'];
const rol = z.enum(ROLES, { error: 'Rol inválido.' });
const permisos = z.array(z.enum([...PERMISOS, 'Usuarios'], { error: 'Permiso inválido.' })).max(20).optional();

// Datos para activar dispositivos (los define el administrador). Vacío = sin cambios
const datosAcceso = {
  usuario: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, 'El usuario debe tener de 3 a 40 letras, números, punto, guion o guion bajo.').nullish()),
  correo: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase().email('El correo no es válido.').max(120).nullish()),
  contrasena: z.preprocess((v) => (v === '' ? undefined : v), contrasena.optional()),
  inactividadMin: desdeTexto(z.number().int().min(1, 'Mínimo 1 minuto.').max(1440, 'Máximo 1440 minutos (un día).').nullish()),
};

export const usuarioNuevo = z.looseObject({ nombre, rol, pin, permisos, ...datosAcceso });
export const usuarioEdicion = z.looseObject({
  nombre: textoOpcional(LARGO.nombre),
  rol: rol.optional(),
  pin: pinOpcional,
  permisos,
  activo: booleanoOpcional,
  ...datosAcceso,
});
export const loginPin = z.looseObject({ pin });

// Activación de un dispositivo: usuario o correo + contraseña
export const activacion = z.looseObject({
  usuario: z.string({ error: 'Escribe tu usuario o correo.' }).trim().min(1, 'Escribe tu usuario o correo.').max(120),
  contrasena: z.string({ error: 'Escribe tu contraseña.' }).min(1, 'Escribe tu contraseña.').max(72),
  nombreDispositivo: z.string({ error: 'Ponle un nombre a este dispositivo (ej. Tablet caja).' }).trim()
    .min(1, 'Ponle un nombre a este dispositivo (ej. Tablet caja).').max(LARGO.nombre),
});
export const cambioContrasena = z.looseObject({
  actual: z.string({ error: 'Escribe tu contraseña actual.' }).max(72),
  nueva: contrasena,
});
