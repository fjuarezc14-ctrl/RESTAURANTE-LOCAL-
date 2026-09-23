-- Distingue los ítems que son parte incluida de un combo
ALTER TABLE "ItemPedido" ADD COLUMN IF NOT EXISTS "esComponente" BOOLEAN NOT NULL DEFAULT false;
