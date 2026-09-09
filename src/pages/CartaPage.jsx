import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Utensils, CupSoda, Wine, AlertCircle, Trash2, BookOpen, Save, X, Tag, ToggleLeft, ToggleRight, Edit2, ChevronDown, ChevronUp, Percent, DollarSign, Search, Sliders, Sparkles, FolderPlus } from 'lucide-react';
import { api } from '../api';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS, TODAS_CATEGORIAS as MASTER_TODAS_CATEGORIAS, ORDEN_PRIORIDADES_CATEGORIAS } from '../config/company';

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
function getCatStyle(cat) {
  if (BARRA_CATEGORIAS.includes(cat)) {
    if (cat === 'Cervezas') return { Icon: CupSoda, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
    if (cat === 'Bar y Cocteles') return { Icon: Wine, color: 'text-purple-500', bg: 'bg-purple-100', badge: 'bg-purple-100 text-purple-700' };
    if (cat === 'Bebidas Calientes') return { Icon: CupSoda, color: 'text-orange-500', bg: 'bg-orange-100', badge: 'bg-orange-100 text-orange-700' };
    if (cat === 'Postres') return { Icon: Utensils, color: 'text-rose-400', bg: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700' };
    return { Icon: CupSoda, color: 'text-blue-500', bg: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700' };
  }
  return { Icon: Utensils, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700' };
}

const TODAS_CATEGORIAS = [
  ...MASTER_TODAS_CATEGORIAS,
  'PedidosYa / Ofertas',
];

export default function CartaPage({ currentUser }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editProd, setEditProd] = useState({ id: '', nombre: '', categoria: 'Platos de Fondo', precio: '', tipoStock: 'ilimitado', stock: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [creandoNuevaCat, setCreandoNuevaCat] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');
  const [categoriasExtra, setCategoriasExtra] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('restaurant_custom_categories') || '[]');
    } catch {
      return [];
    }
  });

  // Ofertas
  const [ofertas, setOfertas] = useState([]);
  const [ofertaModalOpen, setOfertaModalOpen] = useState(false);
  const [guardandoOferta, setGuardandoOferta] = useState(false);
  const [ofertaTab, setOfertaTab] = useState(false); // toggle the offers panel
  const [editOferta, setEditOferta] = useState({
    id: '', nombre: '', descripcion: '', tipoDescuento: 'porcentaje',
    valorDescuento: '', categorias: [], fechaInicio: '', fechaFin: '',
  });

  const isAdmin = currentUser?.rol === 'Administrador';
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

  const fetchOfertas = useCallback(async () => {
    try {
      const data = await api.getOfertas();
      setOfertas(data);
    } catch (err) {
      console.error('Error cargando ofertas:', err);
    }
  }, []);

  useEffect(() => {
    fetchProductos();
    if (isAdmin) fetchOfertas();
  }, [fetchProductos, fetchOfertas, isAdmin]);

  // Categorías dinámicas desde los productos en BD + categorías agregadas por el usuario
  const categoriasEnBD = ['Todos', ...new Set([...productos.map(p => p.categoria), ...categoriasExtra])].filter(cat => {
    if (cat === 'PedidosYa / Ofertas') return hasCajaAccess;
    return Boolean(cat);
  });
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
            options: Array.isArray(step.options) ? step.options.join(', ') : String(step.options || '')
          }));
        }
      } catch (e) {
        parsedOpciones = [];
      }
    }
    setEditProd(p
      ? {
          ...p,
          precio: String(p.precio),
          stock: String(p.stock),
          requiereGuarnicion: !!p.requiereGuarnicion,
          tieneOpciones: parsedOpciones.length > 0 || (p.categoria === 'Menú'),
          opcionesConfig: parsedOpciones.length > 0 ? parsedOpciones : (p.categoria === 'Menú' ? [
            { name: "Elige la Entrada", options: "Sopa del Día, Ensalada Fresca, Papa a la Huancaína, Sin Entrada" },
            { name: "Elige la Bebida", options: "Chicha Morada, Limonada, Gaseosa, Sin Bebida" }
          ] : [])
        }
      : {
          id: '',
          nombre: '',
          categoria: 'Menú',
          precio: '',
          tipoStock: 'ilimitado',
          stock: '',
          requiereGuarnicion: false,
          tieneOpciones: false,
          opcionesConfig: []
        }
    );
    setCreandoNuevaCat(false);
    setNuevaCatNombre('');
    setModalOpen(true);
  };

  const aplicarPlantillaOpciones = (tipo) => {
    if (tipo === 'menu') {
      setEditProd(prev => ({
        ...prev,
        tieneOpciones: true,
        categoria: 'Menú',
        opcionesConfig: [
          { name: "Elige la Entrada", options: "Sopa del Día, Ensalada Fresca, Papa a la Huancaína, Sin Entrada" },
          { name: "Elige la Bebida", options: "Chicha Morada, Limonada, Gaseosa, Sin Bebida" }
        ]
      }));
    } else if (tipo === 'parrilla') {
      setEditProd(prev => ({
        ...prev,
        tieneOpciones: true,
        opcionesConfig: [
          { name: "Elige la Guarnición", options: "Papas Fritas, Arroz Chaufa, Arroz Blanco, Yuca Frita, Ensalada, Sin Guarnición" },
          { name: "Término de la Carne", options: "Término Medio, Tres Cuartos, Bien Cocido" }
        ]
      }));
    } else if (tipo === 'marino') {
      setEditProd(prev => ({
        ...prev,
        tieneOpciones: true,
        opcionesConfig: [
          { name: "Nivel de Picante", options: "Sin Picante / Suave, Picante Medio, Bien Picante" },
          { name: "Acompañamiento", options: "Clásico (Choclo y Camote), Chifles Piuranos, Cancha Serrana" }
        ]
      }));
    } else if (tipo === 'combo') {
      setEditProd(prev => ({
        ...prev,
        tieneOpciones: true,
        categoria: 'Combos',
        opcionesConfig: [
          { name: "Elige la Guarnición", options: "Papas Fritas, Arroz Chaufa, Arroz Blanco, Ensalada Fresca" },
          { name: "Bebida del Combo", options: "Chicha Morada (Vaso), Limonada (Vaso), Gaseosa 500ml, Sin Bebida" },
          { name: "Salsas y Cremas", options: "Todas las Salsas, Solo Ají, Mayonesa y Ketchup, Sin Salsas" }
        ]
      }));
    }
  };

  const agregarPasoOpcion = () => {
    setEditProd(prev => ({
      ...prev,
      opcionesConfig: [
        ...(prev.opcionesConfig || []),
        { name: "", options: "" }
      ]
    }));
  };

  const eliminarPasoOpcion = (idx) => {
    setEditProd(prev => ({
      ...prev,
      opcionesConfig: (prev.opcionesConfig || []).filter((_, i) => i !== idx)
    }));
  };

  const actualizarPasoOpcion = (idx, campo, valor) => {
    setEditProd(prev => {
      const nuevo = [...(prev.opcionesConfig || [])];
      nuevo[idx] = { ...nuevo[idx], [campo]: valor };
      return { ...prev, opcionesConfig: nuevo };
    });
  };

  const guardarProducto = async () => {
    const precio = parseFloat(editProd.precio);
    if (!editProd.nombre || isNaN(precio)) { alert('Ingresa un nombre y precio válido.'); return; }
    
    let categoriaFinal = editProd.categoria;
    if (creandoNuevaCat) {
      if (!nuevaCatNombre.trim()) {
        alert('Por favor ingresa el nombre de la nueva categoría.');
        return;
      }
      categoriaFinal = nuevaCatNombre.trim();
    }

    // Procesar opciones configuradas
    let opcionesPayload = null;
    let requiereGuarnicionBool = false;
    
    if (editProd.tieneOpciones && Array.isArray(editProd.opcionesConfig)) {
      const pasosValidos = editProd.opcionesConfig
        .filter(s => s.name && s.name.trim() && s.options && s.options.trim())
        .map((s, idx) => ({
          name: s.name.trim(),
          key: `opcion_${idx + 1}`,
          options: s.options.split(',').map(o => o.trim()).filter(Boolean)
        }))
        .filter(s => s.options.length > 0);

      if (pasosValidos.length > 0) {
        opcionesPayload = JSON.stringify(pasosValidos);
        requiereGuarnicionBool = true;
      }
    }

    setGuardando(true);
    try {
      const body = {
        nombre: editProd.nombre,
        categoria: categoriaFinal,
        precio,
        tipoStock: editProd.tipoStock,
        stock: parseInt(editProd.stock) || 0,
        requiereGuarnicion: requiereGuarnicionBool,
        opcionesConfig: opcionesPayload
      };
      if (editProd.id) {
        await api.editarProducto(editProd.id, body);
      } else {
        await api.crearProducto(body);
      }
      await fetchProductos();
      setModalOpen(false);
    } catch (err) {
      alert('Error guardando producto: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este producto de la carta?')) {
      try {
        await api.eliminarProducto(id);
        await fetchProductos();
      } catch (err) {
        alert('Error eliminando producto: ' + err.message);
      }
    }
  };

  // ── Ofertas handlers ──────────────────────────────────────
  const abrirOfertaModal = (o = null) => {
    setEditOferta(o
      ? {
          id: o.id,
          nombre: o.nombre,
          descripcion: o.descripcion || '',
          tipoDescuento: o.tipoDescuento,
          valorDescuento: String(o.valorDescuento),
          categorias: o.categorias || [],
          fechaInicio: o.fechaInicio ? o.fechaInicio.split('T')[0] : '',
          fechaFin: o.fechaFin ? o.fechaFin.split('T')[0] : '',
        }
      : { id: '', nombre: '', descripcion: '', tipoDescuento: 'porcentaje', valorDescuento: '', categorias: [], fechaInicio: '', fechaFin: '' }
    );
    setOfertaModalOpen(true);
  };

  const guardarOferta = async () => {
    if (!editOferta.nombre || !editOferta.valorDescuento || editOferta.categorias.length === 0) {
      alert('Completa el nombre, valor de descuento y selecciona al menos una categoría.'); return;
    }
    setGuardandoOferta(true);
    try {
      const body = {
        nombre: editOferta.nombre,
        descripcion: editOferta.descripcion || null,
        tipoDescuento: editOferta.tipoDescuento,
        valorDescuento: parseFloat(editOferta.valorDescuento),
        categorias: editOferta.categorias,
        activa: false,
        fechaInicio: editOferta.fechaInicio || null,
        fechaFin: editOferta.fechaFin || null,
        creadoPor: currentUser?.nombre || 'Admin',
      };
      if (editOferta.id) {
        await api.editarOferta(editOferta.id, body);
      } else {
        await api.crearOferta(body);
      }
      await fetchOfertas();
      await fetchProductos(); // Actualizar precios con oferta
      setOfertaModalOpen(false);
    } catch (err) {
      alert('Error guardando oferta: ' + err.message);
    } finally {
      setGuardandoOferta(false);
    }
  };

  const toggleOferta = async (id, activa) => {
    try {
      await api.activarOferta(id, activa);
      await fetchOfertas();
      await fetchProductos();
    } catch (err) {
      alert('Error al cambiar estado de oferta: ' + err.message);
    }
  };

  const eliminarOferta = async (id) => {
    if (window.confirm('¿Eliminar esta oferta permanentemente?')) {
      try {
        await api.eliminarOferta(id);
        await fetchOfertas();
        await fetchProductos();
      } catch (err) {
        alert('Error eliminando oferta: ' + err.message);
      }
    }
  };

  const toggleCategoriaOferta = (cat) => {
    setEditOferta(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat]
    }));
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

      {/* ── PANEL DE OFERTAS (solo Admin) ─────────────────── */}
      {isAdmin && (
        <div className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
          <div
            onClick={() => setOfertaTab(!ofertaTab)}
            className="w-full flex items-center justify-between p-4 md:p-5 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 shadow-sm">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-slate-800 text-sm uppercase tracking-tight">Ofertas por Temporada</h2>
                <p className="text-xs text-slate-500">
                  {ofertas.filter(o => o.activa).length} oferta{ofertas.filter(o => o.activa).length !== 1 ? 's' : ''} activa{ofertas.filter(o => o.activa).length !== 1 ? 's' : ''} · {ofertas.length} en total
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); abrirOfertaModal(); }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide flex items-center gap-1.5 shadow transition-all"
              >
                <PlusCircle className="w-4 h-4" /> Nueva Oferta
              </button>
              {ofertaTab ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {ofertaTab && (
            <div className="px-4 pb-4 md:px-5 md:pb-5 border-t border-amber-200/60">
              {ofertas.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium">
                  No hay ofertas creadas. Crea la primera con el botón "Nueva Oferta".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
                  {ofertas.map(o => (
                    <div key={o.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${o.activa ? 'border-amber-400 shadow-amber-100' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <h3 className="font-black text-slate-800 text-sm leading-tight truncate" title={o.nombre}>{o.nombre}</h3>
                          {o.descripcion && <p className="text-xs text-slate-400 mt-0.5 truncate">{o.descripcion}</p>}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${o.activa ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {o.activa ? '🟢 Activa' : '⚪ Inactiva'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                          {o.tipoDescuento === 'porcentaje' ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                          {o.tipoDescuento === 'porcentaje' ? `${o.valorDescuento}% desc.` : `S/ ${o.valorDescuento} desc.`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(o.categorias || []).map(c => (
                          <span key={c} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{c}</span>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => toggleOferta(o.id, !o.activa)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-black transition-all ${o.activa ? 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                        >
                          {o.activa ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {o.activa ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => abrirOfertaModal(o)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => eliminarOferta(o.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
          const esBarra = BARRA_CATEGORIAS.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-xs transition-colors flex items-center gap-2 ${
                categoriaActiva === cat
                  ? (esBarra ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white')
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat !== 'Todos' && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  categoriaActiva === cat 
                    ? 'bg-white' 
                    : (esBarra ? 'bg-blue-500' : 'bg-amber-500')
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
              const { Icon, color, bg, badge } = getCatStyle(p.categoria);
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
                        {BARRA_CATEGORIAS.includes(p.categoria) ? '🍹 Barra' : '🔥 Cocina'}
                      </span>
                    </div>
                  </div>
                  <div className="relative z-0">
                    <h3 className="font-black text-slate-800 text-sm leading-tight mb-2 line-clamp-2" title={p.nombre}>{p.nombre}</h3>
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
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center gap-2"><BookOpen className="w-5 h-5 text-amber-500" /> {editProd.id ? 'Editar Producto' : 'Registrar Producto'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nombre del Producto</label>
                <input type="text" value={editProd.nombre} onChange={e => setEditProd({ ...editProd, nombre: e.target.value })} placeholder="Ej. Ceviche Mixto Especial, Bife Angosto..." className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label>
                    {!creandoNuevaCat && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreandoNuevaCat(true);
                          setNuevaCatNombre('');
                        }}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline cursor-pointer"
                        title="Escribir una nueva categoría"
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> + Otra categoría
                      </button>
                    )}
                  </div>

                  {creandoNuevaCat ? (
                    <div className="flex gap-1.5 animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        value={nuevaCatNombre}
                        onChange={e => setNuevaCatNombre(e.target.value)}
                        placeholder="Ej: Chifa, Pastas, Cevichería..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (nuevaCatNombre.trim()) {
                              setEditProd({ ...editProd, categoria: nuevaCatNombre.trim() });
                            }
                            setCreandoNuevaCat(false);
                          }
                        }}
                        className="w-full border-2 border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none bg-white shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (nuevaCatNombre.trim()) {
                            setEditProd({ ...editProd, categoria: nuevaCatNombre.trim() });
                          }
                          setCreandoNuevaCat(false);
                        }}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreandoNuevaCat(false)}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select
                      value={editProd.categoria}
                      onChange={e => {
                        if (e.target.value === '__NUEVA__') {
                          setCreandoNuevaCat(true);
                          setNuevaCatNombre('');
                        } else {
                          setEditProd({ ...editProd, categoria: e.target.value });
                        }
                      }}
                      className="w-full border border-slate-200 focus:border-amber-500 rounded-xl px-4 py-2 text-sm focus:outline-none bg-white font-medium text-slate-800 transition-colors cursor-pointer"
                    >
                      {Array.from(new Set([...TODAS_CATEGORIAS, ...productos.map(p => p.categoria).filter(Boolean), ...categoriasExtra])).filter(c => {
                         if (c === 'PedidosYa / Ofertas') return hasCajaAccess;
                         return Boolean(c);
                       }).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__NUEVA__">➕ Crear otra categoría...</option>
                    </select>
                  )}

                  {/* Indicador visual por color de área de despacho (Cocina vs Barra) */}
                  {(() => {
                    const catActual = editProd.categoria;
                    const esBarra = BARRA_CATEGORIAS.includes(catActual);
                    return esBarra ? (
                      <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs shadow-2xs animate-in fade-in duration-150">
                        <span className="flex items-center gap-2 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 shadow-xs"></span>
                          <span>Destino de comanda: <strong className="text-blue-950 font-black uppercase">Barra</strong></span>
                        </span>
                        <span className="text-[10px] font-black text-blue-750 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Monitor de Barra
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs shadow-2xs animate-in fade-in duration-150">
                        <span className="flex items-center gap-2 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 shadow-xs"></span>
                          <span>Destino de comanda: <strong className="text-amber-950 font-black uppercase">Cocina</strong></span>
                        </span>
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Monitor de Cocina
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Precio (S/)</label>
                  <input type="number" value={editProd.precio} onChange={e => setEditProd({ ...editProd, precio: e.target.value })} placeholder="0.00" step="0.50" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-mono" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-600 font-bold">Control de Stock</span>
                  <select value={editProd.tipoStock} onChange={e => setEditProd({ ...editProd, tipoStock: e.target.value, stock: e.target.value === 'ilimitado' ? '' : (editProd.stock || '') })} className="border border-slate-300 rounded-lg text-sm p-1 bg-white focus:outline-none">
                    <option value="ilimitado">Ilimitado</option>
                    <option value="limitado">Limitado</option>
                  </select>
                </div>
                {editProd.tipoStock === 'limitado' && (
                  <div className="mt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cantidad Disponible</label>
                    <input type="number" min="0" value={editProd.stock} onChange={e => setEditProd({ ...editProd, stock: e.target.value })} placeholder="Ej: 50" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-mono" />
                  </div>
                )}
              </div>

              {/* SECCIÓN CONFIGURACIÓN DE GUARNICIONES / ENTRADAS / OPCIONES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <span className="text-sm text-slate-800 font-black flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-500" />
                      Acompañamientos y Opciones al Comandar
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      ¿Este plato le pide al mozo elegir algo al comandar? (Ej: Entrada, Guarnición, Término)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nuevoEstado = !editProd.tieneOpciones;
                      setEditProd(prev => ({
                        ...prev,
                        tieneOpciones: nuevoEstado,
                        opcionesConfig: nuevoEstado && (!prev.opcionesConfig || prev.opcionesConfig.length === 0)
                          ? [{ name: "Elige Acompañamiento", options: "Papas Fritas, Arroz, Ensalada, Sin Acompañamiento" }]
                          : prev.opcionesConfig
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                      editProd.tieneOpciones
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {editProd.tieneOpciones ? 'Activado' : 'Desactivado (Directo)'}
                  </button>
                </div>

                {!editProd.tieneOpciones ? (
                  <div className="p-3 bg-white/70 rounded-lg border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-500">
                      ⚡ <strong>Comanda Directa:</strong> Al tocar este plato en el Salón, se agregará en 1 clic sin ventanas emergentes. Ideal para ceviches, platos individuales, bebidas y postres.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    {/* Plantillas Rápidas */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                        Cargar Plantilla Rápida (1 Clic):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => aplicarPlantillaOpciones('menu')}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-slate-700 font-medium transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          📋 Menú (Entrada + Bebida)
                        </button>
                        <button
                          type="button"
                          onClick={() => aplicarPlantillaOpciones('parrilla')}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-slate-700 font-medium transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          🥩 Parrilla (Guarnición + Término)
                        </button>
                        <button
                          type="button"
                          onClick={() => aplicarPlantillaOpciones('marino')}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-slate-700 font-medium transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          🐟 Marino (Picante + Guarnición)
                        </button>
                        <button
                          type="button"
                          onClick={() => aplicarPlantillaOpciones('combo')}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-slate-700 font-medium transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          🍔 Combo (Guarnición + Bebida + Salsas)
                        </button>
                      </div>
                    </div>

                    {/* Lista de Pasos */}
                    <div className="space-y-2">
                      {(editProd.opcionesConfig || []).map((paso, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 relative shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                                Paso {idx + 1}: Pregunta al Mozo
                              </label>
                              <input
                                type="text"
                                value={paso.name}
                                onChange={e => actualizarPasoOpcion(idx, 'name', e.target.value)}
                                placeholder="Ej: Elige la Entrada, Guarnición, Término..."
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => eliminarPasoOpcion(idx)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors mt-3"
                              title="Eliminar este paso"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-0.5">
                              Opciones a elegir (separadas por coma)
                            </label>
                            <input
                              type="text"
                              value={paso.options}
                              onChange={e => actualizarPasoOpcion(idx, 'options', e.target.value)}
                              placeholder="Ej: Sopa del Día, Ensalada Fresca, Papa Huancaína, Sin Entrada"
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={agregarPasoOpcion}
                        className="w-full py-2 border border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/50 rounded-xl text-xs font-bold text-slate-600 hover:text-amber-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Agregar otro paso de opciones
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-1">
                {BARRA_CATEGORIAS.includes(editProd.categoria) ? '🍹 Este producto irá a la pantalla de BARRA' : '🔥 Este producto irá a la pantalla de COCINA'}
              </p>
            </div>
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              <button onClick={guardarProducto} disabled={guardando} className="px-5 py-2 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL OFERTA ────────────────────────────────── */}
      {ofertaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center gap-2"><Tag className="w-5 h-5 text-amber-500" /> {editOferta.id ? 'Editar Oferta' : 'Nueva Oferta de Temporada'}</h3>
              <button onClick={() => setOfertaModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nombre de la Oferta</label>
                <input type="text" value={editOferta.nombre} onChange={e => setEditOferta({ ...editOferta, nombre: e.target.value })} placeholder="Ej. Día del Maestro - 20% en Bebidas" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Descripción (opcional)</label>
                <input type="text" value={editOferta.descripcion} onChange={e => setEditOferta({ ...editOferta, descripcion: e.target.value })} placeholder="Ej. Válida todo el día del 6 de junio" className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tipo de Descuento</label>
                  <select value={editOferta.tipoDescuento} onChange={e => setEditOferta({ ...editOferta, tipoDescuento: e.target.value })} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white">
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto_fijo">Monto Fijo (S/)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {editOferta.tipoDescuento === 'porcentaje' ? 'Porcentaje (%)' : 'Descuento (S/)'}
                  </label>
                  <input type="number" min="0" step="0.5" value={editOferta.valorDescuento} onChange={e => setEditOferta({ ...editOferta, valorDescuento: e.target.value })} placeholder={editOferta.tipoDescuento === 'porcentaje' ? '20' : '5.00'} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Fecha inicio (opcional)</label>
                  <input type="date" value={editOferta.fechaInicio} onChange={e => setEditOferta({ ...editOferta, fechaInicio: e.target.value })} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Fecha fin (opcional)</label>
                  <input type="date" value={editOferta.fechaFin} onChange={e => setEditOferta({ ...editOferta, fechaFin: e.target.value })} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Categorías con Descuento</label>
                <div className="grid grid-cols-2 gap-2">
                  {TODAS_CATEGORIAS.map(cat => (
                    <label key={cat} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all text-xs font-bold ${editOferta.categorias.includes(cat) ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={editOferta.categorias.includes(cat)} onChange={() => toggleCategoriaOferta(cat)} className="accent-amber-500" />
                      {cat} {BARRA_CATEGORIAS.includes(cat) ? '🍹' : '🔥'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setOfertaModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={guardarOferta} disabled={guardandoOferta} className="px-5 py-2 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">
                {guardandoOferta ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                Guardar Oferta
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
