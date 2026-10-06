import React from 'react';
import {
  X,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Gift,
  CheckCircle,
  Lock,
  ChevronDown,
  Plus,
  Trash2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { api } from '../../../api';
import { formatearMoneda } from '../../../utils/dinero';

/**
 * Modal principal para cobrar y liberar una mesa activa
 */
export default function ModalCobroMesa({
  abierto,
  mesa,
  onCerrar,
  productosMenu = [],
  metodoPago,
  setMetodoPago,
  cortesiaItemIds = [],
  setCortesiaItemIds,
  pagaCon,
  setPagaCon,
  vueltoCalculado = 0,
  montoMixtoEfectivo,
  setMontoMixtoEfectivo,
  montoMixtoTarjeta,
  setMontoMixtoTarjeta,
  montoMixtoYape,
  setMontoMixtoYape,
  consumoUsuario,
  setConsumoUsuario,
  consumoPin,
  setConsumoPin,
  consumoMotivo,
  setConsumoMotivo,
  codigoOperacionPago,
  setCodigoOperacionPago,
  numDocumento,
  setNumDocumento,
  handleDocumentoChange,
  clienteNombre,
  setClienteNombre,
  clienteDireccion,
  setClienteDireccion,
  usuarios = [],
  DENOMINACIONES_PEN = [],
  procesarCobroYFacturar,
  cobrando = false,
  setMesaSeleccionada,
  // Helper de moneda
  soles = (v) => formatearMoneda(v),
  parseMonto = (val) => {
    const n = parseFloat(String(val || '').replace(/,/g, '.'));
    return isNaN(n) ? 0 : n;
  },
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
}) {
  if (!abierto || !mesa) return null;

  const mesaSeleccionada = mesa;
  const setModalOpen = (val) => { if (!val) onCerrar(); };

  const itemsMesa = (mesaSeleccionada.pedidoData.items || []).filter(Boolean);
        const cortesiaTotalMesa = metodoPago === 'Cortesía';
        const totalConCortesias = cortesiaTotalMesa ? 0 : itemsMesa
          .filter(i => !cortesiaItemIds.includes(i.itemId))
          .reduce((s, i) => s + (i.cant * i.precio), 0);
        const subtotalConCortesias = parseFloat((totalConCortesias / 1.105).toFixed(2));
        const igvConCortesias = parseFloat((totalConCortesias - subtotalConCortesias).toFixed(2));
        const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;
        const requierePin = metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales;
        const unidadesMesa = itemsMesa.reduce((s, i) => s + (i.cant || 0), 0);

        const labelCampo = 'block text-xs font-medium text-slate-500 mb-1.5';
        const inputCampo = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const inputMonto = 'w-full h-11 bg-white border border-slate-200 rounded-xl pl-9 pr-3 font-mono text-base font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';
        const chipMonto = 'h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95';

        const campoMonto = (label, value, onChange, extra) => (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500">{label}</label>
              {parseMonto(value) > 0 && (
                <button type="button" onClick={() => onChange('')} className="text-[11px] text-slate-400 hover:text-rose-600">Limpiar</button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
              <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className={inputMonto} />
            </div>
            {extra}
          </div>
        );

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[110] flex items-end md:items-center justify-center md:p-6 animate-fade-in">
            <div className="bg-white w-full max-w-5xl h-[96dvh] md:h-[min(90dvh,820px)] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white grid place-items-center text-sm font-semibold shrink-0 shadow-sm shadow-emerald-600/30">{mesaSeleccionada.num}</div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">Cobrar mesa {mesaSeleccionada.num}</h2>
                    <p className="text-sm text-slate-500 truncate">
                      {mesaSeleccionada.pedidoData?.mesero || '—'} · {mesaSeleccionada.pedidoData?.hora} · {metodoPago === 'Consumo' ? 'Consumo personal (planilla)' : 'Ticket de venta'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Cerrar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">

                {/* Columna: consumo */}
                <div className="md:border-r border-b md:border-b-0 border-slate-100 bg-slate-50/60 flex flex-col md:min-h-0">
                  <div className="flex items-center justify-between px-5 md:px-6 pt-4 pb-2">
                    <p className="text-xs font-medium text-slate-500">Consumo · {unidadesMesa} ítem{unidadesMesa !== 1 ? 's' : ''}</p>
                    <p className={`text-[11px] flex items-center gap-1 ${cortesiaTotalMesa ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
                      <Gift className="w-3 h-3" /> {cortesiaTotalMesa ? 'Todo es cortesía' : 'Marca para cortesía'}
                    </p>
                  </div>
                  <ul className="flex-1 md:min-h-0 max-h-[38dvh] md:max-h-none overflow-y-auto custom-scrollbar px-3 md:px-4 pb-2">
                    {itemsMesa.map((item, idx) => {
                      const prodOriginal = productosMenu && productosMenu.find(p => p && String(p.id) === String(item.id));
                      const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                      const esCortesia = cortesiaTotalMesa || cortesiaItemIds.includes(item.itemId);
                      return (
                        <li key={idx} className={`rounded-xl px-2.5 py-2 transition-colors ${esCortesia ? 'bg-orange-50/70' : 'hover:bg-white'}`}>
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={esCortesia}
                              disabled={cortesiaTotalMesa}
                              onChange={() => {
                                if (esCortesia) setCortesiaItemIds(prev => prev.filter(id => id !== item.itemId));
                                else setCortesiaItemIds(prev => [...prev, item.itemId]);
                              }}
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-orange-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
                              title="Marcar como cortesía (S/ 0.00)"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3 text-sm">
                                <span className={`min-w-0 ${esCortesia ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  <span className="font-mono text-slate-400 mr-1.5">{item.cant}×</span>{item.nombre}
                                </span>
                                <span className="font-mono tabular-nums shrink-0 text-right">
                                  {esCortesia ? (
                                    <span className="text-xs font-medium text-orange-600">Cortesía</span>
                                  ) : (
                                    <>
                                      {tieneDescuento && <span className="block text-[11px] line-through text-slate-400">{soles(item.cant * prodOriginal.precio)}</span>}
                                      <span className="text-slate-700">{soles(item.cant * item.precio)}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <input
                                type="text"
                                placeholder="Añadir nota…"
                                value={item.notas || item.notes || ''}
                                onChange={(e) => {
                                  setMesaSeleccionada(prev => {
                                    if (!prev || !prev.pedidoData) return prev;
                                    const nuevosItems = [...prev.pedidoData.items];
                                    const originalIdx = prev.pedidoData.items.findIndex(x => x.itemId === item.itemId);
                                    if (originalIdx >= 0) {
                                      nuevosItems[originalIdx].notas = e.target.value;
                                    }
                                    return { ...prev, pedidoData: { ...prev.pedidoData, items: nuevosItems } };
                                  });
                                }}
                                onBlur={async (e) => {
                                  if (item.itemId) {
                                    try {
                                      await api.updateItemNotas(item.itemId, e.target.value);
                                    } catch (err) {
                                      console.error("Error al actualizar nota en caja:", err);
                                    }
                                  }
                                }}
                                className="mt-0.5 w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-300 border-b border-transparent focus:border-slate-300 focus:outline-none py-0.5"
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="px-5 md:px-6 py-3 border-t border-slate-100 space-y-1 text-xs text-slate-500 shrink-0">
                    <div className="flex justify-between"><span>Subtotal (sin IGV)</span><span className="font-mono tabular-nums">{soles(subtotalConCortesias)}</span></div>
                    <div className="flex justify-between"><span>IGV (10.5%)</span><span className="font-mono tabular-nums">{soles(igvConCortesias)}</span></div>
                    <div className="flex justify-between pt-1 text-sm text-slate-900"><span className="font-medium">Total</span><span className="font-mono font-semibold tabular-nums">{soles(totalConCortesias)}</span></div>
                  </div>
                </div>

                {/* Columna: pago */}
                <div className="md:min-h-0 md:overflow-y-auto custom-scrollbar px-5 md:px-6 py-5 space-y-6">

                  {/* Método de pago */}
                  <div>
                    <p className={labelCampo}>Método de pago</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Efectivo', icon: Banknote, label: 'Efectivo' },
                        { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' },
                        { id: 'Yape', icon: Smartphone, label: 'Yape / Plin' },
                        { id: 'Crédito', icon: Wallet, label: 'Crédito' },
                        { id: 'Cortesía', icon: Gift, label: 'Cortesía' },
                        { id: 'Mixto', icon: Layers, label: 'Mixto' }
                      ].map(item => {
                        const IconComp = item.icon;
                        const active = metodoPago === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setMetodoPago(item.id);
                              if (item.id === 'Crédito' || item.id === 'Cortesía') {
                                setTipoComprobante('Ticket');
                              }
                            }}
                            className={`h-16 flex flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] ${active ? estiloMetodo(item.id).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                          >
                            <IconComp className={`w-4.5 h-4.5 ${active ? '' : estiloMetodo(item.id).icono}`} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Efectivo */}
                  {metodoPago === 'Efectivo' && (() => {
                    const total = totalConCortesias;
                    const pagaCon = parseFloat(pagaConEfectivoMesa || 0);
                    const vuelto = (pagaCon >= total && pagaCon > 0) ? (pagaCon - total) : 0;
                    const faltante = (pagaCon > 0 && pagaCon < total) ? (total - pagaCon) : 0;
                    return (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCampo}>Recibido</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={pagaConEfectivoMesa}
                                onChange={(e) => setPagaConEfectivoMesa(e.target.value)}
                                placeholder={total.toFixed(2)}
                                className={inputMonto}
                              />
                            </div>
                          </div>
                          <div>
                            <p className={labelCampo}>{faltante > 0 ? 'Falta' : 'Vuelto'}</p>
                            <p className={`h-11 flex items-center px-3 rounded-xl font-mono text-lg font-semibold tabular-nums ${faltante > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {soles(faltante > 0 ? faltante : vuelto)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setPagaConEfectivoMesa(total.toFixed(2))} className={`${chipMonto} !border-emerald-600 !bg-emerald-600 !text-white`}>
                            Exacto
                          </button>
                          {[10, 20, 50, 100, 200].map(monto => (
                            <button key={monto} type="button" onClick={() => setPagaConEfectivoMesa(monto.toFixed(2))} className={chipMonto}>
                              S/ {monto}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {(metodoPago === 'Tarjeta' || metodoPago === 'Yape') && (
                    <div className="space-y-3 animate-fade-in">
                      <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                        Se registrará <span className="font-mono font-semibold text-slate-900">{soles(totalConCortesias)}</span> pagado íntegramente con {metodoPago === 'Tarjeta' ? 'tarjeta (POS)' : 'Yape / Plin'}.
                      </p>
                      {campoCodigoPago(codigoPago, setCodigoPago, metodoPago)}
                    </div>
                  )}
                  {metodoPago === 'Mixto' && (parseMonto(mixtoTarjeta) > 0 || parseMonto(mixtoYape) > 0) &&
                    campoCodigoPago(codigoPago, setCodigoPago, 'Mixto')}

                  {metodoPago === 'Crédito' && (
                    <div className="animate-fade-in">
                      <SelectorClienteCreditoCombobox
                        clientes={clientes}
                        clienteSeleccionado={clienteCreditoSeleccionado}
                        onSelectCliente={(c) => {
                          setClienteCreditoSeleccionado(c);
                          if (c) {
                            setClienteNombre(c.nombre);
                            setNumDocumento(c.numDoc || '');
                            setClienteDireccion(c.direccion || '');
                          }
                        }}
                        label="Cliente de crédito"
                      />
                    </div>
                  )}

                  {/* Mixto */}
                  {metodoPago === 'Mixto' && (() => {
                    const total = totalConCortesias;
                    const efecVal = parseMonto(mixtoEfectivo);
                    const tarjVal = parseMonto(mixtoTarjeta);
                    const yapeVal = parseMonto(mixtoYape);
                    const credVal = incluirCreditoMixto
                      ? (clientesCreditoMixto || []).reduce((s, c) => s + parseMonto(c.monto), 0)
                      : 0;

                    const totalIngresado = efecVal + tarjVal + yapeVal + credVal;
                    const restanteFisico = Math.max(0, total - (tarjVal + yapeVal + credVal));
                    const vuelto = efecVal > restanteFisico ? efecVal - restanteFisico : 0;
                    const faltante = Math.max(0, total - (Math.min(efecVal, restanteFisico) + tarjVal + yapeVal + credVal));
                    const cuadraExacto = faltante <= 0.01 && (tarjVal + yapeVal + credVal) <= (total + 0.01);

                    const pct = (n) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
                    const noEfectivoExcedido = (tarjVal + yapeVal + credVal) > (total + 0.01);

                    return (
                      <div className="space-y-4 animate-fade-in">
                        <div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div style={{ width: `${pct(Math.min(efecVal, restanteFisico))}%` }} className="bg-emerald-500 transition-all" />
                            <div style={{ width: `${pct(tarjVal)}%` }} className="bg-blue-500 transition-all" />
                            <div style={{ width: `${pct(yapeVal)}%` }} className="bg-purple-500 transition-all" />
                            <div style={{ width: `${pct(credVal)}%` }} className="bg-teal-500 transition-all" />
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            {[['bg-emerald-500', 'Efectivo'], ['bg-blue-500', 'Tarjeta'], ['bg-purple-500', 'Yape'], ['bg-teal-500', 'Crédito']].map(([c, l]) => (
                              <span key={l} className="inline-flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${c}`} /> {l}</span>
                            ))}
                          </div>
                        </div>

                        {noEfectivoExcedido && (
                          <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                            <span>Tarjeta, Yape y Crédito suman {soles(tarjVal + yapeVal + credVal)} y superan el total ({soles(total)}). El vuelto solo se genera con efectivo.</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {campoMonto('Efectivo', mixtoEfectivo, setMixtoEfectivo, (
                            <div className="flex gap-1 mt-1.5">
                              {[10, 20, 50, 100].map(billete => (
                                <button
                                  key={billete}
                                  type="button"
                                  onClick={() => setMixtoEfectivo((parseMonto(mixtoEfectivo) + billete).toFixed(2))}
                                  className="flex-1 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-600 transition active:scale-95"
                                >
                                  +{billete}
                                </button>
                              ))}
                            </div>
                          ))}
                          {campoMonto('Tarjeta', mixtoTarjeta, setMixtoTarjeta)}
                          {campoMonto('Yape / Plin', mixtoYape, setMixtoYape)}
                        </div>

                        {/* Crédito dentro del mixto */}
                        <label className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${incluirCreditoMixto ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                          <span className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={incluirCreditoMixto}
                              onChange={(e) => {
                                setIncluirCreditoMixto(e.target.checked);
                                if (!e.target.checked) {
                                  setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 accent-teal-600 cursor-pointer shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800">Incluir crédito a clientes</span>
                              <span className="block text-xs text-slate-500">Carga parte de la cuenta a uno o varios clientes</span>
                            </span>
                          </span>
                          {incluirCreditoMixto && <span className="font-mono text-sm font-semibold text-teal-700 shrink-0">{soles(credVal)}</span>}
                        </label>

                        {incluirCreditoMixto && (
                          <div className="space-y-2.5 animate-fade-in">
                            {(clientesCreditoMixto || []).map((row, idx) => {
                              const currentClient = clientes.find(c => String(c.id) === String(row.clienteId));
                              const filaSinCliente = !row.clienteId && parseMonto(row.monto) > 0;
                              return (
                                <div key={idx} className={`rounded-xl border p-3 space-y-2 ${filaSinCliente ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">Cliente {idx + 1}</span>
                                    {clientesCreditoMixto.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setClientesCreditoMixto(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Quitar cliente"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem] gap-2 items-start">
                                    <SelectorClienteCreditoCombobox
                                      clientes={clientes}
                                      clienteSeleccionado={currentClient}
                                      onSelectCliente={(c) => {
                                        setClientesCreditoMixto(prev => {
                                          const next = [...prev];
                                          next[idx] = { ...next[idx], clienteId: c ? c.id : '', nombre: c ? c.nombre : '' };
                                          return next;
                                        });
                                      }}
                                      label=""
                                      placeholder="Buscar por nombre, DNI o RUC..."
                                    />
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={row.monto}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setClientesCreditoMixto(prev => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], monto: val };
                                            return next;
                                          });
                                        }}
                                        className={inputMonto}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setClientesCreditoMixto(prev => [...prev, { clienteId: '', monto: '', nombre: '' }])}
                              className="w-full h-10 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors inline-flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-4 h-4" /> Dividir con otro cliente
                            </button>
                          </div>
                        )}

                        <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                          <div className="flex justify-between text-slate-500"><span>Ingresado</span><span className="font-mono tabular-nums text-slate-800">{soles(totalIngresado)} / {soles(total)}</span></div>
                          {faltante > 0.01 && <div className="flex justify-between font-medium text-amber-700"><span>Falta cubrir</span><span className="font-mono tabular-nums">{soles(faltante)}</span></div>}
                          {vuelto > 0 && <div className="flex justify-between font-medium text-emerald-700"><span>Vuelto</span><span className="font-mono tabular-nums">{soles(vuelto)}</span></div>}
                          {cuadraExacto && <div className="flex items-center gap-1.5 font-medium text-emerald-700"><Check className="w-4 h-4" /> Cuenta cubierta</div>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Autorización (cortesía / consumo) */}
                  {requierePin && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-fade-in">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Requiere autorización</p>
                          <p className="text-xs text-slate-500">
                            {tieneCortesiasIndividuales
                              ? `${cortesiaItemIds.length} producto(s) marcados como cortesía. Ingresa el PIN de administrador o cajero.`
                              : 'Ingresa el PIN de administrador o cajero para continuar.'}
                          </p>
                        </div>
                      </div>
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={consumoPin}
                        onChange={(e) => {
                          setConsumoPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setConsumoPinError('');
                        }}
                        placeholder="PIN"
                        className="w-full h-12 bg-white border border-amber-200 rounded-xl px-4 text-center text-xl font-mono tracking-[0.5em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition"
                        autoComplete="off"
                        name="consumo-pin-auth"
                      />
                      {consumoPinError && <p className="text-xs font-medium text-rose-600">{consumoPinError}</p>}
                      {(metodoPago === 'Cortesía' || tieneCortesiasIndividuales) && (
                        <input
                          type="text"
                          value={motivoCortesia}
                          onChange={(e) => setMotivoCortesia(e.target.value)}
                          placeholder="Motivo de la cortesía (opcional): cumpleaños, demora…"
                          className={inputCampo}
                        />
                      )}
                    </div>
                  )}

                  {/* Datos del cliente */}
                  {metodoPago !== 'Consumo' && (
                    <details className="group rounded-xl border border-slate-200" open={!!(numDocumento || clienteNombre) || undefined}>
                      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none">
                        <span className="text-sm font-medium text-slate-700">
                          Datos del cliente <span className="font-normal text-slate-400">· opcional</span>
                        </span>
                        <span className="flex items-center gap-2 min-w-0">
                          {clienteNombre && <span className="text-xs text-slate-500 truncate max-w-[10rem]">{clienteNombre}</span>}
                          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                        </span>
                      </summary>
                      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCampo}>DNI o RUC</label>
                          <input type="text" value={numDocumento} onChange={(e) => handleDocumentoChange(e.target.value)} placeholder="Solo si lo pide" className={`${inputCampo} font-mono`} />
                        </div>
                        <div>
                          <label className={labelCampo}>Nombre</label>
                          <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Consumidor final" className={inputCampo} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCampo}>Dirección</label>
                          <input type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} placeholder="Ej. Av. Hoyos Rubio 338" className={inputCampo} />
                        </div>
                        <p className="sm:col-span-2 text-[11px] text-slate-400">La boleta o factura se emite en el portal de SUNAT.</p>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 md:px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                {requierePin && !consumoPin.trim() && (
                  <p className="mb-2 text-xs text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ingresa el PIN de autorización para poder cobrar.</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Total a cobrar</p>
                    <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 leading-tight">{soles(totalConCortesias)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={procesarCobroYFacturar}
                    disabled={cobrando}
                    className="ml-auto h-12 px-6 sm:px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {cobrando
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle className="w-4.5 h-4.5" /> Cobrar y liberar mesa</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
}
