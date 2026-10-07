// ================================================================
// AVISOS DE "PLATO LISTO" EN EL SALÓN
// Compara las mesas antes y después de un sondeo y arma los avisos flotantes:
// cada plato o bebida que acaba de salir de cocina/barra, y cada mesa que pasó
// de "Cocina" a "Servido". Un Mozo solo recibe avisos de sus mesas; Admin y
// Cajero ven todo el salón. Lo demás queda en la Bandeja de Despacho.
// ================================================================

const MAX_AVISOS_PLATOS = 4;

export function avisosDePlatosListos(mesasAntes, mesas, { meseroActivo, esMesaCompartida, esRolMozo, barraCategorias = [] }) {
  const esDeMiMesa = (m) => {
    const mesaMesero = (m.pedidoData?.mesero || '').trim().toLowerCase();
    return (!!meseroActivo && mesaMesero === meseroActivo) || esMesaCompartida(mesaMesero);
  };

  // Platos y bebidas que acaban de salir de su estación
  const reciénListos = [];
  mesas.forEach(m => {
    const ant = mesasAntes.find(p => p.num === m.num);
    if (!ant || !m.pedidoData?.items) return;
    const esMiMesa = esDeMiMesa(m);
    const antesListos = new Set((ant.pedidoData?.items || []).filter(i => i.historial).map(i => i.itemId));
    m.pedidoData.items.forEach(i => {
      if (i.historial && !i.entregado && !antesListos.has(i.itemId)) {
        reciénListos.push({ mesa: m.num, nombre: i.nombre, esBarra: barraCategorias.includes(i.categoria), esMiMesa, mesero: m.pedidoData?.mesero || 'Salón' });
      }
    });
  });
  const platos = reciénListos
    .filter(item => !esRolMozo || item.esMiMesa)
    .slice(0, MAX_AVISOS_PLATOS)
    .map(item => {
      const tituloEstacion = item.esBarra ? '🍹 Bebida lista en BARRA' : '🍽️ Plato listo en COCINA';
      const detalleMesero = item.esMiMesa ? '⭐ ¡Tu Mesa!' : `Atiende: ${item.mesero}`;
      return { tipo: 'listo', mesa: item.mesa, esMiMesa: item.esMiMesa, mensaje: `${tituloEstacion}: ${item.nombre} · Mesa ${item.mesa} (${detalleMesero})` };
    });

  // Mesas completas que pasaron de Cocina a Servido
  const mesasListas = mesas
    .filter(m => {
      const ant = mesasAntes.find(p => p.num === m.num);
      return ant && ant.estado === 'Cocina' && m.estado === 'Servido';
    })
    .map(m => ({ num: m.num, esMiMesa: esDeMiMesa(m), mesero: m.pedidoData?.mesero || 'Salón' }))
    .filter(info => !esRolMozo || info.esMiMesa)
    .map(info => ({
      tipo: 'listo',
      mesa: info.num,
      esMiMesa: info.esMiMesa,
      mensaje: info.esMiMesa ? `🛎️ ¡Tu Mesa ${info.num} está lista para servir!` : `🛎️ ¡Mesa ${info.num} lista para servir! (${info.mesero})`,
    }));

  return { platos, mesasListas };
}
