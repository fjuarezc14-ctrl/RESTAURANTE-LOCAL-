// Separa la marca corta en dos partes para mostrarla en dos colores
export function splitBrand(brand) {
  const words = String(brand || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || '', ''];
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}
