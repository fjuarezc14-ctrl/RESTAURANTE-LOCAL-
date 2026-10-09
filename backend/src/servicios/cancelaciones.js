// @ts-check
// ============================================================
// CANCELACIONES DE PEDIDOS E ÍTEMS (tarea 24)
// - Quién puede cancelar sin autorización y cuándo hace falta el PIN de un Administrador o Cajero.
// - Avisos para cocina y barra guardados en la BD (tabla Cancelacion): ya no se pierden al reiniciar.
// - Estado de la mesa después de cancelar.
// ============================================================
const { prisma } = require('../db');
const { ErrorApp } = require('../middlewares/errores');
const { usuarioPorPinAutorizado } = require('./autorizacion');
const { LIMITE_CANCELACION_MS } = require('./pedidos');

const ROLES_QUE_AUTORIZAN = ['Administrador', 'Cajero'];
const HORAS_AVISO = 2; // los avisos sin confirmar se dejan de mostrar a las 2 horas

/**
 * Sin autorización solo se cancela un pedido que sigue en cocina, dentro de los 5 minutos y sin
 * platos ya listos. Si no, hace falta { autorizacion: { pin } } de un Administrador o Cajero:
 * el backend lo valida aquí (lo que la pantalla validó antes no cuenta).
 * @returns {Promise<string|null>} nombre de quien autorizó, o null si no hizo falta
 */
async function autorizarCancelacion(req, pedido, { forzada = false, itemListo = false } = {}) {
  const vencido = Date.now() - new Date(pedido.createdAt).getTime() > LIMITE_CANCELACION_MS;
  const requiere = forzada || itemListo || pedido.estado !== 'Cocina' || vencido;
  const pin = req.body?.autorizacion?.pin;
  if (!requiere && !pin) return null;
  if (!pin) {
    if (vencido && !forzada && !itemListo && pedido.estado === 'Cocina') {
      throw new ErrorApp('LIMITE_ANULACION_VENCIDO', 'Pasaron más de 5 minutos: hace falta el PIN de un Administrador o Cajero para anular.');
    }
    throw new ErrorApp('AUTORIZACION_REQUERIDA', 'Hace falta el PIN de un Administrador o Cajero para anular.', { campo: 'pin' });
  }
  const usuario = await usuarioPorPinAutorizado(req, pin);
  if (!usuario) throw new ErrorApp('PIN_INCORRECTO', 'PIN incorrecto.', { campo: 'pin' });
  if (!ROLES_QUE_AUTORIZAN.includes(usuario.rol)) {
    throw new ErrorApp('SIN_PERMISO', 'Se requiere el PIN de un Administrador o Cajero.', { campo: 'pin' });
  }
  return usuario.nombre;
}

const mesaInfoDe = (pedido) => (pedido.mesaId
  ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}`
  : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery'));

/**
 * Guarda la cancelación separada por estación (cocina y barra ven solo lo suyo).
 * items: [{ nombre, cantidad, precio, notas, categoria }]
 */
async function registrarCancelacion(tx, { pedido, tipo, items, motivo, canceladoPor, autorizadoPor, barraCategorias }) {
  const porEstacion = { Cocina: [], Barra: [] };
  for (const i of items) {
    const estacion = barraCategorias.includes(i.categoria || '') ? 'Barra' : 'Cocina';
    porEstacion[estacion].push({ nombre: i.nombre, cantidad: i.cantidad, precio: Number(i.precio), notas: i.notas || null });
  }
  for (const [estacion, lista] of Object.entries(porEstacion)) {
    if (lista.length === 0) continue;
    await tx.cancelacion.create({
      data: {
        pedidoId: pedido.id, tipo, estacion, items: lista, mesaInfo: mesaInfoDe(pedido),
        codigoPedidosYa: pedido.codigoPedidosYa || null, motivo: motivo || null,
        canceladoPor: canceladoPor || 'Sin especificar', autorizadoPor: autorizadoPor || null,
      },
    });
  }
}

// Después de cancelar: la mesa queda Libre (y se separan sus uniones), en Cocina o Servido
async function actualizarEstadoMesa(tx, mesaId) {
  if (!mesaId) return { mesaLiberada: false, nuevoEstadoMesa: null };
  const activos = await tx.pedido.findMany({ where: { mesaId, estado: { in: ['Cocina', 'Servido'] } }, select: { estado: true } });
  if (activos.length === 0) {
    const mesa = await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'Libre' } });
    await tx.mesa.updateMany({ where: { estado: `Unida a Mesa ${mesa.numero}` }, data: { estado: 'Libre' } });
    return { mesaLiberada: true, nuevoEstadoMesa: 'Libre' };
  }
  const nuevoEstadoMesa = activos.some((p) => p.estado === 'Cocina') ? 'Cocina' : 'Servido';
  await tx.mesa.update({ where: { id: mesaId }, data: { estado: nuevoEstadoMesa } });
  return { mesaLiberada: false, nuevoEstadoMesa };
}

// Avisos que cocina o barra aún no confirmaron (con la forma que ya usan los monitores)
async function avisosPendientes(estacion) {
  const desde = new Date(Date.now() - HORAS_AVISO * 3600 * 1000);
  const filas = await prisma.cancelacion.findMany({
    where: { estacion, confirmadaEn: null, creadoEn: { gte: desde } },
    orderBy: { creadoEn: 'asc' },
  });
  return filas.map((c) => ({
    id: c.id, pedidoId: c.pedidoId, items: c.items, mesaInfo: c.mesaInfo, codigoPedidosYa: c.codigoPedidosYa,
    canceladoPor: c.canceladoPor, canceladoEn: c.creadoEn.toISOString(),
  }));
}

async function confirmarAviso(id, estacion) {
  await prisma.cancelacion.updateMany({ where: { id, estacion, confirmadaEn: null }, data: { confirmadaEn: new Date() } });
}

module.exports = { autorizarCancelacion, registrarCancelacion, actualizarEstadoMesa, avisosPendientes, confirmarAviso };
