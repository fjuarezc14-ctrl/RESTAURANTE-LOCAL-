// ================================================================
// MONTO EN LETRAS PARA COMPROBANTES (ej. 1250.5 → "MIL DOSCIENTOS CINCUENTA CON 50/100 SOLES")
// ================================================================

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_VEINTINUEVE = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

// 0 a 999
function centenas(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let decenas;
  if (resto < 10) decenas = UNIDADES[resto];
  else if (resto < 30) decenas = DIEZ_A_VEINTINUEVE[resto - 10];
  else decenas = DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : '');
  return [CENTENAS[c], decenas].filter(Boolean).join(' ');
}

// 0 a 999 999 999
function enteroALetras(n) {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLON' : `${centenas(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${centenas(miles)} MIL`);
  if (resto) partes.push(centenas(resto));
  return partes.join(' ');
}

export function numeroALetras(monto) {
  // Se trabaja en céntimos para que 10.999 sea "ONCE CON 00/100" y no "DIEZ CON 100/100"
  const centimos = Math.round(Math.abs(Number(monto) || 0) * 100);
  const entero = Math.floor(centimos / 100);
  const decimales = String(centimos % 100).padStart(2, '0');
  return `${enteroALetras(entero)} CON ${decimales}/100 SOLES`;
}
