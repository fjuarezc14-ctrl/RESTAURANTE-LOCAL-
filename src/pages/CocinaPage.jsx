import { ChefHat } from 'lucide-react';
import { api } from '../api';
import MonitorPreparacion from '../components/MonitorPreparacion';

const cargarPedidos = () => api.getPedidosCocina();
const cargarCancelaciones = () => api.getCancelacionesCocina();
const descartarCancelacion = (id) => api.dismissCancelacionCocina(id);
const marcarPedidoListo = (pedidoId) => api.prepararPedido(pedidoId, 'cocina');
const marcarItemListo = (itemId) => api.prepararItem(itemId);

export default function CocinaPage() {
  return (
    <MonitorPreparacion
      titulo="Cocina"
      subtitulo="Solo platos de cocina, sin bebidas"
      Icon={ChefHat}
      acento={{ texto: 'text-amber-300', fondoSuave: 'bg-amber-500/15', boton: 'bg-amber-600' }}
      cargarPedidos={cargarPedidos}
      cargarCancelaciones={cargarCancelaciones}
      descartarCancelacion={descartarCancelacion}
      marcarPedidoListo={marcarPedidoListo}
      marcarItemListo={marcarItemListo}
      mostrarEnsalada
      etiquetaCancelacion="Pedido cancelado"
      textoVacio="Sin pedidos pendientes"
      subtextoVacio="La cocina está al día."
    />
  );
}
