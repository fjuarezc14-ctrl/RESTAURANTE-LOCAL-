-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "estadoSunat" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "numero" INTEGER,
ADD COLUMN     "serie" TEXT,
ADD COLUMN     "urlPdf" TEXT,
ADD COLUMN     "urlXml" TEXT;
