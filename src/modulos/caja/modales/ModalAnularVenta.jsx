import React, { useState } from 'react';
import { Ban, X, AlertTriangle } from 'lucide-react';
import { api } from '../../../api';

/**
 * Modal para autorizar y registrar la devolución o anulación de una venta
 */
export default function ModalAnularVenta({
  abierto,
  venta,
  onCerrar,
  onAnulacionExitosa,
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (!abierto || !venta) return null;

  const handleProcesar = async () => {
    if (!pin.trim()) {
      setError('Por favor ingresa el PIN de Administrador.');
      return;
    }
    if (!motivo.trim()) {
      setError('Por favor ingresa el motivo de la devolución / anulación.');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const res = await api.anularVenta(venta.id, pin.trim(), motivo.trim());
      if (res.error) {
        setError(res.error);
        return;
      }
      setPin('');
      setMotivo('');
      onAnulacionExitosa?.();
      onCerrar();
    } catch (err) {
      setError(err.message || 'Error al procesar devolución');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
              <Ban className="w-5 h-5 animate-pulse" />
              Registrar Devolución
            </h3>
            <p className="text-xs font-bold opacity-90 mt-0.5">
              Venta #{venta.id} ({venta.tipoComprobante}) · Original: S/ {Number(venta.montoOriginal || venta.total || 0).toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onCerrar(); setPin(''); setMotivo(''); setError(''); }}
            className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 p-3 rounded-2xl text-red-900 text-xs font-medium space-y-1">
            <div className="font-black flex items-center gap-1.5 text-red-700 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              Atención sobre Devoluciones
            </div>
            <p className="text-[11px] text-red-800 leading-snug">
              Esta venta <strong>permanecerá en el historial</strong> para auditoría, pero su monto cambiará a <strong>S/ 0.00</strong> para que no afecte el arqueo de caja.
            </p>
          </div>

          {/* Motivo de Devolución */}
          <div>
            <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
              Motivo de Devolución / Anulación:
            </label>
            <textarea
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setError(''); }}
              placeholder="Ej: Cliente devolvió pedido por demora / Pedido equivocado / Cancelación..."
              rows={2}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl p-2.5 font-medium text-slate-800 text-xs focus:outline-none resize-none"
            />
          </div>

          {/* PIN de Administrador */}
          <div>
            <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
              PIN de Autorización (Administrador):
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleProcesar()}
              placeholder="••••"
              maxLength={6}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 text-center font-mono font-black text-slate-900 tracking-[0.5em] text-lg focus:outline-none"
              style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
              autoComplete="off"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { onCerrar(); setPin(''); setMotivo(''); setError(''); }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProcesar}
              disabled={cargando || !pin.trim() || !motivo.trim()}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
            >
              {cargando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {cargando ? 'Procesando...' : 'Confirmar Devolución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
