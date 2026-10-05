import React from 'react';
import { 
  Edit3, Link2, User, X, Utensils, Receipt, Search, List, LayoutGrid, Flame, 
  Tag, Plus, Minus, PlusCircle, ChevronRight, ShoppingBag, Trash, AlertTriangle, 
  Lock, ChefHat 
} from 'lucide-react';

/**
 * ModalPedidoMesa: Modal interactivo principal para toma de pedidos en salón por mesa.
 * Incluye catálogo de productos, modo tarjetas/compacto, filtro por categorías y gestión de comanda activa.
 */
export default function ModalPedidoMesa({
  abierto,
  mesa,
  currentUser,
  meseroGlobal,
  cerrarTecladoSiTocaFuera,
  onCerrar,
  onAbrirUnion,
  mobileTab,
  setMobileTab,
  menuFiltrado,
  ticketActual,
  totalTicket,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  modoVista,
  toggleModoVista,
  categoriaActiva,
  setCategoriaActiva,
  categoriasBarra,
  categoriasOrdenadas,
  categoriasVisiblesCount = 8,
  onAbrirCategoriasModal,
  agregarAlTicket,
  alterarCantidad,
  badgeEstado,
  badgeTexto,
  productos = [],
  requestSupervisorAuth,
  handleCancelarItem,
  setTicketActual,
  api,
  aviso,
  setSupervisorAprobador,
  setEsReclamo,
  setCancelModal,
  setPrecuentaMesa,
  confirmar,
  enviarACocina,
  enviando
}) {
  if (!abierto || !mesa) return null;

  return (
    <div onPointerDown={cerrarTecladoSiTocaFuera} className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[90vh] max-w-6xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Cabecera del modal */}
        <div className="p-3 md:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500 rounded-lg md:rounded-xl flex items-center justify-center text-slate-900">
              <Edit3 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm md:text-lg uppercase tracking-tight leading-none">
                Mesa <span className="text-amber-400 text-lg md:text-xl">{mesa.num}</span>
              </h2>
              <p className="text-[10px] md:text-xs text-slate-400">Punto de Venta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onAbrirUnion}
              className="flex items-center gap-1.5 bg-cyan-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-[10px] md:text-xs px-3 py-2 rounded-xl shadow-md transition-all uppercase tracking-wider"
            >
              <Link2 className="w-3.5 h-3.5" />
              Unir Mesa
            </button>
            <div className="hidden md:flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-350 text-xs font-bold font-mono">
              <User className="w-3.5 h-3.5 text-cyan-500" />
              <span>MOZO: <strong className="text-white uppercase">{currentUser?.nombre || meseroGlobal}</strong></span>
            </div>
            <button onClick={onCerrar} className="bg-slate-800 hover:bg-red-500 text-slate-300 hover:text-white p-2 md:p-2.5 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas de alternancia rápida solo en móviles */}
        <div className="md:hidden flex bg-slate-200 p-1 rounded-2xl mx-3 mt-2 mb-1 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('menu')}
            className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'menu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Carta ({menuFiltrado.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('ticket')}
            className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'ticket' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Comanda ({ticketActual.reduce((acc, item) => acc + item.cant, 0)}) · S/ {totalTicket.toFixed(2)}
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-slate-50">
          {/* Panel Izquierdo: Carta y Productos */}
          <div className={`w-full md:w-3/5 flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-200 ${mobileTab === 'menu' ? 'flex flex-1' : 'hidden md:flex'}`}>
            <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2.5 shrink-0 z-10 shadow-sm">
              {/* Buscador de platos y selector de vista */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    inputMode="search"
                    enterKeyHint="search"
                    placeholder="Buscar por nombre (ej: pollo, 1/4, parri)..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 focus:bg-white font-medium text-slate-800"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleModoVista}
                  title={modoVista === 'tarjetas' ? 'Cambiar a Lista Compacta (Modo Rápido Mozo)' : 'Cambiar a Modo Tarjetas'}
                  className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-black uppercase transition-all shrink-0 active:scale-95 shadow-xs ${
                    modoVista === 'compacto' 
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {modoVista === 'tarjetas' ? (
                    <>
                      <List className="w-4 h-4 text-slate-600" />
                      <span className="hidden sm:inline">Compacto</span>
                    </>
                  ) : (
                    <>
                      <LayoutGrid className="w-4 h-4 text-slate-950" />
                      <span className="hidden sm:inline">Tarjetas</span>
                    </>
                  )}
                </button>
              </div>

              {/* Categorías: barra rápida + botón para ver todas */}
              <div className="flex flex-wrap gap-1.5">
                {categoriasBarra.map(cat => {
                  const isMasPedidos = cat === '🔥 Más Pedidos';
                  return (
                    <button 
                      key={cat} 
                      type="button"
                      onClick={() => setCategoriaActiva(cat)} 
                      className={`max-w-[11rem] px-3 py-2 rounded-xl text-xs font-black uppercase shadow-xs transition-all flex items-center gap-1.5 ${
                        categoriaActiva === cat 
                          ? (isMasPedidos ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-white shadow-md') 
                          : (isMasPedidos ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50')
                      }`}
                    >
                      {isMasPedidos && <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
                {categoriasOrdenadas.length > categoriasVisiblesCount && (
                  <button
                    type="button"
                    onClick={onAbrirCategoriasModal}
                    className="px-3 py-2 rounded-xl text-xs font-black uppercase shadow-xs transition-all flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 text-cyan-800 hover:bg-cyan-100 active:scale-95"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                    Ver todas ({categoriasOrdenadas.length - 2})
                  </button>
                )}
              </div>
            </div>

            {/* Listado / Cuadrícula de platos */}
            <div className={`p-3 overflow-y-auto custom-scrollbar content-start flex-1 ${
              modoVista === 'compacto' 
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' 
                : 'grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4'
            }`}>
              {menuFiltrado.map(prod => {
                const isGroup = prod.esAgrupado;
                const cantEnTicket = isGroup 
                  ? 0 
                  : ticketActual.filter(t => String(t.id) === String(prod.id) && !t.yaEnviado).reduce((sum, item) => sum + item.cant, 0);
                const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
                const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;
                
                if (modoVista === 'compacto') {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => !agotado && agregarAlTicket(prod)}
                      className={`bg-white border rounded-xl p-2.5 flex items-center justify-between shadow-xs relative transition-all ${
                        agotado
                          ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50'
                          : cantEnTicket > 0
                            ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/40 cursor-pointer shadow-sm'
                            : 'cursor-pointer hover:border-amber-300 hover:bg-amber-50/20 active:bg-slate-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 text-xs uppercase truncate">{prod.nombre}</p>
                          {cantEnTicket > 0 && (
                            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-md shadow-xs">
                              x{cantEnTicket}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isGroup && (
                            <span className="text-[9px] font-black px-1 rounded bg-amber-100 text-amber-700">VARIANTES</span>
                          )}
                          {prod.tipoStock === 'limitado' && !isGroup && (
                            <span className={`text-[9px] font-bold px-1 rounded ${agotado ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                              {agotado ? 'AGOTADO' : `STK: ${stockDisponible}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                          S/ {isGroup ? prod.precioMin.toFixed(2) : (prod.precioOferta ?? prod.precio).toFixed(2)}
                        </span>
                        {cantEnTicket > 0 && !isGroup ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                                if (idx >= 0) alterarCantidad(idx, '-');
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={agotado}
                              onClick={() => !agotado && agregarAlTicket(prod)}
                              className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={agotado}
                            className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center font-black shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={prod.id} 
                    onClick={() => !agotado && agregarAlTicket(prod)} 
                    className={`bg-white border rounded-xl p-3 md:p-4 flex flex-col justify-between shadow-sm relative overflow-hidden h-28 md:h-32 transition-all ${
                      agotado 
                        ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50' 
                        : cantEnTicket > 0
                          ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/20 cursor-pointer shadow-md'
                          : 'cursor-pointer hover:border-amber-300 hover:-translate-y-0.5 active:bg-slate-50'
                    }`}
                  >
                    {prod.precioOferta !== null && prod.precioOferta !== undefined && !agotado && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1 animate-pulse z-15">
                        <Tag className="w-2.5 h-2.5" />
                        {prod.ofertaValor}% OFF
                      </div>
                    )}
                    {cantEnTicket > 0 && !agotado && (
                      <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 z-20">
                        <span>x{cantEnTicket}</span>
                      </div>
                    )}
                    <div className="z-10 flex flex-col justify-between h-full w-full">
                      <div>
                        <p className="font-bold text-slate-800 text-[10px] md:text-xs uppercase leading-tight pr-8">{prod.nombre}</p>
                        {isGroup && (
                          <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 bg-amber-100 text-amber-700">
                            OPCIONES DE CARNE
                          </span>
                        )}
                        {prod.tipoStock === 'limitado' && !isGroup && (
                          <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 ${
                            agotado ? 'bg-red-100 text-red-650' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {agotado ? 'AGOTADO' : `STOCK: ${stockDisponible}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        {isGroup ? (
                          <p className="font-black font-mono text-emerald-600 text-xs md:text-sm">
                            Desde S/ {prod.precioMin.toFixed(2)}
                          </p>
                        ) : prod.precioOferta !== null && prod.precioOferta !== undefined ? (
                          <div className="flex flex-col items-start leading-none -mt-1">
                            <span className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precioOferta.toFixed(2)}</span>
                            <span className="line-through text-slate-400 font-semibold text-[10px] md:text-xs mt-0.5">S/ {prod.precio.toFixed(2)}</span>
                          </div>
                        ) : (
                          <p className="font-black font-mono text-emerald-600 text-sm md:text-base">S/ {prod.precio.toFixed(2)}</p>
                        )}

                        {cantEnTicket > 0 && !isGroup && (
                          <div className="flex items-center gap-1 z-20" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                const idx = ticketActual.findIndex(t => String(t.id) === String(prod.id) && !t.yaEnviado);
                                if (idx >= 0) alterarCantidad(idx, '-');
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center font-black active:scale-95 shadow-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-black text-xs text-slate-900 w-4 text-center">{cantEnTicket}</span>
                            <button
                              type="button"
                              disabled={agotado}
                              onClick={() => !agotado && agregarAlTicket(prod)}
                              className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-black active:scale-95 shadow-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <PlusCircle className="absolute bottom-[-10px] right-[-10px] w-12 h-12 text-slate-100 opacity-50 pointer-events-none" />
                  </div>
                );
              })}
            </div>

            {/* Barra rápida de acceso a comanda en móvil */}
            {ticketActual.length > 0 && (
              <div className="md:hidden p-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-lg border-t border-slate-800">
                <div className="flex items-center gap-2 pl-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black">
                    {ticketActual.reduce((acc, item) => acc + item.cant, 0)} ítem(s) · S/ {totalTicket.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('ticket')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow active:scale-95"
                >
                  Ver Comanda
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Panel Derecho: Comanda de la Mesa */}
          <div className={`w-full md:w-2/5 bg-white flex-col min-h-0 ${mobileTab === 'ticket' ? 'flex flex-1' : 'hidden md:flex'}`}>
            <div className="p-3 md:p-4 border-b border-slate-100 bg-amber-50 shrink-0 flex justify-between items-center">
              <h3 className="font-black text-amber-800 uppercase text-xs flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Pedido Actual
              </h3>
              <div className="flex items-center gap-1.5">
                {mesa?.pedidoData?.estadoEnsalada === 'Pendiente' && (
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded uppercase animate-pulse">🥗 Ens: Pend.</span>
                )}
                {mesa?.pedidoData?.estadoEnsalada === 'Listo' && (
                  <span className="text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded uppercase">🥗 Ens: Listo</span>
                )}
                <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-slate-200 uppercase ${badgeEstado} ${mesa?.estado === 'Servido' ? 'animate-pulse' : ''}`}>
                  {badgeTexto}
                </span>
              </div>
            </div>

            {/* Lista de ítems en el ticket */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-slate-50/50">
              <ul className="space-y-2 md:space-y-3">
                {ticketActual.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 opacity-50">
                    <ShoppingBag className="w-8 h-8 mb-2" />
                    <p className="text-center text-slate-500 font-bold text-xs">Aún no hay productos en la mesa.</p>
                  </div>
                ) : (
                  ticketActual.map((item, idx) => {
                    const sub = item.cant * item.precio;
                    if (item.yaEnviado) {
                      const esCancelable = item.pedidoId === mesa.pedidoData?.pedidoId;
                      return (
                        <li key={idx} className="bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-xl flex flex-col gap-1.5 opacity-60 grayscale">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 pr-2">
                              <p className={`font-bold text-[10px] md:text-xs leading-tight ${item.historial ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {item.nombre}
                              </p>
                              {(() => {
                                const prodOriginal = productos.find(p => String(p.id) === String(item.id));
                                const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                                return (
                                  <div className="flex items-baseline gap-1.5 mt-1">
                                    {tieneDescuento && (
                                      <span className="line-through text-slate-400 font-semibold text-[10px]">S/ {(item.cant * prodOriginal.precio).toFixed(2)}</span>
                                    )}
                                    <span className="font-mono text-slate-400 font-bold text-xs md:text-sm">S/ {sub.toFixed(2)}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-black text-slate-400 text-sm px-3">
                                {item.cant} <span className="text-[10px]">{item.historial ? '✔ Ready' : '⏳ Pendiente'}</span>
                              </div>
                              {esCancelable && (
                                <button 
                                  onClick={() => {
                                    if (mesa.estado === 'Servido' || item.historial) {
                                      requestSupervisorAuth(`Anular "${item.nombre}"`, (supervisor) => handleCancelarItem(item, supervisor));
                                    } else {
                                      handleCancelarItem(item, null);
                                    }
                                  }} 
                                  title="Anular o reducir cantidad de este producto"
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg hover:text-red-700 transition-colors pointer-events-auto shrink-0"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">📋 NOTA:</span>
                            <input 
                              type="text" 
                              placeholder="Especificaciones (ej: Coca Cola helada)..." 
                              value={item.notas || ''} 
                              onChange={(e) => {
                                let nuevos = [...ticketActual];
                                nuevos[idx].notas = e.target.value;
                                setTicketActual(nuevos);
                              }}
                              onBlur={async (e) => {
                                if (item.itemId) {
                                  try {
                                    await api.updateItemNotas(item.itemId, e.target.value);
                                  } catch (err) {
                                    console.error("Error al actualizar nota:", err);
                                  }
                                }
                              }}
                              className="flex-1 bg-white border border-slate-250 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white"
                            />
                          </div>
                        </li>
                      );
                    }
                    return (
                      <li key={idx} className="bg-white border border-slate-200 p-2.5 md:p-3 rounded-xl flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-slate-800 text-[10px] md:text-xs leading-tight">{item.nombre}</p>
                            {(() => {
                              const prodOriginal = productos.find(p => String(p.id) === String(item.id));
                              const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                              return (
                                <div className="flex items-baseline gap-1.5 mt-1">
                                  {tieneDescuento && (
                                    <span className="line-through text-slate-400 font-semibold text-[10px]">S/ {(item.cant * prodOriginal.precio).toFixed(2)}</span>
                                  )}
                                  <span className="font-mono text-emerald-600 font-bold text-xs md:text-sm">S/ {sub.toFixed(2)}</span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1 md:gap-2 bg-slate-100 rounded-lg p-1 shrink-0 border border-slate-200">
                            <button onClick={() => alterarCantidad(idx, '-')} className="w-8 h-8 md:w-7 md:h-7 bg-white rounded-md shadow-sm text-slate-600 font-black text-lg leading-none">-</button>
                            <span className="font-bold text-slate-900 w-5 text-center text-sm">{item.cant}</span>
                            <button onClick={() => alterarCantidad(idx, '+')} className="w-8 h-8 md:w-7 md:h-7 bg-white rounded-md shadow-sm text-slate-600 font-black text-lg leading-none">+</button>
                          </div>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Especificaciones (ej: sin cebolla)..." 
                          value={item.notas || ''} 
                          onChange={(e) => {
                            let nuevos = [...ticketActual];
                            nuevos[idx].notas = e.target.value;
                            setTicketActual(nuevos);
                          }}
                          className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white"
                        />
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Footer de totales y acciones de la mesa */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-end mb-3 md:mb-4 px-2">
                <span className="font-bold text-slate-400 uppercase text-[10px] md:text-xs tracking-widest">Total Mesa</span>
                <span className="font-black font-mono text-2xl md:text-3xl text-slate-900 leading-none">S/ {totalTicket.toFixed(2)}</span>
              </div>

              {/* Botón cancelar pedido */}
              {mesa?.pedidoData && (
                <div className="mb-3">
                  {mesa.estado === 'Cocina' ? (
                    <button
                      onClick={() => {
                        const algunItemPreparado = ticketActual.some(i => i.yaEnviado && i.historial && i.pedidoId === mesa.pedidoData?.pedidoId);
                        if (algunItemPreparado) {
                          aviso.advertencia("No puedes cancelar normalmente porque algunos platos ya han sido preparados. Usa 'Anulación Especial (Reclamo)'.");
                          return;
                        }
                        setSupervisorAprobador(null);
                        setEsReclamo(false);
                        setCancelModal(true);
                      }}
                      className="w-full py-2.5 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Cancelar Pedido
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        requestSupervisorAuth("Autorizar Anulación Especial / Reclamo", (supervisor) => {
                          setSupervisorAprobador(supervisor);
                          setEsReclamo(true);
                          setCancelModal(true);
                        });
                      }}
                      className="w-full py-2.5 bg-rose-900/10 hover:bg-rose-900/20 text-rose-700 border border-rose-350 border-dashed font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Anulación Especial (Reclamo)
                    </button>
                  )}
                </div>
              )}

              {mesa?.pedidoData && (
                <button
                  type="button"
                  onClick={() => setPrecuentaMesa(mesa)}
                  className="w-full mb-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] md:text-xs tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Imprimir Precuenta
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {ticketActual.some(i => !i.yaEnviado) ? (
                  <button 
                    onClick={async () => {
                      const ok = await confirmar({
                        titulo: 'Descartar Cambios',
                        mensaje: '¿Estás seguro de salir? Se descartarán los platos nuevos que aún no has enviado a la cocina.',
                        textoConfirmar: 'Salir sin guardar',
                        peligro: true
                      });
                      if (ok) onCerrar();
                    }} 
                    className="py-3.5 md:py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs md:text-sm uppercase tracking-wide transition-colors cursor-pointer"
                  >
                    ❌ Descartar y Salir
                  </button>
                ) : (
                  <button 
                    onClick={onCerrar} 
                    className="py-3.5 md:py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs md:text-sm uppercase tracking-wide transition-colors"
                  >
                    Cerrar Ventana
                  </button>
                )}
                <button 
                  onClick={enviarACocina} 
                  disabled={enviando} 
                  className="py-3.5 md:py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase tracking-tight rounded-xl text-xs md:text-sm transition-colors shadow-lg shadow-amber-500/30 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {enviando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <ChefHat className="w-4 h-4 md:w-5 md:h-5" />}
                  A Cocina
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
