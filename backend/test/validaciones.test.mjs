// Validación de entrada (tarea 5): esquemas zod, límites y reglas de dinero
import { beforeEach, describe, expect, it } from 'vitest';
import { api, crearBase, esperarError, limpiarBD } from './helpers.mjs';

let carta;

beforeEach(async () => {
  await limpiarBD();
  carta = await crearBase();
});

describe('base', () => {
  it.each([
    ['get', '/api/clientes/abc', 'id'],
    ['patch', '/api/ventas/-3/anular', 'ventaId'],
    ['patch', '/api/pedidos/items/1.5/entregar', 'itemId'],
    ['post', '/api/mesas/cero/pedido', 'num'],
  ])('%s %s: un ID no numérico en la URL → VALIDACION', async (metodo, url, campo) => {
    esperarError(await api()[metodo](url).send({}), 400, 'VALIDACION', campo);
  });

  it('un cuerpo de más de 100 KB → 413', async () => {
    const res = await api().post('/api/caja/apertura').send({ cajeroNombre: 'x', nota: 'a'.repeat(110 * 1024) });
    esperarError(res, 413, 'CUERPO_DEMASIADO_GRANDE');
  });

  it('la carta de prueba existe', () => {
    expect(carta.lomo.precio).toBe(25.5);
  });
});
