-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "fechaEmision" TIMESTAMP(3),
ADD COLUMN     "urlPdf" TEXT,
ADD COLUMN     "urlXml" TEXT;
