// Une clases de Tailwind y, como tailwind-merge, deja solo la última de cada grupo en conflicto
// (en el CSS generado el orden no depende del className, así que "text-slate-700 text-sky-700" no es fiable)

const TAMANOS = '(xs|sm|base|lg|xl|\\dxl)';

const GRUPOS = [
  [new RegExp(`^text-${TAMANOS}$`), 'text-size'],
  [/^text-\[\d/, 'text-size'],
  [/^text-(left|center|right|justify)$/, 'text-align'],
  [/^text-/, 'text-color'],
  [/^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
  [/^bg-(gradient|linear|radial)-/, 'bg-image'],
  [/^bg-/, 'bg'],
  [/^border-(solid|dashed|dotted|none)$/, 'border-style'],
  [/^border(-[trblxy])?(-\d+)?$/, (m) => `border-width${m[1] || ''}`],
  [/^border-([trblxy])-/, (m) => `border-color-${m[1]}`],
  [/^border-/, 'border-color'],
  [/^shadow(-(2xs|xs|sm|md|lg|xl|2xl|none))?$/, 'shadow-size'],
  [/^shadow-/, 'shadow-color'],
  [/^ring(-\d+)?$/, 'ring-width'],
  [/^ring-offset-/, 'ring-offset'],
  [/^ring-/, 'ring-color'],
  [/^rounded(-[trbl]{1,2})?(-|$)/, (m) => `rounded${m[1] || ''}`],
  [/^(flex|inline-flex|block|inline-block|grid|hidden|inline)$/, 'display'],
  [/^flex-(\d+|\[.*\]|auto|initial|none)$/, 'flex'],
  [/^(min-w|max-w|min-h|max-h|w|h|size|px|py|pl|pr|pt|pb|p|mx|my|ml|mr|mt|mb|m|gap|justify|items|self)-/, (m) => m[1]],
];

function grupoDe(clase) {
  const corte = clase.lastIndexOf(':');
  const variante = corte >= 0 ? clase.slice(0, corte + 1) : '';
  const base = clase.slice(corte + 1).replace(/^!/, '');
  for (const [patron, grupo] of GRUPOS) {
    const m = base.match(patron);
    if (m) return variante + (typeof grupo === 'function' ? grupo(m) : grupo);
  }
  return variante + base;
}

export function cn(...entradas) {
  const clases = entradas.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const vistos = new Set();
  const resultado = [];
  for (let i = clases.length - 1; i >= 0; i--) {
    const grupo = grupoDe(clases[i]);
    if (vistos.has(grupo)) continue;
    vistos.add(grupo);
    resultado.unshift(clases[i]);
  }
  return resultado.join(' ');
}
