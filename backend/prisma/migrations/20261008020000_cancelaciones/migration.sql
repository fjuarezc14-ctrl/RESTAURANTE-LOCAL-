-- Cancelaciones de pedidos e ítems por estación (tarea 24)

-- CreateTable
CREATE TABLE "Cancelacion" (
    "id" SERIAL NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "estacion" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "mesaInfo" TEXT NOT NULL,
    "codigoPedidosYa" TEXT,
    "motivo" TEXT,
    "canceladoPor" TEXT NOT NULL,
    "autorizadoPor" TEXT,
    "confirmadaEn" TIMESTAMP(3),

    CONSTRAINT "Cancelacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cancelacion_estacion_confirmadaEn_idx" ON "Cancelacion"("estacion", "confirmadaEn");

-- CreateIndex
CREATE INDEX "Cancelacion_pedidoId_idx" ON "Cancelacion"("pedidoId");

-- CreateIndex
CREATE INDEX "Cancelacion_creadoEn_idx" ON "Cancelacion"("creadoEn");
