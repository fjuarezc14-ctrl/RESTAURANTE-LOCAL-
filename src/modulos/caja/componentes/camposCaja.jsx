// Piezas pequeñas que comparten los paneles y modales de Caja

// Punto de color + texto: verde si está listo, ámbar (parpadeando) si sigue pendiente
export const estadoChip = (listo, textoListo, textoPendiente) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${listo ? 'text-emerald-700' : 'text-amber-700'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${listo ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
    {listo ? textoListo : textoPendiente}
  </span>
);

// Campo del Nº de operación (Yape/Plin) o voucher (tarjeta), para verificar el pago después
export const campoCodigoPago = (valor, setValor, medio) => (
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
      placeholder="Ej. 01234567"
      className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition"
    />
  </div>
);
