-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "metodoPago" TEXT NOT NULL DEFAULT 'Efectivo';

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "clienteCreditoId" INTEGER,
ADD COLUMN     "montoCredito" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL DEFAULT 'DNI',
    "numDoc" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "esTrabajador" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbonoCredito" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT NOT NULL DEFAULT 'Efectivo',
    "montoEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTarjeta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoYape" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registradoPor" TEXT NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonoCredito_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
