// ============================================================
// ESQUEMAS ZOD BÁSICOS (compartido backend / frontend)
// Reglas en scratch/ACUERDOS.md §3.
// ============================================================
import { z } from 'zod';

z.config(z.locales.es());

const MONTO_MAXIMO = 100000;
const DIAS_MAXIMOS_RANGO = 366;

export const LARGO = { nombre: 80, nota: 300, descripcion: 500 };

// Número ≥ 0 con máximo 2 decimales; tolera el error de coma flotante (0.1 + 0.2) y lo redondea
export const monto = z
  .number()
  .min(0, 'El monto no puede ser negativo.')
  .max(MONTO_MAXIMO, `El monto no puede pasar de ${MONTO_MAXIMO}.`)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'El monto puede tener como máximo 2 decimales.')
  .transform((n) => Math.round(n * 100) / 100);

export const cantidad = z
  .number()
  .int('La cantidad debe ser un número entero.')
  .min(1, 'La cantidad debe ser al menos 1.')
  .max(999, 'La cantidad no puede pasar de 999.');

// Acepta número o texto (params y query llegan como texto)
export const id = z.coerce
  .number()
  .int('El ID no es válido.')
  .positive('El ID no es válido.');

export const texto = (max) => z.string().trim().max(max, `Máximo ${max} caracteres.`);

export const nombre = texto(LARGO.nombre).min(1, 'El nombre es obligatorio.');

export const pin = z.string().regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 dígitos.');

export const contrasena = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña puede tener como máximo 72 caracteres.');

// YYYY-MM-DD (día calendario en America/Lima)
export const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'La fecha no existe.');

export const rangoFechas = z
  .object({ desde: fecha, hasta: fecha })
  .refine(({ desde, hasta }) => desde <= hasta, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['hasta'],
  })
  .refine(({ desde, hasta }) => (Date.parse(hasta) - Date.parse(desde)) / 86400000 <= DIAS_MAXIMOS_RANGO, {
    message: `El rango no puede pasar de ${DIAS_MAXIMOS_RANGO} días.`,
    path: ['hasta'],
  });
