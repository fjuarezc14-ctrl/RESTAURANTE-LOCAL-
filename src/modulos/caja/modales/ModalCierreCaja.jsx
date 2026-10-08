// ================================================================
// MODAL DE CIERRE DE CAJA / ARQUEO DE TURNO
// VT VALETEC — Módulo Caja
// ================================================================
import { useState } from 'react';
import { Calculator, Lock, X, Printer } from 'lucide-react';
import { Dialog } from '../../../components/ui';
import { CalculadoraEfectivoPEN } from '../componentes/CalculadoraEfectivoPEN';
import { DENOMINACIONES_PEN } from '../constantes/denominaciones';
import { api } from '../../../api';
import { useAviso, useConfirmar } from '../../../components/ui';
import { TicketCierrePrevio } from '../componentes/TicketCierrePrevio';

// El cierre va 1 s después de la última venta del turno (o ahora, si no hubo ventas)
function momentoDeCierre(ventas) {
  const ultima = ventas.length > 0 ? Math.max(...ventas.map((v) => new Date(v.createdAt).getTime())) : Date.now();
  return new Date(ultima + 1000).toISOString();
}
const haceHoras = (horas) => new Date(Date.now() - horas * 3600 * 1000).toISOString();

// El contenido se monta de nuevo cada vez que se abre: los campos empiezan limpios (sin efecto que los reinicie)
export function ModalCierreCaja(props) {
  if (!(props.abierto)) return null;
  return <ModalCierreCajaContenido {...props} />;
}

function ModalCierreCajaContenido({
  abierto,
  onCerrar,
  onCierreExitoso,
  cajaEstado = { abierto: false, turno: null, resumenEnVivo: null },
  ventas = [],
  abonos = [],
  clientes = [],
  mesas = [],
  ultimoCierre = null,
  empresa = {},
  cajeroNombre = 'Cajero',
  parsearCreditoSplit = () => [],
}) {
  const aviso = useAviso();
  const confirmar = useConfirmar();

  const [efectivoFisicoContado, setEfectivoFisicoContado] = useState('');
  const [conteoBilletes, setConteoBilletes] = useState({});
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  if (!abierto) return null;

  // Si la caja no está abierta
  if (!cajaEstado.abierto) {
    return (
      <Dialog open={abierto} onClose={onCerrar} className="max-w-md">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">La caja se encuentra cerrada</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              No es posible realizar un arqueo o cierre mientras la caja esté cerrada. Por favor, abre un turno de caja primero.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  // --- CÁLCULOS DEL TURNO ACTUAL ---
  const ventasFiltradas = (
    ultimoCierre
      ? ventas.filter((v) => new Date(v.createdAt) > new Date(ultimoCierre))
      : ventas
  ).filter((v) => v.estadoPedido !== 'Cancelado');

  const abonosFiltrados = ultimoCierre
    ? abonos.filter((a) => new Date(a.creadoEn) > new Date(ultimoCierre))
    : abonos;

  const obtenerMontosVenta = (v) => {
    if (!v || v.anulado || v.estadoPedido === 'Cancelado') return { efec: 0, tarj: 0, yape: 0 };
    if (
      v.metodoPago === 'Cortesía' ||
      v.metodoPago === 'Consumo' ||
      v.metodoPago === 'PedidosYa' ||
      v.metodoPago === 'Crédito'
    ) {
      return { efec: 0, tarj: 0, yape: 0 };
    }

    let efec = parseFloat(v.montoEfectivo || 0);
    let tarj = parseFloat(v.montoTarjeta || 0);
    let yape = parseFloat(v.montoYape || 0);
    const total = parseFloat(v.total || 0);

    if (total <= 0) return { efec: 0, tarj: 0, yape: 0 };
    if (v.metodoPago === 'Efectivo') return { efec: total, tarj: 0, yape: 0 };
    if (v.metodoPago === 'Tarjeta') return { efec: 0, tarj: total, yape: 0 };
    if (v.metodoPago === 'Yape') return { efec: 0, tarj: 0, yape: total };

    const creditAmount = parseFloat(v.montoCredito || 0);
    const totalFisico = Math.max(0, total - creditAmount);
    const suma = efec + tarj + yape;
    if (Math.abs(suma - totalFisico) > 0.01) {
      if (suma === 0) efec = totalFisico;
      else if (totalFisico > suma) efec += totalFisico - suma;
    }
    return { efec, tarj, yape };
  };

  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalYape = 0;

  ventasFiltradas.forEach((v) => {
    const { efec, tarj, yape } = obtenerMontosVenta(v);
    totalEfectivo += efec;
    totalTarjeta += tarj;
    totalYape += yape;
  });

  abonosFiltrados.forEach((a) => {
    totalEfectivo += a.montoEfectivo || 0;
    totalTarjeta += a.montoTarjeta || 0;
    totalYape += a.montoYape || 0;
  });

  const totalPedidosYa = ventasFiltradas
    .filter((v) => v.metodoPago === 'PedidosYa' && !v.anulado && v.estadoPedido !== 'Cancelado')
    .reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

  const clienteMap = new Map(clientes.map((c) => [c.id, c.esTrabajador]));
  let totalConsumoPlanilla = 0;
  let totalConsumoClientes = 0;

  ventasFiltradas.forEach((v) => {
    if (v.anulado || v.estadoPedido === 'Cancelado') return;
    if (v.metodoPago === 'Consumo') {
      totalConsumoPlanilla += parseFloat(v.descuentoAplicado || v.total) || 0;
    } else {
      const splits =
        v.creditoSplit ||
        parsearCreditoSplit(
          v.ofertaDescripcion,
          v.clienteCreditoId,
          v.montoCredito > 0 ? v.montoCredito : v.metodoPago === 'Crédito' ? v.total : 0
        );
      if (splits.length > 0) {
        splits.forEach((s) => {
          const esTrab = clienteMap.get(s.clienteId) || false;
          if (esTrab) totalConsumoPlanilla += s.monto;
          else totalConsumoClientes += s.monto;
        });
      } else if (v.metodoPago === 'Crédito') {
        totalConsumoClientes += parseFloat(v.total) || 0;
      } else if (parseFloat(v.montoCredito || 0) > 0) {
        totalConsumoClientes += parseFloat(v.montoCredito);
      }
    }
  });

  const fondoInicialTurno = Math.max(0, Number(cajaEstado.turno?.montoInicial || 0));
  const retirosCaja = Math.max(0, Number(cajaEstado.resumenEnVivo?.retirosCaja || 0));
  const egresosEfectivo = retirosCaja;
  const ingresosCaja = Math.max(0, Number(cajaEstado.resumenEnVivo?.ingresosExtra || 0));

  const totalEfectivoEsperado = Math.max(
    0,
    Math.round((fondoInicialTurno + totalEfectivo + ingresosCaja - egresosEfectivo) * 100) / 100
  );
  const totalCalculado = Math.max(
    0,
    totalEfectivoEsperado + Math.max(0, totalTarjeta) + Math.max(0, totalYape)
  );

  const totalCortesias = Math.max(
    0,
    ventasFiltradas
      .filter((v) => v.metodoPago === 'Cortesía')
      .reduce((s, v) => s + (v.descuentoAplicado || v.total || 0), 0)
  );

  const montoFisicoNum = Math.max(0, parseFloat(efectivoFisicoContado || 0));
  const tieneConteoFisico = efectivoFisicoContado.trim() !== '';
  const diferenciaEfectivo = tieneConteoFisico
    ? Math.round((montoFisicoNum - totalEfectivoEsperado) * 100) / 100
    : 0;

  const totalConteo = DENOMINACIONES_PEN.reduce(
    (s, d) => s + d.valor * (Number(conteoBilletes[d.valor]) || 0),
    0
  );
  const hayConteoDenominaciones = DENOMINACIONES_PEN.some(
    (d) => Number(conteoBilletes[d.valor]) > 0
  );
  const detalleConteo = DENOMINACIONES_PEN.filter(
    (d) => Number(conteoBilletes[d.valor]) > 0
  ).map((d) => ({
    ...d,
    cantidad: Number(conteoBilletes[d.valor]),
    subtotal: d.valor * Number(conteoBilletes[d.valor]),
  }));

  const cambiarCantidad = (valor, cantidad) => {
    const n = Math.max(0, Math.floor(Number(cantidad) || 0));
    const siguiente = { ...conteoBilletes, [valor]: n };
    setConteoBilletes(siguiente);
    const total = DENOMINACIONES_PEN.reduce(
      (s, d) => s + d.valor * (Number(siguiente[d.valor]) || 0),
      0
    );
    setEfectivoFisicoContado(
      DENOMINACIONES_PEN.some((d) => Number(siguiente[d.valor]) > 0) ? total.toFixed(2) : ''
    );
  };

  const cuadra = Math.abs(diferenciaEfectivo) < 0.05;

  const handleCerrarTurno = async () => {
    if (!cajaEstado.abierto) {
      aviso.advertencia('La caja ya se encuentra cerrada. No es posible registrar un nuevo cierre.');
      onCerrar();
      return;
    }

    if (tieneConteoFisico && (isNaN(montoFisicoNum) || montoFisicoNum < 0)) {
      aviso.advertencia('El efectivo contado no puede ser un valor negativo.');
      return;
    }

    const pendientes = mesas.filter((m) => m.estado !== 'Libre' && m.pedidoData);
    if (pendientes.length > 0) {
      const nombresMesas = pendientes.map((m) => `Mesa ${m.num}`).join(', ');
      aviso.advertencia(
        `Aún quedan mesas activas o pendientes de cobro: ${nombresMesas}. Cóbralas o libéralas antes de cerrar caja.`
      );
      return;
    }

    const seguro = await confirmar({
      titulo: 'Confirmar Cierre de Caja',
      mensaje: `¿Estás seguro de cerrar el turno de ${cajaEstado.turno?.cajeroNombre || cajeroNombre}? Total esperado en gaveta: S/ ${totalEfectivoEsperado.toFixed(2)}.`,
      peligro: true,
      botonConfirmar: 'Sí, cerrar turno',
      botonCancelar: 'Cancelar',
    });
    if (!seguro) return;

    const newCierreISO = momentoDeCierre(ventasFiltradas);

    const textoConteo =
      detalleConteo.length > 0
        ? ` Conteo: ${detalleConteo.map((d) => `${d.cantidad}x${d.etiqueta}`).join(', ')}.`
        : '';

    setGuardandoCierre(true);
    try {
      const abonosEfectivoTotal = Math.max(
        0,
        abonosFiltrados.reduce((s, a) => s + (parseFloat(a.montoEfectivo) || 0), 0)
      );
      const contadoFinal = Math.max(0, tieneConteoFisico ? montoFisicoNum : totalEfectivoEsperado);
      const esperadoFinal = Math.max(0, totalEfectivoEsperado);

      await api.registrarCierre({
        fechaApertura: ultimoCierre || haceHoras(8),
        fechaCierre: newCierreISO,
        cajeroNombre: cajeroNombre || 'Cajero',
        montoInicial: Math.max(0, fondoInicialTurno),
        efectivoVentas: Math.max(0, totalEfectivo),
        efectivoEsperado: esperadoFinal,
        efectivoContado: contadoFinal,
        diferencia: Math.round((contadoFinal - esperadoFinal) * 100) / 100,
        totalTarjeta: Math.max(0, totalTarjeta),
        totalYape: Math.max(0, totalYape),
        totalConsumo: Math.max(0, totalConsumoClientes + totalConsumoPlanilla),
        totalPedidosYa: Math.max(0, totalPedidosYa),
        egresosEfectivo: Math.max(0, egresosEfectivo),
        abonosEfectivo: abonosEfectivoTotal,
        nota: tieneConteoFisico
          ? `Conteo físico: S/ ${contadoFinal.toFixed(2)}. Diferencia: S/ ${(
              Math.round((contadoFinal - esperadoFinal) * 100) / 100
            ).toFixed(2)}.${textoConteo}`
          : null,
      });

      localStorage.setItem('ultimoCierre', newCierreISO);

      if (onCierreExitoso) {
        await onCierreExitoso(newCierreISO);
      }

      aviso.exito(
        `Turno cerrado exitosamente. Gaveta esperada: S/ ${totalEfectivoEsperado.toFixed(2)}${
          tieneConteoFisico ? ` | Contado: S/ ${montoFisicoNum.toFixed(2)}` : ''
        }`
      );
      onCerrar();
    } catch (err) {
      // Fallback local por seguridad ante micro-desconexiones
      localStorage.setItem('ultimoCierre', newCierreISO);
      if (onCierreExitoso) {
        await onCierreExitoso(newCierreISO);
      }
      aviso.advertencia(
        `El turno se cerró localmente (sincronización con base de datos falló: ${err.message || 'error de conexión'}).`
      );
      onCerrar();
    } finally {
      setGuardandoCierre(false);
    }
  };

  return (
    <div
      id="modal-cierre"
      className="impresion-ventana fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[200] flex items-end md:items-center justify-center md:p-6 animate-fade-in"
    >
      <div className="bg-white w-full max-w-5xl h-[96dvh] md:h-auto md:max-h-[92dvh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="cierre-no-print flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center shrink-0">
              <Calculator className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                Arqueo y cierre de turno
              </h3>
              <p className="text-sm text-slate-500 truncate">
                {cajaEstado.turno?.cajeroNombre || cajeroNombre} · cuenta el efectivo y cierra la caja
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Calculadora + Ticket */}
        <div className="cierre-grid flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:grid md:grid-cols-2">
          {/* Calculadora (Columna izquierda) */}
          <div className="cierre-no-print order-1 md:overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">
            <CalculadoraEfectivoPEN
              conteo={conteoBilletes}
              onChangeCantidad={cambiarCantidad}
              onLimpiar={() => {
                setConteoBilletes({});
                setEfectivoFisicoContado('');
              }}
              titulo="Conteo físico de efectivo (Billetes y Monedas)"
            />

            {/* Resultado del cuadre */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-slate-200 text-center">
                <div className="p-3">
                  <p className="text-[11px] text-slate-500">Esperado en caja</p>
                  <p className="font-mono font-semibold tabular-nums text-slate-900">
                    S/ {totalEfectivoEsperado.toFixed(2)}
                  </p>
                </div>
                <div className="p-3">
                  <p className="text-[11px] text-slate-500">Contado</p>
                  <p className="font-mono font-semibold tabular-nums text-slate-900">
                    S/ {(hayConteoDenominaciones ? totalConteo : montoFisicoNum).toFixed(2)}
                  </p>
                </div>
              </div>
              <div
                className={`px-3 py-2.5 text-center text-sm font-semibold ${
                  !tieneConteoFisico
                    ? 'bg-slate-50 text-slate-400'
                    : cuadra
                    ? 'bg-emerald-50 text-emerald-700'
                    : diferenciaEfectivo > 0
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {!tieneConteoFisico
                  ? 'Marca los billetes y monedas que hay en caja'
                  : cuadra
                  ? '✓ Cuadre exacto'
                  : diferenciaEfectivo > 0
                  ? `Sobran S/ ${diferenciaEfectivo.toFixed(2)}`
                  : `Faltan S/ ${Math.abs(diferenciaEfectivo).toFixed(2)}`}
              </div>
            </div>

            {/* Monto directo opcional */}
            <details
              className="group"
              open={!hayConteoDenominaciones && tieneConteoFisico ? true : undefined}
            >
              <summary className="cursor-pointer list-none text-xs text-slate-400 hover:text-slate-700 select-none">
                ▸ Prefiero escribir el monto total
              </summary>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                  S/
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={efectivoFisicoContado}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '' && parseFloat(val) < 0) return;
                    setConteoBilletes({});
                    setEfectivoFisicoContado(val);
                  }}
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-9 pr-3 font-mono text-base font-semibold text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                />
              </div>
            </details>
          </div>

          {/* Vista previa del ticket térmico (Columna derecha) */}
          <TicketCierrePrevio abonosFiltrados={abonosFiltrados} cajaEstado={cajaEstado} cajeroNombre={cajeroNombre} cuadra={cuadra} detalleConteo={detalleConteo} diferenciaEfectivo={diferenciaEfectivo} egresosEfectivo={egresosEfectivo} empresa={empresa} fondoInicialTurno={fondoInicialTurno} ingresosCaja={ingresosCaja} montoFisicoNum={montoFisicoNum} tieneConteoFisico={tieneConteoFisico} totalCalculado={totalCalculado} totalConsumoClientes={totalConsumoClientes} totalConsumoPlanilla={totalConsumoPlanilla} totalCortesias={totalCortesias} totalEfectivo={totalEfectivo} totalEfectivoEsperado={totalEfectivoEsperado} totalPedidosYa={totalPedidosYa} totalTarjeta={totalTarjeta} totalYape={totalYape} />
        </div>

        {/* Acciones */}
        <div className="cierre-no-print px-5 md:px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-12 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir ticket
          </button>
          <button
            type="button"
            disabled={guardandoCierre}
            onClick={handleCerrarTurno}
            className="h-12 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm shadow-red-600/25 transition-colors active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            {guardandoCierre ? 'Cerrando…' : 'Cerrar turno'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalCierreCaja;
