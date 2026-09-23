-- Crea la tabla CierreCaja para almacenar arqueos históricos de caja
CREATE TABLE IF NOT EXISTS "CierreCaja" (
    "id" SERIAL NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajeroNombre" TEXT NOT NULL,
    "efectivoVentas" DOUBLE PRECISION NOT NULL,
    "efectivoEsperado" DOUBLE PRECISION NOT NULL,
    "efectivoContado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTarjeta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalYape" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalConsumo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPedidosYa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "egresosEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abonosEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("id")
);

-- Índice para búsqueda rápida del último cierre o por rangos de fecha
CREATE INDEX IF NOT EXISTS "CierreCaja_fechaCierre_idx" ON "CierreCaja"("fechaCierre");
