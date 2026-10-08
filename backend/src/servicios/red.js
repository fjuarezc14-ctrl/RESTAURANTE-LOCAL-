// @ts-check
// Direcciones IP del servidor para conectar celulares y tablets
const os = require('os');

// ── Detección de la IP del servidor en la red local ──
// Adaptadores que casi nunca son la red del local (WSL, Hyper-V, VirtualBox, VMware, Docker, VPN...)
const INTERFAZ_VIRTUAL = /vethernet|wsl|hyper-v|virtualbox|vmware|vmnet|vbox|docker|br-|veth|virbr|tun|tap|vpn|zerotier|tailscale|hamachi|radmin|loopback|bluetooth|npcap/i;

const interfacesIPv4 = () => Object.entries(os.networkInterfaces())
  .flatMap(([nombre, lista]) => (lista || [])
    .filter(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map(i => ({ ip: i.address, interfaz: nombre, virtual: INTERFAZ_VIRTUAL.test(nombre) })));

// IP que el sistema usa para salir a la red: un socket UDP "conectado" no envía ningún paquete,
// solo le pide al sistema operativo que elija la interfaz de la ruta por defecto.
const ipRutaPorDefecto = () => new Promise((resolve) => {
  const sock = require('dgram').createSocket('udp4');
  const fin = (ip) => { try { sock.close(); } catch { /* ya cerrado */ } resolve(ip); };
  sock.on('error', () => fin(null));
  try {
    sock.connect(53, '8.8.8.8', () => {
      try { fin(sock.address().address); } catch { fin(null); }
    });
  } catch { fin(null); }
  setTimeout(() => fin(null), 500);
});

// Orden: IP fijada a mano > ruta por defecto > redes domésticas típicas > resto; las virtuales al final
const puntajeIp = ({ ip, virtual }, ipRuta) => {
  if (ip === ipRuta) return 0;
  if (virtual) return 50;
  if (ip.startsWith('192.168.')) return 10;
  if (ip.startsWith('10.')) return 20;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 30; // rango habitual de Docker/WSL
  return 40;
};

module.exports = { INTERFAZ_VIRTUAL, interfacesIPv4, ipRutaPorDefecto, puntajeIp };
