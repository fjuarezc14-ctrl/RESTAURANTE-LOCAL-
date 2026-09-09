-- CreateTable Oferta (ofertas por temporada)
CREATE TABLE "Oferta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoDescuento" TEXT NOT NULL,
    "valorDescuento" DOUBLE PRECISION NOT NULL,
    "categorias" TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "creadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Oferta_pkey" PRIMARY KEY ("id")
);

-- AlterTable Venta: agregar campos de descuento
ALTER TABLE "Venta" ADD COLUMN "ofertaDescripcion" TEXT;
ALTER TABLE "Venta" ADD COLUMN "descuentoAplicado" DOUBLE PRECISION NOT NULL DEFAULT 0;
