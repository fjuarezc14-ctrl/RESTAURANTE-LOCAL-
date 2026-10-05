// Firma del PIN para detectar cambios de PIN en sesiones abiertas
const crypto = require('crypto');

function generarPinSignature(pin, userId) {
  return crypto.createHash('sha256').update(`${pin || ''}_${userId}_salt_hernandez_auth`).digest('hex').substring(0, 16);
}

module.exports = { generarPinSignature };
