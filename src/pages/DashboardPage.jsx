import React, { useState, useEffect } from 'react';
import { Users, Flame, CheckCircle, Banknote, LayoutGrid, ChefHat, Calculator, Lock, Unlock, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function DashboardPage() {
  const [stats, setStats] = useState({ ocupadas: 0, totalMesas: 15, enCocina: 0, atendidas: 0, ingresos: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [cajaEstado, setCajaEstado] = useState({ abierto: false, turno: null, resumenEnVivo: null });
  const [modalForzarCierre, setModalForzarCierre] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminMotivo, setAdminMotivo] = useState('');
  const [adminNombre, setAdminNombre] = useState('Administrador');
  const [cargandoForzar, setCargandoForzar] = useState(false);
  const [errorForzar, setErrorForzar] = useState('');

  useEffect(() => {
    let activeCierreCutoff = localStorage.getItem('ultimoCierre');

    const updateStats = async () => {
      try {
        if (!activeCierreCutoff) {
          try {
            const cierreRes = await api.getUltimoCierre();
            if (cierreRes?.ultimoCierre?.fechaCierre) {
              activeCierreCutoff = new Date(cierreRes.ultimoCierre.fechaCierre).toISOString();
              localStorage.setItem('ultimoCierre', activeCierreCutoff);
            }
          } catch (_) {}
        }

        const [mesas, resumen, rotacion, estadoCajaRes] = await Promise.all([
          api.getMesas().catch(() => []),
          api.getResumenVentas(activeCierreCutoff || null).catch(() => ({ atendidas: 0, ingresos: 0 })),
          api.getRotacion(activeCierreCutoff || null).catch(() => []),
          api.getEstadoCaja().catch(() => null),
        ]);

        if (estadoCajaRes && typeof estadoCajaRes.abierto === 'boolean') {
          setCajaEstado(estadoCajaRes);
        }

        setStats({
          ocupadas: (mesas || []).filter(m => m.estado !== 'Libre').length,
          totalMesas: (mesas || []).length || 15,
          enCocina: (mesas || []).filter(m => m.estado === 'Cocina').length,
          atendidas: resumen.atendidas || 0,
          ingresos: resumen.ingresosCaja || 0,
        });
        const categoriasExcluidas = ['Bebidas y Refrescos', 'Cervezas', 'Bar y Cocteles', 'Postres'];
        const platosFiltrados = (rotacion || []).filter(p => !categoriasExcluidas.includes(p.categoria));
        setTopProducts(platosFiltrados.slice(0, 5));
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleForzarCierre = async (e) => {
    e?.preventDefault();
    setErrorForzar('');
    if (!adminPin.trim()) {
      setErrorForzar('El PIN de Administrador es obligatorio.');
      return;
    }

    setCargandoForzar(true);
    try {
      const res = await api.cerrarCajaForzado({
        adminNombre: adminNombre.trim() || 'Administrador',
        adminPin: adminPin.trim(),
        motivo: adminMotivo.trim() || 'Cierre forzado desde el panel de control',
      });

      if (res.error) {
        setErrorForzar(res.error);
        return;
      }

      setModalForzarCierre(false);
      setAdminPin('');
      setAdminMotivo('');
      setCajaEstado({ abierto: false, turno: null, resumenEnVivo: null });
      alert('✅ ' + (res.mensaje || 'Turno cerrado forzosamente con éxito.'));
    } catch (err) {
      setErrorForzar('Error al cerrar caja: ' + err.message);
    } finally {
      setCargandoForzar(false);
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Estado Actual del Local</h1>
          <p className="text-xs md:text-sm text-slate-500">Métricas en tiempo real sincronizadas con la Base de Datos.</p>
        </div>
        <Link to="/salon" className="self-start sm:self-auto bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95">
          <LayoutGrid className="w-4 h-4 text-cyan-400" /> Ir al Salón
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center z-10 shrink-0"><Users className="w-6 h-6" /></div>
          <div className="z-10">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Mesas Ocupadas</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{stats.ocupadas} / {stats.totalMesas}</p>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-2xl flex items-center justify-center z-10 shrink-0"><Flame className="w-6 h-6" /></div>
          <div className="z-10">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">En Cocina</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{stats.enCocina} Ticket{stats.enCocina !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center z-10 shrink-0"><CheckCircle className="w-6 h-6" /></div>
          <div className="z-10">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Atenciones Hoy</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{stats.atendidas}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-lg flex items-center gap-4 relative overflow-hidden text-white transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500 rounded-full opacity-20 pointer-events-none"></div>
          <div className="w-12 h-12 bg-cyan-400 text-slate-950 rounded-2xl flex items-center justify-center z-10 shrink-0"><Banknote className="w-6 h-6" /></div>
          <div className="z-10">
            <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Ingresos Caja</p>
            <p className="text-xl sm:text-2xl font-black mt-1 font-mono">S/ {stats.ingresos.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* WIDGET SUPERVISIÓN DE TURNO Y GAVETA DE CAJA (ADMIN) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 ${
              cajaEstado.abierto ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-600'
            }`}>
              {cajaEstado.abierto ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 uppercase text-sm tracking-wider">
                  Supervisión de Gaveta y Turno de Caja
                </h2>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  cajaEstado.abierto ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-rose-100 text-rose-800'
                }`}>
                  {cajaEstado.abierto ? '🟢 Turno Abierto' : '🔴 Caja Cerrada'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Control de arqueo, sencillo inicial y efectivo en custodia en tiempo real.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cajaEstado.abierto ? (
              <button
                onClick={() => {
                  setErrorForzar('');
                  setAdminPin('');
                  setAdminMotivo('');
                  setModalForzarCierre(true);
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Forzar Cierre (Admin)
              </button>
            ) : (
              <Link
                to="/caja"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                Ir a Abrir Turno
              </Link>
            )}
          </div>
        </div>

        {cajaEstado.abierto && cajaEstado.resumenEnVivo ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cajero en Turno</span>
              <span className="text-sm font-black text-slate-800 uppercase block mt-1 truncate">
                {cajaEstado.resumenEnVivo.cajeroNombre}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Desde las {cajaEstado.resumenEnVivo.fechaApertura ? new Date(cajaEstado.resumenEnVivo.fechaApertura).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--'}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fondo Sencillo Inicial</span>
              <span className="text-base font-black text-slate-800 font-mono block mt-1">
                S/ {Number(cajaEstado.resumenEnVivo.montoInicial || 0).toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Base en gaveta</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ventas Efectivo</span>
              <span className="text-base font-black text-slate-800 font-mono block mt-1">
                S/ {Number(cajaEstado.resumenEnVivo.ventasEfectivo || 0).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {cajaEstado.resumenEnVivo.cantidadVentas} comprobante{cajaEstado.resumenEnVivo.cantidadVentas !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 rounded-2xl border-2 border-emerald-300">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">Efectivo en Gaveta</span>
              <span className="text-lg font-black text-emerald-900 font-mono block mt-0.5">
                S/ {Number(cajaEstado.resumenEnVivo.efectivoEsperadoEnGaveta || 0).toFixed(2)}
              </span>
              <span className="text-[9px] text-emerald-700 font-bold block">Fondo + Ventas - Gastos</span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
            La caja se encuentra cerrada actualmente. Ningún cajero está operando transacciones en este momento.
          </div>
        )}
      </div>

      {/* TOP 5 PRODUCTOS MÁS VENDIDOS WIDGET */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/60 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 uppercase text-sm tracking-wider">Top 5 Productos Más Vendidos (Hoy)</h2>
            <p className="text-xs text-slate-400">Rotación de platos de hoy ordenados por volumen de venta.</p>
          </div>
        </div>
        {topProducts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {topProducts.map((p, idx) => (
              <div key={p.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between font-bold text-slate-700 text-sm gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-black shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-850 font-black">{p.nombre}</span>
                    <span className="text-[10px] text-slate-400 uppercase px-2 py-0.5 rounded bg-slate-50 border border-slate-100">
                      {p.categoria}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6 font-mono pl-9 sm:pl-0">
                  <div>
                    <span className="text-slate-400 text-xs mr-1">Cant:</span>
                    <span className="text-slate-900 font-black">{p.cantidad}</span>
                  </div>
                  <div className="text-right sm:w-24">
                    <span className="text-emerald-600 font-black">S/ {p.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-slate-400 font-bold uppercase text-xs">No hay ventas registradas el día de hoy.</p>
        )}
      </div>

      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Accesos Rápidos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/salon" className="bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all p-5 rounded-2xl flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 bg-slate-50 text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-xl flex items-center justify-center transition-colors shrink-0"><LayoutGrid className="w-6 h-6" /></div>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase">Atención Salón</h3>
            <p className="text-xs text-slate-400 mt-0.5">Mapa de mesas y Punto de Venta (POS).</p>
          </div>
        </Link>

        <Link to="/cocina" className="bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all p-5 rounded-2xl flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 bg-slate-50 text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-xl flex items-center justify-center transition-colors shrink-0"><ChefHat className="w-6 h-6" /></div>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase">Monitor Cocina</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tickets de pedidos en tiempo real.</p>
          </div>
        </Link>

        <Link to="/caja" className="bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all p-5 rounded-2xl flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 bg-slate-50 text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-xl flex items-center justify-center transition-colors shrink-0"><Calculator className="w-6 h-6" /></div>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase">Caja y Cobros</h3>
            <p className="text-xs text-slate-400 mt-0.5">Facturación, pagos y liberación de mesas.</p>
          </div>
        </Link>
      </div>

      {/* MODAL DE CIERRE FORZADO (ADMINISTRADOR) */}
      {modalForzarCierre && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col animate-slide-up border border-slate-100">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black shadow-md">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Cierre Forzado de Turno</h3>
                  <p className="text-xs text-rose-600 font-bold mt-0.5">Supervisión Administrativa</p>
                </div>
              </div>
              <button
                onClick={() => setModalForzarCierre(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorForzar && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorForzar}</span>
              </div>
            )}

            <div className="mb-4 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
              <p className="font-bold">⚠️ Atención:</p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                Esta acción dará por finalizado de forma inmediata el turno abierto por <span className="font-bold">"{cajaEstado.turno?.cajeroNombre || 'el cajero actual'}"</span>. Úselo si el personal culminó su jornada o ante alguna eventualidad.
              </p>
            </div>

            <form onSubmit={handleForzarCierre} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  PIN de Administrador:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  maxLength={10}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Ingrese PIN de Admin"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-base font-black text-slate-900 focus:outline-none tracking-widest text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  Motivo o Justificación del Cierre:
                </label>
                <input
                  type="text"
                  value={adminMotivo}
                  onChange={(e) => setAdminMotivo(e.target.value)}
                  placeholder="Ej. Fin de jornada, cajero se retiró..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalForzarCierre(false)}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoForzar}
                  className="w-2/3 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {cargandoForzar ? 'Cerrando...' : 'Confirmar Cierre Forzado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </section>
  );
}
