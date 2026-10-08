// Ayudas de Compras: fecha de Lima y desglose del método de pago de un gasto
// Helper para obtener fecha local de Perú en formato YYYY-MM-DD (America/Lima)
export const getFechaPeru = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
};

// Helper para parsear métodos de pago (incluyendo desglose mixto)
export function parsearGastoMetodos(metodoPagoStr, totalMonto = 0) {
  if (!metodoPagoStr) return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  const str = String(metodoPagoStr).trim();

  if (str === 'Efectivo') return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  if (str === 'Yape') return { efec: 0, yape: totalMonto, tarj: 0, esMixto: false };
  if (str === 'Tarjeta') return { efec: 0, yape: 0, tarj: totalMonto, esMixto: false };

  if (str.startsWith('Mixto')) {
    let efec = 0, yape = 0, tarj = 0;
    const efecMatch = str.match(/Efec:\s*(?:S\/\s*)?([0-9.]+)/i);
    const yapeMatch = str.match(/Yape:\s*(?:S\/\s*)?([0-9.]+)/i);
    const tarjMatch = str.match(/Tarj:\s*(?:S\/\s*)?([0-9.]+)/i);

    if (efecMatch) efec = parseFloat(efecMatch[1]) || 0;
    if (yapeMatch) yape = parseFloat(yapeMatch[1]) || 0;
    if (tarjMatch) tarj = parseFloat(tarjMatch[1]) || 0;

    if (efec === 0 && yape === 0 && tarj === 0) {
      efec = totalMonto;
    }
    return { efec, yape, tarj, esMixto: true };
  }

  return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
}
