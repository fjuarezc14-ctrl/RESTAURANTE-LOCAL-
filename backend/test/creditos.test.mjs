// Créditos: abonos de clientes con deuda (POST /api/clientes/:id/abonar)
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PIN_ADMIN, abrirCaja, api, cobrar, crearBase, crearCliente, esperarError, item, limpiarBD, mesaListaParaCobrar, prisma,
} from './helpers.mjs';

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
