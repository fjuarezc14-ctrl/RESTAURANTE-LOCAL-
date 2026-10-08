// Búsqueda inteligente y fonética de la Carta (nombre y categoría, con sinónimos)


// --- SISTEMA DE BÚSQUEDA INTELIGENTE Y FONÉTICA ---
const SINONIMOS = {
  gaseosa: ['cola', 'inca', 'coca', 'refresco', 'sprite', 'fanta', 'gaseosa'],
  bebida: ['chicha', 'limonada', 'gaseosa', 'cerveza', 'pisco', 'trago', 'coctel', 'jugo', 'agua'],
  chela: ['cerveza', 'cristal', 'pilsen', 'cusquena'],
  papas: ['papa', 'patata', 'fritas'],
  carne: ['lomo', 'bife', 'parrilla', 'anticucho', 'res', 'corte'],
  pollo: ['brasa', 'broaster', 'alitas', 'pechuga'],
  piqueo: ['entrada', 'porcion', 'tequenos', 'salchipapa']
};

const normalizePhonetic = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-z0-9]/g, " ")      // remover caracteres especiales
    .replace(/ch/g, "x")            // ch -> x
    .replace(/ll/g, "y")            // ll -> y
    .replace(/b/g, "v")             // b -> v
    .replace(/c(?=[eii])/g, "s")    // c suave -> s
    .replace(/z/g, "s")             // z -> s
    .replace(/k/g, "c")             // k -> c
    .replace(/q/g, "c")             // q -> c
    .replace(/\s+/g, " ")
    .trim();
};

export const matchProductSemantic = (prod, query) => {
  if (!query || !query.trim()) return true;
  const rawQ = query.trim().toLowerCase();
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const cleanProdCat = (prod.categoria || '').toLowerCase();
  
  if (cleanProdName.includes(rawQ) || cleanProdCat.includes(rawQ)) return true;
  
  const phoneticQ = normalizePhonetic(rawQ);
  const phoneticName = normalizePhonetic(prod.nombre);
  const phoneticCat = normalizePhonetic(prod.categoria);
  if (phoneticName.includes(phoneticQ) || phoneticCat.includes(phoneticQ)) return true;
  
  const terms = rawQ.split(/\s+/).filter(t => t.length >= 2);
  if (terms.length === 0) return true;
  
  return terms.every(term => {
    if (cleanProdName.includes(term) || cleanProdCat.includes(term)) return true;
    const pTerm = normalizePhonetic(term);
    if (phoneticName.includes(pTerm) || phoneticCat.includes(pTerm)) return true;
    
    for (const [key, aliases] of Object.entries(SINONIMOS)) {
      if (term.includes(key) || aliases.some(a => term.includes(a))) {
        if (aliases.some(a => cleanProdName.includes(a) || cleanProdCat.includes(a))) {
          return true;
        }
      }
    }
    return false;
  });
};
