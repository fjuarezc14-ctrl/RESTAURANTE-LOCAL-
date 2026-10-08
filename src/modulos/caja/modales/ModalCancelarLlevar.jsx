import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '../../../api';
import { Dialog } from '../../../components/ui';

/**
 * Modal para autorizar y ejecutar la cancelación de un pedido de Llevar / Delivery
 */
export default function ModalCancelarLlevar({
  abierto,
  pedido,
  onCerrar,
  onCanceladoExitoso,
  usuarioOperador,
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  if (!abierto || !pedido) return null;

  const handleCancelarOrden = async () => {
    if (!motivo.trim()) {
      setError('Escribe el motivo de la cancelación.');
      return;
    }
    if (!pin.trim()) {
      setError('El PIN es obligatorio.');
      return;
    }

    setProcesando(true);
    setError('');

    try {
      const auth = await api.validateAuth(pin.trim());
      if (!auth || !auth.ok) {
        setError('PIN incorrecto. Autorización denegada.');
        return;
      }

      const res = await api.cancelarPedido(pedido.pedidoId, {
        canceladoPor: usuarioOperador,
        motivo: motivo.trim(),
        force: true,
        autorizacion: { pin: pin.trim() }, // el backend vuelve a validar el PIN
      });

      if (res.ok) {
        setPin('');
        setMotivo('');
        onCanceladoExitoso?.();
        onCerrar();
      } else {
        setError(res.error || 'No se pudo cancelar el pedido.');
      }
    } catch (err) {
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open onClose={procesando ? undefined : () => { onCerrar(); setPin(''); setMotivo(''); setError(''); }} closeOnBackdrop={false} capa="z-[260]" className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white flex justify-between items-center">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            Autorizar Cancelación
          </h3>
          <p className="text-xs font-bold opacity-90 mt-0.5">
            Pedido: {pedido.codigoPedidosYa || `ID: ${pedido.pedidoId}`} · Total: S/ {Number(pedido.total || 0).toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onCerrar(); setPin(''); setMotivo(''); setError(''); }}
          className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="bg-red-50 rounded-2xl p-3 border border-red-100 text-slate-800 text-xs font-semibold leading-relaxed">
          ⚠️ <strong className="font-black text-red-700">Atención:</strong> Esta acción cancelará la orden del cliente de forma permanente y enviará una alerta en tiempo real a cocina/barra.
        </div>

        {/* Detalle de ítems del pedido */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            Detalle del Pedido a Cancelar:
          </p>
          <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
            {pedido.items && pedido.items.length > 0 ? (
              pedido.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1.5 text-xs text-slate-800 font-bold uppercase">
                  <span>{item.cant}× {item.nombre}</span>
                  <span className="font-mono text-slate-600">S/ {(item.cant * item.precio).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">Sin productos registrados</p>
            )}
          </div>
        </div>

        {/* Motivo (queda en el reporte de anulaciones y en la auditoría) */}
        <div>
          <label htmlFor="motivo-cancelar-llevar" className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Motivo de la cancelación</label>
          <textarea
            id="motivo-cancelar-llevar"
            rows={2}
            maxLength={300}
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setError(''); }}
            placeholder="Ej. el cliente ya no quiere el pedido"
            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 focus:bg-white rounded-2xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none resize-none transition-all"
          />
        </div>

        {/* PIN Admin */}
        <div>
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN del Administrador</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleCancelarOrden()}
            placeholder="••••••"
            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
            style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
            autoComplete="off"
            name="cancel-pin-auth"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => { onCerrar(); setPin(''); setMotivo(''); setError(''); }}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
          >
            Regresar
          </button>
          <button
            type="button"
            onClick={handleCancelarOrden}
            disabled={!pin.trim() || !motivo.trim() || procesando}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-2xl transition-all disabled:opacity-50 shadow-md shadow-red-500/20 cursor-pointer"
          >
            {procesando ? 'Cancelando...' : '✓ Cancelar Orden'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
