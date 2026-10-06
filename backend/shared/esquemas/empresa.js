// Esquema de los datos de la empresa (Configuración)
import { z } from 'zod';
import { LARGO, textoOpcional } from './comunes.js';

export const datosEmpresa = z.looseObject({
  name: textoOpcional(LARGO.nombre),
  brandShort: textoOpcional(40),
  tagline: textoOpcional(150),
  legalName: textoOpcional(150),
  ruc: z.string().trim().regex(/^(\d{11})?$/, 'El RUC debe tener 11 dígitos.').nullish(),
  address: textoOpcional(LARGO.nota),
  phone: textoOpcional(30),
  email: textoOpcional(120),
  ticketFooter: textoOpcional(LARGO.nota),
  tipoNegocio: textoOpcional(30),
  barraCategorias: z.array(z.string().max(LARGO.nombre)).max(100).optional(),
});
