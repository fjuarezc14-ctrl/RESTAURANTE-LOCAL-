import { useState, useCallback } from 'react';
import { PlusCircle, Trash2, Save, X, Edit2, Search } from 'lucide-react';
import { api } from '../api';
import { parseComponentes, calcularPrecioComponentes, normalizarOpcion, extractIngredientesTexto } from '../utils/combos';
import { ordenarCategorias } from '../utils/categorias';
import { Button, Dialog, DialogHeader, DialogFooter, useAviso, useConfirmar } from '../components/ui';
import { nombre as nombreEsquema, monto as montoEsquema } from '@shared/esquemas/comunes.js';
import { useCargar } from '../hooks/useCargar';
import { matchProductSemantic } from '../modulos/carta/busqueda';
import { BARRA_CATEGORIAS, getCatStyle } from '../modulos/carta/estilos';
import { SeccionesProducto } from '../modulos/carta/componentes/SeccionesProducto';
import { DatosProducto } from '../modulos/carta/componentes/DatosProducto';

export default function CartaPage({ currentUser }) {
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editProd, setEditProd] = useState({ id: '', nombre: '', categoria: '', precio: '', stock: '', opcionesConfig: [], componentes: [], ingredientes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [categorias, setCategorias] = useState([]);

  // Un Mozo con permiso Caja otorgado por el admin también ve la cat. PedidosYa
  const hasCajaAccess = currentUser?.rol === 'Administrador' || currentUser?.rol === 'Cajero' ||
    (currentUser?.permisos || []).includes('Caja');

  const fetchProductos = useCallback(async () => {
    try {
      const data = await api.getProductos();
      setProductos(data);
    } catch (err) {
      console.error('Error cargando productos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategorias = useCallback(async () => {
    try {
      const data = await api.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  }, []);

  const cargarCarta = useCallback(() => { fetchProductos(); fetchCategorias(); }, [fetchProductos, fetchCategorias]);
  useCargar(cargarCarta);

  const puedeVerCategoria = (cat) => Boolean(cat) && (cat !== 'PedidosYa / Ofertas' || hasCajaAccess);

  // Destino y color vienen de la sección Categorías; si no está registrada se usa la config de Barra
  const infoCategoria = (cat) => {
    const c = categorias.find(x => x.nombre === cat);
    const barra = c ? c.destino === 'barra' : BARRA_CATEGORIAS.includes(cat);
    return { barra, color: c?.color || (barra ? 'sky' : 'amber') };
  };
  const esBarra = (cat) => infoCategoria(cat).barra;

  // Filtros: solo categorías que tienen productos
  const categoriasEnBD = ['Todos', ...ordenarCategorias([...new Set(productos.map(p => p.categoria))].filter(puedeVerCategoria))];

  // Categorías para elegir al crear un producto (incluye la actual aunque ya no exista)
  const todasLasCategorias = ordenarCategorias(
    [...new Set([...categorias.map(c => c.nombre), editProd.categoria])].filter(puedeVerCategoria)
  );
  const productosFiltrados = productos.filter(p => {
    if (p.categoria === 'PedidosYa / Ofertas') {
      if (!hasCajaAccess) return false;
    }
    if (categoriaActiva !== 'Todos' && p.categoria !== categoriaActiva) return false;
    return matchProductSemantic(p, searchQuery);
  });

  const abrirModal = (p = null) => {
    let parsedOpciones = [];
    if (p && p.opcionesConfig) {
      try {
        const raw = typeof p.opcionesConfig === 'string' ? JSON.parse(p.opcionesConfig) : p.opcionesConfig;
        if (Array.isArray(raw)) {
          parsedOpciones = raw.map(step => ({
            name: step.name || '',
            // Cada respuesta es texto libre o un producto de la carta (este llega solo a cocina/barra y descuenta stock)
            respuestas: (Array.isArray(step.options) ? step.options : []).map(normalizarOpcion).map(o => (
              o.productoId ? { label: o.label, productoId: o.productoId, precioExtra: o.precioExtra } : { label: o.label }
            )),
          }));
        }
      } catch {
        parsedOpciones = [];
      }
    }

    // Por defecto la categoría que se está filtrando, o la primera disponible
    const disponibles = ordenarCategorias(categorias.map(c => c.nombre).filter(puedeVerCategoria));
    const defaultCat = categoriaActiva !== 'Todos' ? categoriaActiva : (disponibles[0] || '');

    setEditProd(p
      ? {
          ...p,
          precio: String(p.precio),
          // Vacío = sin límite; un número = se cuentan las porciones
          stock: p.tipoStock === 'limitado' ? String(p.stock) : '',
          opcionesConfig: parsedOpciones,
          componentes: parseComponentes(p),
          ingredientes: extractIngredientesTexto(p),
        }
      : { id: '', nombre: '', categoria: defaultCat, precio: '', stock: '', opcionesConfig: [], componentes: [], ingredientes: '' }
    );
    setModalOpen(true);
    fetchCategorias();
  };

  const PLANTILLAS_PREGUNTAS = {
    guarnicion: { name: 'Guarnición', respuestas: ['Papas Fritas', 'Arroz', 'Ensalada', 'Yuca Frita'] },
    termino: { name: 'Término de la carne', respuestas: ['Término Medio', 'Tres Cuartos', 'Bien Cocido'] },
    bebida: { name: 'Bebida', respuestas: ['Chicha Morada', 'Limonada', 'Gaseosa', 'Sin Bebida'] },
    entrada: { name: 'Entrada', respuestas: ['Sopa del Día', 'Ensalada', 'Papa a la Huancaína'] },
    picante: { name: 'Picante', respuestas: ['Sin Picante', 'Picante Medio', 'Bien Picante'] },
  };

  const agregarPregunta = (plantilla = null) => {
    const nueva = plantilla
      ? { name: plantilla.name, respuestas: plantilla.respuestas.map(label => ({ label })) }
      : { name: '', respuestas: [] };
    setEditProd(prev => ({ ...prev, opcionesConfig: [...(prev.opcionesConfig || []), nueva] }));
  };

  const quitarPregunta = (idx) => {
    setEditProd(prev => ({ ...prev, opcionesConfig: (prev.opcionesConfig || []).filter((_, i) => i !== idx) }));
  };

  const editarPregunta = (idx, cambios) => {
    setEditProd(prev => {
      const pasos = [...(prev.opcionesConfig || [])];
      pasos[idx] = { ...pasos[idx], ...cambios };
      return { ...prev, opcionesConfig: pasos };
    });
  };

  // respuesta: { label } (texto) o { label, productoId, precioExtra } (producto de la carta)
  const agregarRespuesta = (idx, respuesta) => {
    const paso = editProd.opcionesConfig[idx];
    const repetida = paso.respuestas.some(r => (
      respuesta.productoId ? r.productoId === respuesta.productoId : !r.productoId && r.label.toLowerCase() === respuesta.label.toLowerCase()
    ));
    if (!repetida) editarPregunta(idx, { respuestas: [...paso.respuestas, respuesta] });
  };

  const editarRespuesta = (idx, rIdx, cambios) => {
    const paso = editProd.opcionesConfig[idx];
    editarPregunta(idx, { respuestas: paso.respuestas.map((r, i) => (i === rIdx ? { ...r, ...cambios } : r)) });
  };

  const quitarRespuesta = (idx, rIdx) => {
    const paso = editProd.opcionesConfig[idx];
    editarPregunta(idx, { respuestas: paso.respuestas.filter((_, i) => i !== rIdx) });
  };

  // Productos que se pueden usar como respuesta o como parte de un combo
  const productosSeleccionables = productos
    .filter(p => p.activo !== false && String(p.id) !== String(editProd.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const componentesActuales = editProd.componentes || [];
  const sumaComponentes = calcularPrecioComponentes(componentesActuales, productos);

  const agregarComponente = (producto) => {
    setEditProd(prev => {
      const actuales = prev.componentes || [];
      const idx = actuales.findIndex(c => c.productoId === producto.id);
      const nuevos = idx >= 0
        ? actuales.map((c, i) => (i === idx ? { ...c, cantidad: c.cantidad + 1 } : c))
        : [...actuales, { productoId: producto.id, cantidad: 1 }];
      return { ...prev, componentes: nuevos };
    });
  };

  const cambiarCantidadComponente = (productoId, delta) => {
    setEditProd(prev => ({
      ...prev,
      componentes: (prev.componentes || [])
        .map(c => (c.productoId === productoId ? { ...c, cantidad: c.cantidad + delta } : c))
        .filter(c => c.cantidad > 0),
    }));
  };

  const quitarComponente = (productoId) => {
    setEditProd(prev => ({ ...prev, componentes: (prev.componentes || []).filter(c => c.productoId !== productoId) }));
  };

  const guardarProducto = async () => {
    const validNombre = nombreEsquema.safeParse(editProd.nombre);
    if (!validNombre.success) {
      aviso.advertencia(validNombre.error.issues?.[0]?.message || 'El nombre del producto es obligatorio.');
      return;
    }

    const numPrecio = parseFloat(editProd.precio);
    const validPrecio = montoEsquema.safeParse(numPrecio);
    if (!validPrecio.success) {
      aviso.advertencia(validPrecio.error.issues?.[0]?.message || 'El precio debe ser un monto válido (ej: 25.50).');
      return;
    }

    if (!editProd.categoria?.trim()) {
      aviso.advertencia('Elige una categoría para el producto.');
      return;
    }

    // Preguntas al mozo: se ignoran las que están totalmente vacías
    const preguntas = (editProd.opcionesConfig || []).filter(s => s.name.trim() || s.respuestas.length > 0);
    const incompleta = preguntas.findIndex(s => !s.name.trim() || s.respuestas.length === 0);
    if (incompleta >= 0) {
      aviso.advertencia(`La pregunta ${incompleta + 1} necesita un nombre y al menos una respuesta.`);
      return;
    }
    const opcionesPayload = preguntas.length > 0
      ? JSON.stringify(preguntas.map((s, idx) => ({
          name: s.name.trim(),
          key: `opcion_${idx + 1}`,
          options: s.respuestas.map(r => (r.productoId
            ? { label: r.label, value: r.label, productoId: r.productoId, precioExtra: parseFloat(r.precioExtra) || 0 }
            : r.label)),
        })))
      : null;

    const stockTexto = String(editProd.stock ?? '').trim();
    const limitado = stockTexto !== '';

    setGuardando(true);
    try {
      const body = {
        nombre: validNombre.data,
        categoria: editProd.categoria.trim(),
        precio: validPrecio.data,
        tipoStock: limitado ? 'limitado' : 'ilimitado',
        stock: limitado ? Math.max(0, parseInt(stockTexto) || 0) : 0,
        requiereGuarnicion: preguntas.length > 0,
        opcionesConfig: opcionesPayload,
        componentes: componentesActuales.length > 0 ? JSON.stringify(componentesActuales) : null,
        complementos: (editProd.ingredientes || '').trim() || null,
      };
      if (editProd.id) {
        await api.editarProducto(editProd.id, body);
        aviso.exito('Producto actualizado en la carta.');
      } else {
        await api.crearProducto(body);
        aviso.exito('Producto agregado a la carta.');
      }
      await Promise.all([fetchProductos(), fetchCategorias()]);
      setModalOpen(false);
    } catch (err) {
      aviso.error('Error guardando producto: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (id) => {
    const seguro = await confirmar({
      titulo: 'Eliminar producto',
      mensaje: '¿Estás seguro de eliminar este producto de la carta?',
      peligro: true,
      botonConfirmar: 'Sí, eliminar',
      botonCancelar: 'Cancelar',
    });
    if (seguro) {
      try {
        await api.eliminarProducto(id);
        aviso.exito('Producto eliminado correctamente.');
        await fetchProductos();
      } catch (err) {
        aviso.error('Error eliminando producto: ' + err.message);
      }
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando productos...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">

      {/* ── HEADER CARTA ─────────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Menú y Productos</h1>
          <p className="text-xs md:text-sm text-slate-500">{productos.length} productos activos · Guardado en Base de Datos.</p>
        </div>
        <button onClick={() => abrirModal()} className="self-start sm:self-auto bg-amber-500 text-slate-900 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer">
          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" /> Agregar Producto
        </button>
      </div>

      {/* ── BUSCADOR DE PRODUCTOS ── */}
      <div className="mb-5 relative w-full">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Buscar producto por nombre o categoría (ej: 'poyo', 'chela', 'parri')..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-medium text-slate-850 shadow-sm"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')} 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── FILTROS DE CATEGORÍA ─────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4 items-center">
        {categoriasEnBD.map(cat => {
          const catBarra = esBarra(cat);
          return (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-xs transition-colors flex items-center gap-2 ${
                categoriaActiva === cat
                  ? (catBarra ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white')
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat !== 'Todos' && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  categoriaActiva === cat 
                    ? 'bg-white' 
                    : (catBarra ? 'bg-blue-500' : 'bg-amber-500')
                }`} />
              )}
              <span>{cat === 'Todos' ? 'Todos' : cat}</span>
            </button>
          );
        })}
      </div>

      {/* ── GRID DE PRODUCTOS ────────────────────────────── */}
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
                    <button onClick={() => abrirModal(p)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded-xl transition-colors">Editar</button>
                    <button onClick={() => eliminarProducto(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* ── MODAL PRODUCTO ───────────────────────────────── */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} closeOnBackdrop={false} className="sm:max-w-5xl">
        <DialogHeader
          icon={editProd.id ? Edit2 : PlusCircle}
          iconClassName={editProd.id ? 'bg-sky-100 text-sky-600' : 'bg-emerald-100 text-emerald-600'}
          title={editProd.id ? 'Editar producto' : 'Nuevo producto'}
          onClose={() => setModalOpen(false)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">

          {/* ── Datos principales ── */}
          <DatosProducto editProd={editProd} esBarra={esBarra} infoCategoria={infoCategoria} setEditProd={setEditProd} todasLasCategorias={todasLasCategorias} />

          <SeccionesProducto PLANTILLAS_PREGUNTAS={PLANTILLAS_PREGUNTAS} agregarComponente={agregarComponente} agregarPregunta={agregarPregunta} agregarRespuesta={agregarRespuesta} cambiarCantidadComponente={cambiarCantidadComponente} componentesActuales={componentesActuales} editProd={editProd} editarPregunta={editarPregunta} editarRespuesta={editarRespuesta} productos={productos} productosSeleccionables={productosSeleccionables} quitarComponente={quitarComponente} quitarPregunta={quitarPregunta} quitarRespuesta={quitarRespuesta} setEditProd={setEditProd} sumaComponentes={sumaComponentes} />
        </div>

        <DialogFooter className="justify-between">
          <div className="hidden sm:flex items-baseline gap-2 min-w-0">
            <span className="text-sm text-slate-500 truncate max-w-64">{editProd.nombre || 'Sin nombre'}</span>
            {editProd.precio && (
              <span className="font-mono text-lg font-black text-emerald-700">S/ {parseFloat(editProd.precio || 0).toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="lg" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button variant="success" size="lg" onClick={guardarProducto} disabled={guardando} className="flex-[2] sm:flex-none sm:min-w-44">
              {guardando
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Save className="w-5 h-5" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </Dialog>

    </section>
  );
}
