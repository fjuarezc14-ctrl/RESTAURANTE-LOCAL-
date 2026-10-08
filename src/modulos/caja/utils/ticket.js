// Ayudas para armar el ticket impreso (se llaman al cobrar o reimprimir, no durante el render)
import { generateOfflineQrUrl } from '../../../utils/qrOffline';
import { numeroALetras } from '../../../utils/numeroALetras';
import { parseDeliveryInfo } from '../../../utils/ventas';

// Resumen (hash) de muestra que va impreso en el ticket mientras no hay facturación electrónica
export const hashResumenSimulado = () => `gSbTDa${Math.random().toString(36).substring(2, 8).toUpperCase()}iIZDyirfA6TBPKJnEI=`;

// Comprobante de un cobro recién hecho (mesa o delivery), para ModalComprobanteSunat
export function comprobanteDeCobro({ total, response, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items,
  mesaNum = 'Delivery', deliveryInfo = null, descuentoAplicado = 0, ofertaDescripcion = null, metodoPorDefecto, ruc }) {
  if (!response) response = {};
  const fecha = new Date().toLocaleDateString('es-PE');
  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  
  let serie = response.serie || (tipoComprobante === 'Factura' ? 'F001' : (tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
  // Los tickets no llevan correlativo SUNAT: se numeran con el ID de la venta (único e incremental)
  let correlativoStr = String(response.numero || response.ventaId || response.id || '').padStart(4, '0');
  let subtotal = total / 1.105;
  let igv = total - subtotal;
  let totalLetras = numeroALetras(total);
  let hashResumen = hashResumenSimulado();
  const rucEmpresa = ruc; // el QR de SUNAT lleva solo el número
  const igvSafe = Number(igv || 0).toFixed(2);
  const totalSafe = Number(total || 0).toFixed(2);
  let qrData = `${rucEmpresa}|${tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${fecha}|${tipoComprobante === 'Factura' ? '6' : (numDocumento?.length === 8 ? '1' : '0')}|${numDocumento || '00000000'}`;
  let enlacePdf = null;
  let contingencia = false;

  const qrImageUrl = generateOfflineQrUrl(qrData);

  return {
    tipo: tipoComprobante,
    serie,
    correlativo: correlativoStr,
    fecha,
    hora,
    mesaNum,
    clienteNombre: clienteNombre || 'Consumidor Final',
    clienteDoc: numDocumento || 'S/D',
    clienteDireccion: clienteDireccion || '',
    items: items.map(i => ({ cant: i.cant, nombre: i.nombre, precio: i.precio, notas: i.notas, categoria: i.categoria || '' })),
    subtotal,
    igv,
    total,
    descuentoAplicado: descuentoAplicado || response.descuentoAplicado || 0,
    ofertaDescripcion: ofertaDescripcion || response.ofertaDescripcion || null,
    totalLetras,
    hashResumen,
    metodoPago: response.metodoPago || metodoPorDefecto,
    montoEfectivo: response.montoEfectivo || 0,
    montoTarjeta: response.montoTarjeta || 0,
    montoYape: response.montoYape || 0,
    qrImageUrl,
    enlacePdf,
    contingencia,
    deliveryInfo,
    shouldAutoPrint: true,
  };
}

// Comprobante para reimprimir una venta del historial (v: venta de /api/ventas)
export function comprobanteDeVenta(v, ruc) {
  const rucEmpresa = ruc; // el QR de SUNAT lleva solo el número
  
  let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : (v.tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
  let correlativoStr = String(v.numero || v.id).padStart(4, '0');
  const igvSafe = Number(v.igv || 0).toFixed(2);
  const totalSafe = Number(v.total || 0).toFixed(2);
  let qrData = `${rucEmpresa}|${v.tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igvSafe}|${totalSafe}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':(v.numDocumento?.length === 8 ? '1' : '0')}|${v.numDocumento || '00000000'}`;
  let hashResumen = hashResumenSimulado();
  let enlacePdf = null;
  let contingencia = false;

  const qrImageUrl = generateOfflineQrUrl(qrData);
  const totalLetras = numeroALetras(v.total);

  // Reconstruir items si vienen del backend o parsear de itemsResumen
  let items = v.items || [];
  if (items.length === 0 && v.itemsResumen) {
    items = v.itemsResumen.split(', ').map(str => {
      const match = str.match(/^(\d+)x\s+(.+)$/);
      if (match) {
        const cant = parseInt(match[1]);
        const nombre = match[2];
        const precio = v.total / cant; // fallback estimate
        return { cant, nombre, precio };
      }
      return { cant: 1, nombre: str, precio: v.total };
    });
  }

  const parsedDelivery = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
  const cleanDoc = (() => {
    if (v.numDocumento && v.numDocumento.startsWith('DELIVERY -')) return 'S/D';
    return v.numDocumento || 'S/D';
  })();
  const cleanNombre = (() => {
    if (parsedDelivery) return parsedDelivery.nombre;
    if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
      return v.nombreCliente.replace('DELIVERY - ', '');
    }
    return v.nombreCliente || 'Consumidor Final';
  })();

  // Sumar items y agregar servicio de delivery si hay descuadre
  const sumItems = items.reduce((s, i) => s + (i.cant * i.precio), 0);
  const diff = v.total - sumItems;
  if (diff > 0.05 && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.nombreCliente?.startsWith('DELIVERY -'))) {
    items = [...items, { cant: 1, nombre: 'Servicio de Delivery', precio: diff }];
  }

  return {
    tipo: v.tipoComprobante,
    serie,
    correlativo: correlativoStr,
    fecha: v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE'),
    hora: v.hora,
    mesaNum: v.mesaNum || (parsedDelivery ? 'Delivery' : 'Llevar'),
    clienteNombre: cleanNombre,
    clienteDoc: cleanDoc,
    clienteDireccion: parsedDelivery ? parsedDelivery.direccion : (v.clienteDireccion || ''),
    items,
    subtotal: v.subtotal,
    igv: v.igv,
    total: v.total,
    descuentoAplicado: v.descuentoAplicado || 0,
    ofertaDescripcion: v.ofertaDescripcion || null,
    totalLetras,
    hashResumen,
    metodoPago: v.metodoPago,
    montoEfectivo: v.montoEfectivo || 0,
    montoTarjeta: v.montoTarjeta || 0,
    montoYape: v.montoYape || 0,
    qrImageUrl,
    enlacePdf,
    contingencia,
    deliveryInfo: parsedDelivery,
    shouldAutoPrint: true,
  };
}

// Enlace de WhatsApp con el detalle de una venta (teléfono de 9 dígitos, sin el 51)
export function enlaceWhatsAppVenta(v, telefono, nombreEmpresa) {
  const detalle = (v.itemsResumen || '').trim();
  const totalSafe = Number(v.total || 0).toFixed(2);
  const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, le enviamos el detalle de su consumo en *${nombreEmpresa}*:\n\n${detalle ? detalle + '\n\n' : ''}Total: *S/ ${totalSafe}*\nTicket de venta N° ${v.id}\n\n¡Gracias por su preferencia!`;
  return `https://api.whatsapp.com/send?phone=51${telefono}&text=${encodeURIComponent(mensaje)}`;
}
