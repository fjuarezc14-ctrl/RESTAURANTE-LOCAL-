// ============================================================
// CÓDIGOS DE ERROR DE LA API (compartido backend / frontend)
// Respuesta: { error: { codigo, mensaje, campo?, datos? } }
// Agregar un código = agregarlo aquí y en scratch/ACUERDOS.md §1.
// ============================================================

export const CODIGOS = {
  VALIDACION: { status: 400 },
  JSON_INVALIDO: { status: 400 },
  PAGO_NO_CUADRA: { status: 400 },
  CUERPO_DEMASIADO_GRANDE: { status: 413 },
  NO_AUTENTICADO: { status: 401 },
  SESION_EXPIRADA: { status: 401 },
  DISPOSITIVO_NO_ACTIVADO: { status: 401 },
  CREDENCIALES_INCORRECTAS: { status: 401 },
  PIN_INCORRECTO: { status: 401 },
  SIN_PERMISO: { status: 403 },
  AUTORIZACION_REQUERIDA: { status: 403 },
  NO_ENCONTRADO: { status: 404 },
  YA_EXISTE: { status: 409 },
  CONFLICTO: { status: 409 },
  OPERACION_EN_CURSO: { status: 409 },
  CAJA_CERRADA: { status: 409 },
  CAJA_YA_ABIERTA: { status: 409 },
  PEDIDO_NO_SERVIDO: { status: 409 },
  STOCK_INSUFICIENTE: { status: 409 },
  LIMITE_ANULACION_VENCIDO: { status: 409 },
  DEMASIADOS_INTENTOS: { status: 429 },
  ERROR_INTERNO: { status: 500 },
  SERVICIO_NO_DISPONIBLE: { status: 503 },
};

// Solo los genera src/api.js (nunca llegan del servidor)
export const CODIGOS_CLIENTE = {
  SIN_CONEXION: 'SIN_CONEXION',
  TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',
};

export const MENSAJE_ERROR_INTERNO = 'Ocurrió un error, inténtalo de nuevo.';

export function statusDe(codigo) {
  return CODIGOS[codigo]?.status ?? 500;
}
