// Comanda de la mesa: lo que falta enviar (se puede cambiar) y lo que ya está en cocina (solo notas o anular).
// En el celular es una hoja que sube desde abajo; en pantallas grandes, la columna derecha del modal.
import { useState } from 'react';
import { ChefHat, ChevronDown, Minus, Plus, ShoppingBag, StickyNote, Trash2, Ban, CheckCircle2, Clock } from 'lucide-react';

// Nota de un plato: se escribe en un campo de 16 px (con menos, el iPhone hace zoom al tocarlo)
function CampoNota({ valor, onCambiar, onListo }) {
  return (
    <input
      type="text"
      autoFocus
      enterKeyHint="done"
      placeholder="Ej: sin cebolla, bien cocido…"
      value={valor || ''}
      onChange={(e) => onCambiar(e.target.value)}
      onBlur={onListo}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="mt-2 w-full h-11 rounded-xl border border-amber-300 bg-white px-3 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
    />
  );
}

function PrecioItem({ item, productos, apagado }) {
  const sub = item.cant * item.precio;
  const original = productos.find((p) => String(p.id) === String(item.id));
  const conDescuento = original && original.precio > item.precio;
  return (
    <span className="flex items-baseline gap-1.5">
      {conDescuento && <span className="line-through text-slate-400 text-xs">S/ {(item.cant * original.precio).toFixed(2)}</span>}
      <span className={`font-mono font-black text-[15px] ${apagado ? 'text-slate-500' : 'text-emerald-700'}`}>S/ {sub.toFixed(2)}</span>
    </span>
  );
}

export function ComandaMesa({
  mesa,
  ticketActual,
  setTicketActual,
  totalTicket,
  productos,
  alterarCantidad,
  requestSupervisorAuth,
  handleCancelarItem,
  api,
  badgeTexto,
  badgeEstado,
  enviarACocina,
  enviando,
  onVolverALaCarta,
}) {
  const [notaAbierta, setNotaAbierta] = useState(null); // índice del ítem cuya nota se está escribiendo

  const indexados = ticketActual.map((item, idx) => ({ item, idx }));
  const nuevos = indexados.filter(({ item }) => !item.yaEnviado);
  const enviados = indexados.filter(({ item }) => item.yaEnviado);
  const cantNuevos = nuevos.reduce((s, { item }) => s + item.cant, 0);

  const cambiarNota = (idx, valor) => {
    setTicketActual((prev) => prev.map((it, i) => (i === idx ? { ...it, notas: valor } : it)));
  };
  const quitar = (idx) => setTicketActual((prev) => prev.filter((_, i) => i !== idx));
  const guardarNotaEnviada = async (item) => {
    setNotaAbierta(null);
    if (!item.itemId) return;
    try {
      await api.updateItemNotas(item.itemId, item.notas || '');
    } catch (err) {
      console.error('Error al actualizar nota:', err);
    }
  };
  const anular = (item) => {
    if (mesa.estado === 'Servido' || item.historial) {
      requestSupervisorAuth(`Anular "${item.nombre}"`, (supervisor) => handleCancelarItem(item, supervisor));
    } else {
      handleCancelarItem(item, null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Encabezado: en el celular, tocarlo baja la hoja y vuelve a la carta */}
      <div className="shrink-0 border-b border-slate-100">
        <button
          type="button"
          onClick={onVolverALaCarta}
          className="md:hidden w-full pt-2 pb-1 flex justify-center cursor-pointer"
          aria-label="Volver a la carta"
        >
          <span className="w-12 h-1.5 rounded-full bg-slate-300" />
        </button>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:py-3.5">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-lg leading-tight">Pedido de la mesa</h3>
            <span className={`inline-block mt-0.5 text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${badgeEstado}`}>{badgeTexto}</span>
          </div>
          <button
            type="button"
            onClick={onVolverALaCarta}
            className="md:hidden h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" /> Seguir pidiendo
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-3 py-3 space-y-4 bg-slate-50">
        {ticketActual.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 py-10">
            <ShoppingBag className="w-10 h-10" />
            <p className="font-bold text-sm text-center">Aún no hay platos.<br />Tócalos en la carta para agregarlos.</p>
          </div>
        )}

        {nuevos.length > 0 && (
          <section>
            <h4 className="px-1 mb-2 text-xs font-black uppercase tracking-wider text-amber-700">Por enviar · {cantNuevos}</h4>
            <ul className="space-y-2">
              {nuevos.map(({ item, idx }) => (
                <li key={idx} className="rounded-2xl border border-amber-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] leading-snug text-slate-900">{item.nombre}</p>
                      <PrecioItem item={item} productos={productos} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => alterarCantidad(idx, '-')}
                        aria-label="Quitar uno"
                        className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
                      >
                        <Minus className="w-5 h-5" strokeWidth={3} />
                      </button>
                      <span className="w-7 text-center font-black text-lg tabular-nums">{item.cant}</span>
                      <button
                        type="button"
                        onClick={() => alterarCantidad(idx, '+')}
                        aria-label="Agregar uno"
                        className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5" strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {notaAbierta === idx ? (
                    <CampoNota valor={item.notas} onCambiar={(v) => cambiarNota(idx, v)} onListo={() => setNotaAbierta(null)} />
                  ) : (
                    item.notas && <p className="mt-1.5 text-sm text-slate-600 italic break-words">“{item.notas}”</p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setNotaAbierta(notaAbierta === idx ? null : idx)}
                      className="h-10 px-3 rounded-xl text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <StickyNote className="w-4 h-4" /> {item.notas ? 'Editar nota' : 'Agregar nota'}
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(idx)}
                      className="h-10 px-3 rounded-xl text-sm font-bold text-rose-600 flex items-center gap-1.5 active:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {enviados.length > 0 && (
          <section>
            <h4 className="px-1 mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Ya enviado</h4>
            <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
              {enviados.map(({ item, idx }) => {
                const cancelable = item.pedidoId === mesa.pedidoData?.pedidoId;
                return (
                  <li key={idx} className="p-3">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 font-black text-slate-700 flex items-center justify-center tabular-nums">{item.cant}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] leading-snug text-slate-800">{item.nombre}</p>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          <PrecioItem item={item} productos={productos} apagado />
                          {item.historial ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Listo</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Clock className="w-3.5 h-3.5" /> En cocina</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {notaAbierta === idx ? (
                      <CampoNota valor={item.notas} onCambiar={(v) => cambiarNota(idx, v)} onListo={() => guardarNotaEnviada(item)} />
                    ) : (
                      item.notas && <p className="mt-1.5 ml-11 text-sm text-slate-600 italic break-words">“{item.notas}”</p>
                    )}

                    <div className="mt-1.5 ml-11 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNotaAbierta(notaAbierta === idx ? null : idx)}
                        className="h-9 px-2.5 rounded-lg text-sm font-bold text-slate-600 flex items-center gap-1.5 active:bg-slate-100 cursor-pointer"
                      >
                        <StickyNote className="w-4 h-4" /> Nota
                      </button>
                      {cancelable && (
                        <button
                          type="button"
                          onClick={() => anular(item)}
                          className="h-9 px-2.5 rounded-lg text-sm font-bold text-rose-600 flex items-center gap-1.5 active:bg-rose-50 cursor-pointer"
                        >
                          <Ban className="w-4 h-4" /> Anular
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Total y envío: siempre a la vista */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-bold text-slate-500">Total de la mesa</span>
          <span className="font-black font-mono text-2xl text-slate-900">S/ {totalTicket.toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={enviarACocina}
          disabled={enviando || cantNuevos === 0}
          className="w-full h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-transform disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none cursor-pointer"
        >
          {enviando
            ? <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
            : <ChefHat className="w-5 h-5" />}
          {cantNuevos > 0 ? `Enviar a cocina · ${cantNuevos}` : 'Nada nuevo por enviar'}
        </button>
      </div>
    </div>
  );
}
