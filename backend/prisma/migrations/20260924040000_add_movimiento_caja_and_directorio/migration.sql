-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "tieneCredito" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "turnoId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'RETIRO',
    "monto" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "cajeroNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovimientoCaja_turnoId_idx" ON "MovimientoCaja"("turnoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovimientoCaja_creadoEn_idx" ON "MovimientoCaja"("creadoEn");
