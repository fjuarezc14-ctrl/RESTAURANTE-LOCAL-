// ================================================================
// PASOS DEL ASISTENTE DE OPCIONES EN EL SALÓN (comanda del mozo)
// Ojo: no es igual al de Caja (modulos/caja/utils/pasosProducto.js).
// ================================================================
import { getComboConfig, parsePasosOpciones, pasoComplementos } from '../../../utils/combos';

export function isMenuProduct(prod) {
  if (!prod) return false;
  const cat = String(prod.categoria || '').toLowerCase();
  const nom = String(prod.nombre || '').toLowerCase();
  return cat === 'menú' || cat === 'menu' || cat.includes('menú') || cat.includes('menu') || nom.startsWith('menú') || nom.startsWith('menu');
}

export function pasosProductoSalon(prod, currentSelections = {}) {
  if (!prod) return [];

  // 1. OPCIONES Y MODIFICADORES PERSONALIZADOS DEL CLIENTE (MÁXIMA PRIORIDAD)
  const pasoAcomp = pasoComplementos(prod);
  const pasosConfigurados = parsePasosOpciones(prod);
  if (pasosConfigurados.length > 0) return pasoAcomp ? [...pasosConfigurados, pasoAcomp] : pasosConfigurados;
  // Sin opciones configuradas, pero con acompañamientos: igual se abre el asistente
  if (pasoAcomp) return [pasoAcomp];

  // 2. Variantes agrupadas de carne (Tallarines Verdes)
  if (prod.esAgrupado && Array.isArray(prod.variantes)) {
    return [{
      name: "Elige la Variante de Carne",
      key: "producto_variante",
      options: prod.variantes.map(v => ({
        label: `${v.nombre.replace(/tallar[ií]n(es)?\s+verde(s)?\s*(con\s*)?/i, 'Con ')} (S/ ${v.precio.toFixed(2)})`,
        value: v
      }))
    }];
  }

  // 3. Blindaje de Carta: Si el producto fue configurado en la carta (tiene opcionesConfig)
  // o tiene requiereGuarnicion === false, NUNCA cae en los pasos demo/legacy hardcodeados.
  if ((prod.opcionesConfig !== null && prod.opcionesConfig !== undefined) || prod.requiereGuarnicion === false) {
    return [];
  }

  // 4. Categoría Menú (fallback legacy solo si requiereGuarnicion es true y no tiene opcionesConfig)
  if (isMenuProduct(prod) && prod.requiereGuarnicion && !prod.opcionesConfig) {
    return [
      {
        name: "Elige la Entrada",
        key: "entrada_menu",
        options: [
          { label: "Sopa del Día", value: "Sopa" },
          { label: "Ensalada Fresca", value: "Ensalada" },
          { label: "Papa a la Huancaína", value: "Papa a la Huancaína" },
          { label: "Omitir (Sin Entrada)", value: "Sin Entrada" }
        ]
      },
      {
        name: "Elige la Bebida",
        key: "bebida",
        options: [
          { label: "Chicha Morada (Vaso)", value: "Chicha Morada - Vaso" },
          { label: "Limonada (Vaso)", value: "Limonada - Vaso" },
          { label: "Gaseosa Chiki", value: "Gaseosa Chiki" },
          { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
        ]
      }
    ];
  }

  // 5. Combos demo (fallback legacy solo si requiereGuarnicion es true)
  const combo = getComboConfig(prod.nombre);
  if (combo && prod.requiereGuarnicion) {
    const baseSteps = [];
    const config = combo.config;
    const fondoOptions = config.fondoOptions || [];
    
    baseSteps.push({
      name: "Plato de Fondo",
      key: "fondo",
      options: fondoOptions.map(opt => ({ label: opt, value: opt }))
    });
    
    const selectedFondo = currentSelections["fondo"];
    if (selectedFondo && selectedFondo.toLowerCase().includes("pollo o carne")) {
      baseSteps.push({
        name: "Elige Proteína",
        key: "proteina",
        options: [
          { label: "Pollo", value: "Pollo" },
          { label: "Carne", value: "Carne" }
        ]
      });
    }
    
    baseSteps.push({
      name: "Sopa o Ensalada",
      key: "entrada",
      options: ["Sopa", "Ensalada"].map(opt => ({ label: opt, value: opt }))
    });

    baseSteps.push({
      name: "Elige la Bebida",
      key: "bebida",
      options: [
        { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
        { label: "Limonada - Vaso", value: "Limonada - Vaso" },
        { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
        { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
      ]
    });
    
    return baseSteps;
  }

  // 6. Categoría Combos (fallback si requiereGuarnicion es true)
  const isCombo = String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo');
  if (isCombo && prod.requiereGuarnicion) {
    return [
      {
        name: "Elige la Guarnición del Combo",
        key: "guarnicion_combo",
        options: [
          { label: "Papas Fritas", value: "Papas Fritas" },
          { label: "Arroz Chaufa", value: "Arroz Chaufa" },
          { label: "Arroz Blanco", value: "Arroz Blanco" },
          { label: "Ensalada Fresca", value: "Ensalada Fresca" }
        ]
      },
      {
        name: "Elige la Bebida del Combo",
        key: "bebida_combo",
        options: [
          { label: "Chicha Morada (Vaso)", value: "Chicha Morada" },
          { label: "Limonada (Vaso)", value: "Limonada" },
          { label: "Gaseosa Personal", value: "Gaseosa Personal" },
          { label: "Sin Bebida", value: "Sin Bebida" }
        ]
      }
    ];
  }

  // NINGÚN OTRO PLATO TIENE PREGUNTAS FORZADAS. Se agrega directo al ticket!
  return [];
}
