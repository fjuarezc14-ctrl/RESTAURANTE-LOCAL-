import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, onSesionPerdida } from '../api';

function respuestaError(status, codigo, mensaje) {
  return new Response(JSON.stringify({ error: { codigo, mensaje } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api.js: sesión perdida', () => {
  let alPerder;
  let quitar;

  beforeEach(() => {
    alPerder = vi.fn();
    quitar = onSesionPerdida(alPerder);
  });

  afterEach(() => {
    quitar();
    vi.unstubAllGlobals();
  });

  it.each(['NO_AUTENTICADO', 'SESION_EXPIRADA', 'DISPOSITIVO_NO_ACTIVADO'])('avisa con %s en una ruta normal', async (codigo) => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(401, codigo, 'Ingresa tu PIN para continuar.')));
    await expect(api.getMesas()).rejects.toMatchObject({ codigo });
    expect(alPerder).toHaveBeenCalledTimes(1);
    expect(alPerder.mock.calls[0][0]).toMatchObject({ codigo, message: 'Ingresa tu PIN para continuar.' });
  });

  it('no avisa en las rutas /api/auth/* (las maneja la pantalla de login)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(401, 'NO_AUTENTICADO', 'Ingresa tu PIN.')));
    await expect(api.getSesionYo()).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
    expect(alPerder).not.toHaveBeenCalled();
  });

  it('no avisa con otros errores', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(403, 'SIN_PERMISO', 'No tienes permiso.')));
    await expect(api.getMesas()).rejects.toMatchObject({ codigo: 'SIN_PERMISO' });
    expect(alPerder).not.toHaveBeenCalled();
  });

  it('deja de avisar al quitar el suscriptor', async () => {
    quitar();
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(401, 'SESION_EXPIRADA', 'Tu sesión terminó.')));
    await expect(api.getMesas()).rejects.toMatchObject({ codigo: 'SESION_EXPIRADA' });
    expect(alPerder).not.toHaveBeenCalled();
  });
});

describe('api.js: Idempotency-Key', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cobrar manda la clave en el header; sin clave no manda nada', async () => {
    const fetchFalso = vi.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchFalso);
    await api.cobrar({ pedidoId: 1 }, 'clave-123');
    await api.cobrar({ pedidoId: 1 });
    expect(fetchFalso.mock.calls[0][1].headers['Idempotency-Key']).toBe('clave-123');
    expect(fetchFalso.mock.calls[1][1].headers['Idempotency-Key']).toBeUndefined();
  });
});
