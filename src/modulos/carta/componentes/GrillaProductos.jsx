// Grilla de productos de la Carta. Va aparte y memorizada: al escribir en el modal de producto
// (cada letra cambia el estado de la página) no se vuelven a dibujar todas las tarjetas.
import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { extractIngredientesTexto } from '../../../utils/combos';
import { getCatStyle } from '../estilos';
import { matchProductSemantic } from '../busqueda';

export const GrillaProductos = memo(function GrillaProductos({ productos, categoriaActiva, busqueda, verPedidosYa, esBarra, onEditar, onEliminar }) {
  const productosFiltrados = productos.filter(p => {
    if (p.categoria === 'PedidosYa / Ofertas' && !verPedidosYa) return false;
    if (categoriaActiva !== 'Todos' && p.categoria !== categoriaActiva) return false;
    return matchProductSemantic(p, busqueda);
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {productosFiltrados.length === 0
        ? <div className="col-span-full text-center py-10 text-slate-400 font-medium">No hay productos en esta categoría.</div>
        : productosFiltrados.map(p => {
            const { Icon, color, bg, badge } = getCatStyle(p.categoria, esBarra(p.categoria));
            const isAgotado = p.tipoStock === 'limitado' && p.stock <= 0;
            const tieneOferta = p.precioOferta != null;

            return (
              <div key={p.id} className={`bg-white rounded-3xl border shadow-sm p-4 relative overflow-hidden transition-all hover:shadow-md ${isAgotado ? 'opacity-75 grayscale-[50%]' : ''} ${tieneOferta ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-100'}`}>
                {isAgotado && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
                    <span className="bg-red-600 text-white font-black px-4 py-2 rounded-xl uppercase tracking-widest text-sm shadow-xl rotate-[-10deg] border-2 border-white">AGOTADO</span>
                  </div>
                )}
                {tieneOferta && (
                  <div className="absolute top-2 right-2 z-20">
                    <span className="bg-amber-500 text-slate-900 font-black text-[10px] px-2 py-0.5 rounded-lg uppercase tracking-wider shadow animate-pulse">
                      🔥 OFERTA
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-start mb-3 relative z-0">
                  <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center ${color}`}><Icon className="w-6 h-6" /></div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none">{p.categoria}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase mt-1 inline-block ${badge}`}>
                      {esBarra(p.categoria) ? '🍹 Barra' : '🔥 Cocina'}
                    </span>
                  </div>
                </div>
                <div className="relative z-0">
                  <h3 className="font-black text-slate-800 text-sm leading-tight mb-1 line-clamp-2" title={p.nombre}>{p.nombre}</h3>
                  {extractIngredientesTexto(p) && (
                    <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mb-2 flex items-center gap-1" title={extractIngredientesTexto(p)}>
                      <span className="text-emerald-500 shrink-0 text-xs">🥗</span>
                      <span className="truncate">{extractIngredientesTexto(p)}</span>
                    </p>
                  )}
                  {tieneOferta ? (
                    <div>
                      <p className="text-sm text-slate-400 font-mono line-through">S/ {parseFloat(p.precio).toFixed(2)}</p>
                      <p className="text-2xl font-black text-emerald-600 font-mono tracking-tighter">S/ {parseFloat(p.precioOferta).toFixed(2)}</p>
                      <p className="text-[10px] text-amber-600 font-bold truncate" title={p.ofertaNombre}>{p.ofertaNombre}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-black text-amber-500 font-mono tracking-tighter">S/ {parseFloat(p.precio).toFixed(2)}</p>
                  )}
                </div>
                {p.tipoStock === 'limitado' && !isAgotado && (
                  <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md mt-2 inline-block">Stock: {p.stock}</p>
                )}
                <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 relative z-20">
                  <button onClick={() => onEditar(p)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded-xl transition-colors">Editar</button>
                  <button onClick={() => onEliminar(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })
      }
    </div>
  );
});
