// ================================================================
// PASOS DEL ASISTENTE DE OPCIONES EN CAJA (delivery y para llevar)
// Ojo: no es igual al del Salón (modulos/salon/utils/pasosProducto.js): aquí las
// variantes de Tallarines Verdes van antes que las opciones de la carta y se pregunta
// la cantidad de ensaladas.
// ================================================================
import { getComboConfig, parsePasosOpciones, pasoComplementos } from '../../../utils/combos';

function pasosBase(prod, currentSelections, productosMenu) {
  if (!prod) return [];
  
  // 1. Variantes de Tallarines Verdes
  if (prod.esAgrupado) {
    const todasLasVariantes = (prod.variantes && prod.variantes.length > 0)
      ? prod.variantes
      : productosMenu.filter(p => (p.categoria === 'Tallarines Verdes' || (p.nombre && /tallar[ií]n(es)?\s+verde(s)?/i.test(p.nombre))) && p.activo !== false);
    return [{
      name: "Elige la Variante de Carne",
      key: "producto_variante",
      options: todasLasVariantes.map(v => ({
        label: `${v.nombre.replace(/tallar[ií]n(es)?\s+verde(s)?\s*(con\s*)?/i, 'Con ')} (S/ ${v.precio.toFixed(2)})`,
        value: v
      }))
    }];
  }

  // 2. OPCIONES Y MODIFICADORES PERSONALIZADOS DEL CLIENTE (MÁXIMA PRIORIDAD)
  const pasoAcomp = pasoComplementos(prod);
  const pasosConfigurados = parsePasosOpciones(prod);
  if (pasosConfigurados.length > 0) return pasoAcomp ? [...pasosConfigurados, pasoAcomp] : pasosConfigurados;
  // Sin opciones configuradas, pero con acompañamientos: igual se abre el asistente
  if (pasoAcomp) return [pasoAcomp];

  // 3. Blindaje de Carta: Si el producto fue configurado en la carta (tiene opcionesConfig)
  // o tiene requiereGuarnicion === false, NUNCA cae en los pasos demo/legacy hardcodeados.
  if ((prod.opcionesConfig !== null && prod.opcionesConfig !== undefined) || prod.requiereGuarnicion === false) {
    return [];
  }

  // 4. Categoría Menú (fallback solo si requiereGuarnicion es true y no tiene opcionesConfig)
  const isMenuCat = prod && (prod.categoria === 'Menú' || prod.categoria?.toLowerCase().includes('menú'));
  if (isMenuCat && prod.requiereGuarnicion && !prod.opcionesConfig) {
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
          { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
          { label: "Limonada - Vaso", value: "Limonada - Vaso" },
          { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
          { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
        ]
      }
    ];
  }
  
  // 5. Combos configurados (fallback legacy solo si requiereGuarnicion es true)
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
  const isCombo = prod && (String(prod.categoria || '').toLowerCase() === 'combos' || String(prod.nombre || '').toLowerCase().includes('combo'));
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

  return [];
}

export function pasosProductoCaja(prod, currentSelections = {}, productosMenu = []) {
  const steps = pasosBase(prod, currentSelections, productosMenu);
  const nameNorm = (prod && prod.nombre || '').toLowerCase();
  const isCuartoOOctavo = 
    nameNorm.includes('1/4') || nameNorm.includes('cuarto') || 
    nameNorm.includes('1/8') || nameNorm.includes('octavo');

  if (prod && prod.requiereGuarnicion && !isCuartoOOctavo) {
    steps.push({
      name: "Cantidad de Ensaladas",
      key: "cantidad_ensaladas",
      options: [
        { label: "Sin Ensalada", value: "Sin Ensalada" },
        { label: "1 Ensalada", value: "1 Ensalada" },
        { label: "2 Ensaladas", value: "2 Ensaladas" },
        { label: "3 Ensaladas", value: "3 Ensaladas" },
        { label: "4 Ensaladas", value: "4 Ensaladas" },
        { label: "5 Ensaladas", value: "5 Ensaladas" },
        { label: "6 Ensaladas", value: "6 Ensaladas" },
        { label: "7 Ensaladas", value: "7 Ensaladas" },
        { label: "8 Ensaladas", value: "8 Ensaladas" },
        { label: "9 Ensaladas", value: "9 Ensaladas" },
        { label: "10 Ensaladas", value: "10 Ensaladas" }
      ]
    });
  }
  return steps;
}
