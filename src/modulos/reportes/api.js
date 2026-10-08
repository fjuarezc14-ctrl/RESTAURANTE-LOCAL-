// API de Reportes
import { apiRequest } from '../../apiCliente';

export const apiReportes = {
  getReporteContable: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/contable${qs}`);
  },
  getCancelaciones: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/cancelaciones${qs}`);
  },
  getReporteMozos: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/mozos${qs}`);
  },
  getReporteCajeros: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/cajeros${qs}`);
  },
  getRotacion: (desde = null, hasta = null) => {
    const params = [];
    if (desde) params.push(`desde=${encodeURIComponent(desde)}`);
    if (hasta) params.push(`hasta=${encodeURIComponent(hasta)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest(`/api/reportes/rotacion${qs}`);
  },
  getReportePollos: (desde = null, hasta = null) => {
    const params = [];
    if (desde) params.push(`desde=${encodeURIComponent(desde)}`);
    if (hasta) params.push(`hasta=${hasta}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest(`/api/reportes/pollos${qs}`);
  },
};
