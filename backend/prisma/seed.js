// ============================================================
// SEED OFICIAL — RESTAURANTE SEÑOR HERNÁNDEZ
// Carta extraída exactamente del Menú Oficial
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Reiniciando e ingresando la carta oficial del Restaurante Señor Hernández...');

  // ── 1. Limpieza de datos antiguos para evitar discrepancias ──
  console.log('🧹 Limpiando carta anterior...');
  await prisma.itemPedido.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.venta.deleteMany({});
  await prisma.producto.deleteMany({});

  // ── 2. Usuarios por defecto ──────────────────────────────
  await prisma.usuario.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Admin Principal',
      rol: 'Administrador',
      pin: '1234',
      permisos: ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Reportes', 'Usuarios'],
    },
  });

  await prisma.usuario.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nombre: 'Carlos',
      rol: 'Mozo',
      pin: '1111',
      permisos: ['Salon'],
    },
  });

  await prisma.usuario.upsert({
    where: { id: 3 },
    update: {},
    create: {
      nombre: 'María',
      rol: 'Cajero',
      pin: '2222',
      permisos: ['Salon', 'Caja', 'Reportes'],
    },
  });

  // ── 3. Mesas del salón (15 mesas) ─────────────────────────
  for (let i = 1; i <= 15; i++) {
    await prisma.mesa.upsert({
      where: { numero: i },
      update: { estado: 'Libre' },
      create: { numero: i, estado: 'Libre' },
    });
  }

  // ── 4. CARTA OFICIAL EXTRAÍDA DE LA IMAGEN ─────────────────
  const cartaOficial = [
    // ── PLATOS DE FONDO (Fotografía del Menú) ───────────────
    { nombre: 'Seco de res',           categoria: 'Platos de Fondo', precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pollo al sillao',       categoria: 'Platos de Fondo', precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pollo frito',           categoria: 'Platos de Fondo', precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chaufa de pollo',       categoria: 'Platos de Fondo', precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicharrón de chancho', categoria: 'Platos de Fondo', precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chaufa de chancho',     categoria: 'Platos de Fondo', precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Bisteck',               categoria: 'Platos de Fondo', precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicharrón de pollo',   categoria: 'Platos de Fondo', precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga a la plancha',  categoria: 'Platos de Fondo', precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Milanesa',              categoria: 'Platos de Fondo', precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Trucha entera',         categoria: 'Platos de Fondo', precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarín saltado',      categoria: 'Platos de Fondo', precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarín verde',        categoria: 'Platos de Fondo', precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Alitas en salsa BBQ',   categoria: 'Platos de Fondo', precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Saltado de pollo',      categoria: 'Platos de Fondo', precio: 20.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Lomito saltado',        categoria: 'Platos de Fondo', precio: 20.00, tipoStock: 'ilimitado', stock: 0 },

    // ── BEBIDAS Y REFRESH ────────────────────────────────────
    { nombre: 'Chicha Morada (Jarra 1L)', categoria: 'Bebidas y Refrescos', precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicha Morada (Vaso)',     categoria: 'Bebidas y Refrescos', precio: 4.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Limonada (Jarra 1L)',      categoria: 'Bebidas y Refrescos', precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 500ml',            categoria: 'Bebidas y Refrescos', precio: 5.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 1.5L',             categoria: 'Bebidas y Refrescos', precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza Personal',         categoria: 'Bebidas y Refrescos', precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Agua Mineral',             categoria: 'Bebidas y Refrescos', precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
  ];

  for (const item of cartaOficial) {
    await prisma.producto.create({ data: item });
  }

  console.log(`✅ Carta actualizada con éxito: ${cartaOficial.length} productos cargados.`);
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
