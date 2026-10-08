import { describe, expect, it } from 'vitest';
import { validarDatosDelivery } from '../../modulos/caja/utils/validarDelivery';

describe('validarDatosDelivery', () => {
  it('PedidosYa y Para llevar piden el código o nombre', () => {
    expect(validarDatosDelivery({ tipoDelivery: 'PedidosYa', codigoPY: ' ' })).toMatch(/código de PedidosYa/);
    expect(validarDatosDelivery({ tipoDelivery: 'ParaLlevar', codigoPY: '' })).toMatch(/nombre del cliente o número de ticket/);
    expect(validarDatosDelivery({ tipoDelivery: 'ParaLlevar', codigoPY: 'T-12' })).toBeNull();
  });

  it('Factura para llevar: RUC de 11 dígitos, razón social y dirección', () => {
    const base = { tipoDelivery: 'ParaLlevar', codigoPY: 'T-1', deliveryTipoComprobante: 'Factura' };
    expect(validarDatosDelivery({ ...base, deliveryNumDocumento: '2060' })).toMatch(/RUC debe tener 11/);
    expect(validarDatosDelivery({ ...base, deliveryNumDocumento: '20601234567' })).toMatch(/Razón Social/);
    expect(validarDatosDelivery({ ...base, deliveryNumDocumento: '20601234567', deliveryClienteNombre: 'ACME' })).toMatch(/Dirección fiscal/);
    expect(validarDatosDelivery({ ...base, deliveryNumDocumento: '20601234567', deliveryClienteNombre: 'ACME', deliveryDireccion: 'Av. 1' })).toBeNull();
  });

  it('Delivery propio: nombre, dirección y teléfono', () => {
    const base = { tipoDelivery: 'DeliveryPropio' };
    expect(validarDatosDelivery(base)).toMatch(/nombre del cliente es obligatorio/);
    expect(validarDatosDelivery({ ...base, deliveryClienteNombre: 'Ana' })).toMatch(/dirección/);
    expect(validarDatosDelivery({ ...base, deliveryClienteNombre: 'Ana', deliveryDireccion: 'Jr. 2' })).toMatch(/teléfono/);
    expect(validarDatosDelivery({ ...base, deliveryClienteNombre: 'Ana', deliveryDireccion: 'Jr. 2', deliveryTelefono: '999' })).toBeNull();
  });
});
