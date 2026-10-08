// Todas las llamadas a la API en un solo objeto (compatibilidad): cada módulo tiene las suyas en
// src/modulos/<módulo>/api.js y el cliente HTTP está en src/apiCliente.js
export { esErrorDeSesion, onSesionPerdida } from './apiCliente';
import { apiSalon } from './modulos/salon/api';
import { apiCocina } from './modulos/cocina/api';
import { apiCaja } from './modulos/caja/api';
import { apiCarta } from './modulos/carta/api';
import { apiUsuarios } from './modulos/usuarios/api';
import { apiCompras } from './modulos/compras/api';
import { apiReportes } from './modulos/reportes/api';
import { apiCreditos } from './modulos/creditos/api';
import { apiConfiguracion } from './modulos/configuracion/api';
import { apiAdmin } from './modulos/admin/api';

export const api = {
  ...apiSalon,
  ...apiCocina,
  ...apiCaja,
  ...apiCarta,
  ...apiUsuarios,
  ...apiCompras,
  ...apiReportes,
  ...apiCreditos,
  ...apiConfiguracion,
  ...apiAdmin,
};
