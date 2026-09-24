import { GlassWater } from 'lucide-react';
import { api } from '../api';
import MonitorPreparacion from '../components/MonitorPreparacion';

const cargarPedidos = () => api.getPedidosBarra();
const cargarCancelaciones = () => api.getCancelacionesBarra();
const descartarCancelacion = (id) => api.dismissCancelacionBarra(id);
const marcarPedidoListo = (pedidoId) => api.prepararPedido(pedidoId, 'barra');

export default function BarraPage() {
  return (
    <MonitorPreparacion
      titulo="Barra"
      subtitulo="Tragos, refrescos y cervezas"
      Icon={GlassWater}
      acento={{ texto: 'text-purple-300', fondoSuave: 'bg-purple-500/15', boton: 'bg-purple-600' }}
      cargarPedidos={cargarPedidos}
      cargarCancelaciones={cargarCancelaciones}
      descartarCancelacion={descartarCancelacion}
      marcarPedidoListo={marcarPedidoListo}
      etiquetaCancelacion="Bebida cancelada"
      textoVacio="Sin bebidas pendientes"
      subtextoVacio="La barra está al día. ¡Salud!"
    />
  );
}
