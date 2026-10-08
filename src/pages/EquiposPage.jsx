// ================================================================
// EQUIPOS Y SESIONES (solo Administrador)
// - Equipos activados (PC, tablets, celulares): revocar obliga a activarlo de nuevo con usuario y contraseña.
// - Sesiones abiertas de cada usuario: cerrarlas obliga a volver a ingresar el PIN (el equipo sigue activado).
// ================================================================
import { useCallback, useEffect, useState } from 'react';
import { Ban, LogOut, MonitorSmartphone, RefreshCw, UsersRound } from 'lucide-react';
import { api } from '../api';
import { useAviso, useConfirmar } from '../components/ui';

const fechaHora = (iso) => (iso
  ? new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

// "Mozilla/5.0 (Linux; Android 13; ...) Chrome/120" → "Android · Chrome"
function equipoDe(agente = '') {
  const so = /Android/i.test(agente) ? 'Android' : /iPhone|iPad/i.test(agente) ? 'iPhone/iPad'
    : /Windows/i.test(agente) ? 'Windows' : /Mac OS/i.test(agente) ? 'Mac' : /Linux/i.test(agente) ? 'Linux' : 'Otro';
  const nav = /Edg\//.test(agente) ? 'Edge' : /Chrome\//.test(agente) ? 'Chrome' : /Firefox\//.test(agente) ? 'Firefox'
    : /Safari\//.test(agente) ? 'Safari' : 'Navegador';
  return `${so} · ${nav}`;
}

async function obtenerEquiposYSesiones() {
  const [equipos, usuarios] = await Promise.all([api.getDispositivos(), api.getUsuarios()]);
  const activos = usuarios.filter((u) => u.activo !== false);
  const sesiones = await Promise.all(activos.map((u) => api.getSesionesUsuario(u.id).catch(() => [])));
  return { equipos, sesiones: activos.map((usuario, i) => ({ usuario, sesiones: sesiones[i] })) };
}

export default function EquiposPage() {
  const aviso = useAviso();
  const confirmar = useConfirmar();
  const [dispositivos, setDispositivos] = useState([]);
  const [sesionesPorUsuario, setSesionesPorUsuario] = useState([]); // [{ usuario, sesiones }]
  const [cargando, setCargando] = useState(true);
  const [verRevocados, setVerRevocados] = useState(false);

  // "cargando" lo prende quien pide recargar (botón Actualizar); al entrar ya empieza en true
  const cargar = useCallback(() => obtenerEquiposYSesiones()
    .then(({ equipos, sesiones }) => { setDispositivos(equipos); setSesionesPorUsuario(sesiones); })
    .catch((err) => aviso.error(`No se pudo cargar la lista: ${err.message}`))
    .finally(() => setCargando(false)), [aviso]);

  useEffect(() => { cargar(); }, [cargar]);

  const revocar = async (d) => {
    const ok = await confirmar({
      titulo: `¿Revocar "${d.nombre}"?`,
      mensaje: 'Se cerrarán sus sesiones y, para volver a usarlo, habrá que activarlo de nuevo con usuario y contraseña. Si es este mismo equipo, saldrás del sistema.',
      botonConfirmar: 'Revocar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await api.revocarDispositivo(d.id);
      aviso.exito(`Equipo "${d.nombre}" revocado.`);
      cargar();
    } catch (err) {
      aviso.error(err.message);
    }
  };

  const cerrarSesiones = async (usuario) => {
    const ok = await confirmar({
      titulo: `¿Cerrar las sesiones de ${usuario.nombre}?`,
      mensaje: 'Tendrá que volver a ingresar su PIN en todos los equipos. Los equipos siguen activados.',
      botonConfirmar: 'Cerrar sesiones',
      peligro: true,
    });
    if (!ok) return;
    try {
      await api.cerrarSesionesUsuario(usuario.id);
      aviso.exito(`Sesiones de ${usuario.nombre} cerradas.`);
      cargar();
    } catch (err) {
      aviso.error(err.message);
    }
  };

  const visibles = dispositivos.filter((d) => verRevocados || !d.revocadoEn);
  const revocados = dispositivos.filter((d) => d.revocadoEn).length;
  const conSesion = sesionesPorUsuario.filter((s) => s.sesiones.length > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Equipos que pueden entrar al sistema y quién tiene la sesión abierta en cada uno.</p>
        <button type="button" onClick={() => { setCargando(true); cargar(); }} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><MonitorSmartphone className="h-5 w-5 text-cyan-600" /> Equipos activados</h2>
          {revocados > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={verRevocados} onChange={(e) => setVerRevocados(e.target.checked)} /> Mostrar revocados ({revocados})
            </label>
          )}
        </div>
        {visibles.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">{cargando ? 'Cargando…' : 'No hay equipos activados.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Equipo</th>
                  <th className="px-3 py-2.5">Activado por</th>
                  <th className="px-3 py-2.5">Activado</th>
                  <th className="px-3 py-2.5">Último uso</th>
                  <th className="px-5 py-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((d) => (
                  <tr key={d.id} className={d.revocadoEn ? 'text-slate-400' : ''}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{d.nombre}</p>
                      <p className="text-xs text-slate-500" title={d.agente}>{equipoDe(d.agente)}</p>
                    </td>
                    <td className="px-3 py-3">{d.activadoPor?.nombre || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fechaHora(d.creadoEn)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fechaHora(d.ultimoUso)}</td>
                    <td className="px-5 py-3 text-right">
                      {d.revocadoEn ? (
                        <span className="text-xs">Revocado el {fechaHora(d.revocadoEn)}</span>
                      ) : (
                        <button type="button" onClick={() => revocar(d)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer">
                          <Ban className="h-3.5 w-3.5" /> Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><UsersRound className="h-5 w-5 text-cyan-600" /> Sesiones abiertas</h2>
        </div>
        {conSesion.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">{cargando ? 'Cargando…' : 'Nadie tiene la sesión abierta.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conSesion.map(({ usuario, sesiones }) => (
              <li key={usuario.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{usuario.nombre} <span className="text-xs font-normal text-slate-500">· {usuario.rol}</span></p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {sesiones.map((s) => (
                      <li key={s.id}>{s.dispositivo?.nombre || 'Equipo'} — activo por última vez {fechaHora(s.ultimaActividad)}</li>
                    ))}
                  </ul>
                </div>
                <button type="button" onClick={() => cerrarSesiones(usuario)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" /> Cerrar sesiones ({sesiones.length})
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
