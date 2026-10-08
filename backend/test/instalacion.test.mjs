// Pruebas de modo instalación (local vs web) y modal de IPs (Tarea 19)
import { describe, expect, it } from 'vitest';
import { api, esperarError } from './helpers.mjs';

describe('Modo de instalación y red', () => {
  it('GET /api/auth/marca incluye modoInstalacion', async () => {
    const res = await api().get('/api/auth/marca');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('modoInstalacion');
    expect(['local', 'web']).toContain(res.body.modoInstalacion);
  });

  it('con MODO_INSTALACION=local, GET /api/red/direcciones responde 200 con ips', async () => {
    const anterior = process.env.MODO_INSTALACION;
    try {
      process.env.MODO_INSTALACION = 'local';
      const res = await api().get('/api/red/direcciones');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ips');
      expect(Array.isArray(res.body.ips)).toBe(true);
    } finally {
      process.env.MODO_INSTALACION = anterior;
    }
  });

  it('con MODO_INSTALACION=web, GET /api/red/direcciones responde 404 NO_ENCONTRADO', async () => {
    const anterior = process.env.MODO_INSTALACION;
    try {
      process.env.MODO_INSTALACION = 'web';
      const res = await api().get('/api/red/direcciones');
      esperarError(res, 404, 'NO_ENCONTRADO');
    } finally {
      process.env.MODO_INSTALACION = anterior;
    }
  });
});

describe('direcciones dentro de Docker', () => {
  const conEntorno = async (vars, fn) => {
    const antes = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    Object.assign(process.env, vars);
    try { await fn(); } finally {
      for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  };

  it('no ofrece las IPs internas del contenedor; solo IP_SERVIDOR si está definida', async () => {
    await conEntorno({ MODO_INSTALACION: 'local', EN_CONTENEDOR: 'true', IP_SERVIDOR: '' }, async () => {
      const res = await api().get('/api/red/direcciones');
      expect(res.body).toMatchObject({ enContenedor: true, ips: [] });
    });
    await conEntorno({ MODO_INSTALACION: 'local', EN_CONTENEDOR: 'true', IP_SERVIDOR: '192.168.2.102' }, async () => {
      const res = await api().get('/api/red/direcciones');
      expect(res.body.ips.map((i) => i.ip)).toEqual(['192.168.2.102']);
      expect(res.body.ips[0].principal).toBe(true);
    });
  });
});
