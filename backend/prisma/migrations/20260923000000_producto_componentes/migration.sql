-- Combos armados con productos de la carta
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "componentes" TEXT;
