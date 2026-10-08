-- Claves de idempotencia de 24 h para cobros, caja, abonos y anulaciones (tarea 12)

-- CreateTable
CREATE TABLE "IdempotenciaClave" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "status" INTEGER,
    "respuesta" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotenciaClave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotenciaClave_creadoEn_idx" ON "IdempotenciaClave"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotenciaClave_clave_ruta_key" ON "IdempotenciaClave"("clave", "ruta");
