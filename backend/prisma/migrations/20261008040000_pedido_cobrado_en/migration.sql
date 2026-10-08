-- Fecha de cobro del pedido: los reportes de ventas (rotación, pollos) cuentan por ella

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "cobradoEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Pedido_cobradoEn_idx" ON "Pedido"("cobradoEn");

-- Historial: los pedidos con venta toman la fecha de su venta. Los adicionales de una mesa (sin venta
-- propia) se quedan sin fecha de cobro y los reportes usan su fecha de creación.
UPDATE "Pedido" p SET "cobradoEn" = v."createdAt" FROM "Venta" v WHERE v."pedidoId" = p.id AND p.estado = 'Cobrado';
