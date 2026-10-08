// Datos obligatorios de un pedido para llevar / delivery según el canal y el comprobante.
// Devuelve el mensaje para el cajero, o null si está todo bien.
export function validarDatosDelivery({
  tipoDelivery, codigoPY = '', deliveryTipoComprobante, deliveryNumDocumento = '',
  deliveryClienteNombre = '', deliveryDireccion = '', deliveryTelefono = '',
}) {
  const esFactura = deliveryTipoComprobante === 'Factura';
  const rucValido = (deliveryNumDocumento || '').length === 11;

  if (tipoDelivery === 'PedidosYa') {
    if (!codigoPY.trim()) return 'El código de PedidosYa es obligatorio.';
  } else if (tipoDelivery === 'ParaLlevar') {
    if (!codigoPY.trim()) return 'El nombre del cliente o número de ticket es obligatorio.';
    if (esFactura) {
      if (!rucValido) return 'Para emitir Factura, el RUC debe tener 11 dígitos.';
      if (!deliveryClienteNombre.trim()) return 'Para emitir Factura, la Razón Social del cliente es obligatoria.';
      if (!deliveryDireccion.trim()) return 'Para emitir Factura, la Dirección fiscal del cliente es obligatoria. Por favor, ingrésala.';
    }
  } else if (tipoDelivery === 'DeliveryPropio') {
    if (!deliveryClienteNombre.trim()) return 'El nombre del cliente es obligatorio.';
    if (!deliveryDireccion.trim()) return 'La dirección del cliente es obligatoria.';
    if (!deliveryTelefono.trim()) return 'El teléfono del cliente es obligatorio.';
    if (esFactura && !rucValido) return 'Para emitir Factura, el RUC debe tener 11 dígitos.';
  }
  return null;
}
