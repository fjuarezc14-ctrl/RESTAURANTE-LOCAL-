import { describe, expect, it } from 'vitest';
import { api } from '../../api';
import { apiAdmin } from '../../modulos/admin/api';
import { apiCaja } from '../../modulos/caja/api';
import { apiCarta } from '../../modulos/carta/api';
import { apiCocina } from '../../modulos/cocina/api';
import { apiCompras } from '../../modulos/compras/api';
import { apiConfiguracion } from '../../modulos/configuracion/api';
import { apiCreditos } from '../../modulos/creditos/api';
import { apiReportes } from '../../modulos/reportes/api';
import { apiSalon } from '../../modulos/salon/api';
import { apiUsuarios } from '../../modulos/usuarios/api';

const modulos = [apiAdmin, apiCaja, apiCarta, apiCocina, apiCompras, apiConfiguracion, apiCreditos, apiReportes, apiSalon, apiUsuarios];

describe('api por módulo', () => {
  it('ninguna función se repite entre módulos (una pisaría a la otra en `api`)', () => {
    const nombres = modulos.flatMap((m) => Object.keys(m));
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('`api` reúne todas las funciones de los módulos', () => {
    const total = modulos.reduce((n, m) => n + Object.keys(m).length, 0);
    expect(Object.keys(api)).toHaveLength(total);
    expect(typeof api.cobrar).toBe('function');
    expect(typeof api.getMesas).toBe('function');
  });
});
