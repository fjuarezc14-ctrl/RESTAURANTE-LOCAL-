// Formulario de producto: combo, preguntas y acompañamientos
import { Utensils, Trash2, X, Plus, Minus, Boxes, MessageCircleQuestion } from 'lucide-react';
import { Button, Input, Badge } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { BuscadorProductos } from '../BuscadorProductos';

export function SeccionesProducto({ PLANTILLAS_PREGUNTAS, agregarComponente, agregarPregunta, agregarRespuesta, cambiarCantidadComponente, componentesActuales, editProd, editarPregunta, editarRespuesta, productos, productosSeleccionables, quitarComponente, quitarPregunta, quitarRespuesta, setEditProd, sumaComponentes }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

      {/* ── Combo ── */}
      <section className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-violet-600/30">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900">Combo</h4>
              <p className="text-xs text-slate-500">Une varios productos de la carta en uno</p>
            </div>
          </div>
          {componentesActuales.length > 0 && (
            <Badge className="bg-violet-600 text-white">{componentesActuales.reduce((s, c) => s + c.cantidad, 0)}</Badge>
          )}
        </div>

        <BuscadorProductos
          productos={productosSeleccionables}
          onElegir={agregarComponente}
          placeholder="Buscar producto para el combo..."
          acento="violet"
        />

        {componentesActuales.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-violet-200 py-5 text-center text-sm text-slate-400">
            Aún no es combo
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {componentesActuales.map(c => {
                const prod = productos.find(p => p.id === c.productoId);
                return (
                  <div key={c.productoId} className="flex items-center gap-2 rounded-xl bg-white border border-violet-100 p-2 pl-3 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{prod ? prod.nombre : `Producto #${c.productoId} (eliminado)`}</p>
                      <p className="text-xs text-slate-400 font-mono">S/ {((prod?.precio || 0) * c.cantidad).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center rounded-lg bg-slate-100">
                      <button type="button" onClick={() => cambiarCantidadComponente(c.productoId, -1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer" aria-label="Quitar uno">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-black tabular-nums">{c.cantidad}</span>
                      <button type="button" onClick={() => cambiarCantidadComponente(c.productoId, 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer" aria-label="Agregar uno">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => quitarComponente(c.productoId)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label="Quitar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {(() => {
              const precioCombo = parseFloat(editProd.precio) || 0;
              const ahorro = sumaComponentes - precioCombo;
              return (
                <div className="rounded-xl bg-white border border-violet-100 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Por separado</span>
                    <span className="font-mono font-bold text-slate-700">S/ {sumaComponentes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Precio del combo</span>
                    <span className="font-mono font-bold text-slate-700">S/ {precioCombo.toFixed(2)}</span>
                  </div>
                  {precioCombo > 0 && ahorro !== 0 && (
                    <div className={cn('flex justify-between text-sm font-black rounded-lg px-2 py-1', ahorro > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                      <span>{ahorro > 0 ? 'El cliente ahorra' : 'Cuesta más que por separado'}</span>
                      <span className="font-mono">S/ {Math.abs(ahorro).toFixed(2)}</span>
                    </div>
                  )}
                  {precioCombo !== Number(sumaComponentes.toFixed(2)) && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setEditProd(prev => ({ ...prev, precio: sumaComponentes.toFixed(2) }))}>
                      Usar S/ {sumaComponentes.toFixed(2)} como precio
                    </Button>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </section>

      {/* ── Preguntas al tomar el pedido ── */}
      <section className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-600/30">
            <MessageCircleQuestion className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-slate-900">Preguntas al pedir</h4>
            <p className="text-xs text-slate-500">Ej: ¿Guarnición? → Papas, Arroz</p>
          </div>
        </div>

        {(editProd.opcionesConfig || []).map((paso, idx) => (
          <div key={idx} className="rounded-xl bg-white border border-sky-100 p-3 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 text-sm font-black flex items-center justify-center shrink-0">{idx + 1}</span>
              <Input
                value={paso.name}
                onChange={e => editarPregunta(idx, { name: e.target.value })}
                placeholder="Pregunta, ej: Guarnición"
                className="h-10 focus:border-sky-500 focus:ring-sky-100"
              />
              <button type="button" onClick={() => quitarPregunta(idx)} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label="Quitar pregunta">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {paso.respuestas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {paso.respuestas.map((r, rIdx) => (
                  r.productoId ? (
                    <span key={`p${r.productoId}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 pl-3 pr-1 py-1 text-xs font-bold text-emerald-800" title="Producto de la carta: descuenta stock">
                      <Utensils className="w-3 h-3" /> {r.label}
                      <span className="ml-1 text-emerald-600">+S/</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={r.precioExtra}
                        onChange={e => editarRespuesta(idx, rIdx, { precioExtra: e.target.value })}
                        className="w-12 rounded-md border border-emerald-200 bg-white px-1 py-0.5 text-xs text-emerald-900 focus:outline-none focus:border-emerald-500"
                        title="Cobro extra si eligen esta opción"
                      />
                      <button type="button" onClick={() => quitarRespuesta(idx, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-emerald-100 cursor-pointer" aria-label="Quitar">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span key={`t${rIdx}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 pl-3 pr-1 py-1 text-xs font-bold text-slate-700">
                      {r.label}
                      <button type="button" onClick={() => quitarRespuesta(idx, rIdx)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer" aria-label="Quitar">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )
                ))}
              </div>
            )}

            <BuscadorProductos
              productos={productosSeleccionables}
              onElegir={prod => agregarRespuesta(idx, { label: prod.nombre, productoId: prod.id, precioExtra: 0 })}
              onTextoLibre={texto => agregarRespuesta(idx, { label: texto })}
              placeholder="Escribe una respuesta y Enter..."
              acento="sky"
              compacto
            />
          </div>
        ))}

        <div className="space-y-2">
          <Button variant="outline" className="w-full border-dashed border-sky-300 text-sky-700 hover:bg-sky-50" onClick={() => agregarPregunta()}>
            <Plus className="w-4 h-4" /> Nueva pregunta
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1">Rápidas:</span>
            {Object.entries(PLANTILLAS_PREGUNTAS).map(([key, pl]) => (
              <button
                key={key}
                type="button"
                onClick={() => agregarPregunta(pl)}
                className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 cursor-pointer"
              >
                + {pl.name}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
