import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Utensils, CupSoda, Wine, Trash2, Save, X, Tag, ToggleLeft, ToggleRight, Edit2, ChevronDown, ChevronUp, Percent, DollarSign, Search, Flame, GlassWater, Package, Plus, Minus, Boxes, MessageCircleQuestion, Infinity as InfinityIcon } from 'lucide-react';
import { api } from '../api';
import { parseComponentes, calcularPrecioComponentes, normalizarOpcion, extractIngredientesTexto } from '../utils/combos';
import { ordenarCategorias } from '../utils/categorias';
import { Button, Input, Label, Badge, Dialog, DialogHeader, DialogFooter, useAviso, useConfirmar } from '../components/ui';
import { cn } from '../utils/cn';

// --- SISTEMA DE BÚSQUEDA INTELIGENTE Y FONÉTICA ---
const SINONIMOS = {
  gaseosa: ['cola', 'inca', 'coca', 'refresco', 'sprite', 'fanta', 'gaseosa'],
  bebida: ['chicha', 'limonada', 'gaseosa', 'cerveza', 'pisco', 'trago', 'coctel', 'jugo', 'agua'],
  chela: ['cerveza', 'cristal', 'pilsen', 'cusquena'],
  papas: ['papa', 'patata', 'fritas'],
  carne: ['lomo', 'bife', 'parrilla', 'anticucho', 'res', 'corte'],
  pollo: ['brasa', 'broaster', 'alitas', 'pechuga'],
  piqueo: ['entrada', 'porcion', 'tequenos', 'salchipapa']
};

const normalizePhonetic = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-z0-9]/g, " ")      // remover caracteres especiales
    .replace(/ch/g, "x")            // ch -> x
    .replace(/ll/g, "y")            // ll -> y
    .replace(/b/g, "v")             // b -> v
    .replace(/c(?=[eii])/g, "s")    // c suave -> s
    .replace(/z/g, "s")             // z -> s
    .replace(/k/g, "c")             // k -> c
    .replace(/q/g, "c")             // q -> c
    .replace(/\s+/g, " ")
    .trim();
};

const matchProductSemantic = (prod, query) => {
  if (!query || !query.trim()) return true;
  const rawQ = query.trim().toLowerCase();
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const cleanProdCat = (prod.categoria || '').toLowerCase();
  
  if (cleanProdName.includes(rawQ) || cleanProdCat.includes(rawQ)) return true;
  
  const phoneticQ = normalizePhonetic(rawQ);
  const phoneticName = normalizePhonetic(prod.nombre);
  const phoneticCat = normalizePhonetic(prod.categoria);
  if (phoneticName.includes(phoneticQ) || phoneticCat.includes(phoneticQ)) return true;
  
  const terms = rawQ.split(/\s+/).filter(t => t.length >= 2);
  if (terms.length === 0) return true;
  
  return terms.every(term => {
    if (cleanProdName.includes(term) || cleanProdCat.includes(term)) return true;
    const pTerm = normalizePhonetic(term);
    if (phoneticName.includes(pTerm) || phoneticCat.includes(pTerm)) return true;
    
    for (const [key, aliases] of Object.entries(SINONIMOS)) {
      if (term.includes(key) || aliases.some(a => term.includes(a))) {
        if (aliases.some(a => cleanProdName.includes(a) || cleanProdCat.includes(a))) {
          return true;
        }
      }
    }
    return false;
  });
};

// Categorías de Barra (el resto va a Cocina)
const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;

// Ícono y color por categoría
function getCatStyle(cat, esBarra) {
  if (esBarra) {
    if (cat === 'Cervezas') return { Icon: CupSoda, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
    if (cat === 'Bar y Cocteles') return { Icon: Wine, color: 'text-purple-500', bg: 'bg-purple-100', badge: 'bg-purple-100 text-purple-700' };
    if (cat === 'Bebidas Calientes') return { Icon: CupSoda, color: 'text-orange-500', bg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700' };
    if (cat === 'Postres') return { Icon: Utensils, color: 'text-rose-400', bg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700' };
    return { Icon: CupSoda, color: 'text-blue-500', bg: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700' };
  }
  return { Icon: Utensils, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
}

const ACENTOS_BUSCADOR = {
  violet: { foco: 'focus:border-violet-500 focus:ring-violet-100', hover: 'hover:bg-violet-50', mas: 'bg-violet-100 text-violet-700' },
  sky: { foco: 'focus:border-sky-500 focus:ring-sky-100', hover: 'hover:bg-sky-50', mas: 'bg-sky-100 text-sky-700' },
};

// Buscador de productos de la carta; con onTextoLibre también permite agregar lo escrito como texto
function BuscadorProductos({ productos, onElegir, onTextoLibre, placeholder, acento = 'violet', compacto = false }) {
  const [q, setQ] = useState('');
  const texto = q.trim();
  const resultados = texto ? productos.filter(p => matchProductSemantic(p, texto)).slice(0, 6) : [];
  const a = ACENTOS_BUSCADOR[acento];

  const elegir = (p) => { onElegir(p); setQ(''); };
  const agregarTexto = () => {
    if (!texto || !onTextoLibre) return;
    onTextoLibre(texto);
    setQ('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onTextoLibre) agregarTexto();
      else if (resultados[0]) elegir(resultados[0]);
    } else if (e.key === 'Escape' && q) {
      e.stopPropagation(); // limpia la búsqueda sin cerrar el modal
      setQ('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(compacto ? 'h-10 text-sm' : 'h-12', 'pl-10 font-medium', a.foco)}
        />
      </div>
      {texto && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y divide-slate-100 animate-fade-in">
          {onTextoLibre && (
            <button type="button" onClick={agregarTexto} className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-slate-700 cursor-pointer', a.hover)}>
              <span className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', a.mas)}><Plus className="w-4 h-4" /></span>
              Agregar “{texto}”
            </button>
          )}
          {onTextoLibre && resultados.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">De la carta</p>
          )}
          {resultados.map(p => (
            <button key={p.id} type="button" onClick={() => elegir(p)} className={cn('w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer', a.hover)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400 truncate">{p.categoria}</p>
              </div>
              <span className="text-sm font-mono font-bold text-slate-600">S/ {Number(p.precio || 0).toFixed(2)}</span>
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', a.mas)}><Plus className="w-4 h-4" /></span>
            </button>
          ))}
          {!onTextoLibre && resultados.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">No se encontró “{texto}”</p>
          )}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, [fetchProductos, fetchCategorias]);

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
    const precio = parseFloat(editProd.precio);
    if (!editProd.nombre.trim() || isNaN(precio)) {
      aviso.advertencia('Ingresa un nombre y precio válido.');
      return;
    }
    if (!editProd.categoria) {
      aviso.advertencia('Elige una categoría.');
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
        nombre: editProd.nombre.trim(),
        categoria: editProd.categoria,
        precio,
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-4">
              <div>
                <Label htmlFor="prod-nombre">Nombre</Label>
                <Input
                  id="prod-nombre"
                  autoFocus={!editProd.id}
                  value={editProd.nombre}
                  onChange={e => setEditProd({ ...editProd, nombre: e.target.value })}
                  placeholder="Ej: 1/4 Pollo a la Brasa"
                  className="h-12 text-base focus:border-amber-500 focus:ring-amber-100"
                />
              </div>
              <div>
                <Label htmlFor="prod-precio">Precio</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 select-none">S/</span>
                  <Input
                    id="prod-precio"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={editProd.precio}
                    onChange={e => setEditProd({ ...editProd, precio: e.target.value })}
                    placeholder="0.00"
                    className="h-12 pl-11 text-lg font-black font-mono text-emerald-700 focus:border-emerald-500 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="prod-categoria">Categoría</Label>
                  <Link to="/categorias" className="mb-1.5 text-xs font-bold text-violet-600 hover:underline">Administrar</Link>
                </div>
                <div className="relative">
                  {(() => {
                    const info = infoCategoria(editProd.categoria);
                    const IconoDestino = info.barra ? GlassWater : Flame;
                    return (
                      <span className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center', info.barra ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600')}>
                        <IconoDestino className="w-4 h-4" />
                      </span>
                    );
                  })()}
                  <select
                    id="prod-categoria"
                    value={editProd.categoria}
                    onChange={e => setEditProd({ ...editProd, categoria: e.target.value })}
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 cursor-pointer"
                  >
                    {!editProd.categoria && <option value="">Elegir categoría...</option>}
                    {todasLasCategorias.map(cat => (
                      <option key={cat} value={cat}>{cat}{esBarra(cat) ? '  · Barra' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-400">
                  Se prepara en {esBarra(editProd.categoria) ? <span className="text-sky-600">Barra</span> : <span className="text-amber-600">Cocina</span>}
                </p>
              </div>

              <div>
                <Label htmlFor="prod-stock">Disponibles</Label>
                <div className="relative">
                  <Package className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="prod-stock"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={editProd.stock}
                    onChange={e => setEditProd({ ...editProd, stock: e.target.value })}
                    placeholder="Sin límite"
                    className="h-12 pl-12 pr-12 text-base font-black font-mono focus:border-sky-500 focus:ring-sky-100 placeholder:font-sans placeholder:font-semibold"
                  />
                  {String(editProd.stock ?? '') !== '' && (
                    <button
                      type="button"
                      onClick={() => setEditProd({ ...editProd, stock: '' })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                      title="Sin límite"
                    >
                      <InfinityIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-400">
                  {String(editProd.stock ?? '') === '' ? 'Vacío = siempre hay' : 'Al llegar a 0 sale AGOTADO'}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="prod-ingredientes" className="text-xs text-slate-500">
                Ingredientes <span className="font-medium text-slate-400">(opcional)</span>
              </Label>
              <Input
                id="prod-ingredientes"
                value={editProd.ingredientes || ''}
                onChange={e => setEditProd({ ...editProd, ingredientes: e.target.value })}
                placeholder="Ej: papas fritas, ensalada, cremas"
                className="h-10 text-sm font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

            {/* ── Combo ── */}
            <section className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-violet-600/30">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">Combo</h4>
                    <p className="text-xs text-slate-500">Une varios productos de la carta en uno</p>
                  </div>
                </div>
                {componentesActuales.length > 0 && (
                  <Badge className="bg-violet-600 text-white">{componentesActuales.reduce((s, c) => s + c.cantidad, 0)}</Badge>
                )}
              </div>

              <BuscadorProductos
                productos={productosSeleccionables}
                onElegir={agregarComponente}
                placeholder="Buscar producto para el combo..."
                acento="violet"
              />

              {componentesActuales.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-violet-200 py-5 text-center text-sm text-slate-400">
                  Aún no es combo
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {componentesActuales.map(c => {
                      const prod = productos.find(p => p.id === c.productoId);
                      return (
                        <div key={c.productoId} className="flex items-center gap-2 rounded-xl bg-white border border-violet-100 p-2 pl-3 shadow-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{prod ? prod.nombre : `Producto #${c.productoId} (eliminado)`}</p>
                            <p className="text-xs text-slate-400 font-mono">S/ {((prod?.precio || 0) * c.cantidad).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center rounded-lg bg-slate-100">
                            <button type="button" onClick={() => cambiarCantidadComponente(c.productoId, -1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer" aria-label="Quitar uno">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center text-sm font-black tabular-nums">{c.cantidad}</span>
                            <button type="button" onClick={() => cambiarCantidadComponente(c.productoId, 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer" aria-label="Agregar uno">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button type="button" onClick={() => quitarComponente(c.productoId)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label="Quitar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const precioCombo = parseFloat(editProd.precio) || 0;
                    const ahorro = sumaComponentes - precioCombo;
                    return (
                      <div className="rounded-xl bg-white border border-violet-100 p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Por separado</span>
                          <span className="font-mono font-bold text-slate-700">S/ {sumaComponentes.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Precio del combo</span>
                          <span className="font-mono font-bold text-slate-700">S/ {precioCombo.toFixed(2)}</span>
                        </div>
                        {precioCombo > 0 && ahorro !== 0 && (
                          <div className={cn('flex justify-between text-sm font-black rounded-lg px-2 py-1', ahorro > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                            <span>{ahorro > 0 ? 'El cliente ahorra' : 'Cuesta más que por separado'}</span>
                            <span className="font-mono">S/ {Math.abs(ahorro).toFixed(2)}</span>
                          </div>
                        )}
                        {precioCombo !== Number(sumaComponentes.toFixed(2)) && (
                          <Button variant="outline" size="sm" className="w-full" onClick={() => setEditProd(prev => ({ ...prev, precio: sumaComponentes.toFixed(2) }))}>
                            Usar S/ {sumaComponentes.toFixed(2)} como precio
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </section>

            {/* ── Preguntas al tomar el pedido ── */}
            <section className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-600/30">
                  <MessageCircleQuestion className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900">Preguntas al pedir</h4>
                  <p className="text-xs text-slate-500">Ej: ¿Guarnición? → Papas, Arroz</p>
                </div>
              </div>

              {(editProd.opcionesConfig || []).map((paso, idx) => (
                <div key={idx} className="rounded-xl bg-white border border-sky-100 p-3 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 text-sm font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                    <Input
                      value={paso.name}
                      onChange={e => editarPregunta(idx, { name: e.target.value })}
                      placeholder="Pregunta, ej: Guarnición"
                      className="h-10 focus:border-sky-500 focus:ring-sky-100"
                    />
                    <button type="button" onClick={() => quitarPregunta(idx)} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label="Quitar pregunta">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {paso.respuestas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {paso.respuestas.map((r, rIdx) => (
                        r.productoId ? (
                          <span key={`p${r.productoId}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 pl-3 pr-1 py-1 text-xs font-bold text-emerald-800" title="Producto de la carta: descuenta stock">
                            <Utensils className="w-3 h-3" /> {r.label}
                            <span className="ml-1 text-emerald-600">+S/</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={r.precioExtra}
                              onChange={e => editarRespuesta(idx, rIdx, { precioExtra: e.target.value })}
                              className="w-12 rounded-md border border-emerald-200 bg-white px-1 py-0.5 text-xs text-emerald-900 focus:outline-none focus:border-emerald-500"
                              title="Cobro extra si eligen esta opción"
                            />
                            <button type="button" onClick={() => quitarRespuesta(idx, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-emerald-100 cursor-pointer" aria-label="Quitar">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span key={`t${rIdx}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 pl-3 pr-1 py-1 text-xs font-bold text-slate-700">
                            {r.label}
                            <button type="button" onClick={() => quitarRespuesta(idx, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer" aria-label="Quitar">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  <BuscadorProductos
                    productos={productosSeleccionables}
                    onElegir={prod => agregarRespuesta(idx, { label: prod.nombre, productoId: prod.id, precioExtra: 0 })}
                    onTextoLibre={texto => agregarRespuesta(idx, { label: texto })}
                    placeholder="Escribe una respuesta y Enter..."
                    acento="sky"
                    compacto
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Button variant="outline" className="w-full border-dashed border-sky-300 text-sky-700 hover:bg-sky-50" onClick={() => agregarPregunta()}>
                  <Plus className="w-4 h-4" /> Nueva pregunta
                </Button>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1">Rápidas:</span>
                  {Object.entries(PLANTILLAS_PREGUNTAS).map(([key, pl]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => agregarPregunta(pl)}
                      className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 cursor-pointer"
                    >
                      + {pl.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
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
