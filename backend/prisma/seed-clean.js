// ============================================================
// SEED LIMPIO / PUESTA EN MARCHA PARA NUEVO CLIENTE (WHITE-LABEL)
// Deja la base de datos lista en cero para cualquier restaurante
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando puesta en marcha limpia para nuevo restaurante...');

  // 1. Limpieza total de movimientos transaccionales previos
  console.log('🧹 Eliminando ventas, comandas, gastos y auditorías anteriores...');
  await prisma.abonoCredito.deleteMany({});
  await prisma.venta.deleteMany({});
  await prisma.itemPedido.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.compra.deleteMany({});
  await prisma.oferta.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.producto.deleteMany({});

  // 2. Administrador Único de Puesta en Marcha
  console.log('👤 Creando usuario Administrador inicial...');
  await prisma.usuario.deleteMany({});
  await prisma.usuario.create({
    data: {
      id: 1,
      nombre: 'Administrador',
      rol: 'Administrador',
      pin: process.env.INITIAL_ADMIN_PIN || '1234',
      permisos: [
        'Dashboard',
        'Salon',
        'Cocina',
        'Barra',
        'Caja',
        'Reportes',
        'Usuarios',
        'Configuracion',
        'Compras',
        'Creditos',
        'Carta'
      ],
      activo: true,
    }
  });

  // 3. Mesas del Salón iniciales (12 mesas libres)
  console.log('🪑 Configurando 12 mesas en salón...');
  await prisma.mesa.deleteMany({});
  for (let i = 1; i <= 12; i++) {
    await prisma.mesa.create({
      data: {
        numero: i,
        estado: 'Libre'
      }
    });
  }

  // 4. Configuración inicial de la Empresa (Marca Blanca)
  console.log('🏢 Inicializando datos de empresa...');
  await prisma.empresaConfig.deleteMany({});
  const companyName = process.env.COMPANY_NAME || 'Mi Restaurante';
  const brandShort = process.env.BRAND_SHORT || 'RESTAURANTE';
  const ruc = process.env.COMPANY_RUC || '20000000001';
  const tipoNegocio = process.env.TIPO_NEGOCIO || 'restaurante';

  await prisma.empresaConfig.create({
    data: {
      name: companyName,
      brandShort: brandShort,
      tagline: 'Gastronomía & Buen Sabor',
      legalName: `${brandShort} S.A.C.`,
      ruc: ruc,
      address: 'Dirección Principal del Establecimiento',
      phone: '999-999-999',
      email: 'contacto@mirestaurante.com',
      ticketFooter: `¡Gracias por su visita! · ${brandShort}`,
      tipoNegocio: tipoNegocio,
      barraCategorias: [
        'Bebidas y Refrescos',
        'Bebidas',
        'Cervezas',
        'Bar y Cocteles',
        'Postres'
      ]
    }
  });

  console.log('\n============================================================');
  console.log('✨ SISTEMA INICIALIZADO CON ÉXITO EN MODO VIRGEN / PLANTILLA');
  console.log('============================================================');
  console.log('👉 Usuario Administrador: "Administrador"');
  console.log(`👉 PIN de Acceso:        "${process.env.INITIAL_ADMIN_PIN || '1234'}"`);
  console.log('👉 Mesas activas:        12 mesas libres');
  console.log('👉 Carta:                Vacía (Lista para ingresar platos en /carta)');
  console.log('👉 Empresa:              Configurada por defecto (Ajustable en /configuracion)');
  console.log('============================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error inicializando sistema limpio:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
