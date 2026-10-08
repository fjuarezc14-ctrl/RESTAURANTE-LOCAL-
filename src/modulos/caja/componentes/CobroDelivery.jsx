// Pedido para llevar / delivery: comprobante, cliente y forma de pago
import { Banknote, CreditCard, Smartphone, Wallet, Gift, Lock, ChevronDown, Search, Layers, Check } from 'lucide-react';
import SelectorClienteCreditoCombobox from './SelectorClienteCreditoCombobox';
import { campoCodigoPago } from './camposCaja';

export function CobroDelivery({ buscarClienteDelivery, chip, clientes, conCobro, cortesiaDeliveryIndices, deliveryClienteCreditoSeleccionado, deliveryClienteNombre, deliveryCodigoPago, deliveryConCuanto, deliveryDireccion, deliveryMetodoPago, deliveryMixtoEfectivo, deliveryMixtoTarjeta, deliveryMixtoYape, deliveryMontoCredito, deliveryMotivoCortesia, deliveryNumDocumento, deliveryTipoComprobante, estiloMetodo, grandTotalDelivery, inp, isBuscando, lbl, pinAdminDelivery, requierePinDelivery, setDeliveryClienteCreditoSeleccionado, setDeliveryClienteNombre, setDeliveryCodigoPago, setDeliveryConCuanto, setDeliveryDireccion, setDeliveryMetodoPago, setDeliveryMixtoEfectivo, setDeliveryMixtoTarjeta, setDeliveryMixtoYape, setDeliveryMontoCredito, setDeliveryMotivoCortesia, setDeliveryNumDocumento, setDeliveryTipoComprobante, setPinAdminDelivery, soles, tipoDelivery, tituloSeccion }) {
  return (
    <>
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
    </>
  );
}
