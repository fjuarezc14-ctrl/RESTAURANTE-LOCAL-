-- CreateTable
CREATE TABLE IF NOT EXISTS "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'amber',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Categoria_nombre_key" ON "Categoria"("nombre");

-- Categorías base de la plantilla gastronómica
INSERT INTO "Categoria" ("nombre", "color") VALUES
  ('Menú Ejecutivo', 'amber'),
  ('Combos', 'orange'),
  ('Entradas y Piqueos', 'lime'),
  ('Ceviches y Pescados', 'emerald'),
  ('Platos Criollos y Fondos', 'amber'),
  ('Parrillas y Carnes', 'rose'),
  ('Pastas y Tallarines', 'orange'),
  ('Sopas y Caldos', 'amber'),
  ('Guarniciones y Porciones', 'lime'),
  ('Bebidas y Refrescos', 'sky'),
  ('Gaseosas', 'sky'),
  ('Cervezas', 'amber'),
  ('Bar y Cocteles', 'violet'),
  ('Bebidas Calientes', 'orange'),
  ('Postres', 'rose'),
  ('PedidosYa / Ofertas', 'rose')
ON CONFLICT ("nombre") DO NOTHING;
