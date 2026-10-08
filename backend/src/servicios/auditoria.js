// ============================================================
// AUDITORÍA (tarea 11): registro de quién hizo qué y el antes → después.
// Se llama DENTRO del $transaction de la operación (cliente = tx): si la operación falla, no queda
// registro; si el registro falla, la operación se deshace. Nunca se edita ni se borra desde la app.
// ============================================================
const { prisma } = require('../db');

// Las acciones que se registran (la pantalla de auditoría filtra por estas)
const ACCIONES = {
  VENTA_ANULADA: 'Venta anulada',
  VENTA_DEVUELTA: 'Devolución de venta',
  METODO_PAGO_CORREGIDO: 'Método de pago corregido',
  TIPO_ENTREGA_CORREGIDO: 'Tipo de entrega corregido',
  DATOS_CLIENTE_CORREGIDOS: 'Datos del cliente corregidos',
  DESCUENTO: 'Descuento en una venta',
  CORTESIA: 'Cortesía (regalo)',
  PEDIDO_CANCELADO: 'Pedido cancelado',
  ITEM_CANCELADO: 'Ítem cancelado',
  PRECIO_CAMBIADO: 'Precio cambiado',
  PRODUCTO_ELIMINADO: 'Producto eliminado',
  CAJA_ABIERTA: 'Caja abierta',
  CAJA_CERRADA: 'Caja cerrada',
  CAJA_CIERRE_FORZADO: 'Cierre forzado de caja',
  CAJA_MOVIMIENTO: 'Ingreso o retiro de caja',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_EDITADO: 'Usuario editado',
  USUARIO_DESACTIVADO: 'Usuario desactivado',
  PIN_CAMBIADO: 'PIN cambiado',
  DISPOSITIVO_REVOCADO: 'Equipo revocado',
  SESIONES_CERRADAS: 'Sesiones cerradas',
  RESPALDO_DESCARGADO: 'Respaldo descargado',
};

// Decimal, Date y BigInt quedan como texto o número en el JSON
const aJson = (valor) => (valor === undefined || valor === null ? undefined : JSON.parse(JSON.stringify(valor)));

/**
 * @param {object} cliente  prisma o el `tx` del $transaction de la operación
 * @param {object} req      la petición (para el usuario y el equipo de la sesión)
 * @param {{ accion: keyof ACCIONES, entidad: string, entidadId?: string|number, antes?: any, despues?: any,
 *           motivo?: string|null, autorizadoPor?: string|null, nombreDeclarado?: string|null }} datos
 *   nombreDeclarado: el nombre que mandó la pantalla (ej. cajeroNombre). Solo se usa si no hay sesión
 *   (transición con AUTH_OBLIGATORIA=false) y se marca como "sin sesión": no está verificado.
 */
async function registrarAuditoria(cliente, req, datos) {
  if (!ACCIONES[datos.accion]) throw new Error(`Acción de auditoría desconocida: ${datos.accion}`);
  const usuario = req?.usuario;
  const dispositivo = req?.dispositivo;
  const usuarioNombre = usuario?.nombre
    || (datos.nombreDeclarado ? `${datos.nombreDeclarado} (sin sesión)` : 'Sin sesión');
  return (cliente || prisma).auditoria.create({
    data: {
      usuarioId: usuario?.id ?? null,
      usuarioNombre,
      dispositivoId: dispositivo?.id ?? null,
      dispositivoNombre: dispositivo?.nombre ?? null,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId != null ? String(datos.entidadId) : null,
      antes: aJson(datos.antes),
      despues: aJson(datos.despues),
      motivo: datos.motivo || null,
      autorizadoPor: datos.autorizadoPor || null,
    },
  });
}

module.exports = { ACCIONES, registrarAuditoria };
