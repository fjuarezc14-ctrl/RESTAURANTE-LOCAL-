import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X, Search, List, LayoutGrid, Flame, Receipt, ChefHat, SlidersHorizontal } from 'lucide-react';
import { Dialog } from '../../../components/ui';
import { ListaPlatosMesa } from '../componentes/ListaPlatosMesa';
import { ComandaMesa } from '../componentes/ComandaMesa';
import { MenuAccionesMesa } from '../componentes/MenuAccionesMesa';

const MAS_PEDIDOS = '🔥 Más Pedidos';
const CIERRA_CON_PX = 110; // arrastrar la hoja del pedido más que esto hacia abajo la cierra
const CIERRA_CON_VELOCIDAD = 0.6; // o un deslizamiento rápido (px por ms)
const esCelular = () => window.matchMedia('(max-width: 767px)').matches;

/**
 * ModalPedidoMesa: toma de pedidos de una mesa.
 * En el celular del mozo ocupa toda la pantalla: arriba la carta, abajo una barra con el pedido y el botón de enviar;
 * la comanda sube como una hoja. En pantallas grandes, carta y comanda van lado a lado.
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
  // Hoja del pedido: se cierra deslizándola hacia abajo
  const [arrastre, setArrastre] = useState(0);
  const gestoRef = useRef(null);

  // Mientras el modal está abierto, deslizar hacia abajo no recarga la página ("jalar para actualizar" del navegador)
  useEffect(() => {
    if (!abierto) return undefined;
    const elementos = [document.documentElement, document.body];
    const antes = elementos.map((el) => el.style.overscrollBehaviorY);
    elementos.forEach((el) => { el.style.overscrollBehaviorY = 'none'; });
    return () => elementos.forEach((el, i) => { el.style.overscrollBehaviorY = antes[i]; });
  }, [abierto]);

  if (!abierto || !mesa) return null;

  // Solo se arrastra si la lista está arriba del todo (si no, el dedo está desplazando la lista)
  const alTocar = (e) => {
    if (!esCelular()) return;
    const lista = e.target.closest('[data-desplazable]');
    gestoRef.current = lista && lista.scrollTop > 0 ? null : { y: e.touches[0].clientY, t: Date.now(), dy: 0 };
  };
  const alMover = (e) => {
    const gesto = gestoRef.current;
    if (!gesto) return;
    const dy = e.touches[0].clientY - gesto.y;
    if (dy < -8) { gestoRef.current = null; setArrastre(0); return; } // sube: está desplazando la lista
    gesto.dy = Math.max(0, dy);
    setArrastre(gesto.dy);
  };
  const alSoltar = () => {
    const gesto = gestoRef.current;
    gestoRef.current = null;
    if (gesto && (gesto.dy > CIERRA_CON_PX || gesto.dy / Math.max(1, Date.now() - gesto.t) > CIERRA_CON_VELOCIDAD)) {
      setMobileTab('menu');
    }
    setArrastre(0);
  };

  const cantNuevos = ticketActual.filter((i) => !i.yaEnviado).reduce((s, i) => s + i.cant, 0);
  const cantTotal = ticketActual.reduce((s, i) => s + i.cant, 0);
  const verComanda = mobileTab === 'ticket';

  // Salir con platos sin enviar pide confirmación (antes la X de arriba los descartaba sin avisar)
  const salir = async () => {
    if (enviando) return;
    if (cantNuevos > 0) {
      const ok = await confirmar({
        titulo: '¿Salir sin enviar?',
        mensaje: `Tienes ${cantNuevos} ${cantNuevos === 1 ? 'plato' : 'platos'} sin enviar a cocina. Si sales, se descartan.`,
        botonConfirmar: 'Salir y descartar',
        peligro: true,
      });
      if (!ok) return;
    }
    onCerrar();
  };

  const anularPedido = () => {
    const algunItemPreparado = ticketActual.some((i) => i.yaEnviado && i.historial && i.pedidoId === mesa.pedidoData?.pedidoId);
    if (algunItemPreparado) {
      aviso.advertencia("No puedes cancelar normalmente porque algunos platos ya han sido preparados. Usa 'Anulación especial (reclamo)'.");
      return;
    }
    setSupervisorAprobador(null);
    setEsReclamo(false);
    setCancelModal(true);
  };
  const reclamo = () => {
    requestSupervisorAuth('Autorizar anulación especial / reclamo', (supervisor) => {
      setSupervisorAprobador(supervisor);
      setEsReclamo(true);
      setCancelModal(true);
    });
  };

  // En el celular: Más pedidos, Todos y la categoría elegida; el resto, en "Categorías"
  const chipsCelular = [...new Set([MAS_PEDIDOS, 'Todos', categoriaActiva])].filter((c) => categoriasOrdenadas.includes(c) || c === categoriaActiva);
  const hayMasCategorias = categoriasOrdenadas.length > categoriasVisiblesCount;

  const chip = (cat, extra = '') => {
    const activa = categoriaActiva === cat;
    const esMasPedidos = cat === MAS_PEDIDOS;
    return (
      <button
        key={cat}
        type="button"
        onClick={() => setCategoriaActiva(cat)}
        className={`h-9 max-w-[11rem] px-3 rounded-xl text-[13px] font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-colors cursor-pointer ${extra} ${
          activa
            ? (esMasPedidos ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white')
            : (esMasPedidos ? 'bg-amber-100 text-amber-900' : 'bg-white border border-slate-200 text-slate-700')
        }`}
      >
        {esMasPedidos && <Flame className="w-4 h-4 shrink-0" />}
        <span className="truncate">{esMasPedidos ? 'Más pedidos' : cat}</span>
      </button>
    );
  };

  return (
    <Dialog
      open
      onClose={salir}
      closeOnBackdrop={false}
      onPointerDown={cerrarTecladoSiTocaFuera}
      capa="z-[100]"
      className="bg-white w-full h-[100dvh] max-h-[100dvh] rounded-t-none sm:h-[92vh] sm:max-h-[92vh] sm:rounded-3xl max-w-6xl shadow-2xl"
    >
      {/* Cabecera: salir, mesa y mozo, y el menú con las demás acciones */}
      <header className="shrink-0 bg-slate-900 text-white px-2 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={salir}
          aria-label="Salir de la mesa"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 active:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 sm:hidden" />
          <X className="w-6 h-6 hidden sm:block" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-lg leading-tight">
            Mesa <span className="text-amber-400">{mesa.num}</span>
          </h2>
          <p className="text-xs text-slate-400 truncate">
            Mozo: <span className="text-slate-200 font-bold">{currentUser?.nombre || meseroGlobal}</span>
          </p>
        </div>
        <MenuAccionesMesa
          mesa={mesa}
          onUnir={onAbrirUnion}
          onPrecuenta={() => setPrecuentaMesa(mesa)}
          onAnular={anularPedido}
          onReclamo={reclamo}
        />
      </header>

      <div className="flex flex-1 min-h-0 bg-slate-50">
        {/* Carta */}
        <div className="flex-1 md:w-3/5 md:flex-none flex flex-col min-h-0 relative md:border-r md:border-slate-200">
          <div className="shrink-0 bg-white border-b border-slate-200 px-3 pt-3 pb-2.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  placeholder="Buscar plato…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-slate-100 border border-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Borrar búsqueda"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 active:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={toggleModoVista}
                aria-label={modoVista === 'tarjetas' ? 'Ver como lista' : 'Ver como tarjetas'}
                title={modoVista === 'tarjetas' ? 'Ver como lista' : 'Ver como tarjetas'}
                className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 cursor-pointer"
              >
                {modoVista === 'tarjetas' ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              </button>
            </div>

            {/* Categorías: pocas a la vista y el resto en "Categorías" (deslizar una barra era incómodo en el celular) */}
            <div className="flex flex-wrap gap-2 md:hidden">
              {chipsCelular.map((c) => chip(c))}
              {hayMasCategorias && (
                <button
                  type="button"
                  onClick={onAbrirCategoriasModal}
                  className="h-9 px-3 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 text-cyan-900 active:scale-95 cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Categorías
                </button>
              )}
            </div>
            <div className="hidden md:flex flex-wrap gap-2">
              {categoriasBarra.map((c) => chip(c))}
              {hayMasCategorias && (
                <button
                  type="button"
                  onClick={onAbrirCategoriasModal}
                  className="h-9 px-3 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 text-cyan-900 active:scale-95 cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4" /> Ver todas ({categoriasOrdenadas.length - 2})
                </button>
              )}
            </div>
          </div>

          <ListaPlatosMesa
            agregarAlTicket={agregarAlTicket}
            alterarCantidad={alterarCantidad}
            menuFiltrado={menuFiltrado}
            modoVista={modoVista}
            ticketActual={ticketActual}
            hayBusqueda={Boolean(searchQuery.trim())}
          />

          {/* Barra inferior del celular: ver el pedido y enviarlo sin salir de la carta */}
          {cantTotal > 0 && (
            <div className="md:hidden absolute inset-x-0 bottom-0 z-20 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-50 via-slate-50 to-slate-50/0">
              <div className="flex items-stretch gap-2 rounded-2xl bg-slate-900 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setMobileTab('ticket')}
                  className="flex-1 min-w-0 h-12 px-2 rounded-xl flex items-center gap-2.5 text-left active:bg-slate-800 cursor-pointer"
                >
                  <span className="relative w-10 h-10 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-amber-400" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center">{cantTotal}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-white font-bold text-sm leading-tight">Ver pedido</span>
                    <span className="block text-amber-400 font-mono font-black text-sm leading-tight">S/ {totalTicket.toFixed(2)}</span>
                  </span>
                </button>
                {cantNuevos > 0 && (
                  <button
                    type="button"
                    onClick={enviarACocina}
                    disabled={enviando}
                    className="h-12 px-4 rounded-xl bg-amber-500 text-slate-950 font-black text-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {enviando
                      ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                      : <ChefHat className="w-5 h-5" />}
                    Enviar {cantNuevos}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fondo oscuro detrás de la hoja del pedido (celular) */}
        {verComanda && (
          <div onClick={() => setMobileTab('menu')} className="md:hidden fixed inset-0 z-30 bg-slate-950/50 animate-fade-in" />
        )}

        {/* Comanda: hoja que sube en el celular; columna derecha en pantallas grandes */}
        <div
          onTouchStart={alTocar}
          onTouchMove={alMover}
          onTouchEnd={alSoltar}
          onTouchCancel={alSoltar}
          style={arrastre > 0 ? { transform: `translateY(${arrastre}px)`, transition: 'none' } : undefined}
          className={`fixed inset-x-0 bottom-0 top-[6dvh] z-40 rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out
          md:static md:z-auto md:w-2/5 md:rounded-none md:shadow-none md:translate-y-0 ${verComanda ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <ComandaMesa
            mesa={mesa}
            ticketActual={ticketActual}
            setTicketActual={setTicketActual}
            totalTicket={totalTicket}
            productos={productos}
            alterarCantidad={alterarCantidad}
            requestSupervisorAuth={requestSupervisorAuth}
            handleCancelarItem={handleCancelarItem}
            api={api}
            badgeTexto={badgeTexto}
            badgeEstado={badgeEstado}
            enviarACocina={enviarACocina}
            enviando={enviando}
            onVolverALaCarta={() => setMobileTab('menu')}
          />
        </div>
      </div>
    </Dialog>
  );
}
