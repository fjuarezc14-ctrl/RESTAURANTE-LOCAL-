-- Índices para acelerar las consultas frecuentes (mesas, cocina, caja, reportes).
-- IF NOT EXISTS: se puede aplicar sin riesgo aunque algún índice ya exista.

CREATE INDEX IF NOT EXISTS "AbonoCredito_clienteId_idx" ON "AbonoCredito"("clienteId");
CREATE INDEX IF NOT EXISTS "AbonoCredito_creadoEn_idx" ON "AbonoCredito"("creadoEn");
CREATE INDEX IF NOT EXISTS "Pedido_mesaId_estado_idx" ON "Pedido"("mesaId", "estado");
CREATE INDEX IF NOT EXISTS "Pedido_estado_idx" ON "Pedido"("estado");
CREATE INDEX IF NOT EXISTS "Pedido_createdAt_idx" ON "Pedido"("createdAt");
CREATE INDEX IF NOT EXISTS "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "ItemPedido_productoId_idx" ON "ItemPedido"("productoId");
CREATE INDEX IF NOT EXISTS "Venta_createdAt_idx" ON "Venta"("createdAt");
CREATE INDEX IF NOT EXISTS "Venta_clienteCreditoId_idx" ON "Venta"("clienteCreditoId");
CREATE INDEX IF NOT EXISTS "Venta_estadoSunat_idx" ON "Venta"("estadoSunat");
CREATE INDEX IF NOT EXISTS "Compra_creadoEn_idx" ON "Compra"("creadoEn");
