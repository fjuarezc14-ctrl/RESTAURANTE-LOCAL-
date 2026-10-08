// Esquemas de compras y gastos
import { z } from 'zod';
import { LARGO, desdeTexto, fecha, monto, montoOpcional, conRangoFechasObligatorio, textoOpcional } from './comunes.js';

const fechaEmision = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s.includes('T') ? s : `${s}T12:00:00`)), 'La fecha de emisión no es válida.').nullish();
const ruc = z.string().trim().regex(/^(\d{8}|\d{11})?$/, 'El RUC debe tener 11 dígitos (o DNI de 8).').nullish();

const datosCompra = {
  ruc,
  tipoDocumento: textoOpcional(30),
  serieNumero: textoOpcional(30),
  baseImponible: montoOpcional,
  igv: montoOpcional,
  categoria: textoOpcional(LARGO.nombre),
  fechaEmision,
  metodoPago: textoOpcional(30),
};

export const compraNueva = z.looseObject({
  proveedor: z.string({ error: 'Indica el proveedor.' }).trim().min(1, 'Indica el proveedor.').max(150),
  total: desdeTexto(monto),
  xmlData: textoOpcional(1500000),
  origenCarga: textoOpcional(20),
  ...datosCompra,
  // la ruta los guarda tal cual: sin ellos Prisma fallaba con un error interno
  baseImponible: desdeTexto(monto),
  igv: desdeTexto(monto),
});
export const compraEdicion = z.looseObject({ proveedor: textoOpcional(150), total: montoOpcional, ...datosCompra });
export const categoriaCompra = z.looseObject({ categoria: textoOpcional(LARGO.nombre) });
export const sincronizacionSunat = z.looseObject({ periodo: textoOpcional(10), fechaInicio: fecha.optional(), fechaFin: fecha.optional() });
export const consultaCompras = conRangoFechasObligatorio({
  busqueda: textoOpcional(100), categoria: textoOpcional(LARGO.nombre), metodoPago: textoOpcional(30),
});
