// Texto legible del "antes y después" de un registro de auditoría, una línea por campo:
// "precio: 18 → 20", "motivo: Se equivocó" (solo después), "nombre: Lomo (eliminado)" (solo antes)
const texto = (v) => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.map(texto).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function resumenCambio(antes, despues) {
  const a = antes && typeof antes === 'object' ? antes : {};
  const d = despues && typeof despues === 'object' ? despues : {};
  // Solo "antes" (algo eliminado o revocado): sus datos, sin los campos vacíos
  if (Object.keys(d).length === 0) {
    return Object.entries(a).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${texto(v)}`).join('\n');
  }
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])];
  return campos
    .map((k) => {
      const enAntes = k in a;
      const enDespues = k in d;
      if (enAntes && enDespues) return texto(a[k]) === texto(d[k]) ? `${k}: ${texto(d[k])}` : `${k}: ${texto(a[k])} → ${texto(d[k])}`;
      return enDespues ? `${k}: ${texto(d[k])}` : `${k}: ${texto(a[k])} (antes)`;
    })
    .join('\n');
}
