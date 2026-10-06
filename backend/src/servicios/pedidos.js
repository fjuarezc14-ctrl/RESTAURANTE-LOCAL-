// Pedidos: expansión de ítems y combos para guardarlos en la BD
const { prisma } = require('../db');
const { ErrorApp } = require('../middlewares/errores');

const LIMITE_CANCELACION_MS = 5 * 60 * 1000; // 5 minutos

// ============================================================
// CONFIGURACIÓN DE PARRILLADAS Y PIQUEOS MIX (COMBO DECOMPOSITION)
// ============================================================
const MIX_PRODUCTS_DECOMPOSITION = {};

function parseSelectionsFromNotes(notas) {
  const selections = {};
  if (!notas) return selections;
  
  // 1. Bracket format: [Key: Value]
  const bracketMatches = String(notas).match(/\[([^\]:]+):\s*([^\]]+)\]/g);
  if (bracketMatches) {
    bracketMatches.forEach(m => {
      const parts = m.slice(1, -1).split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        selections[key] = val;
      }
    });
  }

  // 2. Dot or newline separated: Key: Value (e.g. "Bebida: Chicha · Entrada: Sopa")
  const segments = String(notas).split(/[·\n]/);
  for (const seg of segments) {
    const cleaned = seg.trim().replace(/^\[|\]$/g, '');
    if (cleaned.includes(':')) {
      const colonIdx = cleaned.indexOf(':');
      const key = cleaned.substring(0, colonIdx).trim();
      const val = cleaned.substring(colonIdx + 1).trim();
      if (key && val && !selections[key]) {
        selections[key] = val;
      }
    }
  }

  return selections;
}

function parseJsonSafe(txt, fallback) {
  if (!txt) return fallback;
  try {
    const parsed = typeof txt === 'string' ? JSON.parse(txt) : txt;
    return parsed ?? fallback;
  } catch (err) {
    console.warn('[parseJsonSafe] JSON inválido:', err.message);
    return fallback;
  }
}

async function expandPedidoItemsForDb(itemsList) {
  const expandedList = [];
  const defaultProduct = await prisma.producto.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  if (!defaultProduct) {
    throw new ErrorApp('VALIDACION', 'No hay productos registrados en la carta. Carga productos antes de realizar pedidos.');
  }

  for (const i of itemsList) {
    let rawProdId = parseInt(i.productoId || i.id);
    let validProd = null;

    if (!isNaN(rawProdId) && rawProdId > 0) {
      validProd = await prisma.producto.findUnique({ where: { id: rawProdId } });
    }

    if (!validProd && i.nombre) {
      validProd = await prisma.producto.findFirst({
        where: { nombre: { equals: String(i.nombre), mode: 'insensitive' } }
      });
    }

    if (!validProd) {
      validProd = defaultProduct;
    }

    const prodId = validProd.id;
    const prodNombre = String(i.nombre || validProd.nombre);
    const decomp = MIX_PRODUCTS_DECOMPOSITION[prodId];

    if (decomp) {
      const parsedNotes = parseSelectionsFromNotes(i.notas);
      const acompanamiento = parsedNotes["Acompañamiento"] || parsedNotes["Elige el Acompañamiento"] || parsedNotes["Elige la Guarnición"] || parsedNotes["guarnicion"] || "Sin Acompañamiento";

      const detailedGrillNotesArray = [
        `🥔 ACOMPAÑAMIENTO: ${acompanamiento}`
      ];

      if (i.notas && i.notas.includes("(Nota:")) {
        const customNoteMatch = i.notas.match(/\(Nota:\s*([^\)]+)\)/);
        if (customNoteMatch && customNoteMatch[1]) {
          detailedGrillNotesArray.push(`📝 NOTAS CAJA: ${customNoteMatch[1]}`);
        }
      }

      // 1. MAIN BILLING ITEM
      expandedList.push({
        productoId: prodId,
        nombre: prodNombre,
        precio: parseFloat(i.precio),
        cantidad: parseInt(i.cant || i.cantidad),
        historial: false,
        entregado: false,
        notas: detailedGrillNotesArray.join(' · '),
      });

      // 2. DETAILED GRILL COMPONENTS
      if (decomp.components && decomp.components.length > 0) {
        for (const comp of decomp.components) {
          expandedList.push({
            productoId: prodId,
            nombre: comp.nombre,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false,
            entregado: false,
            notas: null,
            esComponente: true,
          });
        }
      }

      // 3. DRINK SELECTIONS
      if (decomp.hasDrinkSelections) {
        const selectedDrinkNames = [];
        const drinkKeys = ["Elige Bebida 1 (Medio Litro)", "Elige Bebida 2 (Medio Litro)", "Elige Bebida 2 (Un Litro)", "Elige la Bebida", "Bebida", "Bebida 1", "Bebida 2"];

        for (const key of drinkKeys) {
          const val = parsedNotes[key];
          if (val) selectedDrinkNames.push(val);
        }

        let groupedDrinks = [...selectedDrinkNames];
        if (prodId === 49 || prodId === 53) {
          if (selectedDrinkNames.length === 2 && selectedDrinkNames[0] === selectedDrinkNames[1]) {
            const drinkName = selectedDrinkNames[0];
            const name1Lt = drinkName.replace("1/2 Lt", "1 Lt").replace("1/2 Litro", "1 Litro").replace("1/2 lt", "1 lt");
            groupedDrinks = [name1Lt];
          }
        }

        if (groupedDrinks.length === 0 && (prodId === 50 || prodId === 51)) {
          groupedDrinks.push("Vino Tabernero (Botella)");
        }

        for (const drinkName of groupedDrinks) {
          let lookupName = drinkName;
          let displayName = drinkName;
          if (drinkName === "Gaseosa Chiki") { lookupName = "Gaseosa Mediana"; displayName = "Gaseosa Chiki"; }
          else if (drinkName === "Vino Tabernero (Copa)") { lookupName = "Vino Tabernero"; displayName = "Vino Tabernero (Copa)"; }
          else if (drinkName === "Vaso de Chicha Morada" || drinkName === "Chicha Morada - Vaso") { lookupName = "Chicha Morada - Vaso"; displayName = "Chicha Morada - Vaso"; }
          else if (drinkName === "Sangría 1/2 Litro" || drinkName === "Sangria 1/2 Litro") { lookupName = "Sangría Española o Hawaiana 1/2 Lt"; displayName = "Sangría Española o Hawaiana 1/2 Lt"; }
          else if (drinkName === "Sangría 1 Litro" || drinkName === "Sangria 1 Litro") { lookupName = "Sangría Española o Hawaiana 1 Lt"; displayName = "Sangría Española o Hawaiana 1 Lt"; }

          const drinkProd = await prisma.producto.findFirst({ where: { nombre: { contains: lookupName, mode: 'insensitive' } } });
          expandedList.push({
            productoId: drinkProd ? drinkProd.id : prodId,
            nombre: drinkProd ? drinkProd.nombre : displayName,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false,
            entregado: false,
            notas: null,
            esComponente: true,
          });
        }
      }

      // 4. FIXED REPORTING
      if (decomp.reportingItems && decomp.reportingItems.length > 0) {
        for (const rep of decomp.reportingItems) {
          expandedList.push({
            productoId: rep.productoId,
            nombre: rep.nombre,
            precio: 0,
            cantidad: Math.ceil(rep.cantidadMultiplier * parseInt(i.cant || i.cantidad)),
            historial: rep.toBar ? false : true,
            entregado: rep.toBar ? false : true,
            notas: null,
            esComponente: true,
          });
        }
      }
    } else {
      expandedList.push({
        productoId: prodId,
        nombre: prodNombre,
        precio: parseFloat(i.precio),
        cantidad: parseInt(i.cant || i.cantidad),
        historial: i.historial || false,
        entregado: i.entregado || false,
        notas: i.notas ? String(i.notas) : null,
      });

      const cantidadPadre = parseInt(i.cant || i.cantidad || 1);

      // Combo armado con productos de la carta: cada componente va a su estación y descuenta su stock
      const componentes = parseJsonSafe(validProd.componentes, []);
      for (const comp of Array.isArray(componentes) ? componentes : []) {
        const compId = parseInt(comp.productoId);
        const compCant = parseInt(comp.cantidad || 1);
        if (isNaN(compId) || compId <= 0 || isNaN(compCant) || compCant <= 0) continue;
        const compProd = await prisma.producto.findUnique({ where: { id: compId } });
        if (!compProd) continue;
        expandedList.push({
          productoId: compProd.id,
          nombre: compProd.nombre,
          precio: 0,
          cantidad: compCant * cantidadPadre,
          historial: false,
          entregado: false,
          notas: `(Incluido en ${prodNombre})`,
          esComponente: true,
        });
      }

      // Opciones elegidas que apuntan a un producto real de la carta (guarnición, bebida, postre...)
      const opcionesElegidas = Array.isArray(i.opciones) ? i.opciones : [];
      let expandidoPorOpciones = false;
      for (const op of opcionesElegidas) {
        const opId = parseInt(op?.productoId);
        if (isNaN(opId) || opId <= 0) continue;
        const opProd = await prisma.producto.findUnique({ where: { id: opId } });
        if (!opProd) continue;
        expandedList.push({
          productoId: opProd.id,
          nombre: opProd.nombre,
          precio: 0,
          cantidad: cantidadPadre,
          historial: false,
          entregado: false,
          notas: `(${op.paso || 'Opción'} de ${prodNombre})`,
          esComponente: true,
        });
        expandidoPorOpciones = true;
      }

      // Formato antiguo: deducir la bebida desde el texto de las notas
      if (i.notas && !expandidoPorOpciones) {
        const parsedNotes = parseSelectionsFromNotes(i.notas);
        const drinkKeys = [
          "Elige la Bebida (1.5 Litros)",
          "Elige la Bebida (1 Litro)",
          "Elige la Bebida",
          "Bebida",
          "Bebida 1",
          "Bebida 2"
        ];
        const selectedDrinkNames = [];
        const isExcludedVal = (v) => !v || ["sin bebida", "omitir (sin bebida)", "sin refresco", "ninguno", "sin entrada"].includes(String(v).trim().toLowerCase());

        for (const [k, v] of Object.entries(parsedNotes)) {
          if (isExcludedVal(v)) continue;
          const lk = k.toLowerCase();
          if (lk.includes('bebida') || lk.includes('refresco') || lk.includes('gaseosa') || lk.includes('chicha') || lk.includes('jugo')) {
            if (!selectedDrinkNames.includes(v)) selectedDrinkNames.push(v);
          }
        }
        for (const key of drinkKeys) {
          const val = parsedNotes[key];
          if (!isExcludedVal(val) && !selectedDrinkNames.includes(val)) {
            selectedDrinkNames.push(val);
          }
        }

        for (const drinkName of selectedDrinkNames) {
          let lookupName = drinkName;
          let displayName = drinkName;

          if (drinkName === "Gaseosa Chiki") {
            lookupName = "Gaseosa Mediana";
            displayName = "Gaseosa Chiki";
          } else if (drinkName === "Gaseosa 1.5 Litros" || drinkName === "Gaseosa 1 1/2 Lt") {
            lookupName = "Gaseosa 1 1/2 Lt";
            displayName = "Gaseosa 1.5 Litros";
          } else if (drinkName === "Chicha Morada 1.5 Litros" || drinkName === "Chicha Morada - 1 1/2 Lt") {
            lookupName = "Chicha Morada - 1 1/2 Lt";
            displayName = "Chicha Morada 1.5 Litros";
          } else if (drinkName === "Limonada 1.5 Litros" || drinkName === "Limonada - 1 1/2 Lt") {
            lookupName = "Limonada - 1 1/2 Lt";
            displayName = "Limonada 1.5 Litros";
          }

          const drinkProd = await prisma.producto.findFirst({
            where: { nombre: { contains: lookupName, mode: 'insensitive' } }
          });

          expandedList.push({
            productoId: drinkProd ? drinkProd.id : prodId,
            nombre: drinkProd ? drinkProd.nombre : displayName,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false, // Va para la barra
            entregado: false,
            notas: "(Bebida Incluida en Combo - S/ 0.00)",
            esComponente: true,
          });
        }
      }
    }
  }
  return expandedList;
}

async function evaluarEstadoEnsalada(itemsList) {
  return 'No Aplica';
}

module.exports = { LIMITE_CANCELACION_MS, MIX_PRODUCTS_DECOMPOSITION, parseSelectionsFromNotes, parseJsonSafe, expandPedidoItemsForDb, evaluarEstadoEnsalada };
