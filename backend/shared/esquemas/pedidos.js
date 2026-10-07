// Esquemas de pedidos: mesas, comandas, delivery y cancelaciones
import { z } from 'zod';
import {
  LARGO, booleanoOpcional, cantidad, desdeTexto, idOpcional, metodoPago, montoCalculado, montoCalculadoOpcional, textoOpcional,
} from './comunes.js';

const NOTAS_ITEM = 1000; // las notas de un combo incluyen todas las opciones elegidas
const numeroMesa = (mensaje) => desdeTexto(z.number({ error: mensaje }).int(mensaje).positive(mensaje).max(999, mensaje));

export const itemPedido = z.looseObject({
  productoId: idOpcional,
  nombre: textoOpcional(150),
  precio: desdeTexto(montoCalculado),
  cantidad: desdeTexto(cantidad.optional()),
  cant: desdeTexto(cantidad.optional()),
  notas: textoOpcional(NOTAS_ITEM),
  historial: booleanoOpcional,
}).refine((i) => i.cantidad || i.cant, { message: 'La cantidad es obligatoria.', path: ['cantidad'] });

const listaItems = z.array(itemPedido, { error: 'Envía la lista de ítems del pedido.' }).max(200, 'Un pedido puede tener como máximo 200 ítems.');

export const pedidoMesa = z.looseObject({
  mesero: textoOpcional(LARGO.nombre),
  items: listaItems,
  total: montoCalculadoOpcional,
  adicional: booleanoOpcional,
});

export const pedidoLlevar = z.looseObject({
  items: listaItems,
  total: montoCalculadoOpcional,
  metodoPago: z.enum(metodoPago.options, { error: 'Método de pago inválido.' }).optional(),
  tipoDelivery: textoOpcional(30),
  tipoComprobante: textoOpcional(20),
  montoDelivery: montoCalculadoOpcional,
  descuentoMonto: montoCalculadoOpcional,
  descuentoPorcentaje: desdeTexto(z.number().min(0).max(100, 'El descuento no puede pasar de 100%.').optional()),
  descuentoDescripcion: textoOpcional(LARGO.descripcion),
  montoEfectivo: montoCalculadoOpcional,
  montoTarjeta: montoCalculadoOpcional,
  montoYape: montoCalculadoOpcional,
  montoCredito: montoCalculadoOpcional,
  clienteCreditoId: idOpcional,
  nombreCliente: textoOpcional(150),
  numDocumento: textoOpcional(20),
  clienteDireccion: textoOpcional(LARGO.nota),
  telefono: textoOpcional(20),
  // Delivery propio guarda aquí "DELIVERY - nombre | TEL | DIR | PAGA | VUELTO" (ver parseDeliveryInfo)
  codigoPedidosYa: textoOpcional(LARGO.nota),
  codigoPago: textoOpcional(60),
  cajero: textoOpcional(LARGO.nombre),
  motivoCortesia: textoOpcional(LARGO.nota),
});

export const mesaNueva = z.looseObject({ numero: numeroMesa('El número de mesa debe ser un número entero positivo.') });
export const mesaRenumerar = z.looseObject({ nuevoNumero: numeroMesa('El nuevo número de mesa debe ser un número entero positivo.') });
export const mesaUnir = z.looseObject({ numeroMesaAUnir: numeroMesa('Debe especificar el número de mesa a unir.') });
export const mesaSeparar = z.looseObject({ numeroMesa: numeroMesa('El número de mesa no es válido.').optional() });

export const preparacion = z.looseObject({ seccion: textoOpcional(20) });
export const notasItem = z.looseObject({ notas: textoOpcional(NOTAS_ITEM) });

export const cancelacionPedido = z.looseObject({
  motivo: textoOpcional(LARGO.nota),
  canceladoPor: textoOpcional(LARGO.nombre),
  force: booleanoOpcional,
});

export const cancelacionItem = z.looseObject({
  productoId: idOpcional,
  itemId: idOpcional,
  cantidadACancelar: desdeTexto(cantidad.optional()),
  motivo: textoOpcional(LARGO.nota),
  canceladoPor: textoOpcional(LARGO.nombre),
  force: booleanoOpcional,
});
