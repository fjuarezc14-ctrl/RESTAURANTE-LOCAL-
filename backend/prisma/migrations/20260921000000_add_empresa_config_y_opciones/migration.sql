-- Migración idempotente: algunas BD ya tienen estos objetos creados vía `prisma db push`

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "opcionesConfig" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmpresaConfig" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Valetec Gourmet',
    "brandShort" TEXT NOT NULL DEFAULT 'VALETEC GOURMET',
    "tagline" TEXT NOT NULL DEFAULT 'Sistema Gastronómico & Punto de Venta',
    "legalName" TEXT NOT NULL DEFAULT 'VALETEC GOURMET S.A.C.',
    "ruc" TEXT NOT NULL DEFAULT '20600000001',
    "address" TEXT NOT NULL DEFAULT 'Av. Principal 123',
    "phone" TEXT NOT NULL DEFAULT '987-654-321',
    "email" TEXT NOT NULL DEFAULT 'contacto@valetecgourmet.pe',
    "ticketFooter" TEXT NOT NULL DEFAULT '¡Gracias por su preferencia! · VALETEC GOURMET',
    "tipoNegocio" TEXT NOT NULL DEFAULT 'restaurante',
    "barraCategorias" TEXT[] DEFAULT ARRAY['Bebidas y Refrescos', 'Cervezas', 'Bar y Cocteles', 'Postres', 'Bebidas']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AbonoCredito_clienteId_idx" ON "AbonoCredito"("clienteId");
CREATE INDEX IF NOT EXISTS "AbonoCredito_creadoEn_idx" ON "AbonoCredito"("creadoEn");
CREATE INDEX IF NOT EXISTS "Compra_fecha_idx" ON "Compra"("fecha");
CREATE INDEX IF NOT EXISTS "Compra_fechaEmision_idx" ON "Compra"("fechaEmision");
CREATE INDEX IF NOT EXISTS "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "ItemPedido_productoId_idx" ON "ItemPedido"("productoId");
CREATE INDEX IF NOT EXISTS "Pedido_mesaId_estado_idx" ON "Pedido"("mesaId", "estado");
CREATE INDEX IF NOT EXISTS "Pedido_createdAt_idx" ON "Pedido"("createdAt");
CREATE INDEX IF NOT EXISTS "Pedido_estado_idx" ON "Pedido"("estado");
CREATE INDEX IF NOT EXISTS "Venta_createdAt_idx" ON "Venta"("createdAt");
CREATE INDEX IF NOT EXISTS "Venta_estadoSunat_idx" ON "Venta"("estadoSunat");
CREATE INDEX IF NOT EXISTS "Venta_metodoPago_idx" ON "Venta"("metodoPago");
