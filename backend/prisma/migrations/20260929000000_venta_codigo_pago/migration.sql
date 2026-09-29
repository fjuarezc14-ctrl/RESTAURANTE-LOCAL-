-- Código de operación del pago con Yape/Plin o voucher de tarjeta
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "codigoPago" TEXT;
