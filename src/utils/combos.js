// ================================================================
// OPCIONES DE PRODUCTOS Y COMBOS ARMADOS CON PRODUCTOS DE LA CARTA
// Lo usan Carta (para configurar), y Salón y Caja (para comandar).
// ================================================================

export function parseJsonSafe(txt, fallback) {
  if (!txt) return fallback;
  try {
    const parsed = typeof txt === 'string' ? JSON.parse(txt) : txt;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// Normaliza una opción: acepta el formato antiguo (texto) y el nuevo (ligada a un producto)
export function normalizarOpcion(opt) {
  if (typeof opt === 'string') return { label: opt, value: opt, productoId: null, precioExtra: 0 };
  return {
    label: opt.label ?? opt.value ?? '',
    value: opt.value ?? opt.label ?? '',
    productoId: opt.productoId ?? null,
    precioExtra: parseFloat(opt.precioExtra || 0) || 0,
  };
}

// Pasos configurados en la carta, listos para el asistente de opciones
export function parsePasosOpciones(prod) {
  const parsed = parseJsonSafe(prod?.opcionesConfig, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  return parsed.map((step, idx) => ({
    name: step.name || `Paso ${idx + 1}`,
    key: step.key || `opcion_${idx + 1}`,
    options: (step.options || []).map(normalizarOpcion),
  }));
}

// Con lo que eligió el mozo devuelve los productos enlazados y el precio extra a sumar
export function resolverSeleccion(pasos, selections) {
  const opciones = [];
  let precioExtra = 0;
  for (const paso of pasos || []) {
    const elegido = selections?.[paso.key];
    if (!elegido) continue;
    const opt = (paso.options || []).find(o => o.value === elegido || o.label === elegido);
    if (!opt) continue;
    precioExtra += opt.precioExtra || 0;
    if (opt.productoId) {
      opciones.push({ paso: paso.name, label: opt.label, productoId: opt.productoId });
    }
  }
  return { opciones, precioExtra };
}

// Componentes de un combo armado uniendo productos: [{ productoId, cantidad }]
export function parseComponentes(prod) {
  const parsed = parseJsonSafe(prod?.componentes, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(c => ({ productoId: parseInt(c.productoId), cantidad: parseInt(c.cantidad || 1) }))
    .filter(c => c.productoId > 0 && c.cantidad > 0);
}

// Suma de los precios de lista de los componentes (precio "normal" antes de la oferta)
export function calcularPrecioComponentes(componentes, productos) {
  const porId = new Map((productos || []).map(p => [p.id, p]));
  return (componentes || []).reduce((total, c) => {
    const prod = porId.get(c.productoId);
    return total + (prod ? prod.precio * c.cantidad : 0);
  }, 0);
}
