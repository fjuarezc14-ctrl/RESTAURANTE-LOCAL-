// Esquemas de la carta: productos, categorías y ofertas
import { z } from 'zod';
import { LARGO, booleanoOpcional, desdeTexto, monto, montoOpcional, nombre, textoOpcional } from './comunes.js';

const stock = desdeTexto(z.number().int('El stock debe ser un número entero.').min(0, 'El stock no puede ser negativo.').max(100000).optional());
// opcionesConfig, componentes y complementos llegan como JSON en texto o como arreglo
const configuracion = z.union([z.string().max(20000), z.array(z.any()).max(100)]).nullish();

const datosProducto = {
  tipoStock: z.enum(['ilimitado', 'limitado']).optional(),
  stock,
  requiereGuarnicion: booleanoOpcional,
  opcionesConfig: configuracion,
  componentes: configuracion,
  complementos: configuracion,
};

export const productoNuevo = z.looseObject({
  nombre,
  categoria: z.string({ error: 'Elige la categoría del producto.' }).trim().min(1, 'Elige la categoría del producto.').max(LARGO.nombre),
  precio: desdeTexto(monto),
  ...datosProducto,
});

export const productoEdicion = z.looseObject({
  nombre: textoOpcional(LARGO.nombre),
  categoria: textoOpcional(LARGO.nombre),
  precio: montoOpcional,
  activo: booleanoOpcional,
  ...datosProducto,
});

export const categoria = z.looseObject({
  nombre: textoOpcional(LARGO.nombre),
  color: textoOpcional(30),
  destino: textoOpcional(20),
});
export const eliminacionCategoria = z.looseObject({ moverA: textoOpcional(LARGO.nombre) });

const datosOferta = {
  descripcion: textoOpcional(LARGO.descripcion),
  tipoDescuento: z.enum(['porcentaje', 'monto'], { error: 'Tipo de descuento inválido.' }).optional(),
  valorDescuento: montoOpcional,
  categorias: z.array(z.string().max(LARGO.nombre)).max(100).optional(),
  fechaInicio: textoOpcional(40),
  fechaFin: textoOpcional(40),
  activa: booleanoOpcional,
};
const porcentajeValido = (o) => o.tipoDescuento !== 'porcentaje' || o.valorDescuento == null || o.valorDescuento <= 100;

export const ofertaNueva = z.looseObject({ nombre: textoOpcional(LARGO.nombre), creadoPor: textoOpcional(LARGO.nombre), ...datosOferta })
  .refine(porcentajeValido, { message: 'El descuento no puede pasar de 100%.', path: ['valorDescuento'] });
export const ofertaEdicion = z.looseObject({ nombre: textoOpcional(LARGO.nombre), ...datosOferta })
  .refine(porcentajeValido, { message: 'El descuento no puede pasar de 100%.', path: ['valorDescuento'] });
export const activacionOferta = z.looseObject({ activa: z.boolean({ error: 'Indica si la oferta queda activa.' }) });
