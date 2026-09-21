// ============================================================
// SEED LIMPIO / PUESTA EN MARCHA PARA NUEVO CLIENTE (WHITE-LABEL)
// Deja la base de datos lista en cero para cualquier restaurante
// ============================================================
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Datos del cliente (opcional): JSON con { empresa: {...}, usuarios: [{ nombre, rol, pin }] }
// El instalador Windows lo pasa en SEED_CLIENTE_JSON; sin él se usan las variables de entorno.
const cliente = process.env.SEED_CLIENTE_JSON && fs.existsSync(process.env.SEED_CLIENTE_JSON)
  ? JSON.parse(fs.readFileSync(process.env.SEED_CLIENTE_JSON, 'utf8'))
  : { empresa: {}, usuarios: [] };

const ADMIN_PERMISOS = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Reportes', 'Usuarios', 'Configuracion', 'Compras', 'Creditos', 'Carta'];
// Mismos permisos por rol que asigna la pantalla de Usuarios
const PERMISOS_POR_ROL = {
  Administrador: ADMIN_PERMISOS,
  Cajero: ['Dashboard', 'Salon', 'Caja'],
  Mozo: ['Salon', 'Barra'],
  Cocinero: ['Cocina'],
  Contador: ['Dashboard', 'Reportes'],
};

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

  // 2. Administrador (id 1, cuenta principal protegida) y demás usuarios del cliente
  console.log('👤 Creando usuarios iniciales...');
  await prisma.usuario.deleteMany({});
  const [adminCliente, ...otrosUsuarios] = cliente.usuarios;
  await prisma.usuario.create({
    data: {
      id: 1,
      nombre: adminCliente?.nombre || 'Administrador',
      rol: 'Administrador',
      pin: String(adminCliente?.pin || process.env.INITIAL_ADMIN_PIN || '1234'),
      permisos: ADMIN_PERMISOS,
      activo: true,
    }
  });
  // Sincronizar la secuencia del id: al insertar id=1 explícito, el siguiente empleado chocaría con id=1
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Usuario"', 'id'), (SELECT MAX(id) FROM "Usuario"))`);
  for (const u of otrosUsuarios) {
    await prisma.usuario.create({
      data: { nombre: u.nombre, rol: u.rol, pin: String(u.pin), permisos: PERMISOS_POR_ROL[u.rol] || [], activo: true }
    });
  }

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
  const emp = cliente.empresa || {};
  const companyName = emp.name || process.env.COMPANY_NAME || 'Mi Restaurante';
  const brandShort = emp.brandShort || process.env.BRAND_SHORT || 'RESTAURANTE';
  const ruc = emp.ruc || process.env.COMPANY_RUC || '20000000001';
  const tipoNegocio = emp.tipoNegocio || process.env.TIPO_NEGOCIO || 'restaurante';

  await prisma.empresaConfig.create({
    data: {
      name: companyName,
      brandShort: brandShort,
      tagline: emp.tagline || 'Gastronomía & Buen Sabor',
      legalName: emp.legalName || `${brandShort} S.A.C.`,
      ruc: ruc,
      address: emp.address || 'Dirección Principal del Establecimiento',
      phone: emp.phone || '999-999-999',
      email: emp.email || 'contacto@mirestaurante.com',
      ticketFooter: emp.ticketFooter || `¡Gracias por su visita! · ${brandShort}`,
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
  if (cliente.usuarios.length > 0) {
    console.log(`👉 Usuarios creados:     ${cliente.usuarios.length} (PINs en las credenciales entregadas)`);
  } else {
    console.log('👉 Usuario Administrador: "Administrador"');
    console.log(`👉 PIN de Acceso:        "${process.env.INITIAL_ADMIN_PIN || '1234'}"`);
  }
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
