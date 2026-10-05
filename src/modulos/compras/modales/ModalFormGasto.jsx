import React from 'react';
import { X, Save } from 'lucide-react';

/**
 * ModalFormGasto: Formulario para registrar o editar compras y gastos,
 * con soporte para conceptos rápidos, desglose de pago mixto y comprobantes SUNAT.
 */
export default function ModalFormGasto({
  abierto,
  form,
  setForm,
  editandoId,
  onCerrar,
  guardarGasto,
  guardando,
  CONCEPTOS_RAPIDOS = [],
  aplicarConceptoRapido,
  METODOS_PAGO = [],
  CATEGORIAS = [],
  coloresDe,
  TIPOS_DOCUMENTO = [],
  calcularBaseIgv,
  soles
}) {
  if (!abierto || !form) return null;

  const tot = parseFloat(form.total) || 0;
  const { base, igv } = calcularBaseIgv ? calcularBaseIgv(tot, form.tipoDocumento) : { base: 0, igv: 0 };

  const lbl = 'block text-xs font-medium text-slate-500 mb-1.5';
  const inp = 'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition';

  return (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onCerrar}
    >
      <div
        className="bg-white w-full sm:max-w-xl max-h-[92dvh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900">{editandoId ? 'Editar gasto' : 'Registrar gasto'}</p>
            <p className="text-sm text-slate-500">{editandoId ? `Registro #${editandoId}` : 'Compra, pago o egreso del negocio'}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {!editandoId && (
            <div>
              <p className={lbl}>Conceptos frecuentes</p>
              <div className="flex flex-wrap gap-1.5">
                {CONCEPTOS_RAPIDOS.map((cp) => (
                  <button
                    key={cp.label}
                    type="button"
                    onClick={() => aplicarConceptoRapido && aplicarConceptoRapido(cp)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-95"
                  >
                    {cp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>Descripción del gasto *</label>
            <input
              type="text"
              value={form.proveedor}
              onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
              placeholder="Ej. Pollo para caldo, Gas, Sueldo Martha…"
              className={inp}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">S/</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.total}
                  onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                  placeholder="0.00"
                  className={`${inp} h-11 pl-9 font-mono text-lg font-semibold tabular-nums`}
                />
              </div>
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input
                type="date"
                value={form.fechaEmision}
                onChange={(e) => setForm((f) => ({ ...f, fechaEmision: e.target.value }))}
                className={`${inp} h-11 font-mono`}
              />
            </div>
          </div>

          <div>
            <p className={lbl}>Medio de pago</p>
            <div className="grid grid-cols-4 gap-2">
              {METODOS_PAGO.map((m) => {
                const activo = form.metodoPago === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        metodoPago: m.id,
                        montoEfectivoMixto:
                          m.id === 'Mixto' && !f.montoEfectivoMixto ? String(parseFloat(f.total) || '') : f.montoEfectivoMixto,
                      }))
                    }
                    className={`h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium transition-all active:scale-[0.97] ${
                      activo
                        ? m.activo
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <m.Icon className={`w-4 h-4 ${activo ? '' : m.icono}`} />
                    {m.id === 'Yape' ? 'Yape' : m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {form.metodoPago === 'Mixto' &&
            (() => {
              const efec = parseFloat(form.montoEfectivoMixto) || 0;
              const yape = parseFloat(form.montoYapeMixto) || 0;
              const tarj = parseFloat(form.montoTarjetaMixto) || 0;
              const dif = tot - (efec + yape + tarj);
              return (
                <div className="rounded-xl bg-slate-50 p-3 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['montoEfectivoMixto', 'Efectivo'],
                      ['montoYapeMixto', 'Yape'],
                      ['montoTarjetaMixto', 'Tarjeta'],
                    ].map(([campo, label]) => (
                      <div key={campo}>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={form[campo]}
                          onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                          placeholder="0.00"
                          className={`${inp} font-mono tabular-nums`}
                        />
                      </div>
                    ))}
                  </div>
                  <p
                    className={`text-xs font-medium px-3 py-2 rounded-lg ${
                      Math.abs(dif) < 0.01
                        ? 'bg-emerald-50 text-emerald-700'
                        : dif > 0
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {Math.abs(dif) < 0.01
                      ? 'Cuadra con el total'
                      : dif > 0
                      ? `Falta asignar ${soles ? soles(dif) : `S/ ${dif}`}`
                      : `Excede por ${soles ? soles(Math.abs(dif)) : `S/ ${Math.abs(dif)}`}`}
                  </p>
                </div>
              );
            })()}

          <div>
            <p className={lbl}>Categoría</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((cat) => {
                const activa = form.categoria === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, categoria: cat }))}
                    className={`h-8 px-3 rounded-full border text-xs font-medium transition active:scale-95 ${
                      activa ? coloresDe(cat).activo : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className={lbl}>Comprobante</p>
            <div className="grid grid-cols-4 p-1 rounded-xl bg-slate-100">
              {TIPOS_DOCUMENTO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipoDocumento: t }))}
                  className={`h-8 rounded-lg text-xs font-medium transition-all ${
                    form.tipoDocumento === t
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t === 'Recibo Interno' ? 'Sin comp.' : t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Número</label>
                <input
                  type="text"
                  value={form.serieNumero}
                  onChange={(e) => setForm((f) => ({ ...f, serieNumero: e.target.value }))}
                  placeholder="Ej. F001-124"
                  className={`${inp} font-mono`}
                />
              </div>
              <div>
                <label className={lbl}>RUC del proveedor</label>
                <input
                  type="text"
                  maxLength={11}
                  inputMode="numeric"
                  value={form.ruc}
                  onChange={(e) => setForm((f) => ({ ...f, ruc: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Opcional"
                  className={`${inp} font-mono`}
                />
              </div>
            </div>
            {form.tipoDocumento === 'Factura' && tot > 0 && (
              <p className="text-xs text-slate-500 bg-sky-50 rounded-lg px-3 py-2">
                Base imponible <span className="font-mono text-slate-800">{soles ? soles(base) : `S/ ${base}`}</span> · IGV (18%){' '}
                <span className="font-mono text-slate-800">{soles ? soles(igv) : `S/ ${igv}`}</span>
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            className="h-11 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardarGasto}
            disabled={guardando}
            className="ml-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {guardando ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {editandoId ? 'Guardar cambios' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}
