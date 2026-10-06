import {
  X,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Gift,
  Lock,
  ChevronDown,
  ChevronRight,
  Search,
  Layers,
  ShoppingBag,
  Bike,
  Truck,
  Flame,
  Check,
} from 'lucide-react';
import { formatearMoneda } from '../../../utils/dinero';
import { matchProductSemantic, relevanciaBusqueda, agruparProductos } from '../../../utils/busquedaProductos';
import SelectorClienteCreditoCombobox from '../componentes/SelectorClienteCreditoCombobox';
import { getEstiloMetodo } from '../constantes/metodosPago';

/**
 * Modal completo para registrar y gestionar pedidos para llevar, delivery y PedidosYa
 */
export default function ModalNuevoPedidoDelivery({
  abierto,
  onCerrar,
  editingPedidoId = null,
  setEditingPedidoId,
  usuarioOperador = 'Cajero',
  tipoDelivery = 'ParaLlevar',
  setTipoDelivery,
  codigoPY = '',
  setCodigoPY,
  deliveryMontoEnvio = '',
  setDeliveryMontoEnvio,
  avisarPedidosYaPrueba = () => {},
  deliveryVistaMovil = 'productos',
  setDeliveryVistaMovil,
  deliverySearchInputRef,
  deliverySearchQuery = '',
  setDeliverySearchQuery,
  deliveryCategoriaFiltro = '🔥 Más Pedidos',
  setDeliveryCategoriaFiltro,
  deliveryCategoriasBarra = [],
  deliveryCategoriasOrdenadas = [],
  CATEGORIAS_VISIBLES = 5,
  setDeliveryCategoriasModalOpen,
  productosMenu = [],
  agregarItemDelivery = () => {},
  alterarItemDelivery = () => {},
  alterarNotasDelivery = () => {},
  itemsDelivery = [],
  setItemsDelivery,
  cortesiaDeliveryIndices = [],
  setCortesiaDeliveryIndices,
  deliveryDescuentoTipo = 'porcentaje',
  setDeliveryDescuentoTipo,
  deliveryDescuentoValor = '',
  setDeliveryDescuentoValor,
  deliveryDescVal = 0,
  deliveryDescPct = 0,
  deliveryDescuentoMonto = 0,
  totalDelivery = 0,
  deliveryShippingFee = 0,
  grandTotalDelivery = 0,
  deliveryMetodoPago = 'Efectivo',
  setDeliveryMetodoPago,
  deliveryTipoComprobante = 'Ticket',
  setDeliveryTipoComprobante,
  deliveryConCuanto = '',
  setDeliveryConCuanto,
  deliveryClienteNombre = '',
  setDeliveryClienteNombre,
  deliveryTelefono = '',
  setDeliveryTelefono,
  deliveryDireccion = '',
  setDeliveryDireccion,
  deliveryNumDocumento = '',
  setDeliveryNumDocumento,
  buscarClienteDelivery = () => {},
  isBuscando = false,
  deliveryCodigoPago = '',
  setDeliveryCodigoPago,
  deliveryMixtoEfectivo = '',
  setDeliveryMixtoEfectivo,
  deliveryMixtoTarjeta = '',
  setDeliveryMixtoTarjeta,
  deliveryMixtoYape = '',
  setDeliveryMixtoYape,
  deliveryMontoCredito = '',
  setDeliveryMontoCredito,
  deliveryClienteCreditoSeleccionado = null,
  setDeliveryClienteCreditoSeleccionado = () => {},
  clientes = [],
  pinAdminDelivery = '',
  setPinAdminDelivery = () => {},
  deliveryMotivoCortesia = '',
  setDeliveryMotivoCortesia,
  enviarDeliveryACocina = () => {},
  enviandoDelivery = false,
  soles = (v) => formatearMoneda(v),
  campoCodigoPago = (valor, setValor, medio) => (
    <div className="animate-fade-in">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {medio === 'Tarjeta' ? 'Nº de voucher / operación POS' : medio === 'Yape' ? 'Código de operación Yape / Plin' : 'Código de operación (Yape / tarjeta)'}
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={60}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={medio === 'Tarjeta' ? 'Ej. 000456' : 'Ej. 123456'}
        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition"
      />
    </div>
  ),
  estiloMetodo = getEstiloMetodo,
}) {
  if (!abierto) return null;

  const setDeliveryModal = (val) => { if (!val) onCerrar(); };

  const cerrarDelivery = () => { setDeliveryModal(false); setCodigoPY(''); setItemsDelivery([]); setEditingPedidoId(null); };
        const conCobro = tipoDelivery === 'ParaLlevar' || tipoDelivery === 'DeliveryPropio';
        const requierePinDelivery = deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo' || cortesiaDeliveryIndices.length > 0;
        const unidadesDelivery = itemsDelivery.reduce((s, i) => s + (i.cant || 0), 0);

        const lbl = 'block text-xs font-medium text-slate-500 mb-1.5';
        const inp = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const chip = 'h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95';
        const tituloSeccion = 'text-xs font-semibold uppercase tracking-wider text-sky-700 flex items-center gap-2 before:w-1 before:h-3.5 before:rounded-full before:bg-sky-500';

        return (
          <div
            onPointerDown={(e) => {
              // Cierra el teclado del celular al tocar fuera del buscador
              const input = deliverySearchInputRef.current;
              if (input && document.activeElement === input && !input.contains(e.target)) input.blur();
            }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[110] flex items-end md:items-center justify-center md:p-6 animate-fade-in"
          >
            <div className="bg-white w-full max-w-6xl h-[96dvh] md:h-[min(92dvh,880px)] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">{editingPedidoId ? 'Modificar pedido' : 'Nuevo pedido'}</h2>
                    <p className="text-sm text-slate-500 truncate">Para llevar, delivery o PedidosYa · Cajero: {usuarioOperador}</p>
                  </div>
                  <button type="button" onClick={cerrarDelivery} className="p-2 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 sm:w-auto">
                    {[
                      { id: 'ParaLlevar', label: 'Para llevar', Icon: ShoppingBag, activo: 'bg-cyan-600 text-white shadow-sm', onSel: () => { setTipoDelivery('ParaLlevar'); setCodigoPY(''); setDeliveryMontoEnvio(''); } },
                      { id: 'DeliveryPropio', label: 'Delivery', Icon: Bike, activo: 'bg-indigo-600 text-white shadow-sm', onSel: () => { setTipoDelivery('DeliveryPropio'); setCodigoPY(''); } },
                      {
                        id: 'PedidosYa', label: 'PedidosYa', Icon: Truck, activo: 'bg-rose-600 text-white shadow-sm',
                        // Los pedidos nuevos por PedidosYa están deshabilitados (versión de prueba);
                        // los que ya existían se pueden seguir modificando.
                        bloqueado: !editingPedidoId,
                        onSel: () => {
                          if (!editingPedidoId) { avisarPedidosYaPrueba(); return; }
                          setTipoDelivery('PedidosYa'); setCodigoPY(''); setDeliveryMontoEnvio('');
                        },
                      },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.onSel}
                        className={`h-9 px-3 sm:px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                          tipoDelivery === t.id ? t.activo : (t.bloqueado ? 'text-slate-400 opacity-60' : 'text-slate-500 hover:text-slate-800')
                        }`}
                      >
                        {t.bloqueado ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <t.Icon className="w-4 h-4 shrink-0" />} <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Pestañas solo en móvil */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 md:hidden">
                    {[['productos', 'Productos'], ['pedido', `Pedido${unidadesDelivery ? ` (${unidadesDelivery})` : ''}`]].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDeliveryVistaMovil(id)}
                        className={`h-9 rounded-lg text-sm font-medium transition-all ${deliveryVistaMovil === id ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 flex md:grid md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">

                {/* Columna: catálogo */}
                <div className={`${deliveryVistaMovil === 'productos' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col min-h-0 bg-slate-50/60 md:border-r border-slate-100`}>
                  <div className="px-4 md:px-5 pt-4 pb-2 space-y-3 shrink-0">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        ref={deliverySearchInputRef}
                        type="text"
                        inputMode="search"
                        enterKeyHint="search"
                        placeholder="Buscar por nombre (ej: pollo, 1/4, parri)…"
                        value={deliverySearchQuery}
                        onChange={(e) => setDeliverySearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className={`${inp} pl-9 pr-9`}
                      />
                      {deliverySearchQuery && (
                        <button type="button" onClick={() => setDeliverySearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {/* Categorías: solo unas pocas + botón para ver todas (deslizar era incómodo en celular) */}
                    <div className="flex flex-wrap gap-1.5">
                      {deliveryCategoriasBarra.map(cat => {
                        const isMasPedidos = cat === '🔥 Más Pedidos';
                        const isSelected = deliveryCategoriaFiltro === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setDeliveryCategoriaFiltro(cat)}
                            className={`max-w-[11rem] h-8 px-3 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                              isSelected
                                ? (isMasPedidos ? 'bg-amber-500 text-white shadow-sm' : 'bg-sky-600 text-white shadow-sm')
                                : (isMasPedidos ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700')
                            }`}
                          >
                            {isMasPedidos && <Flame className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />}
                            <span className="truncate">{isMasPedidos ? 'Más pedidos' : cat}</span>
                          </button>
                        );
                      })}
                      {deliveryCategoriasOrdenadas.length > CATEGORIAS_VISIBLES && (
                        <button
                          type="button"
                          onClick={() => setDeliveryCategoriasModalOpen(true)}
                          className="h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 active:scale-95 transition"
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" /> Ver todas ({deliveryCategoriasOrdenadas.length - 2})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-5 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {(() => {
                        const topProductosCajaIds = [...productosMenu]
                          .filter(p => p.activo && p.categoria !== 'PedidosYa / Ofertas')
                          .sort((a, b) => (b.ordenCount || b.ventasTotal || b.precio || 0) - (a.ordenCount || a.ventasTotal || a.precio || 0))
                          .slice(0, 8)
                          .map(p => p.id);

                        const menuFiltradoPre = productosMenu.filter(p => {
                          if (!p.activo) return false;
                          if (deliveryCategoriaFiltro === '🔥 Más Pedidos') {
                            return topProductosCajaIds.includes(p.id) && matchProductSemantic(p, deliverySearchQuery);
                          }
                          if (deliveryCategoriaFiltro !== 'Todos' && p.categoria !== deliveryCategoriaFiltro) return false;
                          return matchProductSemantic(p, deliverySearchQuery);
                        });
                        const menuAgrupado = agruparProductos(menuFiltradoPre);
                        const menuFiltrado = deliverySearchQuery.trim()
                          ? [...menuAgrupado].sort((a, b) => relevanciaBusqueda(a, deliverySearchQuery) - relevanciaBusqueda(b, deliverySearchQuery))
                          : menuAgrupado;

                        if (menuFiltrado.length === 0) {
                          return <p className="col-span-full text-center text-sm text-slate-400 py-12">No se encontraron productos.</p>;
                        }

                        return menuFiltrado.map(prod => {
                          const isGroup = prod.esAgrupado;
                          const cantEnTicket = isGroup
                            ? 0
                            : itemsDelivery.filter(i => String(i.id) === String(prod.id)).reduce((sum, item) => sum + item.cant, 0);
                          const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
                          const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;
                          const tieneOferta = prod.precioOferta !== null && prod.precioOferta !== undefined;

                          return (
                            <button
                              key={prod.id}
                              type="button"
                              disabled={agotado}
                              onClick={() => agregarItemDelivery(prod)}
                              className={`relative text-left rounded-xl border p-3 min-h-[5.5rem] flex flex-col justify-between gap-2 transition-all ${
                                agotado
                                  ? 'opacity-50 grayscale border-slate-200 bg-slate-50 cursor-not-allowed'
                                  : cantEnTicket > 0
                                    ? 'bg-sky-50/60 border-sky-500 ring-1 ring-sky-500'
                                    : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm active:scale-[0.98]'
                              }`}
                            >
                              {cantEnTicket > 0 && !isGroup && (
                                <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-sky-600 text-white text-xs font-semibold grid place-items-center shadow">
                                  {cantEnTicket}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-2">{prod.nombre}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {isGroup && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">Opciones</span>}
                                  {tieneOferta && !isGroup && <span className="text-[10px] font-medium text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">-{prod.ofertaValor}%</span>}
                                  {prod.tipoStock === 'limitado' && !isGroup && (
                                    <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${agotado ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>
                                      {agotado ? 'Agotado' : `Stock ${stockDisponible}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isGroup ? (
                                <p className="font-mono text-sm font-semibold text-sky-700"><span className="text-xs font-sans font-normal text-slate-400">desde </span>{soles(prod.precioMin)}</p>
                              ) : tieneOferta ? (
                                <p className="font-mono text-sm font-semibold text-rose-600">
                                  {soles(prod.precioOferta)} <span className="text-[11px] font-normal line-through text-slate-400">{soles(prod.precio)}</span>
                                </p>
                              ) : (
                                <p className="font-mono text-sm font-semibold text-sky-700">{soles(prod.precio)}</p>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Columna: pedido y cobro */}
                <div className={`${deliveryVistaMovil === 'pedido' ? 'block' : 'hidden'} md:block flex-1 min-w-0 min-h-0 overflow-y-auto custom-scrollbar`}>
                  <div className="px-5 md:px-6 py-5 space-y-6">

                    {/* Datos del pedido */}
                    <section className="space-y-3">
                      <p className={tituloSeccion}>{tipoDelivery === 'DeliveryPropio' ? 'Datos de entrega' : 'Datos del pedido'}</p>
                      {tipoDelivery !== 'DeliveryPropio' ? (
                        <div>
                          <label className={lbl}>{tipoDelivery === 'PedidosYa' ? 'Código PedidosYa' : 'Nombre del cliente o ticket'}</label>
                          <input
                            type="text"
                            value={codigoPY}
                            onChange={(e) => setCodigoPY(e.target.value)}
                            placeholder={tipoDelivery === 'PedidosYa' ? 'Ej: FG-4821' : 'Ej: PEDRO o T-12'}
                            className={`${inp} font-mono uppercase`}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className={lbl}>Nombre del cliente</label>
                            <input type="text" value={deliveryClienteNombre} onChange={(e) => setDeliveryClienteNombre(e.target.value)} placeholder="Ej: Juan Pérez" className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Teléfono</label>
                            <input type="tel" inputMode="tel" value={deliveryTelefono} onChange={(e) => setDeliveryTelefono(e.target.value)} placeholder="999 888 777" className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Envío</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                              <input type="number" min="0" step="any" value={deliveryMontoEnvio} onChange={(e) => setDeliveryMontoEnvio(e.target.value)} placeholder="0.00" className={`${inp} pl-9 font-mono`} />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className={lbl}>Dirección de entrega</label>
                            <input type="text" value={deliveryDireccion} onChange={(e) => setDeliveryDireccion(e.target.value)} placeholder="Ej: Av. Hoyos Rubio 338" className={inp} />
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Productos del pedido */}
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className={tituloSeccion}>Productos {unidadesDelivery > 0 && <span className="normal-case tracking-normal font-medium">· {unidadesDelivery}</span>}</p>
                        {itemsDelivery.length > 0 && deliveryMetodoPago !== 'Cortesía' && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1"><Gift className="w-3 h-3" /> Toca el regalo para cortesía</p>
                        )}
                      </div>
                      {itemsDelivery.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                          <p className="text-sm text-slate-400">Agrega productos desde el catálogo</p>
                          <button type="button" onClick={() => setDeliveryVistaMovil('productos')} className="md:hidden mt-2 text-sm font-medium text-slate-700 underline underline-offset-2">
                            Ver productos
                          </button>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {itemsDelivery.map((item, idx) => {
                            const prodOriginal = productosMenu.find(p => String(p.id) === String(item.id));
                            const esCortesiaItem = cortesiaDeliveryIndices.includes(idx) || deliveryMetodoPago === 'Cortesía';
                            const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                            return (
                              <li key={idx} className={`px-3 py-2.5 ${esCortesiaItem ? 'bg-orange-50/60' : ''}`}>
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm leading-snug ${esCortesiaItem ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.nombre}</p>
                                    <p className="font-mono text-xs tabular-nums mt-0.5">
                                      {esCortesiaItem ? (
                                        <span className="text-orange-600 font-sans font-medium">Cortesía</span>
                                      ) : (
                                        <>
                                          {tieneDescuento && <span className="line-through text-slate-400 mr-1.5">{soles(item.cant * prodOriginal.precio)}</span>}
                                          <span className="text-slate-600">{soles(item.cant * item.precio)}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  {deliveryMetodoPago !== 'Cortesía' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (cortesiaDeliveryIndices.includes(idx)) setCortesiaDeliveryIndices(prev => prev.filter(i => i !== idx));
                                        else setCortesiaDeliveryIndices(prev => [...prev, idx]);
                                      }}
                                      className={`w-8 h-8 rounded-lg grid place-items-center transition-colors shrink-0 ${cortesiaDeliveryIndices.includes(idx) ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-orange-500 hover:bg-orange-50'}`}
                                      title={cortesiaDeliveryIndices.includes(idx) ? 'Quitar cortesía' : 'Marcar como cortesía (S/ 0.00)'}
                                    >
                                      <Gift className="w-4 h-4" />
                                    </button>
                                  )}
                                  <div className="flex items-center rounded-lg border border-slate-200 shrink-0">
                                    <button type="button" onClick={() => alterarItemDelivery(idx, '-')} className="w-8 h-8 grid place-items-center text-slate-500 hover:text-slate-900 text-lg leading-none" aria-label="Quitar uno">−</button>
                                    <span className="w-6 text-center text-sm font-semibold text-slate-900 tabular-nums">{item.cant}</span>
                                    <button type="button" onClick={() => alterarItemDelivery(idx, '+')} className="w-8 h-8 grid place-items-center text-slate-500 hover:text-slate-900 text-lg leading-none" aria-label="Agregar uno">+</button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Añadir especificación (ej: sin cebolla)…"
                                  value={item.notas || ''}
                                  onChange={(e) => alterarNotasDelivery(idx, e.target.value)}
                                  className="mt-1 w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-300 border-b border-transparent focus:border-slate-300 focus:outline-none py-0.5"
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    {/* Descuento */}
                    {itemsDelivery.length > 0 && (
                      <section className="space-y-2">
                        <p className={tituloSeccion}>Descuento</p>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0">
                            {[['porcentaje', '%'], ['monto', 'S/']].map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => { setDeliveryDescuentoTipo(id); setDeliveryDescuentoValor(''); }}
                                className={`h-8 w-11 rounded-lg text-sm font-semibold transition-all ${deliveryDescuentoTipo === id ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                title={id === 'porcentaje' ? 'Descuento en porcentaje' : 'Descuento en soles'}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="relative flex-1">
                            {deliveryDescuentoTipo === 'monto' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>}
                            <input
                              type="number"
                              min="0"
                              max={deliveryDescuentoTipo === 'porcentaje' ? 100 : totalDelivery}
                              step="any"
                              inputMode="decimal"
                              placeholder={deliveryDescuentoTipo === 'porcentaje' ? '0' : '0.00'}
                              value={deliveryDescuentoValor}
                              onChange={(e) => setDeliveryDescuentoValor(e.target.value)}
                              className={`${inp} font-mono ${deliveryDescuentoTipo === 'monto' ? 'pl-9' : 'pr-8'}`}
                            />
                            {deliveryDescuentoTipo === 'porcentaje' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">%</span>}
                          </div>
                          {deliveryDescuentoMonto > 0 && (
                            <span className="font-mono text-sm font-medium text-rose-600 tabular-nums shrink-0">−{soles(deliveryDescuentoMonto)}</span>
                          )}
                        </div>
                        {deliveryDescuentoTipo === 'porcentaje' && (
                          <div className="flex flex-wrap gap-1.5">
                            {[5, 10, 15, 20, 50].map(p => (
                              <button key={p} type="button" onClick={() => setDeliveryDescuentoValor(String(p))} className={chip}>{p}%</button>
                            ))}
                          </div>
                        )}
                        {deliveryDescuentoTipo === 'monto' && deliveryDescVal > totalDelivery && totalDelivery > 0 && (
                          <p className="text-xs text-amber-700">El descuento no puede superar el subtotal; se aplicará {soles(totalDelivery)}.</p>
                        )}
                      </section>
                    )}

                    {/* Cobro (Para llevar / Delivery propio) */}
                    {conCobro && (
                      <section className="space-y-4">
                        <p className={tituloSeccion}>Cobro</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'Efectivo', Icon: Banknote, label: 'Efectivo' },
                            { id: 'Tarjeta', Icon: CreditCard, label: 'Tarjeta' },
                            { id: 'Yape', Icon: Smartphone, label: 'Yape' },
                            { id: 'Mixto', Icon: Layers, label: 'Mixto' },
                            { id: 'Crédito', Icon: Wallet, label: 'Crédito' },
                            { id: 'Cortesía', Icon: Gift, label: 'Cortesía' },
                          ].map(m => {
                            const active = deliveryMetodoPago === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setDeliveryMetodoPago(m.id);
                                  if (m.id === 'Crédito' || m.id === 'Cortesía' || m.id === 'Consumo') {
                                    setDeliveryTipoComprobante('Ticket');
                                    setDeliveryNumDocumento('');
                                  }
                                }}
                                className={`h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium transition-all active:scale-[0.97] ${active ? estiloMetodo(m.id).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                              >
                                <m.Icon className={`w-4 h-4 ${active ? '' : estiloMetodo(m.id).icono}`} />
                                {m.label}
                              </button>
                            );
                          })}
                        </div>

                        {deliveryMetodoPago === 'Efectivo' && (() => {
                          const conC = parseFloat(deliveryConCuanto);
                          const vuelto = (!isNaN(conC) && conC >= grandTotalDelivery) ? conC - grandTotalDelivery : 0;
                          const falta = (!isNaN(conC) && conC > 0 && conC < grandTotalDelivery) ? grandTotalDelivery - conC : 0;
                          return (
                            <div className="space-y-3 animate-fade-in">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={lbl}>{tipoDelivery === 'DeliveryPropio' ? 'Paga con' : 'Recibido'}</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                    <input type="number" min="0" step="any" value={deliveryConCuanto} onChange={(e) => setDeliveryConCuanto(e.target.value)} placeholder={grandTotalDelivery.toFixed(2)} className={`${inp} h-11 pl-9 font-mono text-base font-semibold`} />
                                  </div>
                                </div>
                                <div>
                                  <p className={lbl}>{falta > 0 ? 'Falta' : 'Vuelto'}</p>
                                  <p className={`h-11 flex items-center px-3 rounded-xl font-mono text-lg font-semibold tabular-nums ${falta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {soles(falta > 0 ? falta : vuelto)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => setDeliveryConCuanto(grandTotalDelivery.toFixed(2))} className={`${chip} !border-emerald-600 !bg-emerald-600 !text-white`}>Exacto</button>
                                {[10, 20, 50, 100, 200].map(monto => (
                                  <button key={monto} type="button" onClick={() => setDeliveryConCuanto(monto.toFixed(2))} className={chip}>S/ {monto}</button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {(deliveryMetodoPago === 'Tarjeta' || deliveryMetodoPago === 'Yape') && (
                          <div className="space-y-3 animate-fade-in">
                            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                              Se registrará <span className="font-mono font-semibold text-slate-900">{soles(grandTotalDelivery)}</span> con {deliveryMetodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                            </p>
                            {campoCodigoPago(deliveryCodigoPago, setDeliveryCodigoPago, deliveryMetodoPago)}
                          </div>
                        )}
                        {deliveryMetodoPago === 'Mixto' && (parseFloat(deliveryMixtoTarjeta || 0) > 0 || parseFloat(deliveryMixtoYape || 0) > 0) &&
                          campoCodigoPago(deliveryCodigoPago, setDeliveryCodigoPago, 'Mixto')}

                        {deliveryMetodoPago === 'Crédito' && (
                          <div className="animate-fade-in">
                            <SelectorClienteCreditoCombobox
                              clientes={clientes}
                              clienteSeleccionado={deliveryClienteCreditoSeleccionado}
                              onSelectCliente={(client) => {
                                setDeliveryClienteCreditoSeleccionado(client || null);
                                if (client) {
                                  setDeliveryClienteNombre(client.nombre);
                                  setDeliveryNumDocumento(client.numDoc || '');
                                }
                              }}
                              label="Cliente de crédito"
                            />
                          </div>
                        )}

                        {deliveryMetodoPago === 'Mixto' && (() => {
                          const total = grandTotalDelivery;
                          const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
                          const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
                          const yapeVal = parseFloat(deliveryMixtoYape || 0);
                          const credVal = parseFloat(deliveryMontoCredito || 0);
                          const ingresado = efecVal + tarjVal + yapeVal + credVal;
                          const restante = Math.max(0, total - (tarjVal + yapeVal + credVal));
                          const vuelto = efecVal > restante ? efecVal - restante : 0;
                          const diferencia = total - ingresado;
                          const campos = [
                            { label: 'Efectivo', value: deliveryMixtoEfectivo, set: setDeliveryMixtoEfectivo, otros: tarjVal + yapeVal + credVal },
                            { label: 'Tarjeta', value: deliveryMixtoTarjeta, set: setDeliveryMixtoTarjeta, otros: efecVal + yapeVal + credVal },
                            { label: 'Yape / Plin', value: deliveryMixtoYape, set: setDeliveryMixtoYape, otros: efecVal + tarjVal + credVal },
                            { label: 'Crédito', value: deliveryMontoCredito, set: setDeliveryMontoCredito, otros: efecVal + tarjVal + yapeVal },
                          ];
                          return (
                            <div className="space-y-3 animate-fade-in">
                              <div className="grid grid-cols-2 gap-3">
                                {campos.map(c => (
                                  <div key={c.label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-xs font-medium text-slate-500">{c.label}</label>
                                      <button
                                        type="button"
                                        onClick={() => { const resto = Math.max(0, total - c.otros); c.set(resto > 0 ? resto.toFixed(2) : ''); }}
                                        className="text-[11px] font-medium text-slate-400 hover:text-slate-900"
                                        title="Completar con el saldo restante"
                                      >
                                        Completar
                                      </button>
                                    </div>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                      <input type="number" min="0" step="any" value={c.value} onChange={(e) => c.set(e.target.value)} placeholder="0.00" className={`${inp} pl-9 font-mono`} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {credVal > 0 && (
                                <div className="space-y-1.5">
                                  <SelectorClienteCreditoCombobox
                                    clientes={clientes}
                                    clienteSeleccionado={deliveryClienteCreditoSeleccionado}
                                    onSelectCliente={(client) => setDeliveryClienteCreditoSeleccionado(client || null)}
                                    label="Cliente para el crédito"
                                  />
                                  {deliveryClienteCreditoSeleccionado && (
                                    <p className={`text-xs font-medium ${(deliveryClienteCreditoSeleccionado.saldo || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      Saldo actual: {soles(deliveryClienteCreditoSeleccionado.saldo)}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                                <div className="flex justify-between text-slate-500"><span>Ingresado</span><span className="font-mono tabular-nums text-slate-800">{soles(ingresado)} / {soles(total)}</span></div>
                                {diferencia > 0.01 && <div className="flex justify-between font-medium text-amber-700"><span>Falta cubrir</span><span className="font-mono tabular-nums">{soles(diferencia)}</span></div>}
                                {vuelto > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Vuelto</span><span className="font-mono tabular-nums">{soles(vuelto)}</span></div>}
                                {diferencia <= 0.01 && vuelto === 0 && <div className="flex items-center gap-1.5 font-medium text-emerald-700"><Check className="w-4 h-4" /> Cuenta cubierta</div>}
                              </div>
                            </div>
                          );
                        })()}

                        {requierePinDelivery && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-fade-in">
                            <div className="flex items-start gap-2.5">
                              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">Requiere autorización</p>
                                <p className="text-xs text-slate-500">
                                  {deliveryMetodoPago === 'Cortesía'
                                    ? 'Cortesía total (S/ 0.00). Ingresa el PIN de administrador o cajero.'
                                    : deliveryMetodoPago === 'Consumo'
                                      ? 'Consumo de personal. Ingresa el PIN de administrador o cajero.'
                                      : `${cortesiaDeliveryIndices.length} producto(s) como cortesía. Ingresa el PIN de administrador o cajero.`}
                                </p>
                              </div>
                            </div>
                            <input
                              type="password"
                              value={pinAdminDelivery}
                              onChange={(e) => setPinAdminDelivery(e.target.value)}
                              placeholder="PIN"
                              maxLength={10}
                              autoComplete="off"
                              className="w-full h-12 bg-white border border-amber-200 rounded-xl px-4 text-center text-xl font-mono tracking-[0.5em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition"
                            />
                            {(deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0) && (
                              <input
                                type="text"
                                value={deliveryMotivoCortesia}
                                onChange={(e) => setDeliveryMotivoCortesia(e.target.value)}
                                placeholder="Motivo de la cortesía (opcional)"
                                className={inp}
                              />
                            )}
                          </div>
                        )}

                        {deliveryMetodoPago !== 'Consumo' && (
                          <details className="group rounded-xl border border-slate-200" open={!!deliveryNumDocumento || undefined}>
                            <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none">
                              <span className="text-sm font-medium text-slate-700">Documento del cliente <span className="font-normal text-slate-400">· opcional</span></span>
                              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="px-4 pb-4 space-y-3">
                              <div className={`grid grid-cols-1 ${tipoDelivery === 'DeliveryPropio' ? '' : 'sm:grid-cols-2'} gap-3`}>
                                <div>
                                  <label className={lbl}>DNI o RUC</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={deliveryNumDocumento}
                                      onChange={(e) => setDeliveryNumDocumento(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarClienteDelivery(); } }}
                                      placeholder={deliveryTipoComprobante === 'Factura' ? '11 dígitos' : '8 dígitos'}
                                      className={`${inp} font-mono`}
                                    />
                                    <button
                                      type="button"
                                      onClick={buscarClienteDelivery}
                                      disabled={isBuscando}
                                      className="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 grid place-items-center shrink-0 disabled:opacity-50"
                                      title="Buscar cliente"
                                    >
                                      {isBuscando ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                {tipoDelivery !== 'DeliveryPropio' && (
                                  <div>
                                    <label className={lbl}>Nombre / razón social</label>
                                    <input type="text" value={deliveryClienteNombre} onChange={(e) => setDeliveryClienteNombre(e.target.value)} placeholder="Consumidor final" className={inp} />
                                  </div>
                                )}
                              </div>
                              {deliveryTipoComprobante === 'Factura' && tipoDelivery !== 'DeliveryPropio' && (
                                <div>
                                  <label className={lbl}>Dirección fiscal</label>
                                  <input type="text" value={deliveryDireccion} onChange={(e) => setDeliveryDireccion(e.target.value)} placeholder="Obligatorio" className={inp} />
                                </div>
                              )}
                              <p className="text-[11px] text-slate-400">Se emite ticket de venta; la boleta o factura se hace en SUNAT.</p>
                            </div>
                          </details>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 md:px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
                {requierePinDelivery && conCobro && !pinAdminDelivery.trim() && (
                  <p className="mb-2 text-xs text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ingresa el PIN de autorización para registrar la cortesía / consumo.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 truncate">
                      Subtotal {soles(totalDelivery)}
                      {deliveryDescuentoMonto > 0 && <span className="text-rose-600"> · Desc. {deliveryDescuentoTipo === 'porcentaje' ? `${deliveryDescPct}%` : ''} −{soles(deliveryDescuentoMonto)}</span>}
                      {tipoDelivery === 'DeliveryPropio' && <> · Envío {soles(deliveryShippingFee)}</>}
                    </p>
                    <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 leading-tight">{soles(grandTotalDelivery)}</p>
                  </div>
                  {deliveryVistaMovil === 'productos' && (
                    <button
                      type="button"
                      onClick={() => setDeliveryVistaMovil('pedido')}
                      className="md:hidden ml-auto h-12 px-5 rounded-xl bg-sky-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      Continuar <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={enviarDeliveryACocina}
                    disabled={enviandoDelivery}
                    className={`${deliveryVistaMovil === 'productos' ? 'hidden md:inline-flex' : 'inline-flex'} ml-auto h-12 px-6 sm:px-8 rounded-xl text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 items-center justify-center gap-2 ${
                      editingPedidoId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {enviandoDelivery ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {tipoDelivery === 'ParaLlevar' ? <Banknote className="w-4.5 h-4.5" /> : <Truck className="w-4.5 h-4.5" />}
                        {editingPedidoId
                          ? 'Actualizar pedido'
                          : tipoDelivery === 'ParaLlevar'
                            ? 'Cobrar y enviar'
                            : 'Registrar y enviar'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
}
