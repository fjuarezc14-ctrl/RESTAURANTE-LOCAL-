// Categorías de la carta: sincronización y destino (cocina o barra)
const { prisma } = require('../db');
const { DEFAULT_BARRA_CATEGORIAS, configEnCache, getEmpresaConfig, guardarConfigEnCache, isBarraCategoria } = require('./empresa');

// ============================================================
// CATEGORÍAS DE LA CARTA
// ============================================================

const COLORES_CATEGORIA = ['amber', 'emerald', 'sky', 'violet', 'rose', 'orange', 'lime', 'slate'];

const mismoNombre = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Registra en la tabla las categorías que ya usan los productos (las base se crean en la migración)
async function sincronizarCategorias() {
  const existentes = await prisma.categoria.findMany({ select: { nombre: true } });
  const usadas = await prisma.producto.findMany({ where: { activo: true }, distinct: ['categoria'], select: { categoria: true } });
  const nuevas = [];
  for (const { categoria: nombre } of usadas) {
    const limpio = String(nombre || '').trim();
    if (!limpio) continue;
    if (existentes.some(e => mismoNombre(e.nombre, limpio)) || nuevas.some(n => mismoNombre(n, limpio))) continue;
    nuevas.push(limpio);
  }
  if (nuevas.length > 0) {
    await prisma.categoria.createMany({
      data: nuevas.map(nombre => ({ nombre, color: isBarraCategoria(nombre) ? 'sky' : 'amber' })),
      skipDuplicates: true,
    });
  }
}

// Actualiza la lista de categorías de Barra quitando el nombre anterior y agregando el nuevo si va a Barra
async function actualizarDestinoCategoria(tx, nombreAnterior, nombreNuevo, esBarra) {
  const conf = await getEmpresaConfig();
  if (!conf || !conf.id) return;
  const base = Array.isArray(conf.barraCategorias) ? conf.barraCategorias : DEFAULT_BARRA_CATEGORIAS;
  const lista = base.filter(c => !mismoNombre(c, nombreAnterior) && !mismoNombre(c, nombreNuevo));
  if (esBarra && nombreNuevo) lista.push(nombreNuevo);
  const actualizada = await tx.empresaConfig.update({ where: { id: conf.id }, data: { barraCategorias: lista } });
  guardarConfigEnCache({ ...configEnCache(), ...actualizada });
}

// Reemplaza (o quita si nombreNuevo es null) una categoría dentro de las ofertas
async function renombrarCategoriaEnOfertas(tx, nombreAnterior, nombreNuevo) {
  const ofertas = await tx.oferta.findMany({ where: { categorias: { has: nombreAnterior } } });
  for (const o of ofertas) {
    const cats = o.categorias.filter(c => c !== nombreAnterior);
    if (nombreNuevo && !cats.includes(nombreNuevo)) cats.push(nombreNuevo);
    await tx.oferta.update({ where: { id: o.id }, data: { categorias: cats } });
  }
}

module.exports = { COLORES_CATEGORIA, mismoNombre, sincronizarCategorias, actualizarDestinoCategoria, renombrarCategoriaEnOfertas };
