-- Restricciones de montos como red de seguridad (PLAN_WEB §2).
-- NOT VALID: se exigen en cada INSERT/UPDATE nuevo, pero no revisan los datos que ya existen,
-- así la migración no falla en un restaurante con algún dato antiguo fuera de rango.

ALTER TABLE "Venta"
  ADD CONSTRAINT "Venta_montos_no_negativos" CHECK (
    "total" >= 0 AND "igv" >= 0 AND "subtotal" >= 0 AND "descuentoAplicado" >= 0
    AND "montoEfectivo" >= 0 AND "montoTarjeta" >= 0 AND "montoYape" >= 0 AND "montoCredito" >= 0
  ) NOT VALID;

ALTER TABLE "Pedido"
  ADD CONSTRAINT "Pedido_total_no_negativo" CHECK ("total" >= 0) NOT VALID;

ALTER TABLE "ItemPedido"
  ADD CONSTRAINT "ItemPedido_precio_no_negativo" CHECK ("precio" >= 0) NOT VALID,
  ADD CONSTRAINT "ItemPedido_cantidad_positiva" CHECK ("cantidad" > 0) NOT VALID;

ALTER TABLE "Producto"
  ADD CONSTRAINT "Producto_precio_no_negativo" CHECK ("precio" >= 0) NOT VALID,
  ADD CONSTRAINT "Producto_stock_no_negativo" CHECK ("stock" >= 0) NOT VALID;

ALTER TABLE "AbonoCredito"
  ADD CONSTRAINT "AbonoCredito_montos_validos" CHECK (
    "monto" > 0 AND "montoEfectivo" >= 0 AND "montoTarjeta" >= 0 AND "montoYape" >= 0
  ) NOT VALID;

ALTER TABLE "MovimientoCaja"
  ADD CONSTRAINT "MovimientoCaja_monto_positivo" CHECK ("monto" > 0) NOT VALID;

-- "diferencia" no lleva restricción: un faltante es negativo
ALTER TABLE "CierreCaja"
  ADD CONSTRAINT "CierreCaja_montos_no_negativos" CHECK (
    "montoInicial" >= 0 AND "efectivoVentas" >= 0 AND "efectivoEsperado" >= 0 AND "efectivoContado" >= 0
  ) NOT VALID;
