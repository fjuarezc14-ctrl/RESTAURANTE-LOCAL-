// ================================================================
// MODAL DE MOVIMIENTO DE CAJA (INGRESO / RETIRO DE EFECTIVO)
// VT VALETEC — Módulo Caja
// ================================================================
import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, AlertTriangle } from 'lucide-react';
import { Dialog, DialogHeader, DialogFooter, Button } from '../../../components/ui';
import { api } from '../../../api';
import { movimientoCaja } from '@shared/esquemas/caja.js';

// El contenido se monta de nuevo cada vez que se abre: los campos empiezan limpios (sin efecto que los reinicie)
export function ModalRetiroCaja(props) {
  if (!(props.abierto)) return null;
  return <ModalRetiroCajaContenido {...props} />;
}

function ModalRetiroCajaContenido({
  abierto,
  onCerrar,
  onMovimientoExitoso,
  cajeroNombre = 'Cajero',
  tipoInicial = 'RETIRO',
}) {
  const [tipo, setTipo] = useState(tipoInicial); // 'RETIRO' | 'INGRESO'
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const esIngreso = tipo === 'INGRESO';
  const acento = esIngreso
    ? {
        icono: 'bg-emerald-500 text-white',
        foco: 'focus:border-emerald-500',
        chip: 'bg-emerald-600 text-white border-emerald-600',
        boton: 'success',
        nota: 'text-emerald-600',
      }
    : {
        icono: 'bg-rose-500 text-white',
        foco: 'focus:border-rose-500',
        chip: 'bg-rose-500 text-white border-rose-600',
        boton: 'destructive',
        nota: 'text-rose-500',
      };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const montoNum = parseFloat(monto) || 0;
    const motivoTexto = (motivo || '').trim();

    const validacion = movimientoCaja.safeParse({
      monto: montoNum,
      motivo: motivoTexto,
      tipo,
      cajeroNombre: cajeroNombre || undefined,
    });

    if (!validacion.success) {
      setError(validacion.error.issues?.[0]?.message || 'Verifica los datos del movimiento.');
      return;
    }

    setGuardando(true);
    try {
      const res = await api.registrarMovimientoCaja(validacion.data);

      if (res.error) {
        throw new Error(res.error);
      }

      if (onMovimientoExitoso) {
        await onMovimientoExitoso({ tipo, monto: montoNum, motivo: motivo.trim(), res });
      }
      onCerrar();
    } catch (err) {
      setError(err.message || 'Error al registrar movimiento.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} className="max-w-md">
      <DialogHeader
        icon={esIngreso ? ArrowDownLeft : ArrowUpRight}
        iconClassName={acento.icono}
        title="Movimiento de Caja"
        onClose={onCerrar}
      >
        <p className="text-xs text-slate-400 mt-0.5">
          {esIngreso ? 'Entrada de dinero a la gaveta' : 'Salida de dinero de la gaveta'}
        </p>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Selector de Tipo (Pestañas) */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => {
                setTipo('RETIRO');
                setError('');
              }}
              className={`h-10 rounded-lg text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipo === 'RETIRO'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Retiro
            </button>
            <button
              type="button"
              onClick={() => {
                setTipo('INGRESO');
                setError('');
              }}
              className={`h-10 rounded-lg text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipo === 'INGRESO'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" /> Ingreso
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between">
              <span>{esIngreso ? 'Monto a ingresar a la gaveta:' : 'Monto a retirar de la gaveta:'}</span>
              <span className={`font-bold ${acento.nota}`}>
                {esIngreso ? 'Suma al arqueo' : 'Resta al arqueo'}
              </span>
            </label>
            <div className="relative mb-2">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">
                S/
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                autoFocus
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={`w-full bg-white border-2 border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-lg font-black text-slate-900 focus:outline-none shadow-inner ${acento.foco}`}
              />
            </div>

            {/* Atajos de montos */}
            <div className="grid grid-cols-4 gap-1.5">
              {[10, 20, 50, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMonto(String(val))}
                  className={`py-1.5 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                    monto === String(val)
                      ? `${acento.chip} shadow-sm`
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  S/ {val}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
              {esIngreso ? 'Motivo / Concepto del ingreso:' : 'Motivo / Concepto del retiro:'}
            </label>
            <input
              type="text"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                esIngreso
                  ? 'Ej. Sencillo adicional, reposición de caja…'
                  : 'Ej. Compra de hielo, pasaje delivery, gas urgente…'
              }
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none ${acento.foco}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant={acento.boton}
            type="submit"
            disabled={guardando}
            className="w-full sm:w-auto"
          >
            {guardando
              ? 'Registrando...'
              : esIngreso
              ? 'Confirmar ingreso'
              : 'Confirmar retiro'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default ModalRetiroCaja;
