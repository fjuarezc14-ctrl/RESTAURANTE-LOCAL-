// ============================================================
// IMPORTA UNA CARTA DESDE UN ARCHIVO JSON
// Es seguro repetirlo: si el plato ya existe (mismo nombre) no lo duplica
// ni le cambia el precio que ya haya puesto el restaurante.
// Uso: node scripts/importar-carta.js <ruta-del-json>
// ============================================================
require('dotenv').config(); // toma DATABASE_URL del .env de la instalación
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error('❌ Indica la ruta del archivo. Ejemplo: node scripts/importar-carta.js carta.json');
    process.exit(1);
  }
  const rutaAbs = path.resolve(ruta);
  if (!fs.existsSync(rutaAbs)) {
    console.error(`❌ No existe el archivo ${rutaAbs}`);
    process.exit(1);
  }

  const productos = JSON.parse(fs.readFileSync(rutaAbs, 'utf8'));
  if (!Array.isArray(productos)) {
    console.error('❌ El archivo debe contener una lista de productos.');
    process.exit(1);
  }

  const existentes = await prisma.producto.findMany({ select: { nombre: true } });
  const yaEstan = new Set(existentes.map(p => p.nombre.trim().toLowerCase()));

  let creados = 0;
  let omitidos = 0;

  for (const p of productos) {
    const nombre = String(p.nombre || '').trim();
    if (!nombre) continue;
    if (yaEstan.has(nombre.toLowerCase())) {
      omitidos++;
      continue;
    }
    await prisma.producto.create({
      data: {
        nombre,
        categoria: String(p.categoria || 'Otros'),
        precio: parseFloat(p.precio || 0),
        tipoStock: p.tipoStock === 'limitado' ? 'limitado' : 'ilimitado',
        stock: parseInt(p.stock || 0),
        requiereGuarnicion: Boolean(p.requiereGuarnicion),
        opcionesConfig: p.opcionesConfig ? JSON.stringify(p.opcionesConfig) : null,
        componentes: p.componentes ? JSON.stringify(p.componentes) : null,
        complementos: p.complementos ? JSON.stringify(p.complementos) : null,
      },
    });
    yaEstan.add(nombre.toLowerCase());
    creados++;
  }

  console.log(`✅ Carta importada: ${creados} platos nuevos, ${omitidos} ya existían (no se tocaron).`);
  if (creados > 0) {
    console.log('👉 Los precios quedan en S/ 0.00: complétalos desde el menú Carta e Inventario.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error importando la carta:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
