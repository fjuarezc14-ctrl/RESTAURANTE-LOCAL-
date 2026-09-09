import React, { useState, useEffect } from 'react';
import { Users, Flame, CheckCircle, Banknote, LayoutGrid, ChefHat, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function DashboardPage() {
  const [stats, setStats] = useState({ ocupadas: 0, totalMesas: 15, enCocina: 0, atendidas: 0, ingresos: 0 });
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const updateStats = async () => {
      try {
        const savedCierre = localStorage.getItem('ultimoCierre');
        const [mesas, resumen, rotacion] = await Promise.all([
          api.getMesas(),
          api.getResumenVentas(savedCierre || null),
          api.getRotacion(savedCierre || null),
        ]);
        setStats({
          ocupadas: mesas.filter(m => m.estado !== 'Libre').length,
          totalMesas: mesas.length,
          enCocina: mesas.filter(m => m.estado === 'Cocina').length,
          atendidas: resumen.atendidas || 0,
          ingresos: resumen.ingresosCaja || 0,
        });
        const categoriasExcluidas = ['Bebidas y Refrescos', 'Cervezas', 'Bar y Cocteles', 'Postres'];
        const platosFiltrados = rotacion.filter(p => !categoriasExcluidas.includes(p.categoria));
        setTopProducts(platosFiltrados.slice(0, 5));
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, []);

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
      </section>
  );
}
