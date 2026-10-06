// Esquemas de clientes con crédito y abonos
import { z } from 'zod';
import { LARGO, booleanoOpcional, desdeTexto, idOpcional, montoOpcional, montoPositivo, textoOpcional } from './comunes.js';

const datosCliente = {
  tipoDoc: textoOpcional(10),
  numDoc: textoOpcional(15),
  telefono: textoOpcional(20),
  direccion: textoOpcional(LARGO.nota),
  esTrabajador: booleanoOpcional,
  tieneCredito: booleanoOpcional,
  usuarioId: idOpcional,
};

export const clienteNuevo = z.looseObject({
  nombre: z.string({ error: 'El nombre del cliente es obligatorio.' }).trim()
    .min(1, 'El nombre del cliente es obligatorio.').max(150),
  ...datosCliente,
});

export const clienteEdicion = z.looseObject({
  nombre: textoOpcional(150),
  activo: booleanoOpcional,
  ...datosCliente,
});

export const abono = z.looseObject({
  monto: desdeTexto(montoPositivo),
  metodoPago: z.enum(['Efectivo', 'Tarjeta', 'Yape', 'Mixto'], { error: 'Método de pago inválido.' }).optional(),
  montoEfectivo: montoOpcional,
  montoTarjeta: montoOpcional,
  montoYape: montoOpcional,
  registradoPor: textoOpcional(LARGO.nombre),
  nota: textoOpcional(LARGO.nota),
});
