// Configuración de la empresa (en caché) y categorías que van a la barra
const { prisma } = require('../db');

// Categorías que van a la BARRA (el resto va a COCINA)
const DEFAULT_BARRA_CATEGORIAS = [
  'Bebidas y Refrescos',
  'Gaseosas',
  'Cervezas',
  'Bar y Cocteles',
  'Bebidas Calientes',
  'Postres',
  'Bebidas',
];

function isBarraCategoria(cat) {
  if (!cat) return false;
  // Una lista vacía guardada es válida (todas las categorías van a Cocina)
  const list = (cachedCompanyConfig && Array.isArray(cachedCompanyConfig.barraCategorias))
    ? cachedCompanyConfig.barraCategorias
    : DEFAULT_BARRA_CATEGORIAS;
  return list.some(b => String(b).trim().toLowerCase() === String(cat).trim().toLowerCase());
}

const BARRA_CATEGORIAS = {
  includes: (cat) => isBarraCategoria(cat)
};

// ============================================================
// CONFIGURACIÓN DINÁMICA DE LA EMPRESA
// ============================================================
let cachedCompanyConfig = null;

const configEnCache = () => cachedCompanyConfig;
function guardarConfigEnCache(conf) {
  cachedCompanyConfig = conf;
}

async function getEmpresaConfig() {
  if (cachedCompanyConfig) return cachedCompanyConfig;
  try {
    let conf = await prisma.empresaConfig.findFirst();
    if (!conf) {
      conf = await prisma.empresaConfig.create({
        data: {
          name: process.env.COMPANY_NAME || "Valetec Gourmet",
          brandShort: process.env.BRAND_SHORT || "VALETEC GOURMET",
          tagline: "Sistema Gastronómico & Punto de Venta",
          legalName: process.env.LEGAL_NAME || "VALETEC GOURMET S.A.C.",
          ruc: process.env.COMPANY_RUC || "20600000001",
          address: process.env.COMPANY_ADDRESS || "Av. Principal 123",
          phone: process.env.COMPANY_PHONE || "987-654-321",
          email: process.env.COMPANY_EMAIL || "contacto@valetecgourmet.pe",
          ticketFooter: process.env.TICKET_FOOTER || "¡Gracias por su preferencia! · VALETEC GOURMET",
        }
      });
    }
    cachedCompanyConfig = conf;
    return conf;
  } catch (err) {
    return {
      name: process.env.COMPANY_NAME || "Valetec Gourmet",
      brandShort: process.env.BRAND_SHORT || "VALETEC GOURMET",
      tagline: process.env.TAGLINE || "Sistema Gastronómico & Punto de Venta",
      legalName: process.env.LEGAL_NAME || "VALETEC GOURMET S.A.C.",
      ruc: process.env.COMPANY_RUC || "20600000001",
      address: process.env.COMPANY_ADDRESS || "Av. Principal 123",
      phone: process.env.COMPANY_PHONE || "987-654-321",
      email: process.env.COMPANY_EMAIL || "contacto@valetecgourmet.pe",
      ticketFooter: process.env.TICKET_FOOTER || "¡Gracias por su preferencia! · VALETEC GOURMET",
    };
  }
}

module.exports = { DEFAULT_BARRA_CATEGORIAS, isBarraCategoria, BARRA_CATEGORIAS, configEnCache, guardarConfigEnCache, getEmpresaConfig };
