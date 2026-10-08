// ================================================================
// MODAL DE APERTURA DE CAJA / INICIO DE TURNO
// VT VALETEC — Módulo Caja
// ================================================================
import { useState } from 'react';
import { Banknote, AlertTriangle, ChevronDown } from 'lucide-react';
import { Dialog, DialogHeader, DialogFooter, Button } from '../../../components/ui';
import { CalculadoraEfectivoPEN } from '../componentes/CalculadoraEfectivoPEN';
import { api } from '../../../api';
import { aperturaCaja } from '@shared/esquemas/caja.js';

// El contenido se monta de nuevo cada vez que se abre: los campos empiezan limpios (sin efecto que los reinicie)
export function ModalAperturaCaja(props) {
  if (!(props.abierto)) return null;
  return <ModalAperturaCajaContenido {...props} />;
}

function ModalAperturaCajaContenido({
  abierto,
  onCerrar,
  onAperturaExitosa,
  cajerosDisponibles = [],
  cajeroNombrePorDefecto = '',
}) {
  const [cajeroNombre, setCajeroNombre] = useState(cajeroNombrePorDefecto || (cajerosDisponibles[0]?.nombre || ''));
  const [modoOtroCajero, setModoOtroCajero] = useState(false);
  const [montoInicialInput, setMontoInicialInput] = useState('');
  const [conteoApertura, setConteoApertura] = useState({});
  const [notaAperturaInput, setNotaAperturaInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiarCantidadApertura = (valor, cantidad) => {
    const cant = Math.max(0, parseInt(cantidad) || 0);
    const nuevoConteo = { ...conteoApertura };
    if (cant > 0) {
      nuevoConteo[valor] = cant;
    } else {
      delete nuevoConteo[valor];
    }
    setConteoApertura(nuevoConteo);

    const totalConteo = Object.entries(nuevoConteo).reduce(
      (sum, [val, c]) => sum + Number(val) * Number(c),
      0
    );
    setMontoInicialInput(totalConteo > 0 ? totalConteo.toFixed(2) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nombreFinal = (cajeroNombre || '').trim();
    const montoNum = parseFloat(montoInicialInput) || 0;

    const validacion = aperturaCaja.safeParse({
      cajeroNombre: nombreFinal,
      montoInicial: montoNum,
      notaApertura: notaAperturaInput.trim() || undefined,
    });

    if (!validacion.success) {
      setError(validacion.error.issues?.[0]?.message || 'Verifica los datos de apertura.');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      const res = await api.abrirCaja(validacion.data);

      if (res.error) {
        throw new Error(res.error);
      }

      if (onAperturaExitosa) {
        await onAperturaExitosa(res);
      }
      onCerrar();
    } catch (err) {
      setError(err.message || 'Error al aperturar la caja.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} className="max-w-2xl">
      <DialogHeader
        icon={Banknote}
        iconClassName="bg-emerald-500 text-slate-950"
        title="Apertura de Caja"
        onClose={onCerrar}
      >
        <p className="text-xs text-slate-400 mt-0.5">
          Iniciar nuevo turno y registrar fondo inicial de sencillo
        </p>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 max-h-[75vh]">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 flex justify-between items-center">
              <span>Cajero(a) a quien se le aperturará la caja:</span>
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Personal Registrado
              </span>
            </label>
            <div className="relative">
              <select
                required
                value={modoOtroCajero ? '__OTRO__' : cajeroNombre}
                onChange={(e) => {
                  if (e.target.value === '__OTRO__') {
                    setModoOtroCajero(true);
                    setCajeroNombre('');
                  } else {
                    setModoOtroCajero(false);
                    setCajeroNombre(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none transition-all cursor-pointer appearance-none pr-9 shadow-2xs"
              >
                <option value="" disabled>
                  -- Selecciona el Cajero(a) --
                </option>
                {cajerosDisponibles.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    {u.nombre} · ({u.rol || 'Personal'})
                  </option>
                ))}
                {cajerosDisponibles.length === 0 && (
                  <option value={cajeroNombre || 'María'}>
                    {cajeroNombre || 'María'} (Cajero)
                  </option>
                )}
                <option value="__OTRO__">✍️ Ingresar otro nombre manualmente...</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {modoOtroCajero && (
              <div className="mt-2 animate-fade-in">
                <input
                  type="text"
                  required
                  value={cajeroNombre}
                  onChange={(e) => setCajeroNombre(e.target.value)}
                  placeholder="Escribe el nombre del cajero(a)..."
                  autoFocus
                  className="w-full bg-white border-2 border-emerald-500 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none shadow-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Escribe el nombre del cajero responsable para este turno.
                </p>
              </div>
            )}
          </div>

          {/* Calculadora de Sencillo */}
          <div className="pt-1">
            <CalculadoraEfectivoPEN
              conteo={conteoApertura}
              onChangeCantidad={cambiarCantidadApertura}
              onLimpiar={() => {
                setConteoApertura({});
                setMontoInicialInput('');
              }}
              titulo="Calculadora de Sencillo (Billetes y Monedas)"
            />
          </div>

          {/* Total y campo manual de fondo inicial */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Fondo Inicial Total en Gaveta:
                </span>
                <p className="text-xs text-slate-400">
                  Calculado por las denominaciones o ingresado directamente
                </p>
              </div>
              <div className="relative w-full sm:w-44">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                  S/
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={montoInicialInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '' && parseFloat(val) < 0) return;
                    setConteoApertura({});
                    setMontoInicialInput(val);
                  }}
                  className="w-full bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-1.5 text-base font-black font-mono text-slate-900 focus:outline-none shadow-inner text-right"
                />
              </div>
            </div>

            {/* Accesos directos de fondo de caja */}
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Rápidos:
              </span>
              {[0, 50, 100, 150].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setConteoApertura({});
                    setMontoInicialInput(String(val));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                    montoInicialInput === String(val) && Object.keys(conteoApertura).length === 0
                      ? 'bg-emerald-500 text-slate-950 border-emerald-600 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {val === 0 ? 'Sin Sencillo' : `S/ ${val}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
              Observación / Nota de Apertura (opcional):
            </label>
            <input
              type="text"
              value={notaAperturaInput}
              onChange={(e) => setNotaAperturaInput(e.target.value)}
              placeholder="Ej. Sencillo recibido para inicio de labores..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="success"
            type="submit"
            disabled={guardando}
            className="w-full sm:w-auto"
          >
            {guardando ? 'Abriendo...' : 'Confirmar Apertura'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default ModalAperturaCaja;
