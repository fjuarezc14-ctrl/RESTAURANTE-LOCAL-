-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "estadoEnsalada" TEXT NOT NULL DEFAULT 'No Aplica';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "requiereGuarnicion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladoEn" TIMESTAMP(3),
ADD COLUMN     "anuladoPor" TEXT,
ADD COLUMN     "clienteDireccion" TEXT,
ADD COLUMN     "montoEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "montoOriginal" DOUBLE PRECISION,
ADD COLUMN     "montoTarjeta" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "montoYape" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "motivoAnulacion" TEXT;
