// ================================================================
// AUDITORÍA (solo Administrador): quién hizo cada acción delicada (anulaciones, descuentos, cambios
// de precio, caja, usuarios, equipos...), con el "antes y después", el motivo y quién autorizó.
// ================================================================
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAviso } from '../components/ui';
import { resumenCambio } from '../modulos/admin/auditoria';

const POR_PAGINA = 50;

const hoyLima = (diasAtras = 0) => new Date(Date.now() - diasAtras * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const fechaHora = (iso) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function exportarExcel(registros, nombreAccion, { desde, hasta }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet('Auditoría', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    { header: 'Fecha y hora', key: 'fecha', width: 20 },
    { header: 'Usuario', key: 'usuario', width: 22 },
    { header: 'Equipo', key: 'equipo', width: 20 },
    { header: 'Acción', key: 'accion', width: 30 },
    { header: 'Sobre', key: 'entidad', width: 18 },
    { header: 'Detalle', key: 'detalle', width: 60 },
    { header: 'Motivo', key: 'motivo', width: 30 },
    { header: 'Autorizado por', key: 'autorizadoPor', width: 20 },
  ];
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  for (const r of registros) {
    hoja.addRow({
      fecha: fechaHora(r.creadoEn),
      usuario: r.usuarioNombre,
      equipo: r.dispositivoNombre || '',
      accion: nombreAccion(r.accion),
      entidad: `${r.entidad}${r.entidadId ? ` #${r.entidadId}` : ''}`,
      detalle: resumenCambio(r.antes, r.despues),
      motivo: r.motivo || '',
      autorizadoPor: r.autorizadoPor || '',
    });
  }
  hoja.getColumn('detalle').alignment = { wrapText: true, vertical: 'top' };
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Auditoria_${desde}_al_${hasta}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditoriaPage() {
  const aviso = useAviso();
  const [filtros, setFiltros] = useState({ desde: hoyLima(6), hasta: hoyLima(), usuarioId: '', accion: '' });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ registros: [], total: 0 });
  const [usuarios, setUsuarios] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    Promise.all([api.getUsuarios(), api.getAccionesAuditoria()])
      .then(([u, a]) => { setUsuarios(u); setAcciones(a); })
      .catch((err) => aviso.error(`No se pudieron cargar los filtros: ${err.message}`));
  }, [aviso]);

  // "cargando" lo prende quien busca (irAPagina); al entrar ya empieza en true
  const buscar = useCallback((filtrosBusqueda, paginaBusqueda) => api.getAuditoria({ ...filtrosBusqueda, page: paginaBusqueda, limit: POR_PAGINA })
    .then(setDatos)
    .catch((err) => aviso.error(err.message))
    .finally(() => setCargando(false)), [aviso]);

  // La primera búsqueda con los filtros iniciales; después, con el botón Buscar o al cambiar de página
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { buscar(filtros, 1); }, [buscar]);

  const irAPagina = (p) => { setPagina(p); setCargando(true); buscar(filtros, p); };
  const alBuscar = (e) => { e.preventDefault(); irAPagina(1); };

  const nombreAccion = (codigo) => acciones.find((a) => a.codigo === codigo)?.nombre || codigo;

  const descargar = async () => {
    setExportando(true);
    try {
      // Todas las páginas del rango filtrado (de 200 en 200, el máximo de la API)
      const todos = [];
      for (let p = 1; ; p++) {
        const res = await api.getAuditoria({ ...filtros, page: p, limit: 200 });
        todos.push(...res.registros);
        if (todos.length >= res.total || res.registros.length === 0) break;
      }
      if (todos.length === 0) return aviso.advertencia('No hay registros para exportar con estos filtros.');
      await exportarExcel(todos, nombreAccion, filtros);
    } catch (err) {
      aviso.error(`No se pudo exportar: ${err.message}`);
    } finally {
      setExportando(false);
    }
  };

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));
  const campo = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-cyan-500';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
        <form onSubmit={alBuscar} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-slate-600">Desde
              <input type="date" value={filtros.desde} max={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} className={`mt-1 block w-full ${campo}`} required />
            </label>
            <label className="text-xs font-semibold text-slate-600">Hasta
              <input type="date" value={filtros.hasta} min={filtros.desde} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} className={`mt-1 block w-full ${campo}`} required />
            </label>
            <label className="text-xs font-semibold text-slate-600">Usuario
              <select value={filtros.usuarioId} onChange={(e) => setFiltros({ ...filtros, usuarioId: e.target.value })} className={`mt-1 block w-full ${campo}`}>
                <option value="">Todos</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Acción
              <select value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })} className={`mt-1 block w-full ${campo}`}>
                <option value="">Todas</option>
                {acciones.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" disabled={cargando} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer active:scale-95 transition-transform">
              <Search className="h-4 w-4" /> Buscar
            </button>
            <button type="button" onClick={descargar} disabled={exportando || datos.total === 0} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer active:scale-95 transition-transform">
              <FileSpreadsheet className="h-4 w-4" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 sm:px-5 py-3">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
              <ShieldCheck className="h-5 w-5 text-cyan-600 shrink-0" />
              <span>{datos.total} registro(s)</span>
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
              <button type="button" aria-label="Página anterior" onClick={() => irAPagina(pagina - 1)} disabled={pagina <= 1 || cargando} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" aria-label="Página siguiente" onClick={() => irAPagina(pagina + 1)} disabled={pagina >= paginas || cargando} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          {datos.registros.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">{cargando ? 'Cargando…' : 'No hay registros con estos filtros.'}</p>
          ) : (
            <>
              {/* Vista Móvil: Tarjetas claras y legibles */}
              <div className="block md:hidden divide-y divide-slate-100">
                {datos.registros.map((r) => (
                  <div key={r.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{nombreAccion(r.accion)}</span>
                        <p className="text-slate-400 text-[11px]">{r.entidad}{r.entidadId ? ` #${r.entidadId}` : ''}</p>
                      </div>
                      <span className="shrink-0 text-slate-500 text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded-lg">{fechaHora(r.creadoEn)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-semibold text-slate-800">{r.usuarioNombre}</span>
                      {r.dispositivoNombre && <span className="text-slate-400">({r.dispositivoNombre})</span>}
                    </div>

                    {resumenCambio(r.antes, r.despues) && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-slate-700 whitespace-pre-line font-mono text-[11px]">
                        {resumenCambio(r.antes, r.despues)}
                      </div>
                    )}

                    {(r.motivo || r.autorizadoPor) && (
                      <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                        {r.motivo && <p><span className="font-medium text-slate-700">Motivo:</span> {r.motivo}</p>}
                        {r.autorizadoPor && <p><span className="font-medium text-slate-700">Autorizó:</span> {r.autorizadoPor}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Vista Desktop / Tablet: Tabla completa con scroll horizontal si es necesario */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Usuario</th>
                      <th className="px-3 py-2.5">Acción</th>
                      <th className="px-3 py-2.5">Detalle</th>
                      <th className="px-4 py-2.5">Motivo / Autorizó</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 align-top">
                    {datos.registros.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fechaHora(r.creadoEn)}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900">{r.usuarioNombre}</p>
                          {r.dispositivoNombre && <p className="text-xs text-slate-400">{r.dispositivoNombre}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900">{nombreAccion(r.accion)}</p>
                          <p className="text-xs text-slate-400">{r.entidad}{r.entidadId ? ` #${r.entidadId}` : ''}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-pre-line max-w-md">{resumenCambio(r.antes, r.despues) || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {r.motivo && <p>{r.motivo}</p>}
                          {r.autorizadoPor && <p className="text-slate-400">Autorizó: {r.autorizadoPor}</p>}
                          {!r.motivo && !r.autorizadoPor && '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
