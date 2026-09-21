// Configuración centralizada de empresa - Plantilla White-Label Gastronómica
export const MASTER_CATEGORIAS_COCINA = [
  'Menú Ejecutivo',
  'Combos',
  'Entradas y Piqueos',
  'Ceviches y Pescados',
  'Platos Criollos y Fondos',
  'Parrillas y Carnes',
  'Pastas y Tallarines',
  'Sopas y Caldos',
  'Guarniciones y Porciones'
];

export const MASTER_CATEGORIAS_BARRA = [
  'Bebidas y Refrescos',
  'Gaseosas',
  'Cervezas',
  'Bar y Cocteles',
  'Bebidas Calientes',
  'Postres'
];

export const DEFAULT_BARRA_CATEGORIAS = [
  ...MASTER_CATEGORIAS_BARRA,
  'Bebidas'
];

export const TODAS_CATEGORIAS = [
  ...MASTER_CATEGORIAS_COCINA,
  ...MASTER_CATEGORIAS_BARRA
];

export const ORDEN_PRIORIDADES_CATEGORIAS = [
  '🔥 Más Pedidos',
  'Todos',
  'Menú Ejecutivo',
  'Combos',
  'Parrillas y Carnes',
  'Platos Criollos y Fondos',
  'Ceviches y Pescados',
  'Pastas y Tallarines',
  'Entradas y Piqueos',
  'Sopas y Caldos',
  'Guarniciones y Porciones',
  'Bebidas y Refrescos',
  'Gaseosas',
  'Cervezas',
  'Bar y Cocteles',
  'Bebidas Calientes',
  'Postres'
];

export const TIPOS_NEGOCIO = [
  { id: 'polleria', label: 'Pollería & Brasas', desc: 'Habilita control de rotación de pollos fraccionados (1/4, 1/2, enteros).' },
  { id: 'restaurante', label: 'Restaurante General / Criollo', desc: 'Control estándar de platos, cocina caliente y servicio de salón.' },
  { id: 'bar', label: 'Bar & Coctelería', desc: 'Enfocado en tragos, licores, bebidas y piqueos.' },
  { id: 'pizzeria', label: 'Pizzería & Pastas', desc: 'Despacho a hornos y bebidas a barra.' },
  { id: 'cafeteria', label: 'Cafetería & Pastelería', desc: 'Atención rápida, vitrina y bebidas calientes.' },
];

export const COMPANY_CONFIG = {
  name: "Valetec Gourmet",
  brandShort: "VALETEC GOURMET",
  tagline: "Sistema Gastronómico & Punto de Venta",
  legalName: "VALETEC GOURMET S.A.C.",
  ruc: "20600000001",
  address: "Av. Principal 123",
  phone: "987-654-321",
  email: "contacto@valetecgourmet.pe",
  currencySymbol: "S/",
  igvRate: 0.10,
  ticketFooter: "¡Gracias por su preferencia! · VALETEC GOURMET",
  localStoragePrefix: "pos_draft_mesa_",
  tipoNegocio: "restaurante", // "polleria" | "restaurante" | "bar" | "pizzeria" | "cafeteria"
  barraCategorias: DEFAULT_BARRA_CATEGORIAS,
};
