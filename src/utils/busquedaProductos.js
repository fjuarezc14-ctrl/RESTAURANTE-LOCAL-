// Búsqueda de productos por nombre, compartida por Salón (mozos) y Caja (nuevo pedido).

// --- SISTEMA DE BÚSQUEDA INTELIGENTE Y FONÉTICA ---
// Solo formas equivalentes de escribir lo mismo que aparece en el nombre ("cuarto" = "1/4").
// No se agregan sinónimos que amplíen la búsqueda a otros platos (ej: "pollo" -> "alitas").
const SINONIMOS = {
  "1/8": ['octavo', 'octavos', '1/8', 'un octavo'],
  "1/4": ['cuarto', 'cuartos', '1/4', 'un cuarto'],
  "1/2": ['medio', 'medios', '1/2', 'un medio', 'mitad']
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
    .replace(/z/g, "s")             // z -> s
    .replace(/c([ei])/g, "s$1")      // ce, ci -> se, si
    .replace(/h/g, "")              // h muda
    .replace(/b/g, "v")              // b -> v equivalencia
    .replace(/k/g, "c")              // k -> c
    .replace(/q/g, "c")              // q -> c
    .replace(/\s+/g, " ")
    .trim();
};

// Solo busca en el NOMBRE del producto (no en la categoría): "pollo" muestra los platos
// cuyo nombre contiene "pollo", tolerando faltas de ortografía comunes ("poyo").
export const matchProductSemantic = (prod, query) => {
  if (!query) return true;
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return true;
  const queryTokens = cleanQuery.split(/\s+/);
  
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const phoneticName = normalizePhonetic(prod.nombre);
  
  return queryTokens.every(qToken => {
    // 1. Coincidencia directa simple
    if (cleanProdName.includes(qToken)) return true;
    
    // 2. Coincidencia fonética
    const phoneticToken = normalizePhonetic(qToken);
    if (phoneticToken && phoneticName.includes(phoneticToken)) return true;
    
    for (const [key, syns] of Object.entries(SINONIMOS)) {
      const tokenMatchesSyn = (key === qToken) || syns.some(syn => syn === qToken || normalizePhonetic(syn) === phoneticToken);
      if (tokenMatchesSyn) {
        const prodHasKeyOrSyn = cleanProdName.includes(key) || syns.some(syn => cleanProdName.includes(syn));
        if (prodHasKeyOrSyn) {
          return true;
        }
      }
    }
    
    return false;
  });
};

// Relevancia de un producto para la búsqueda (menor = más arriba):
// 1) el nombre empieza con lo buscado, 2) alguna palabra empieza con lo buscado,
// 3) lo contiene en medio de una palabra, 4) solo coincide por fonética/sinónimo.
// Dentro del mismo nivel gana la coincidencia más cercana al inicio y luego el nombre más corto.
const normalizarBusqueda = (text) => (text || '')
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const puntajeCoincidencia = (nombre, texto) => {
  const idx = nombre.indexOf(texto);
  if (idx === -1) return null;
  if (idx === 0) return 0;
  const inicioDePalabra = !/[a-z0-9]/.test(nombre[idx - 1]);
  return (inicioDePalabra ? 1000 : 2000) + idx;
};

export const relevanciaBusqueda = (prod, query) => {
  if (prod.esAgrupado && Array.isArray(prod.variantes)) {
    const puntajes = prod.variantes
      .filter(v => matchProductSemantic(v, query))
      .map(v => relevanciaBusqueda(v, query));
    return puntajes.length > 0 ? Math.min(...puntajes) : Number.MAX_SAFE_INTEGER;
  }
  const nombre = normalizarBusqueda(prod.nombre);
  const q = normalizarBusqueda(query);
  const desempate = nombre.length / 1000;

  // Frase completa ("pollo entero")
  const completo = puntajeCoincidencia(nombre, q);
  if (completo !== null) return completo + desempate;

  // Varias palabras en distinto orden: se usa la peor coincidencia de cada palabra
  const tokens = q.split(' ').filter(Boolean);
  const puntajes = tokens.map(t => puntajeCoincidencia(nombre, t));
  if (puntajes.every(p => p !== null)) return 3000 + Math.max(...puntajes) + desempate;
  return 9000 + desempate;
};

// Orden de categorías para la barra/modal de categorías: primero las prioritarias de la
// configuración de la empresa, luego el resto alfabéticamente.
export const ordenarCategorias = (categorias, ordenPrioridades) => [...categorias].sort((a, b) => {
  const idxA = ordenPrioridades.indexOf(a);
  const idxB = ordenPrioridades.indexOf(b);
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return a.localeCompare(b);
});
