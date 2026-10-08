// Descargar un respaldo completo de la base (solo Administrador). El archivo .dump se restaura con
// pg_restore o con scripts/importar-respaldo.sh; la descarga queda registrada en la auditoría.
import { useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { api } from '../../api';
import { useAviso } from '../../components/ui';

export default function TarjetaRespaldo() {
  const aviso = useAviso();
  const [descargando, setDescargando] = useState(false);

  const descargar = async () => {
    setDescargando(true);
    try {
      const { nombre, bytes } = await api.descargarRespaldo();
      aviso.exito(`Respaldo descargado: ${nombre} (${(bytes / 1024 / 1024).toFixed(1)} MB). Guárdalo fuera de esta computadora.`);
    } catch (err) {
      aviso.error(err.message || 'No se pudo descargar el respaldo.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
        <DatabaseBackup className="w-5 h-5 text-cyan-600" /> Respaldo de la base de datos
      </h3>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        Copia completa de ventas, carta, usuarios y caja. Descárgala seguido y guárdala en una USB o en la nube.
      </p>
      <button
        type="button"
        onClick={descargar}
        disabled={descargando}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 disabled:opacity-50 cursor-pointer"
      >
        {descargando
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando respaldo…</>
          : <><Download className="w-4 h-4" /> Descargar respaldo</>}
      </button>
    </div>
  );
}
