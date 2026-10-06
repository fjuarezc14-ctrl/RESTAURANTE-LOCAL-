// Esquemas de ventas: cobro, correcciones y anulación
import { z } from 'zod';
import {
  LARGO, TIPOS_COMPROBANTE, desdeTexto, id, idOpcional, metodoPago, montoOpcional, montoPositivo, pinOpcional, textoOpcional,
} from './comunes.js';

export const creditoDetalle = z.looseObject({
  clienteId: id,
  nombre: textoOpcional(150),
  monto: desdeTexto(montoPositivo),
});

export const cobro = z.looseObject({
  pedidoId: idOpcional,
  pedidoIds: z.array(id).min(1).max(20).optional(),
  metodoPago: z.enum(metodoPago.options, { error: 'Método de pago inválido.' }),
  tipoComprobante: z.enum(TIPOS_COMPROBANTE).optional(),
  numDocumento: textoOpcional(20),
  nombreCliente: textoOpcional(150),
  clienteDireccion: textoOpcional(LARGO.nota),
  total: montoOpcional,
  ofertaDescripcion: textoOpcional(LARGO.descripcion),
  descuentoAplicado: montoOpcional,
  montoEfectivo: montoOpcional,
  montoTarjeta: montoOpcional,
  montoYape: montoOpcional,
  montoCredito: montoOpcional,
  clienteCreditoId: idOpcional,
  creditosDetalle: z.array(creditoDetalle).max(20).optional(),
  cortesiaItemIds: z.array(id).max(200).optional(),
  motivoCortesia: textoOpcional(LARGO.nota),
  cajeroNombre: textoOpcional(LARGO.nombre),
  codigoPago: textoOpcional(60),
}).refine((b) => b.pedidoId || b.pedidoIds, { message: 'Indica el pedido a cobrar.', path: ['pedidoId'] });

export const correccionMetodoPago = z.looseObject({
  metodoPago: z.enum(metodoPago.options, { error: 'Método de pago inválido.' }),
  pin: pinOpcional,
  montoEfectivo: montoOpcional,
  montoTarjeta: montoOpcional,
  montoYape: montoOpcional,
  montoCredito: montoOpcional,
  clienteCreditoId: idOpcional,
});

export const correccionTipoEntrega = z.looseObject({
  tipoEntrega: textoOpcional(30),
  pin: pinOpcional,
  codigoPedidosYa: textoOpcional(60),
  direccion: textoOpcional(LARGO.nota),
  nombreCliente: textoOpcional(150),
  telefono: textoOpcional(20),
  metodoPago: z.enum(metodoPago.options, { error: 'Método de pago inválido.' }).optional(),
  montoConCuanto: montoOpcional,
  montoDelivery: montoOpcional,
});

export const correccionDatosCliente = z.looseObject({
  pin: pinOpcional,
  numDocumento: textoOpcional(20),
  clienteDireccion: textoOpcional(LARGO.nota),
  nombreCliente: textoOpcional(150),
  tipoComprobante: z.enum(TIPOS_COMPROBANTE).optional(),
});

export const anulacion = z.looseObject({
  pin: pinOpcional,
  motivo: textoOpcional(LARGO.nota),
});
