import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Modal para corregir el método de pago de una venta ya realizada
 */
export default function ModalCorregirMetodoPago({
  abierto,
  venta,
  onCerrar,
  onGuardar,
}) {
  const [nuevoMetodo, setNuevoMetodo] = useState('Efectivo');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estados para desglose si nuevo método es Mixto
  const [mixtoEfectivo, setMixtoEfectivo] = useState('');
  const [mixtoTarjeta, setMixtoTarjeta] = useState('');
  const [mixtoYape, setMixtoYape] = useState('');

  if (!abierto || !venta) return null;

  const handleConfirmar = async () => {
    if (!pin.trim()) {
      setError('Ingresa el PIN de Administrador.');
      return;
    }
    if (!nuevoMetodo) {
      setError('Selecciona el nuevo método de pago.');
      return;
    }

    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    const total = venta.total;

    if (nuevoMetodo === 'Mixto') {
      const efecVal = parseFloat(mixtoEfectivo || 0);
      const tarjVal = parseFloat(mixtoTarjeta || 0);
      const yapeVal = parseFloat(mixtoYape || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0) {
        setError('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (tarjVal + yapeVal > total) {
        setError('La suma de Tarjeta y Yape / Plin no puede superar el total a pagar.');
        return;
      }

      const restante = total - (tarjVal + yapeVal);
      if (efecVal < restante) {
        setError(`Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}. Faltan S/ ${(restante - efecVal).toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
    }

    setGuardando(true);
    setError('');

    try {
      await onGuardar({
        ventaId: venta.id,
        nuevoMetodo,
        pin: pin.trim(),
        desgloseMixto: {
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
        },
      });
      setPin('');
      setNuevoMetodo('Efectivo');
      onCerrar();
    } catch (err) {
      setError(err.message || 'Error al cambiar método de pago');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-slate-950 flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              Corregir Método de Pago
            </h3>
            <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{venta.id} · S/ {venta.total.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => { onCerrar(); setPin(''); setError(''); }}
            className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Método anterior */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Método actual</p>
            <p className="font-black text-slate-800 uppercase text-sm">{venta.metodoPago}</p>
          </div>

          {/* Nuevo método */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Método de Pago</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto'].map(mp => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => setNuevoMetodo(mp)}
                  className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                    nuevoMetodo === mp
                      ? mp === 'Efectivo' ? 'bg-emerald-500 border-emerald-600 text-white' :
                        mp === 'Tarjeta' ? 'bg-blue-500 border-blue-600 text-white' :
                        mp === 'Yape' ? 'bg-purple-500 border-purple-600 text-white' :
                        mp === 'Consumo' ? 'bg-slate-700 border-slate-800 text-white' :
                        mp === 'Cortesía' ? 'bg-cyan-500 border-amber-600 text-slate-950' :
                        mp === 'Mixto' ? 'bg-orange-500 border-orange-600 text-white' :
                        'bg-indigo-500 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {mp === 'Efectivo' ? '💵' : mp === 'Tarjeta' ? '💳' : mp === 'Yape' ? '📱' : mp === 'Consumo' ? '👤' : mp === 'Cortesía' ? '🎁' : mp === 'Mixto' ? '➕' : '🛵'} {mp === 'Consumo' ? 'Consumo' : mp === 'Cortesía' ? 'Corte.' : mp}
                </button>
              ))}
            </div>
          </div>

          {/* Pago Mixto para Corrección */}
          {nuevoMetodo === 'Mixto' && (() => {
            const total = venta.total;
            const efecVal = parseFloat(mixtoEfectivo || 0);
            const tarjVal = parseFloat(mixtoTarjeta || 0);
            const yapeVal = parseFloat(mixtoYape || 0);
            const ingresado = efecVal + tarjVal + yapeVal;
            const restante = Math.max(0, total - (tarjVal + yapeVal));
            const vuelto = efecVal > restante ? efecVal - restante : 0;
            const diferencia = total - ingresado;

            return (
              <div className="bg-cyan-500/5 border border-amber-500/20 p-3 rounded-2xl shadow-sm space-y-3">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-amber-600 flex justify-between">
                  <span>Desglose de Pago Mixto</span>
                  <span>Total: S/ {total.toFixed(2)}</span>
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💵 Efec. (S/)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={mixtoEfectivo}
                      onChange={(e) => setMixtoEfectivo(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💳 Tarj. (S/)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={mixtoTarjeta}
                      onChange={(e) => setMixtoTarjeta(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">📱 Yape (S/)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={mixtoYape}
                      onChange={(e) => setMixtoYape(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-1 text-[9px] font-bold text-slate-500">
                  <div className="flex justify-between">
                    <span>Ingresado:</span>
                    <span className="font-mono text-slate-700">S/ {ingresado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Faltante:</span>
                    <span className={`font-mono ${diferencia > 0 ? 'text-red-650' : 'text-emerald-600'}`}>
                      S/ {Math.max(0, diferencia).toFixed(2)}
                    </span>
                  </div>
                  {vuelto > 0 && (
                    <div className="flex justify-between col-span-2 border-t border-slate-100 pt-1 mt-0.5 text-[10px] text-emerald-700 font-black">
                      <span>💸 Vuelto:</span>
                      <span className="font-mono">S/ {vuelto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* PIN Admin */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Administrador</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirmar()}
              placeholder="••••••"
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
              style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
              autoComplete="off"
              name="cambio-pin-auth"
              autoFocus
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { onCerrar(); setPin(''); setError(''); }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={guardando || !pin.trim()}
              className="flex-1 py-3 bg-cyan-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : null}
              {guardando ? 'Guardando...' : 'Confirmar Cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
