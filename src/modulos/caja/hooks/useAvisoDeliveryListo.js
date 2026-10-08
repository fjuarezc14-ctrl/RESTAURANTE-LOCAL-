// Alerta sonora y visual cuando un pedido para llevar / delivery pasa de Cocina a Servido (listo para entregar)
import { useEffect, useRef } from 'react';
import { sonarCampanaCaja } from '../utils/sonidoCaja';

export function useAvisoDeliveryListo(pedidosLlevar, setToasts) {
  const prevPedidosLlevarRef = useRef([]);
  useEffect(() => {
    if (pedidosLlevar.length === 0) {
      if (prevPedidosLlevarRef.current.length === 0) prevPedidosLlevarRef.current = pedidosLlevar;
      return;
    }
    if (prevPedidosLlevarRef.current.length > 0) {
      pedidosLlevar.forEach(p => {
        const ant = prevPedidosLlevarRef.current.find(prev => prev.pedidoId === p.pedidoId);
        if (ant && ant.estado === 'Cocina' && p.estado === 'Servido') {
          sonarCampanaCaja();
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, { id: toastId, mensaje: `🛎️ ¡Pedido "${p.codigoPedidosYa}" está LISTO para entregar!` }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 9000);
        }
      });
    }
    prevPedidosLlevarRef.current = pedidosLlevar;
  }, [pedidosLlevar, setToasts]);
}
