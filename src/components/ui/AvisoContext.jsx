// ================================================================
// SISTEMA CENTRAL DE NOTIFICACIONES, CONFIRMACIONES Y PROMPTS
// VT VALETEC — Reemplazo profesional de alert, confirm y prompt
// ================================================================
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle,
  Edit3
} from 'lucide-react';
import { Dialog, DialogHeader, DialogFooter, Button, Input } from './index';

import { AvisoContext, registrarAvisoGlobal } from './avisos';

export function AvisoProvider({ children }) {
  // --- Estado de Toasts (Avisos) ---
  const [toasts, setToasts] = useState([]);

  // --- Estado de Confirmación (Modal) ---
  const [confirmDialog, setConfirmDialog] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    botonConfirmar: 'Confirmar',
    botonCancelar: 'Cancelar',
    peligro: false,
    resolver: null,
  });

  // --- Estado de Pedir Dato (Prompt Modal) ---
  const [promptDialog, setPromptDialog] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    placeholder: '',
    valor: '',
    tipo: 'text',
    error: '',
    validacion: null,
    botonConfirmar: 'Aceptar',
    botonCancelar: 'Cancelar',
    resolver: null,
  });

  // -------------------------------------------------------------
  // 1. AVISOS (TOASTS)
  // -------------------------------------------------------------
  const cerrarAviso = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const avisar = useCallback((options) => {
    const {
      tipo = 'info', // 'exito' | 'error' | 'advertencia' | 'info'
      mensaje = '',
      titulo = '',
      duracion = tipo === 'error' ? 5000 : 3500,
    } = typeof options === 'string' ? { mensaje: options } : options;

    const id = Date.now() + Math.random().toString(36).substring(2, 7);

    setToasts((prev) => [...prev, { id, tipo, mensaje, titulo, duracion }]);

    if (duracion > 0) {
      setTimeout(() => {
        cerrarAviso(id);
      }, duracion);
    }
  }, [cerrarAviso]);

  // aviso(...) y sus accesos rápidos aviso.exito(...), aviso.error(...), etc. Un objeto estable
  // (no cambia entre renders), así se puede usar en las dependencias de los efectos.
  const aviso = useMemo(() => Object.assign((options) => avisar(options), {
    exito: (mensaje, titulo = '') => avisar({ tipo: 'exito', mensaje, titulo }),
    error: (mensaje, titulo = '') => avisar({ tipo: 'error', mensaje, titulo }),
    advertencia: (mensaje, titulo = '') => avisar({ tipo: 'advertencia', mensaje, titulo }),
    info: (mensaje, titulo = '') => avisar({ tipo: 'info', mensaje, titulo }),
  }), [avisar]);

  // Avisos desde fuera de React (ej. api.js)
  useEffect(() => registrarAvisoGlobal((tipo, mensaje, duracion) => avisar({ tipo, mensaje, duracion })), [avisar]);

  // -------------------------------------------------------------
  // 2. CONFIRMAR (MODAL PROMISE)
  // -------------------------------------------------------------
  const confirmar = useCallback((options) => {
    return new Promise((resolve) => {
      const {
        titulo = '¿Confirmar acción?',
        mensaje = '',
        botonConfirmar = 'Confirmar',
        botonCancelar = 'Cancelar',
        peligro = false,
      } = typeof options === 'string' ? { mensaje: options } : options;

      setConfirmDialog({
        abierto: true,
        titulo,
        mensaje,
        botonConfirmar,
        botonCancelar,
        peligro,
        resolver: resolve,
      });
    });
  }, []);

  const responderConfirmacion = (resultado) => {
    if (confirmDialog.resolver) {
      confirmDialog.resolver(resultado);
    }
    setConfirmDialog((prev) => ({ ...prev, abierto: false, resolver: null }));
  };

  // -------------------------------------------------------------
  // 3. PEDIR DATO (PROMPT PROMISE)
  // -------------------------------------------------------------
  const pedirDato = useCallback((options) => {
    return new Promise((resolve) => {
      const {
        titulo = 'Ingresa el dato requerido',
        mensaje = '',
        placeholder = '',
        valorInicial = '',
        tipo = 'text',
        validacion = null, // función opcional (val) => string de error o null
        botonConfirmar = 'Aceptar',
        botonCancelar = 'Cancelar',
      } = typeof options === 'string' ? { mensaje: options } : options;

      setPromptDialog({
        abierto: true,
        titulo,
        mensaje,
        placeholder,
        valor: valorInicial,
        tipo,
        error: '',
        validacion,
        botonConfirmar,
        botonCancelar,
        resolver: resolve,
      });
    });
  }, []);

  const responderPrompt = (confirmado) => {
    if (!confirmado) {
      if (promptDialog.resolver) promptDialog.resolver(null);
      setPromptDialog((prev) => ({ ...prev, abierto: false, resolver: null, error: '' }));
      return;
    }

    if (promptDialog.validacion) {
      const err = promptDialog.validacion(promptDialog.valor);
      if (err) {
        setPromptDialog((prev) => ({ ...prev, error: err }));
        return;
      }
    }

    if (promptDialog.resolver) {
      promptDialog.resolver(promptDialog.valor);
    }
    setPromptDialog((prev) => ({ ...prev, abierto: false, resolver: null, error: '' }));
  };

  // Iconos y colores según tipo de aviso
  const TOAST_STYLES = {
    exito: {
      bg: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      Icon: CheckCircle2,
    },
    error: {
      bg: 'bg-red-950/90 border-red-500/40 text-red-100',
      iconBg: 'bg-red-500/20 text-red-400',
      Icon: AlertCircle,
    },
    advertencia: {
      bg: 'bg-amber-950/90 border-amber-500/40 text-amber-100',
      iconBg: 'bg-amber-500/20 text-amber-400',
      Icon: AlertTriangle,
    },
    info: {
      bg: 'bg-slate-900/90 border-slate-700/60 text-slate-100',
      iconBg: 'bg-blue-500/20 text-blue-400',
      Icon: Info,
    },
  };

  return (
    <AvisoContext.Provider value={{ aviso, confirmar, pedirDato }}>
      {children}

      {/* --- CONTENEDOR DE TOASTS FLOTANTES --- */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none p-4 sm:p-0"
      >
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.tipo] || TOAST_STYLES.info;
          const { Icon } = style;
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-up ${style.bg}`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${style.iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {t.titulo && (
                  <h4 className="text-sm font-bold tracking-tight mb-0.5">{t.titulo}</h4>
                )}
                <p className="text-xs sm:text-sm font-medium leading-relaxed break-words opacity-95">
                  {t.mensaje}
                </p>
              </div>
              <button
                type="button"
                onClick={() => cerrarAviso(t.id)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* --- MODAL DE CONFIRMACIÓN (useConfirmar) --- */}
      <Dialog
        open={confirmDialog.abierto}
        onClose={() => responderConfirmacion(false)}
        className="max-w-md"
      >
        <DialogHeader
          icon={confirmDialog.peligro ? AlertTriangle : HelpCircle}
          iconClassName={confirmDialog.peligro ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}
          title={confirmDialog.titulo}
          onClose={() => responderConfirmacion(false)}
        />
        <div className="p-6">
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            {confirmDialog.mensaje}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => responderConfirmacion(false)}
          >
            {confirmDialog.botonCancelar}
          </Button>
          <Button
            variant={confirmDialog.peligro ? 'destructive' : 'primary'}
            onClick={() => responderConfirmacion(true)}
            autoFocus
          >
            {confirmDialog.botonConfirmar}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* --- MODAL DE PEDIR DATO (usePedirDato) --- */}
      <Dialog
        open={promptDialog.abierto}
        onClose={() => responderPrompt(false)}
        className="max-w-md"
      >
        <DialogHeader
          icon={Edit3}
          iconClassName="bg-blue-100 text-blue-700"
          title={promptDialog.titulo}
          onClose={() => responderPrompt(false)}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            responderPrompt(true);
          }}
        >
          <div className="p-6 space-y-4">
            {promptDialog.mensaje && (
              <p className="text-sm text-slate-600 font-medium">
                {promptDialog.mensaje}
              </p>
            )}
            <div>
              <Input
                type={promptDialog.tipo}
                value={promptDialog.valor}
                placeholder={promptDialog.placeholder}
                onChange={(e) =>
                  setPromptDialog((prev) => ({
                    ...prev,
                    valor: e.target.value,
                    error: '',
                  }))
                }
                autoFocus
              />
              {promptDialog.error && (
                <p className="mt-2 text-xs font-bold text-red-600 animate-fade-in">
                  {promptDialog.error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => responderPrompt(false)}
            >
              {promptDialog.botonCancelar}
            </Button>
            <Button variant="primary" type="submit">
              {promptDialog.botonConfirmar}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </AvisoContext.Provider>
  );
}
