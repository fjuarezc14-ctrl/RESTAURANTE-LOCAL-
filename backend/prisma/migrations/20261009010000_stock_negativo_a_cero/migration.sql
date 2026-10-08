-- Versiones anteriores podían dejar stock negativo. Con la restricción Producto_stock_no_negativo,
-- devolver stock a esos productos (al cancelar) fallaría: se dejan en 0.
UPDATE "Producto" SET "stock" = 0 WHERE "stock" < 0;
