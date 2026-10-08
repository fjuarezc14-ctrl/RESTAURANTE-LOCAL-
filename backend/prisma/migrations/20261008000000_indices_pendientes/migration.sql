-- Ajustes que estaban en schema.prisma sin migración: índices de Cliente y Venta, y fechaCierre sin valor
-- por defecto (un turno abierto no debe tener fecha de cierre). IF NOT EXISTS: seguro en cualquier base.

-- AlterTable
ALTER TABLE "CierreCaja" ALTER COLUMN "fechaCierre" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cliente_numDoc_idx" ON "Cliente"("numDoc");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cliente_tieneCredito_idx" ON "Cliente"("tieneCredito");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cliente_telefono_idx" ON "Cliente"("telefono");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cliente_activo_idx" ON "Cliente"("activo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cliente_creadoEn_idx" ON "Cliente"("creadoEn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Venta_anulado_idx" ON "Venta"("anulado");
