import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCheck, CheckCircle2, User, Truck, XCircle, AlertTriangle, Salad, ShoppingBag, Bike, UtensilsCrossed, Timer, X } from 'lucide-react';

const parseDeliveryInfo = (code) => {
  if (!code || !code.startsWith('DELIVERY -')) return null;
  const parts = code.split(' | ');
  return { nombre: parts[0] ? parts[0].replace('DELIVERY - ', '') : '' };
};

// Tipo y título visible del ticket
const origenPedido = (p) => {
  const codigo = p.codigoPedidosYa || '';
  if (codigo.startsWith('DELIVERY -')) {
    const info = parseDeliveryInfo(codigo);
    return { tipo: 'delivery', etiqueta: 'Delivery', titulo: info ? info.nombre : codigo.replace('DELIVERY - ', ''), Icon: Bike };
  }
  if (codigo.startsWith('LLEVAR -')) return { tipo: 'llevar', etiqueta: 'Para llevar', titulo: codigo.replace('LLEVAR - ', ''), Icon: ShoppingBag };
  if (codigo || p.tipoEntrega === 'llevar' || p.tipoEntrega === 'delivery') return { tipo: 'pedidosya', etiqueta: 'PedidosYa', titulo: codigo || 'Delivery', Icon: Truck };
  return { tipo: 'salon', etiqueta: 'Salón', titulo: `Mesa ${p.mesaNum}`, Icon: UtensilsCrossed };
};

const ESTILO_ORIGEN = {
  salon: 'bg-amber-400 text-slate-950',
  llevar: 'bg-cyan-500 text-slate-950',
  delivery: 'bg-indigo-500 text-white',
  pedidosya: 'bg-rose-500 text-white',
};

// Semáforo de espera: verde < 10 min, ámbar < 20 min, rojo desde 20 min
const nivelEspera = (min) => {
  if (min == null) return { chip: 'bg-slate-800 text-slate-300', texto: 'text-slate-300', borde: 'border-slate-700', barra: 'bg-slate-600' };
  if (min < 10) return { chip: 'bg-emerald-500/15 text-emerald-300', texto: 'text-emerald-300', borde: 'border-slate-700', barra: 'bg-emerald-500' };
  if (min < 20) return { chip: 'bg-amber-500/20 text-amber-300', texto: 'text-amber-300', borde: 'border-amber-500/60', barra: 'bg-amber-500' };
  return { chip: 'bg-red-500/25 text-red-300 animate-pulse', texto: 'text-red-300', borde: 'border-red-500/80', barra: 'bg-red-500' };
};

const formatoEspera = (min) => {
  if (min == null) return '';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

const horaLima = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

/**
 * Monitor de preparación compartido por Cocina y Barra.
 * Cada página pasa sus endpoints, textos y acento de color.
 */
export default function MonitorPreparacion({
  titulo,
  subtitulo,
  Icon,
  acento, // { texto, fondoSuave, boton, botonHover, anillo }
  cargarPedidos,
  cargarCancelaciones,
  descartarCancelacion,
  marcarPedidoListo,
  marcarItemListo, // opcional: solo cocina marca platos individuales
  mostrarEnsalada = false,
  etiquetaCancelacion = 'Pedido cancelado',
  textoVacio = 'Sin pedidos pendientes',
  subtextoVacio = 'Todo al día.',
}) {
  const [pedidos, setPedidos] = useState([]);
  const [cancelaciones, setCancelaciones] = useState([]);
  const [ahora, setAhora] = useState(() => Date.now());
  const [hora, setHora] = useState(horaLima);
  const [filtro, setFiltro] = useState('todos');
  const [confirmandoPedidoId, setConfirmandoPedidoId] = useState(null);
  const [confirmandoItemId, setConfirmandoItemId] = useState(null);
  const [despachando, setDespachando] = useState(false);

  const fetchPedidos = useCallback(async () => {
    try {
      const data = await cargarPedidos();
      if (Array.isArray(data)) setPedidos(data);
    } catch (err) {
      console.error(`Error cargando ${titulo}:`, err);
    }
  }, [cargarPedidos, titulo]);

  const fetchCancelaciones = useCallback(async () => {
    try {
      const data = await cargarCancelaciones();
      if (Array.isArray(data)) setCancelaciones(data);
    } catch (err) {
      console.error('Error cargando cancelaciones:', err);
    }
  }, [cargarCancelaciones]);

  useEffect(() => {
    fetchPedidos();
    fetchCancelaciones();

    // Refresco periódico cada 2 segundos
    const interval = setInterval(() => {
      fetchPedidos();
      fetchCancelaciones();
      setAhora(Date.now());
      setHora(horaLima());
    }, 2000);

    // Refresco inmediato al tocar la pantalla o reactivar la pestaña
    let lastImmediateFetch = 0;
    const triggerInstantRefresh = () => {
      const now = Date.now();
      if (now - lastImmediateFetch > 1000) {
        lastImmediateFetch = now;
        fetchPedidos();
        fetchCancelaciones();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerInstantRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', triggerInstantRefresh);
    window.addEventListener('pointerdown', triggerInstantRefresh, { passive: true });

    // Wake Lock para que la tablet o el monitor no se suspenda
    let wakeLock = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch {
          // El navegador no soporta o rechazó el wake lock
        }
      }
    };
    requestWakeLock();
    document.addEventListener('visibilitychange', requestWakeLock);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', requestWakeLock);
      window.removeEventListener('focus', triggerInstantRefresh);
      window.removeEventListener('pointerdown', triggerInstantRefresh);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [fetchPedidos, fetchCancelaciones]);

  // Confirmación en 2 toques: el primer toque arma, el segundo ejecuta (se desarma a los 3.5 s)
  const handleClicListoPedido = (pedidoId) => {
    if (confirmandoPedidoId === pedidoId) {
      ejecutarMarcarListo(pedidoId);
      setConfirmandoPedidoId(null);
    } else {
      setConfirmandoPedidoId(pedidoId);
      setTimeout(() => setConfirmandoPedidoId(prev => (prev === pedidoId ? null : prev)), 3500);
    }
  };

  const ejecutarMarcarListo = async (pedidoId) => {
    setDespachando(true);
    try {
      await marcarPedidoListo(pedidoId);
      await fetchPedidos();
    } catch (err) {
      alert('Error al marcar listo: ' + err.message);
    } finally {
      setDespachando(false);
    }
  };

  const handleClicListoItem = (itemId) => {
    if (confirmandoItemId === itemId) {
      setConfirmandoItemId(null);
      marcarItemListo(itemId)
        .then(fetchPedidos)
        .catch(err => alert('Error al marcar listo el plato: ' + err.message));
    } else {
      setConfirmandoItemId(itemId);
      setTimeout(() => setConfirmandoItemId(prev => (prev === itemId ? null : prev)), 3500);
    }
  };

  const dismissCancelacion = async (id) => {
    try {
      await descartarCancelacion(id);
    } finally {
      setCancelaciones(prev => prev.filter(c => c.id !== id));
    }
  };

  const minutosEspera = (p) => (p.createdAt ? Math.max(0, Math.floor((ahora - new Date(p.createdAt).getTime()) / 60000)) : null);

  const conOrigen = pedidos.map(p => ({ ...p, origen: origenPedido(p), espera: minutosEspera(p) }));
  const nSalon = conOrigen.filter(p => p.origen.tipo === 'salon').length;
  const nFuera = conOrigen.length - nSalon;
  const esperaMax = conOrigen.reduce((m, p) => (p.espera != null && p.espera > m ? p.espera : m), 0);
  const nUnidades = conOrigen.reduce((s, p) => s + p.items.reduce((a, i) => a + (i.cant || 0), 0), 0);
  const visibles = conOrigen.filter(p => filtro === 'todos' || (filtro === 'salon' ? p.origen.tipo === 'salon' : p.origen.tipo !== 'salon'));

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full bg-slate-950 text-white">

      {/* BARRA SUPERIOR */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 px-4 md:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${acento.fondoSuave} ${acento.texto}`}><Icon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">{titulo}</h1>
            <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              En vivo · {subtitulo}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-800">
            {[['todos', `Todos ${conOrigen.length}`], ['salon', `Salón ${nSalon}`], ['fuera', `Llevar ${nFuera}`]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filtro === id ? `${acento.boton} text-white shadow` : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-11 px-3 rounded-xl bg-slate-800 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-slate-300" title="Unidades por preparar"><span className="font-mono font-semibold text-white">{nUnidades}</span> unid.</span>
            <span className={`flex items-center gap-1.5 ${nivelEspera(conOrigen.length ? esperaMax : null).texto}`} title="Mayor tiempo de espera">
              <Timer className="w-4 h-4" /> <span className="font-mono font-semibold">{conOrigen.length ? formatoEspera(esperaMax) : '—'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 border-l border-slate-700 pl-4">
              <Clock className="w-4 h-4 text-slate-500" /> <span className="font-mono font-semibold text-white">{hora}</span>
            </span>
          </div>
        </div>
      </header>

      {/* ALERTAS DE CANCELACIÓN (persisten hasta tocar "Entendido") */}
      {cancelaciones.length > 0 && (
        <div className="shrink-0 bg-red-950/80 border-b-2 border-red-600 px-4 md:px-6 py-3 space-y-2 max-h-[40dvh] overflow-y-auto custom-scrollbar">
          {cancelaciones.map((c) => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-500/70 bg-red-900/60 p-3.5" style={{ animation: 'pulse 1.5s ease-in-out 3' }}>
              <AlertTriangle className="w-7 h-7 text-red-300 shrink-0 hidden sm:block" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide text-red-100 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-300 shrink-0" /> {etiquetaCancelacion} · {c.mesaInfo}
                </p>
                <p className="text-xs text-red-300/90 mb-2">
                  Por {c.canceladoPor} · {new Date(c.canceladoEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.items.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-red-800/80 px-2.5 py-1 text-sm font-semibold text-red-50">
                      <span className="text-red-300 font-mono">{item.cantidad}×</span> {item.nombre}
                      {item.notas && <span className="text-red-300 italic font-normal">· {item.notas}</span>}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissCancelacion(c.id)}
                className="h-11 px-5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-sm font-bold uppercase tracking-wide transition-all shrink-0"
              >
                ✓ Entendido
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TICKETS */}
      <section className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-6">
        {visibles.length === 0 ? (
          <div className="h-full min-h-[50dvh] flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 grid place-items-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-xl font-bold">{conOrigen.length > 0 ? 'Nada en este filtro' : textoVacio}</p>
            <p className="text-slate-400 mt-1">{conOrigen.length > 0 ? 'Cambia el filtro para ver los demás pedidos.' : subtextoVacio}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]">
            {visibles.map((p, idx) => {
              const { origen, espera } = p;
              const nivel = nivelEspera(espera);
              const armado = confirmandoPedidoId === p.pedidoId;
              return (
                <article key={p.pedidoId} className={`rounded-2xl border-2 ${nivel.borde} bg-slate-900 flex flex-col overflow-hidden shadow-xl shadow-black/30`}>
                  {/* Cabecera */}
                  <div className={`px-4 py-3 ${ESTILO_ORIGEN[origen.tipo]} relative`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest opacity-80 flex items-center gap-1.5">
                          <origen.Icon className="w-3.5 h-3.5" /> {origen.etiqueta}
                          <span className="opacity-70">· #{idx + 1}</span>
                        </p>
                        <h2 className="text-2xl font-black uppercase leading-tight truncate">{origen.titulo}</h2>
                      </div>
                      {p.adicional && origen.tipo === 'salon' && (
                        <span className="shrink-0 rounded-lg bg-red-600 text-white text-[11px] font-black px-2 py-1 uppercase tracking-wide animate-pulse">Adicional</span>
                      )}
                    </div>
                  </div>

                  {/* Mozo, hora y espera */}
                  <div className="px-4 py-2 flex items-center justify-between gap-2 text-xs border-b border-slate-800">
                    <span className="flex items-center gap-1.5 text-slate-300 min-w-0"><User className="w-3.5 h-3.5 text-slate-500 shrink-0" /><span className="truncate">{p.mesero}</span></span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-500 font-mono">{p.hora}</span>
                      {espera != null && <span className={`rounded-md px-2 py-0.5 font-mono font-semibold ${nivel.chip}`}>{formatoEspera(espera)}</span>}
                    </span>
                  </div>

                  {mostrarEnsalada && p.estadoEnsalada && p.estadoEnsalada !== 'No Aplica' && (
                    <div className="px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1.5"><Salad className="w-3.5 h-3.5" /> Ensalada</span>
                      {p.estadoEnsalada === 'Pendiente'
                        ? <span className="rounded-md bg-emerald-500/15 text-emerald-300 px-2 py-0.5 font-semibold animate-pulse">Pendiente</span>
                        : <span className="rounded-md bg-sky-500/15 text-sky-300 px-2 py-0.5 font-semibold">Lista</span>}
                    </div>
                  )}

                  {/* Items */}
                  <ul className="flex-1 divide-y divide-slate-800/80">
                    {p.items.map((item, i) => {
                      const itemArmado = marcarItemListo && confirmandoItemId === item.id;
                      return (
                        <li key={item.id ?? i} className="px-4 py-2.5">
                          <div className="flex items-start gap-3">
                            <span className={`min-w-9 h-9 px-1.5 rounded-lg grid place-items-center font-mono text-lg font-black shrink-0 ${acento.fondoSuave} ${acento.texto}`}>{item.cant}</span>
                            <p className="flex-1 min-w-0 pt-1.5 text-[15px] font-semibold uppercase leading-snug text-slate-50">{item.nombre}</p>
                            {marcarItemListo && item.id != null && (
                              <button
                                type="button"
                                onClick={() => handleClicListoItem(item.id)}
                                className={`h-9 rounded-lg shrink-0 transition-all active:scale-90 ${itemArmado ? 'px-3 bg-amber-500 text-slate-950 text-xs font-bold animate-pulse' : 'w-9 grid place-items-center text-slate-500 border border-slate-700 hover:text-white hover:bg-emerald-600 hover:border-emerald-600'}`}
                                title={itemArmado ? 'Toca de nuevo para confirmar' : 'Marcar este plato como listo'}
                              >
                                {itemArmado ? '¿Listo?' : <CheckCircle2 className="w-5 h-5" />}
                              </button>
                            )}
                          </div>
                          {item.notas && (
                            <p className="mt-2 ml-12 rounded-lg bg-amber-400 text-slate-950 px-2.5 py-1.5 text-sm font-bold uppercase leading-snug">
                              📋 {item.notas}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Barra de espera */}
                  {espera != null && (
                    <div className="h-1 bg-slate-800">
                      <div className={`h-full ${nivel.barra} transition-all`} style={{ width: `${Math.min(100, (espera / 30) * 100)}%` }} />
                    </div>
                  )}

                  {/* Acción: listo con confirmación de 2 toques */}
                  <div className="p-3">
                    {armado ? (
                      <div className="flex gap-2 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => handleClicListoPedido(p.pedidoId)}
                          disabled={despachando}
                          className="flex-1 h-14 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-sm font-black uppercase tracking-wide inline-flex items-center justify-center gap-2 animate-pulse transition-all disabled:opacity-50"
                        >
                          <CheckCheck className="w-5 h-5" /> ¿Confirmar?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoPedidoId(null)}
                          className="w-14 h-14 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 grid place-items-center"
                          title="Cancelar"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleClicListoPedido(p.pedidoId)}
                        disabled={despachando}
                        className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-base font-bold uppercase tracking-wide inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <CheckCheck className="w-5 h-5" />
                        {origen.tipo === 'salon' ? 'Listo · Servir' : 'Listo · Recoger'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
