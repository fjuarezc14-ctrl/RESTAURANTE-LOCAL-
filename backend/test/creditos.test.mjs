// Créditos: abonos de clientes con deuda (POST /api/clientes/:id/abonar)
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PIN_ADMIN, abrirCaja, api, cobrar, crearBase, crearCliente, esperarError, item, limpiarBD, mesaListaParaCobrar, prisma,
} from './helpers.mjs';

const require = createRequire(import.meta.url);
const { migrarCreditosAntiguos } = require('../src/servicios/creditos.js');

let carta;
let cliente;
const abonar = (datos, id = cliente.id) => api().post(`/api/clientes/${id}/abonar`).send({ registradoPor: 'Carla', ...datos });
const saldo = async (id = cliente.id) => (await api().get(`/api/clientes/${id}`)).body.saldo;

// Venta a crédito de S/ 54.50 para el cliente
async function dejarDeuda() {
  const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]);
  const res = await cobrar(pedidoId, { metodoPago: 'Crédito', clienteCreditoId: cliente.id });
  return res.body.ventaId;
}

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
  cliente = await crearCliente('Juan Pérez');
});

describe('requisitos', () => {
  it('no registra abonos con la caja cerrada', async () => {
    esperarError(await abonar({ monto: 10 }), 409, 'CAJA_CERRADA');
  });

  it('rechaza montos de 0 o negativos', async () => {
    await abrirCaja();
    await dejarDeuda();
    esperarError(await abonar({ monto: 0 }), 400, 'VALIDACION', 'monto');
    esperarError(await abonar({ monto: -5 }), 400, 'VALIDACION', 'monto');
  });

  it('responde 404 si el cliente no existe', async () => {
    await abrirCaja();
    esperarError(await abonar({ monto: 10 }, 9999), 404, 'NO_ENCONTRADO');
  });

  it('rechaza el abono de un cliente sin deuda', async () => {
    await abrirCaja();
    expect((await abonar({ monto: 10 })).status).toBe(400);
  });
});

describe('saldo', () => {
  it('la venta a crédito suma a la deuda y cada abono la reduce', async () => {
    await abrirCaja();
    await dejarDeuda();
    expect(await saldo()).toBe(54.5);

    expect((await abonar({ monto: 20 })).status).toBe(200);
    expect(await saldo()).toBe(34.5);

    expect((await abonar({ monto: 34.5, metodoPago: 'Yape' })).status).toBe(200);
    expect(await saldo()).toBe(0);
  });

  it('no permite abonar más que la deuda', async () => {
    await abrirCaja();
    await dejarDeuda();
    esperarError(await abonar({ monto: 60 }), 400, 'VALIDACION', 'monto');
    expect(await prisma.abonoCredito.count()).toBe(0);
  });

  // Hoy acepta hasta S/ 0.05 por encima de la deuda (tolerancia de redondeo)
  it('acepta hasta 5 céntimos por encima de la deuda', async () => {
    await abrirCaja();
    await dejarDeuda();
    expect((await abonar({ monto: 54.55 })).status).toBe(200);
    expect(await saldo()).toBe(-0.05);
  });

  it('una venta a crédito anulada deja de contar como deuda', async () => {
    await abrirCaja();
    const ventaId = await dejarDeuda();
    await api().patch(`/api/ventas/${ventaId}/anular`).send({ pin: PIN_ADMIN, motivo: 'Error' });
    expect(await saldo()).toBe(0);
    expect((await abonar({ monto: 10 })).status).toBe(400);
  });
});

describe('medios de pago del abono', () => {
  it('efectivo por defecto: todo el monto va a efectivo', async () => {
    await abrirCaja();
    await dejarDeuda();
    const { body } = await abonar({ monto: 20 });
    expect(body.abono).toMatchObject({ metodoPago: 'Efectivo', montoEfectivo: 20, montoTarjeta: 0, montoYape: 0 });
  });

  it('mixto: guarda cada parte cuando la suma coincide con el monto', async () => {
    await abrirCaja();
    await dejarDeuda();
    const { body } = await abonar({ monto: 30, metodoPago: 'Mixto', montoEfectivo: 10, montoTarjeta: 15, montoYape: 5 });
    expect(body.abono).toMatchObject({ monto: 30, montoEfectivo: 10, montoTarjeta: 15, montoYape: 5 });
  });

  it('mixto: rechaza si la suma de las partes no coincide con el monto', async () => {
    await abrirCaja();
    await dejarDeuda();
    esperarError(await abonar({ monto: 30, metodoPago: 'Mixto', montoEfectivo: 10, montoTarjeta: 10 }), 400, 'PAGO_NO_CUADRA');
    expect(await prisma.abonoCredito.count()).toBe(0);
  });

  it('rechaza montos con más de 2 decimales', async () => {
    await abrirCaja();
    await dejarDeuda();
    esperarError(await abonar({ monto: 10.456 }), 400, 'VALIDACION', 'monto');
  });

  it('acepta el monto como texto, tal como lo envía el formulario', async () => {
    await abrirCaja();
    await dejarDeuda();
    const { body } = await abonar({ monto: '15,50', metodoPago: 'Mixto', montoEfectivo: '10', montoYape: '5.5' });
    expect(body.abono).toMatchObject({ monto: 15.5, montoEfectivo: 10, montoYape: 5.5 });
  });
});

describe('reparto del crédito (tabla VentaCredito)', () => {
  it('la descripción que manda la pantalla ya no puede cargarle deuda a otro cliente', async () => {
    await abrirCaja();
    const otro = await crearCliente('Víctima');
    const pedidoId = await mesaListaParaCobrar(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]);
    const res = await cobrar(pedidoId, {
      metodoPago: 'Crédito', clienteCreditoId: cliente.id,
      ofertaDescripcion: `Promo [CREDITO_SPLIT:[{"clienteId":${otro.id},"monto":500}]]`,
    });
    expect(res.status).toBe(200);
    expect([await saldo(), await saldo(otro.id)]).toEqual([54.5, 0]);
    expect((await prisma.venta.findUnique({ where: { id: res.body.ventaId } })).ofertaDescripcion).toBe('Promo');
  });

  it('al arrancar pasa las ventas antiguas (reparto como texto) a la tabla, con los mismos saldos', async () => {
    await abrirCaja();
    const [ana, beto] = await Promise.all([crearCliente('Ana'), crearCliente('Beto')]);
    const ventaRepartida = (await cobrar(await mesaListaParaCobrar(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]), {
      metodoPago: 'Crédito', creditosDetalle: [{ clienteId: ana.id, monto: 30 }, { clienteId: beto.id, monto: 24.5 }],
    })).body.ventaId;
    const ventaSimple = await dejarDeudaEnMesa(2);

    // Como las dejaba la versión anterior: sin filas en VentaCredito, el reparto en el texto y de antes de la migración
    const antes = new Date('2026-01-01T12:00:00Z');
    await prisma.ventaCredito.deleteMany({});
    await prisma.venta.update({
      where: { id: ventaRepartida },
      data: { createdAt: antes, ofertaDescripcion: `Cumpleaños [CREDITO_SPLIT:[{"clienteId":${ana.id},"nombre":"Ana","monto":30},{"clienteId":${beto.id},"nombre":"Beto","monto":24.5}]]` },
    });
    await prisma.venta.update({ where: { id: ventaSimple }, data: { createdAt: antes } });
    expect(await saldo(ana.id)).toBe(0);

    expect(await migrarCreditosAntiguos()).toBe(2);
    expect([await saldo(ana.id), await saldo(beto.id), await saldo()]).toEqual([30, 24.5, 54.5]);
    expect((await prisma.venta.findUnique({ where: { id: ventaRepartida } })).ofertaDescripcion).toBe('Cumpleaños');
    expect(await migrarCreditosAntiguos()).toBe(0); // la segunda vez no hay nada que pasar
  });
});

async function dejarDeudaEnMesa(mesa) {
  const pedidoId = await mesaListaParaCobrar(mesa, [item(carta.lomo, 2), item(carta.gaseosa, 1)]);
  return (await cobrar(pedidoId, { metodoPago: 'Crédito', clienteCreditoId: cliente.id })).body.ventaId;
}

describe('directorio de clientes', () => {
  it('"consumido" es lo de cada cliente: su parte del crédito y lo pagado con su documento', async () => {
    await abrirCaja();
    const [ana, beto] = await Promise.all([crearCliente('Ana'), crearCliente('Beto')]);
    await prisma.cliente.update({ where: { id: beto.id }, data: { numDoc: '44556677' } });
    // Reparto: Ana 30, Beto 24.50
    await cobrar(await mesaListaParaCobrar(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]), {
      metodoPago: 'Crédito', creditosDetalle: [{ clienteId: ana.id, monto: 30 }, { clienteId: beto.id, monto: 24.5 }],
    });
    // Beto paga al contado con su DNI: S/ 3.50
    await cobrar(await mesaListaParaCobrar(2, [item(carta.gaseosa, 1)]), { numDocumento: '44556677', nombreCliente: 'Beto' });

    const { clientes } = (await api().get('/api/clientes/directorio?search=')).body;
    const de = (id) => clientes.find((c) => c.id === id);
    expect(de(ana.id)).toMatchObject({ totalConsumido: 30, visitas: 1 });
    expect(de(beto.id)).toMatchObject({ totalConsumido: 28, visitas: 2 });
  });

  it('en un pago mixto sin documento solo cuenta la parte a crédito (lo del contado no se sabe quién lo pagó)', async () => {
    await abrirCaja();
    // S/ 54.50: 20 a crédito del cliente y el resto en efectivo
    await cobrar(await mesaListaParaCobrar(1, [item(carta.lomo, 2), item(carta.gaseosa, 1)]), {
      metodoPago: 'Mixto', montoEfectivo: 34.5, montoCredito: 20, clienteCreditoId: cliente.id,
    });
    const { clientes } = (await api().get('/api/clientes/directorio?search=')).body;
    expect(clientes.find((c) => c.id === cliente.id).totalConsumido).toBe(20);
    expect(await saldo()).toBe(20);
  });
});
