import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Modal para corregir el tipo de entrega (ParaLlevar, DeliveryPropio, PedidosYa) de una venta
 */
export default function ModalCorregirTipoEntrega({
  abierto,
  venta,
  onCerrar,
  onGuardar,
}) {
  const [nuevoTipo, setNuevoTipo] = useState('ParaLlevar');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Campos dinámicos
  const [codigoPY, setCodigoPY] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [montoDelivery, setMontoDelivery] = useState('');
  const [montoConCuanto, setMontoConCuanto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  if (!abierto || !venta) return null;

  const handleConfirmar = async () => {
    if (!pin.trim()) {
      setError('Ingresa el PIN de Administrador.');
      return;
    }
    if (nuevoTipo === 'PedidosYa' && !codigoPY.trim()) {
      setError('Ingresa el Código de PedidosYa.');
      return;
    }
    if ((nuevoTipo === 'ParaLlevar' || nuevoTipo === 'DeliveryPropio') && !nombreCliente.trim()) {
      setError('Ingresa el nombre del cliente.');
      return;
    }
    if (nuevoTipo === 'DeliveryPropio' && !direccion.trim()) {
      setError('Ingresa la dirección de envío.');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      await onGuardar({
        ventaId: venta.id,
        datos: {
          tipoEntrega: nuevoTipo,
          codigoPedidosYa: codigoPY.trim(),
          nombreCliente: nombreCliente.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          montoDelivery: parseFloat(montoDelivery || 0),
          montoConCuanto: parseFloat(montoConCuanto || 0),
          metodoPago,
          pin: pin.trim(),
        },
      });
      setPin('');
      onCerrar();
    } catch (err) {
      setError(err.message || 'Error al actualizar tipo de entrega');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-blue-500 p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              Corregir Tipo de Entrega
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

        <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Selector de Nuevo Tipo */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Tipo de Entrega</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'ParaLlevar', label: '🛍️ Llevar' },
                { type: 'DeliveryPropio', label: '🛵 Delivery' },
                { type: 'PedidosYa', label: '🛵 PedidosYa' },
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setNuevoTipo(item.type)}
                  className={`py-3 px-2 rounded-2xl text-xs font-black uppercase border-2 transition-all ${
                    nuevoTipo === item.type
                      ? 'bg-indigo-500 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campos dinámicos según el tipo de entrega */}
          {nuevoTipo === 'PedidosYa' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Código PedidosYa</label>
                <input
                  type="text"
                  value={codigoPY}
                  onChange={e => setCodigoPY(e.target.value)}
                  placeholder="Ej. FG-4821"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                />
              </div>
            </div>
          )}

          {nuevoTipo === 'ParaLlevar' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={e => setNombreCliente(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => setMetodoPago(mp)}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        metodoPago === mp
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {mp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {nuevoTipo === 'DeliveryPropio' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={e => setNombreCliente(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="Ej. 999888777"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Costo Delivery (S/)</label>
                  <input
                    type="number"
                    step="any"
                    value={montoDelivery}
                    onChange={e => setMontoDelivery(e.target.value)}
                    placeholder="Ej. 5.00"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Dirección de Envío</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  placeholder="Ej. Av. Larco 123"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Paga Con (S/)</label>
                  <input
                    type="number"
                    step="any"
                    value={montoConCuanto}
                    onChange={e => setMontoConCuanto(e.target.value)}
                    placeholder="Ej. 100.00"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-1">
                    {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                      <button
                        key={mp}
                        type="button"
                        onClick={() => setMetodoPago(mp)}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border transition-all ${
                          metodoPago === mp
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {mp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
              style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
              autoComplete="off"
              name="cambio-tipo-pin-auth"
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
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              {guardando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {guardando ? 'Guardando...' : 'Confirmar Cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
