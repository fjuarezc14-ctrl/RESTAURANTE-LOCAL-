-- Reparto de la parte a crédito de una venta entre clientes (antes: texto [CREDITO_SPLIT:…] en Venta.ofertaDescripcion).
-- Las ventas antiguas se pasan a esta tabla al arrancar el servidor (src/servicios/creditos.js).

-- CreateTable
CREATE TABLE "VentaCredito" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaCredito_ventaId_idx" ON "VentaCredito"("ventaId");

-- CreateIndex
CREATE INDEX "VentaCredito_clienteId_idx" ON "VentaCredito"("clienteId");

-- AddForeignKey
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Cada parte del reparto es un monto positivo (como las demás restricciones de montos)
ALTER TABLE "VentaCredito" ADD CONSTRAINT "VentaCredito_monto_positivo" CHECK ("monto" > 0);
