// Configuración de empresa backend - Plantilla White-Label Gastronómica
const DEFAULT_BARRA_CATEGORIAS = [
  'Bebidas y Refrescos',
  'Gaseosas',
  'Cervezas',
  'Bar y Cocteles',
  'Bebidas Calientes',
  'Postres',
  'Bebidas'
];

module.exports = {
  COMPANY_NAME: process.env.COMPANY_NAME || "Valetec Gourmet",
  BRAND_SHORT: process.env.BRAND_SHORT || "VALETEC GOURMET",
  LEGAL_NAME: process.env.LEGAL_NAME || "VALETEC GOURMET S.A.C.",
  RUC: process.env.COMPANY_RUC || "20600000001",
  ADDRESS: process.env.COMPANY_ADDRESS || "Av. Principal 123",
  PHONE: process.env.COMPANY_PHONE || "987-654-321",
  TIPO_NEGOCIO: process.env.TIPO_NEGOCIO || "restaurante",
  BARRA_CATEGORIAS: DEFAULT_BARRA_CATEGORIAS,
};
