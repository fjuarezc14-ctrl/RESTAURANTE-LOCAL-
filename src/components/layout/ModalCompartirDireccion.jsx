// Compartir la dirección del sistema (QR) con los celulares de los mozos
import { X, Copy, Check as CheckIcon, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../../api';
import { generateOfflineQrUrl } from '../../utils/qrOffline';
import { Dialog } from '../ui';

// Muestra las direcciones con las que los mozos entran desde su celular (se consultan al abrir,
// así siempre reflejan la IP actual de la PC aunque el router se la haya cambiado).
export const ModalCompartirDireccion = ({ onClose }) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    let vigente = true;
    api.getDireccionesRed()
      .then(res => {
        if (!vigente) return;
        if (res?.error || !res?.urls) setError('No se pudieron obtener las direcciones.');
        else setDatos(res);
      })
      .catch(() => vigente && setError('No se pudieron obtener las direcciones.'));
    return () => { vigente = false; };
  }, []);

  const copiar = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): selección manual como respaldo
      const tmp = document.createElement('textarea');
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }
    setCopiado(url);
    setTimeout(() => setCopiado(''), 2000);
  };

  // Si la app ya se abrió con una IP/host de la red (o un dominio, ej. un túnel https), esa dirección
  // es la correcta tal cual, sin agregarle puerto. Para las IPs de la PC, el puerto es el de la app
  // abierta (en desarrollo difiere del backend); si la página no tiene puerto, el del backend por http.
  const hostActual = window.location.hostname;
  const esLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostActual);
  const puerto = window.location.port || datos?.puerto;
  const aUrl = (host) => window.location.port
    ? `${window.location.protocol}//${host}:${window.location.port}`
    : `http://${host}${puerto ? `:${puerto}` : ''}`;
  const ipsDetectadas = datos?.ips || (datos?.urls || []).map(u => ({ ip: new URL(u).hostname, virtual: false }));
  const principal = datos ? (!esLocal ? window.location.origin : (ipsDetectadas[0] ? aUrl(ipsDetectadas[0].ip) : null)) : null;
  const otras = ipsDetectadas
    .map(i => ({ ...i, url: aUrl(i.ip) }))
    .filter(i => i.url !== principal);

  return (
    <Dialog open onClose={onClose} capa="z-[60]" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" /> Dirección para los mozos
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-rose-400 font-bold">{error}</p>}
          {!datos && !error && <p className="text-xs text-slate-400 animate-pulse">Buscando direcciones...</p>}

          {datos && (
            <>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                El celular debe estar en el <strong className="text-slate-200">mismo WiFi</strong> que esta PC.
                Escanea el código o copia el enlace y envíaselo.
              </p>

              {principal && (
                <div className="flex justify-center">
                  <img src={generateOfflineQrUrl(principal, 160)} alt="Código QR de acceso" className="bg-white p-2 rounded-xl w-40 h-40" />
                </div>
              )}

              <div className="space-y-2">
                {principal && (
                  <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/40 rounded-xl px-3 py-2.5">
                    <span className="flex-1 text-sm font-mono font-bold text-cyan-300 truncate">{principal}</span>
                    <button
                      onClick={() => copiar(principal)}
                      className="shrink-0 px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      {copiado === principal ? <><CheckIcon className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </button>
                  </div>
                )}
                {!principal && datos.enContenedor && (
                  <p className="text-xs text-amber-400 font-bold leading-relaxed">
                    El sistema corre en Docker y desde ahí no se ve la IP de esta PC. Abre el sistema con la IP de la PC
                    en vez de localhost (ej. http://192.168.1.20:{puerto}) o define IP_SERVIDOR en el archivo .env.
                  </p>
                )}
                {!principal && !datos.enContenedor && (
                  <p className="text-xs text-amber-400 font-bold">Esta PC no está conectada a ninguna red WiFi o cable.</p>
                )}
                {otras.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[11px] text-slate-400 hover:text-slate-200 select-none">
                      ▸ Otras direcciones de esta PC ({otras.length}) · úsalas solo si la principal no abre
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {otras.map(o => (
                        <div key={o.url} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-1.5">
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-mono text-slate-300 truncate">{o.url}</span>
                            {o.interfaz && <span className="block text-[10px] text-slate-500 truncate">{o.interfaz}{o.virtual ? ' · adaptador virtual' : ''}</span>}
                          </span>
                          <button
                            onClick={() => copiar(o.url)}
                            className="shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                          >
                            {copiado === o.url ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
                Si el enlace deja de funcionar, es porque el router le cambió la IP a esta PC. Vuelve a abrir esta
                ventana para ver la nueva, o pídele a tu proveedor de internet que le fije una IP siempre igual.
              </p>
            </>
          )}
        </div>
    </Dialog>
  );
};
