// ================================================================
// DATOS DE VENTAS Y PEDIDOS QUE SE GUARDAN COMO TEXTO (delivery, crédito dividido)
// Lo usan Caja, Reportes y los monitores de cocina y barra.
// ================================================================

// Delivery propio guarda "DELIVERY - nombre | TEL: … | DIR: … | PAGA: … | VUELTO: …" en codigoPedidosYa
export const parseDeliveryInfo = (code) => {
  if (!code || typeof code !== 'string' || !code.startsWith('DELIVERY -')) return null;
  const parts = code.split(' | ');
  const namePart = parts[0] ? parts[0].replace('DELIVERY - ', '') : '';
  const telPart = parts[1] ? parts[1].replace('TEL: ', '') : '';
  const dirPart = parts[2] ? parts[2].replace('DIR: ', '') : '';
  const pagaPart = parts[3] ? parts[3].replace('PAGA: ', '') : '';
  const vueltoPart = parts[4] ? parts[4].replace('VUELTO: ', '') : '';

  return {
    nombre: namePart,
    telefono: telPart,
    direccion: dirPart,
    conCuanto: pagaPart,
    vuelto: vueltoPart,
  };
};

// Reparto del crédito entre varios clientes: [CREDITO_SPLIT:[…]] dentro de ofertaDescripcion
export const parsearCreditoSplit = (ofertaDescripcion, defaultClienteId, defaultMonto) => {
  if (ofertaDescripcion && typeof ofertaDescripcion === 'string') {
    const match = ofertaDescripcion.match(/\[CREDITO_SPLIT:(\[.*?\])\]/) || ofertaDescripcion.match(/\[CREDITO_SPLIT:(.*?)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            clienteId: parseInt(item.clienteId || item.id),
            nombre: item.nombre || '',
            monto: parseFloat(item.monto || 0)
          })).filter(item => !isNaN(item.clienteId) && item.monto > 0);
        }
      } catch (e) {
        console.error('Error parseando CREDITO_SPLIT:', e);
      }
    }
  }
  const defId = parseInt(defaultClienteId);
  const defM = parseFloat(defaultMonto || 0);
  if (!isNaN(defId) && defId > 0 && defM > 0) {
    return [{ clienteId: defId, monto: defM, nombre: '' }];
  }
  return [];
};

// Monto escrito por el usuario (acepta coma decimal); nunca negativo
export const parseMonto = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
};
