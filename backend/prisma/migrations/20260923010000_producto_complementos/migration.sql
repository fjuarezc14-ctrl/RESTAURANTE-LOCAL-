-- Acompañamientos incluidos y complementos opcionales de cada plato
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "complementos" TEXT;
