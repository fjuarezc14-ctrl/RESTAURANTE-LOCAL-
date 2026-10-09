// Esquemas de caja: apertura, movimientos y cierre
import { z } from 'zod';
import {
  LARGO, desdeTexto, fecha, id, monto, montoCalculadoOpcional, montoOpcional, montoPositivo, nombre, pinOpcional, conRangoFechas, texto, textoOpcional,
} from './comunes.js';

export const aperturaCaja = z.looseObject({
  cajeroNombre: z.string({ error: 'El nombre del cajero es obligatorio para abrir la caja.' }).trim()
    .min(1, 'El nombre del cajero es obligatorio para abrir la caja.').max(LARGO.nombre),
  montoInicial: montoOpcional,
  notaApertura: textoOpcional(LARGO.nota),
});

export const movimientoCaja = z.looseObject({
  monto: desdeTexto(montoPositivo),
  motivo: z.string({ error: 'Debe especificar el motivo del retiro o salida de caja.' }).trim()
    .min(1, 'Debe especificar el motivo del retiro o salida de caja.').max(LARGO.nota),
  tipo: textoOpcional(20),
  cajeroNombre: textoOpcional(LARGO.nombre),
});

// Lo contado lo escribe el cajero; los totales y lo esperado en gaveta los calcula el servidor
// (si llegan otros campos, como los que mandaban versiones anteriores de la pantalla, se ignoran)
export const cierreCaja = z.looseObject({
  cajeroNombre: nombre,
  efectivoContado: montoOpcional,
  totalConsumo: montoCalculadoOpcional,
  nota: textoOpcional(LARGO.nota),
});

export const cierreForzado = z.looseObject({
  adminPin: pinOpcional,
  adminNombre: textoOpcional(LARGO.nombre),
  motivo: textoOpcional(LARGO.nota),
});

export const consultaMovimientos = conRangoFechas({ turnoId: id.optional() });
export const consultaCierres = z.looseObject({ limit: desdeTexto(z.number().int().min(1).max(100).optional()) });

export { fecha, monto, texto };
