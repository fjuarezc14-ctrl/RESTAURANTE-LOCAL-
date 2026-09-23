import React, { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign, XCircle, Users, Truck, Calendar, Search, Receipt, Printer, X, Wallet, Briefcase, Award, Flame, UtensilsCrossed, PieChart, Layers, History, AlertTriangle, Filter } from 'lucide-react';

import { api } from '../api';
import { useCompany } from '../context/CompanyContext';
import { COMPANY_CONFIG, DEFAULT_BARRA_CATEGORIAS } from '../config/company';
import { generateOfflineQrUrl } from '../utils/qrOffline';

// Igual que en Caja: el sistema solo emite tickets de venta
const FACTURACION_ELECTRONICA = false;

const BARRA_CATEGORIAS = (COMPANY_CONFIG.barraCategorias && Array.isArray(COMPANY_CONFIG.barraCategorias))
  ? COMPANY_CONFIG.barraCategorias
  : DEFAULT_BARRA_CATEGORIAS;


const parseDeliveryInfo = (code) => {
  if (!code || !code.startsWith('DELIVERY -')) return null;
  const parts = code.split(' | ');
  const namePart = parts[0] ? parts[0].replace('DELIVERY - ', '') : '';
  const telPart = parts[1] ? parts[1].replace('TEL: ', '') : '';
  const dirPart = parts[2] ? parts[2].replace('DIR: ', '') : '';
  const pagaPart = parts[3] ? parts[3].replace('PAGA: ', '') : '';
  const vueltoPart = parts[4] ? parts[4].replace('VUELTO: ', '') : '';
  
  return {
    nombre: namePart,
    telefono: telPart,
    direccion: dirPart,
    conCuanto: pagaPart,
    vuelto: vueltoPart,
  };
};

const parsearCreditoSplit = (ofertaDescripcion, defaultClienteId, defaultMonto) => {
  if (ofertaDescripcion && typeof ofertaDescripcion === 'string') {
    const match = ofertaDescripcion.match(/\[CREDITO_SPLIT:(.*?)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            clienteId: parseInt(item.clienteId || item.id),
            nombre: item.nombre || '',
            monto: parseFloat(item.monto || 0)
          })).filter(item => !isNaN(item.clienteId) && item.monto > 0);
        }
      } catch (e) {
        console.error('Error parseando CREDITO_SPLIT:', e);
      }
    }
  }
  const defId = parseInt(defaultClienteId);
  const defM = parseFloat(defaultMonto || 0);
  if (!isNaN(defId) && defId > 0 && defM > 0) {
    return [{ clienteId: defId, monto: defM, nombre: '' }];
  }
  return [];
};

export default function ReportesPage() {
  const { empresa: COMPANY_CONFIG } = useCompany();
  const getPrimerDiaMes = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const getHoyString = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fechaDesde, setFechaDesde] = useState(getHoyString());
  const [fechaHasta, setFechaHasta] = useState(getHoyString());
  const [resumen, setResumen] = useState({ 
    ventasTotal: 0, 
    ventasBase: 0, 
    ventasIGV: 0, 
    comprasTotal: 0, 
    comprasBase: 0, 
    comprasIGV: 0, 
    igvAPagar: 0 
  });
  const [cancelaciones, setCancelaciones] = useState([]);
  const [mozos, setMozos] = useState([]);
  const [cajeros, setCajeros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrando, setFiltrando] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [rotacion, setRotacion] = useState([]);
  const [compras, setCompras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [gerencialModalOpen, setGerencialModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [cierresHistorial, setCierresHistorial] = useState([]);
  const [cierreAImprimir, setCierreAImprimir] = useState(null);
  const [rotacionCatFiltro, setRotacionCatFiltro] = useState('Todos');
  const [rotacionBusqueda, setRotacionBusqueda] = useState('');
  const [filtroTipoAnulacion, setFiltroTipoAnulacion] = useState('Todos');

  // Filtros de secciones para el Reporte Gerencial PDF
  const [incluirBalance, setIncluirBalance] = useState(true);
  const [incluirMozos, setIncluirMozos] = useState(true);
  const [incluirRotacion, setIncluirRotacion] = useState(true);
  const [incluirGastos, setIncluirGastos] = useState(true);
  const [incluirPedidosYa, setIncluirPedidosYa] = useState(true);
  const [incluirPersonal, setIncluirPersonal] = useState(true);


  const numeroALetras = (num) => {
    const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
    const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    let entero = Math.floor(num);
    let decimales = Math.round((num - entero) * 100);
    let decimalStr = decimales < 10 ? "0" + decimales : decimales;

    if (entero === 0) return "CERO CON " + decimalStr + "/100 SOLES";
    if (entero === 100) return "CIEN CON " + decimalStr + "/100 SOLES";

    let letras = "";

    if (entero >= 100) {
      let c = Math.floor(entero / 100);
      letras += centenas[c] + " ";
      entero %= 100;
    }

    if (entero >= 10 && entero <= 19) {
      letras += especiales[entero - 10] + " ";
    } else if (entero >= 20 || entero > 0) {
      let d = Math.floor(entero / 10);
      let u = entero % 10;
      if (d > 0) {
        letras += decenas[d];
        if (u > 0) letras += " Y ";
      }
      if (u > 0) {
        letras += unidades[u];
      }
      letras += " ";
    }

    return letras.trim() + " CON " + decimalStr + "/100 SOLES";
  };

  const reimprimirComprobante = (v) => {
    if (!v) return;
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.id % 10000).padStart(4, '0');
    const totalLetras = numeroALetras(v.total);
    const hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = `R.U.C. N° ${COMPANY_CONFIG.ruc}`;
    const qrData = `${rucEmpresa}|03|${serie}|${correlativoStr}|${v.igv.toFixed(2)}|${v.total.toFixed(2)}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':'1'}|${v.numDocumento || '00000000'}`;
    const qrImageUrl = generateOfflineQrUrl(qrData);

    // Reconstruir items si vienen del backend o parsear de itemsResumen
    let items = v.items || [];
    if (items.length === 0 && v.itemsResumen) {
      items = v.itemsResumen.split(', ').map(str => {
        const match = str.match(/^(\d+)x\s+(.+)$/);
        if (match) {
          const cant = parseInt(match[1]);
          const nombre = match[2];
          const precio = v.total / cant; // fallback estimate
          return { cant, nombre, precio };
        }
        return { cant: 1, nombre: str, precio: v.total };
      });
    }

    const parsedDelivery = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    const cleanDoc = (() => {
      if (v.numDocumento && v.numDocumento.startsWith('DELIVERY -')) return 'S/D';
      return v.numDocumento || 'S/D';
    })();
    const cleanNombre = (() => {
      if (parsedDelivery) return parsedDelivery.nombre;
      if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
        return v.nombreCliente.replace('DELIVERY - ', '');
      }
      return v.nombreCliente || 'Consumidor Final';
    })();

    setActiveComprobante({
      tipo: v.tipoComprobante,
      serie,
      correlativo: correlativoStr,
      fecha: v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE'),
      hora: v.hora,
      mesaNum: v.mesaNum || (parsedDelivery ? 'Delivery' : 'Llevar'),
      clienteNombre: cleanNombre,
      clienteDoc: cleanDoc,
      clienteDireccion: parsedDelivery ? parsedDelivery.direccion : (v.clienteDireccion || ''),
      items,
      subtotal: v.subtotal,
      igv: v.igv,
      total: v.total,
      descuentoAplicado: v.descuentoAplicado || 0,
      ofertaDescripcion: v.ofertaDescripcion || null,
      totalLetras,
      hashResumen: "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=",
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo || 0,
      montoTarjeta: v.montoTarjeta || 0,
      montoYape: v.montoYape || 0,
      qrImageUrl,
      deliveryInfo: parsedDelivery,
    });

    setSunatModalOpen(true);
    
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const enviarPorWhatsApp = (v) => {
    if (!v) return;
    const telefono = prompt("Ingresa el número de WhatsApp del cliente (Ej. 999888777):");
    if (!telefono) return;
    
    // Validar celular peruano de 9 dígitos
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      alert("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.id % 10000).padStart(4, '0');
    
    const mensaje = `Hola *${v.nombreCliente || 'Estimado cliente'}*, el total de su consumo en *${COMPANY_CONFIG.name}* fue de *S/ ${v.total.toFixed(2)}* (ticket de venta N° ${v.id}).\n\n¡Gracias por su preferencia!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };


  const fetchReportes = useCallback(async (desde, hasta) => {
    setFiltrando(true);
    try {
      const [data, cancs, mzs, vts, rot, cmps, clients, cierresRes, cajs] = await Promise.all([
        api.getReporteContable(desde, hasta),
        api.getCancelaciones(desde, hasta),
        api.getReporteMozos(desde, hasta),
        api.getHistorialVentas(desde, hasta),
        api.getRotacion(desde, hasta),
        api.getCompras(desde, hasta),
        api.getClientes().catch(() => []),
        api.getHistorialCierres(100).catch(() => []),
        api.getReporteCajeros(desde, hasta).catch(() => []),
      ]);
      setResumen(data);
      setCancelaciones(cancs || []);
      setMozos(mzs || []);
      setVentas(vts || []);
      setRotacion(rot || []);
      setCompras(cmps || []);
      setClientes(clients || []);
      const listCierres = Array.isArray(cierresRes) ? cierresRes : (cierresRes?.cierres || []);
      setCierresHistorial(listCierres);
      setCajeros(cajs || []);
    } catch(err) {
      console.error('Error cargando reportes:', err);
    } finally {
      setLoading(false);
      setFiltrando(false);
    }
  }, []);


  useEffect(() => {
    fetchReportes(fechaDesde, fechaHasta);
  }, []);

  const handleFiltrar = () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Por favor selecciona ambas fechas.');
      return;
    }
    fetchReportes(fechaDesde, fechaHasta);
  };

  const exportarLibroContableRCE = async () => {
    try {
      setFiltrando(true);
      // Obtener el historial real detallado de ventas y compras del periodo seleccionado
      const [ventasData, comprasData] = await Promise.all([
        api.getHistorialVentas(fechaDesde, fechaHasta),
        api.getCompras(fechaDesde, fechaHasta)
      ]);

      const totalVentas = ventasData.reduce((s, v) => s + (Number(v.total) || 0), 0);
      const baseVentas = ventasData.reduce((s, v) => s + (Number(v.subtotal) || 0), 0);
      const igvVentas = ventasData.reduce((s, v) => s + (Number(v.igv) || 0), 0);

      const totalCompras = comprasData.reduce((s, c) => s + (Number(c.total) || 0), 0);
      const baseCompras = comprasData.reduce((s, c) => s + (Number(c.baseImponible) || 0), 0);
      const igvCompras = comprasData.reduce((s, c) => s + (Number(c.igv) || 0), 0);

      const margenOperativo = totalVentas - totalCompras;

      // Desglose por métodos de pago en ventas
      let ventasEfec = 0;
      let ventasTarj = 0;
      let ventasYape = 0;
      let ventasOtros = 0;

      ventasData.forEach(v => {
        let e = Number(v.montoEfectivo) || (v.metodoPago === 'Efectivo' ? v.total : 0);
        let t = Number(v.montoTarjeta) || (v.metodoPago === 'Tarjeta' ? v.total : 0);
        let y = Number(v.montoYape) || (v.metodoPago === 'Yape' ? v.total : 0);
        if (v.metodoPago === 'Mixto' && (e + t + y) < v.total) {
          e += (v.total - (e + t + y));
        }
        ventasEfec += e;
        ventasTarj += t;
        ventasYape += y;
        if (v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía' || v.metodoPago === 'Crédito') {
          ventasOtros += Number(v.total) || 0;
        }
      });

      // Filas de Ventas
      const ventasRows = ventasData.map((v, idx) => {
        const date = v.createdAt ? v.createdAt.split('T')[0] : '';
        const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
        const correlativoStr = String(v.id % 10000).padStart(4, '0');
        const numComp = `${serie}-${correlativoStr}`;
        let efec = Number(v.montoEfectivo) || (v.metodoPago === 'Efectivo' ? v.total : 0);
        let tarj = Number(v.montoTarjeta) || (v.metodoPago === 'Tarjeta' ? v.total : 0);
        let yape = Number(v.montoYape) || (v.metodoPago === 'Yape' ? v.total : 0);
        if (v.metodoPago === 'Mixto' && (efec + tarj + yape) < v.total) {
          efec += (v.total - (efec + tarj + yape));
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        return `
          <tr style="background-color: ${bg};">
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'\\@';">${idx + 1}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'yyyy-mm-dd';">${date}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${v.tipoComprobante || 'Ticket'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; font-weight: bold; mso-number-format:'\\@';">${numComp}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'\\@';">${v.numDocumento || 'S/D'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px;">${v.nombreCliente || 'PÚBLICO GENERAL'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; font-weight: 600;">${v.metodoPago}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; font-weight: bold; mso-number-format:'\\@';">${v.cajeroNombre || 'Cajero Principal'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${v.subtotal.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; color: #2563EB; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${v.igv.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; font-weight: bold; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${v.total.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${efec.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${tarj.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${yape.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      // Filas de Compras
      const comprasRows = comprasData.map((c, idx) => {
        const date = c.creadoEn ? c.creadoEn.split('T')[0] : '';
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        return `
          <tr style="background-color: ${bg};">
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'\\@';">${idx + 1}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'yyyy-mm-dd';">${date}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${c.tipoDocumento || 'Factura'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; font-weight: bold; mso-number-format:'\\@';">${c.serieNumero || '-'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center; mso-number-format:'\\@';">${c.ruc || 'S/D'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; font-weight: 600;">${c.proveedor || 'Sin proveedor'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px;">${c.categoria || 'Gastos Operativos'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${c.baseImponible.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; color: #E11D48; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${c.igv.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: right; font-weight: bold; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">${c.total.toFixed(2)}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; text-align: center;">${c.metodoPago || 'Efectivo'}</td>
          </tr>
        `;
      }).join('');

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Libro Contable RCE-RVE</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1E293B; }
            .title { font-size: 16px; font-weight: 900; color: #0F172A; text-align: center; }
            .subtitle { font-size: 11px; color: #64748B; text-align: center; }
            .section-header { background-color: #0F172A; color: #FFFFFF; font-weight: 900; font-size: 12px; padding: 8px; text-align: left; }
            .table-head th { background-color: #1E293B; color: #FFFFFF; font-weight: 800; font-size: 10px; text-transform: uppercase; padding: 6px; border: 1px solid #0F172A; }
            .kpi-title { background-color: #F1F5F9; font-weight: 800; font-size: 10px; color: #475569; padding: 6px; border: 1px solid #CBD5E1; }
            .kpi-val { background-color: #FFFFFF; font-weight: 900; font-size: 12px; color: #0F172A; text-align: right; padding: 6px; border: 1px solid #CBD5E1; }
            .total-row td { background-color: #E2E8F0; font-weight: 900; font-size: 11px; color: #0F172A; border-top: 2px solid #0F172A; border-bottom: 3px double #0F172A; padding: 6px; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="14" class="title">${COMPANY_CONFIG.legalName.toUpperCase()}</td></tr>
            <tr><td colspan="14" class="subtitle">RUC: ${COMPANY_CONFIG.ruc} · ${COMPANY_CONFIG.address}</td></tr>
            <tr><td colspan="14" class="subtitle" style="font-weight: bold; color: #334155; font-size: 13px;">LIBRO CONTABLE TRIBUTARIO Y FINANCIERO (RVE / RCE)</td></tr>
            <tr><td colspan="14" class="subtitle">PERIODO EVALUADO: DESDE ${fechaDesde} HASTA ${fechaHasta} · EMISIÓN: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}</td></tr>
            <tr><td colspan="14"></td></tr>

            <!-- DASHBOARD RESUMEN EJECUTIVO -->
            <tr><td colspan="14" class="section-header" style="background-color: #334155;">📊 1. RESUMEN EJECUTIVO FINANCIERO DEL PERIODO</td></tr>
            <tr>
              <td colspan="3" class="kpi-title">TOTAL VENTAS (RVE)</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${totalVentas.toFixed(2)}</td>
              <td colspan="3" class="kpi-title">RECAUDACIÓN EFECTIVO</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasEfec.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
            <tr>
              <td colspan="3" class="kpi-title">TOTAL COMPRAS Y GASTOS (RCE)</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00'; color: #E11D48;">S/ ${totalCompras.toFixed(2)}</td>
              <td colspan="3" class="kpi-title">RECAUDACIÓN TARJETAS (POS)</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasTarj.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
            <tr>
              <td colspan="3" class="kpi-title" style="background-color: #FEF3C7; color: #92400E;">UTILIDAD BRUTA OPERATIVA</td>
              <td colspan="2" class="kpi-val" style="background-color: #FEF3C7; color: ${margenOperativo >= 0 ? '#166534' : '#991B1B'}; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${margenOperativo.toFixed(2)}</td>
              <td colspan="3" class="kpi-title">RECAUDACIÓN YAPE / PLIN</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasYape.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
            <tr>
              <td colspan="3" class="kpi-title">BASE IMPONIBLE VENTAS</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${baseVentas.toFixed(2)}</td>
              <td colspan="3" class="kpi-title">OTROS (CONSUMO / CRÉDITOS)</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasOtros.toFixed(2)}</td>
              <td colspan="4"></td>
            </tr>
            <tr>
              <td colspan="3" class="kpi-title">IGV VENTAS (10.5%)</td>
              <td colspan="2" class="kpi-val" style="mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${igvVentas.toFixed(2)}</td>
              <td colspan="9"></td>
            </tr>
            <tr><td colspan="14"></td></tr>

            <!-- SECCIÓN VENTAS RVE -->
            <tr><td colspan="14" class="section-header">🍽️ 2. REGISTRO DETALLADO DE VENTAS E INGRESOS (RVE)</td></tr>
            <tr class="table-head">
              <th style="width: 40px;">N°</th>
              <th style="width: 85px;">FECHA</th>
              <th style="width: 75px;">TIPO</th>
              <th style="width: 95px;">COMPROBANTE</th>
              <th style="width: 95px;">DOC. CLIENTE</th>
              <th style="width: 220px;">CLIENTE / RAZÓN SOCIAL</th>
              <th style="width: 100px;">MEDIO PAGO</th>
              <th style="width: 110px;">CAJERO</th>
              <th style="width: 100px;">BASE IMP. (S/)</th>
              <th style="width: 80px;">IGV (S/)</th>
              <th style="width: 100px;">TOTAL (S/)</th>
              <th style="width: 90px;">EFECTIVO</th>
              <th style="width: 90px;">TARJETA</th>
              <th style="width: 90px;">YAPE/PLIN</th>
            </tr>
            ${ventasRows}
            <tr class="total-row">
              <td colspan="8" style="text-align: right; padding-right: 12px;">TOTALES RVE VENTAS:</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${baseVentas.toFixed(2)}</td>
              <td style="text-align: right; color: #2563EB; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${igvVentas.toFixed(2)}</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${totalVentas.toFixed(2)}</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasEfec.toFixed(2)}</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasTarj.toFixed(2)}</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${ventasYape.toFixed(2)}</td>
            </tr>
            <tr><td colspan="14"></td></tr>

            <!-- SECCIÓN COMPRAS RCE -->
            <tr><td colspan="13" class="section-header" style="background-color: #BE123C;">🔻 3. REGISTRO DETALLADO DE COMPRAS Y GASTOS (RCE)</td></tr>
            <tr class="table-head">
              <th style="width: 40px; background-color: #881337;">N°</th>
              <th style="width: 85px; background-color: #881337;">FECHA</th>
              <th style="width: 75px; background-color: #881337;">TIPO</th>
              <th style="width: 95px; background-color: #881337;">SERIE/NUM</th>
              <th style="width: 95px; background-color: #881337;">RUC PROVEEDOR</th>
              <th style="width: 220px; background-color: #881337;">PROVEEDOR / RAZÓN SOCIAL</th>
              <th style="width: 130px; background-color: #881337;">CATEGORÍA / CONCEPTO</th>
              <th style="width: 100px; background-color: #881337;">BASE IMP. (S/)</th>
              <th style="width: 80px; background-color: #881337;">IGV (S/)</th>
              <th style="width: 100px; background-color: #881337;">TOTAL GASTO (S/)</th>
              <th style="width: 90px; background-color: #881337;">FORMA PAGO</th>
              <th colspan="2" style="background-color: #881337;"></th>
            </tr>
            ${comprasRows}
            <tr class="total-row">
              <td colspan="7" style="text-align: right; padding-right: 12px;">TOTALES RCE COMPRAS:</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${baseCompras.toFixed(2)}</td>
              <td style="text-align: right; color: #E11D48; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${igvCompras.toFixed(2)}</td>
              <td style="text-align: right; mso-number-format:'\\&quot;S/\\&quot;\\ #\\,##0\\.00';">S/ ${totalCompras.toFixed(2)}</td>
              <td colspan="3"></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const marca = (COMPANY_CONFIG.brandShort || 'EMPRESA').replace(/\s+/g, '_');
      link.download = `Libro_Contable_RCE_RVE_${marca}_${fechaDesde}_AL_${fechaHasta}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al generar libro contable: ' + err.message);
    } finally {
      setFiltrando(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando reporte contable...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50">
      {/* HEADER Y FILTRO DE FECHAS */}
      <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-amber-500"></div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Panel Contable y Auditoría</h1>
          <p className="text-xs md:text-sm text-slate-500">Auditoría tributaria de IGV mensual, mermas de cancelaciones y rendimiento de meseros.</p>
        </div>
        
        {/* Controles del Rango de Fechas */}
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3 z-10 w-full xl:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl h-[38px] shrink-0 border border-slate-200/50">
            <button
              onClick={() => {
                const hoy = getHoyString();
                setFechaDesde(hoy);
                setFechaHasta(hoy);
                fetchReportes(hoy, hoy);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde === getHoyString() && fechaHasta === getHoyString()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const ayerDate = new Date();
                ayerDate.setDate(ayerDate.getDate() - 1);
                const yyyy = ayerDate.getFullYear();
                const mm = String(ayerDate.getMonth() + 1).padStart(2, '0');
                const dd = String(ayerDate.getDate()).padStart(2, '0');
                const ayerStr = `${yyyy}-${mm}-${dd}`;
                setFechaDesde(ayerStr);
                setFechaHasta(ayerStr);
                fetchReportes(ayerStr, ayerStr);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde !== getHoyString() && fechaDesde === fechaHasta && (() => {
                  const ayerDate = new Date();
                  ayerDate.setDate(ayerDate.getDate() - 1);
                  const yyyy = ayerDate.getFullYear();
                  const mm = String(ayerDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(ayerDate.getDate()).padStart(2, '0');
                  return fechaDesde === `${yyyy}-${mm}-${dd}`;
                })()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => {
                const primerDia = getPrimerDiaMes();
                const hoy = getHoyString();
                setFechaDesde(primerDia);
                setFechaHasta(hoy);
                fetchReportes(primerDia, hoy);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde === getPrimerDiaMes() && fechaHasta === getHoyString()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Mes
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Desde:</label>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={(e) => setFechaDesde(e.target.value)} 
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Hasta:</label>
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={(e) => setFechaHasta(e.target.value)} 
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
            </div>
            <button 
              onClick={handleFiltrar}
              disabled={filtrando}
              className="mt-4 sm:mt-0 bg-slate-900 hover:bg-purple-600 text-white px-3.5 py-2 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 h-[38px] shrink-0"
            >
              {filtrando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Search className="w-4 h-4" />}
              Filtrar
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <button 
              onClick={exportarLibroContableRCE} 
              disabled={filtrando}
              className="flex-1 sm:flex-initial bg-emerald-500 hover:bg-emerald-600 text-slate-900 px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all active:scale-95 disabled:opacity-50 h-[38px] shrink-0"
            >
              <Download className="w-4 h-4" /> Excel RCE / RVE
            </button>
            <button 
              onClick={() => setGerencialModalOpen(true)} 
              disabled={filtrando}
              className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50 h-[38px] shrink-0"
            >
              <Printer className="w-4 h-4" /> Reporte PDF
            </button>
          </div>
        </div>
      </div>
       {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 overflow-x-auto custom-scrollbar whitespace-nowrap">
        {[
          { id: 'resumen', label: '📊 Balance y Finanzas' },
          { id: 'rotacion', label: '🍽️ Rendimiento de Carta y Platos' },
          { id: 'mozos', label: '👥 Mozos y Servicio' },
          { id: 'anulaciones', label: '🚫 Auditoría de Anulaciones' },
          { id: 'consumo', label: '📋 Consumos y Créditos' },
          { id: 'pedidosya', label: '🛵 Control PedidosYa' },
          { id: 'cierres', label: '🔒 Cierres de Turno (Arqueos)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center gap-1.5 shrink-0 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. RESUMEN FINANCIERO Y COMPROBANTES (RCE) */}
      {activeTab === 'resumen' && (
        <>
          {/* METRICAS DE BALANCE COMERCIAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* TARJETA VENTAS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm"><TrendingUp className="w-5 h-5"/></div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Ventas en Periodo</h2>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 mb-1">S/ {resumen.ventasTotal.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400">Impuestos y base acumulada.</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-4">
                <span>Base: S/ {resumen.ventasBase.toFixed(2)}</span>
                <span className="font-bold text-blue-600">IGV: S/ {resumen.ventasIGV.toFixed(2)}</span>
              </div>
            </div>

            {/* TARJETA COMPRAS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm"><TrendingDown className="w-5 h-5"/></div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Compras RCE</h2>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 mb-1">S/ {resumen.comprasTotal.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400">Gastos comerciales e insumos.</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-4">
                <span>Base: S/ {resumen.comprasBase.toFixed(2)}</span>
                <span className="font-bold text-rose-600">IGV: S/ {resumen.comprasIGV.toFixed(2)}</span>
              </div>
            </div>

            {/* TARJETA MARGEN / UTILIDAD BRUTA */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm"><DollarSign className="w-5 h-5"/></div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Margen Operativo</h2>
                </div>
                <p className={`text-2xl font-black font-mono mb-1 ${(resumen.ventasTotal - resumen.comprasTotal) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  S/ {(resumen.ventasTotal - resumen.comprasTotal).toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400">Utilidad Bruta (Ventas - Compras).</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-4">
                <span>Rentabilidad</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {resumen.ventasTotal > 0 ? (((resumen.ventasTotal - resumen.comprasTotal) / resumen.ventasTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            {/* TARJETA TICKET PROMEDIO Y COMANDAS */}
            <div className="bg-slate-900 p-5 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.01]">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500 rounded-full opacity-10 blur-xl"></div>
              <div>
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="w-9 h-9 bg-slate-800 text-amber-400 rounded-xl flex items-center justify-center shadow-sm border border-slate-700"><Receipt className="w-5 h-5"/></div>
                  <h2 className="font-black text-amber-400 uppercase text-xs tracking-wider">Ticket Promedio</h2>
                </div>
                <p className="text-3xl font-black font-mono text-white mb-1 relative z-10">
                  S/ {ventas.length > 0 ? (resumen.ventasTotal / ventas.length).toFixed(2) : '0.00'}
                </p>
                <p className="text-[11px] text-slate-400">Gasto medio por comanda / cliente.</p>
              </div>
              <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800 pt-3 mt-4 relative z-10">
                <span>Comandas cobradas</span>
                <span className="font-bold text-amber-400 font-mono">{ventas.length} pedidos</span>
              </div>
            </div>
          </div>

          {/* DESGLOSE DE RECAUDACIÓN EN CAJA */}
          {resumen.desgloseCaja && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 mb-8 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Desglose de Recaudación en Caja (Periodo Seleccionado)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-emerald-800">💵 Efectivo Total</span>
                  <p className="text-lg font-mono font-black text-emerald-700 mt-0.5">S/ {(resumen.desgloseCaja.efectivo ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-blue-800">💳 Tarjeta / POS</span>
                  <p className="text-lg font-mono font-black text-blue-700 mt-0.5">S/ {(resumen.desgloseCaja.tarjeta ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-purple-800">📱 Yape / Plin</span>
                  <p className="text-lg font-mono font-black text-purple-700 mt-0.5">S/ {(resumen.desgloseCaja.yape ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-indigo-800">🛵 PedidosYa</span>
                  <p className="text-lg font-mono font-black text-indigo-700 mt-0.5">S/ {(resumen.desgloseCaja.pedidosYa ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-violet-800">👤 Consumo Planilla</span>
                  <p className="text-lg font-mono font-black text-violet-700 mt-0.5">S/ {(resumen.desgloseCaja.consumos ?? resumen.desgloseCaja.consumoPlanilla ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-sky-800">🤝 Crédito Comercial</span>
                  <p className="text-lg font-mono font-black text-sky-700 mt-0.5">S/ {(resumen.desgloseCaja.credito ?? resumen.desgloseCaja.consumoClientes ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-amber-800">🎁 Cortesías</span>
                  <p className="text-lg font-mono font-black text-amber-700 mt-0.5">S/ {(resumen.desgloseCaja.cortesias ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* RENDIMIENTO Y VENTAS POR CAJERO */}
          {cajeros.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" /> Rendimiento y Ventas por Cajero
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Recaudación y volumen de cobro por personal de caja en el periodo.</p>
                </div>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {cajeros.length} Cajero{cajeros.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="table-scroll">
                <table className="w-full text-left min-w-[750px]">
                  <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Cajero / Usuario</th>
                      <th className="px-6 py-4 text-center">Tickets Cobrados</th>
                      <th className="px-6 py-4 text-right">Ticket Prom.</th>
                      <th className="px-6 py-4 text-right">Efectivo</th>
                      <th className="px-6 py-4 text-right">Tarjeta POS</th>
                      <th className="px-6 py-4 text-right">Yape / Plin</th>
                      <th className="px-6 py-4 text-right">Total Cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {cajeros.map((c, i) => (
                      <tr key={i} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-900 text-purple-200 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                              {(c.nombre || 'C')[0].toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 uppercase text-xs">{c.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-black">
                            {c.cantidadTickets}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          S/ {c.ticketPromedio.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-700">
                          S/ {c.efectivo.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-blue-700">
                          S/ {c.tarjeta.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-purple-700">
                          S/ {c.yape.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900">
                          S/ {c.totalVentas.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HISTORIAL Y AUDITORÍA DE COMPROBANTES EMITIDOS */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-500" /> Registro de Comprobantes Emitidos (RCE)
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Listado oficial de comprobantes emitidos en el periodo.</p>
              </div>
              {(() => {
                const ventasComerciales = ventas;
                return (
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {ventasComerciales.length} Comprobante{ventasComerciales.length !== 1 ? 's' : ''}
                  </span>
                );
              })()}
            </div>
            <div className="table-scroll">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">ID / Hora</th>
                    <th className="px-6 py-4">Comprobante / Cliente</th>
                    <th className="px-6 py-4">Mesa / Delivery</th>
                    <th className="px-6 py-4">Cajero</th>
                    <th className="px-6 py-4">Método de Pago</th>
                    <th className="px-6 py-4">Detalle Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                  {(() => {
                    const filtradas = ventas;
                    return filtradas.length > 0 ? filtradas.map(v => (
                      <tr key={v.id} className={`hover:bg-slate-50/80 transition-colors ${v.anulado ? 'bg-red-50/60' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-black text-slate-900">#VT-{v.id}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{v.hora}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-xs">
                                {v.tipoComprobante} {v.serie ? `${v.serie}-${String(v.numero).padStart(4, '0')}` : `#${v.id}`}
                              </span>
                              {v.anulado && (
                                <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span> 🚫 DEVUELTO
                                </span>
                              )}
                            </div>
                            {v.anulado && v.motivoAnulacion && (
                              <span className="text-[9px] text-red-600 font-medium block leading-none mt-1">
                                Motivo: {v.motivoAnulacion} ({v.anuladoPor || 'Admin'})
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 uppercase tracking-tight font-medium mt-0.5">
                              {(() => {
                                if (v.codigoPedidosYa?.startsWith('DELIVERY -')) {
                                  const parsed = parseDeliveryInfo(v.codigoPedidosYa);
                                  return parsed ? parsed.nombre : v.nombreCliente;
                                }
                                if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
                                  const parsed = parseDeliveryInfo(v.nombreCliente);
                                  return parsed ? parsed.nombre : v.nombreCliente.replace('DELIVERY - ', '');
                                }
                                return v.nombreCliente || 'Consumidor Final';
                              })()}
                            </span>
                            {(() => {
                              const parsed = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
                              if (!parsed) return null;
                              return (
                                <span className="text-[9px] text-slate-400 font-mono mt-0.5 block leading-none">
                                  📞 {parsed.telefono} · 📍 {parsed.direccion.substring(0, 20)}{parsed.direccion.length > 20 ? '...' : ''}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {v.codigoPedidosYa ? (
                            v.codigoPedidosYa.startsWith('DELIVERY -') ? (
                              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                                🛵 DEL: {(() => {
                                  const parsed = parseDeliveryInfo(v.codigoPedidosYa);
                                  const name = parsed ? parsed.nombre : v.codigoPedidosYa.replace('DELIVERY - ', '');
                                  const first = name.split(/\s+/)[0] || '';
                                  return first.substring(0, 10);
                                })()}
                              </span>
                            ) : v.codigoPedidosYa.startsWith('LLEVAR -') ? (
                              <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                                🛍️ LLEVAR: {(() => {
                                  const name = v.codigoPedidosYa.replace('LLEVAR - ', '');
                                  const first = name.split(/\s+/)[0] || '';
                                  return first.substring(0, 10);
                                })()}
                              </span>
                            ) : (
                              <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md font-mono whitespace-nowrap">
                                🛵 PY: {v.codigoPedidosYa}
                              </span>
                            )
                          ) : (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                              🍽️ Mesa {v.mesaNum || 'S/M'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-700 text-xs uppercase whitespace-nowrap">
                            {v.cajeroNombre || 'Cajero Principal'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {v.anulado ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-100 border border-red-200 text-red-700 whitespace-nowrap">
                              🚫 CANCELADO
                            </span>
                          ) : (() => {
                            let method = v.metodoPago;
                            if (method === 'PedidosYa' && v.codigoPedidosYa) {
                              if (v.codigoPedidosYa.startsWith('DELIVERY -') || v.codigoPedidosYa.startsWith('LLEVAR -')) {
                                method = 'Efectivo';
                              }
                            }
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                method === 'Efectivo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                method === 'Tarjeta' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                method === 'Yape' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                method === 'Cortesía' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                method === 'Consumo' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                'bg-indigo-50 border-indigo-200 text-indigo-700'
                              }`}>{method}</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs font-bold text-slate-500 uppercase" title={v.itemsResumen}>
                          {v.itemsResumen}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-base">
                          {v.anulado ? (
                            <div className="flex flex-col items-end leading-none">
                              <span className="text-red-600 font-black">S/ 0.00</span>
                              {v.montoOriginal != null && (
                                <span className="line-through text-slate-400 font-bold text-xs mt-1">
                                  S/ {v.montoOriginal.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            `S/ ${(v.total ?? 0).toFixed(2)}`
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {v.anulado ? (
                              <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase border border-red-200 flex items-center justify-center gap-1">
                                🚫 VENTA DEVUELTA (S/ 0.00)
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => reimprimirComprobante(v)}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                  title="Reimprimir Comprobante Susii 80mm"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Reimprimir
                                </button>
                                <button
                                  onClick={() => enviarPorWhatsApp(v)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                  title="Enviar Comprobante por WhatsApp"
                                >
                                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.161.001 6.136 1.23 8.375 3.466 2.238 2.237 3.467 5.21 3.466 8.373-.003 6.535-5.328 11.86-11.859 11.86-2.007-.001-3.98-.51-5.753-1.48L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.269 0 9.557-4.287 9.559-9.556.001-2.553-.99-4.955-2.792-6.758-1.802-1.802-4.199-2.793-6.753-2.794-5.27 0-9.559 4.287-9.56 9.559-.001 1.625.434 3.208 1.262 4.622L1.51 21.054l4.137-1.9zm12.135-6.843c-.268-.134-1.583-.78-1.828-.87-.247-.09-.427-.134-.607.134-.18.267-.697.87-.852 1.047-.156.178-.311.201-.579.067-.268-.134-1.132-.418-2.156-1.332-.796-.71-1.335-1.586-1.492-1.853-.156-.268-.017-.413.117-.547.12-.12.268-.312.401-.468.134-.156.179-.268.268-.446.09-.178.045-.335-.022-.469-.067-.134-.607-1.462-.832-2.002-.22-.53-.442-.457-.607-.466-.156-.008-.337-.008-.518-.008-.18 0-.473.067-.72.337-.247.268-.943.922-.943 2.248s.965 2.604 1.1 2.784c.134.18 1.9 2.901 4.6 4.068.643.277 1.143.443 1.534.568.646.205 1.233.176 1.697.107.518-.077 1.583-.647 1.807-1.272.223-.624.223-1.159.156-1.272-.069-.112-.249-.18-.517-.313z" />
                                  </svg> WhatsApp
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se encontraron comprobantes emitidos en este rango de fechas.
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 2. RENDIMIENTO DE LA CARTA Y RANKING DE PLATOS */}
      {activeTab === 'rotacion' && (() => {
        const totalPlatosVendidos = rotacion.reduce((sum, item) => sum + (item.cantidad || 0), 0);
        const totalFacturacionCarta = rotacion.reduce((sum, item) => sum + (item.total || 0), 0);
        const platoEstrella = rotacion.length > 0 ? rotacion[0] : null;
        const platoMayorIngreso = rotacion.length > 0 ? [...rotacion].sort((a, b) => (b.total || 0) - (a.total || 0))[0] : null;

        // Agrupación por categoría gastronómica
        const catMap = {};
        rotacion.forEach(item => {
          const cat = item.categoria || 'Sin Categoría';
          if (!catMap[cat]) {
            catMap[cat] = { categoria: cat, cantidad: 0, total: 0 };
          }
          catMap[cat].cantidad += item.cantidad || 0;
          catMap[cat].total += item.total || 0;
        });
        const categoriasRanking = Object.values(catMap).sort((a, b) => b.total - a.total);
        const categoriasDisponibles = ['Todos', ...categoriasRanking.map(c => c.categoria)];

        // Top 5 Platos Estrella
        const top5 = rotacion.slice(0, 5);

        // Filtro interactivo de la tabla
        const rotacionFiltrada = rotacion.filter(item => {
          const matchCat = rotacionCatFiltro === 'Todos' || item.categoria === rotacionCatFiltro;
          const matchNom = !rotacionBusqueda.trim() ||
            item.nombre.toLowerCase().includes(rotacionBusqueda.toLowerCase()) ||
            (item.categoria && item.categoria.toLowerCase().includes(rotacionBusqueda.toLowerCase()));
          return matchCat && matchNom;
        });

        return (
          <div className="space-y-6 mb-8">
            {/* KPI CARDS DE LA CARTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Plato Estrella */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 text-white shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-100">🏆 Plato Más Vendido</span>
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black leading-snug line-clamp-1" title={platoEstrella?.nombre || 'Sin ventas'}>
                    {platoEstrella ? platoEstrella.nombre : 'Sin ventas'}
                  </h3>
                  <p className="text-2xl font-mono font-black mt-1">
                    {platoEstrella ? `${platoEstrella.cantidad} raciones` : '0'}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-xs text-amber-100 font-bold">
                  <span>Recaudación</span>
                  <span className="font-mono">S/ {platoEstrella ? platoEstrella.total.toFixed(2) : '0.00'}</span>
                </div>
              </div>

              {/* Mayor Facturación */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">💰 Mayor Ingreso</span>
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-snug line-clamp-1" title={platoMayorIngreso?.nombre || 'Sin ventas'}>
                    {platoMayorIngreso ? platoMayorIngreso.nombre : 'Sin ventas'}
                  </h3>
                  <p className="text-2xl font-mono font-black text-emerald-600 mt-1">
                    S/ {platoMayorIngreso ? platoMayorIngreso.total.toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-bold">
                  <span>Volumen</span>
                  <span className="font-mono text-slate-700">{platoMayorIngreso ? `${platoMayorIngreso.cantidad} unid.` : '0'}</span>
                </div>
              </div>

              {/* Total Raciones Vendidas */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">🍽️ Raciones / Platos</span>
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-mono font-black text-slate-900">{totalPlatosVendidos}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Total de platos servidos en el periodo.</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-bold">
                  <span>Variedad servida</span>
                  <span className="font-mono text-blue-600">{rotacion.length} platos distintos</span>
                </div>
              </div>

              {/* Recaudación Total Carta */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">📈 Total Recaudado Carta</span>
                  <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-mono font-black text-slate-900">S/ {totalFacturacionCarta.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Facturación total generada por cocina y barra.</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-bold">
                  <span>Categorías activas</span>
                  <span className="font-mono text-purple-600">{categoriasRanking.length} áreas</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: PARTICIPACIÓN POR CATEGORÍA DE RESTAURANTE */}
            {categoriasRanking.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-amber-500" />
                      Participación y Recaudación por Categoría Gastronómica
                    </h3>
                    <p className="text-[10px] text-slate-400">Distribución porcentual de los ingresos del restaurante.</p>
                  </div>
                  <span className="text-xs font-black font-mono text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                    100% = S/ {totalFacturacionCarta.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoriasRanking.map((catItem, cIdx) => {
                    const pct = totalFacturacionCarta > 0 ? ((catItem.total / totalFacturacionCarta) * 100) : 0;
                    return (
                      <div key={cIdx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-800 truncate" title={catItem.categoria}>
                            {catItem.categoria}
                          </span>
                          <span className="text-xs font-black font-mono text-slate-900">
                            S/ {catItem.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>{catItem.cantidad} unid. vendidas</span>
                          <span className="font-bold text-amber-700">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN 2: PODIO TOP 5 PLATOS ESTRELLA */}
            {top5.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Top 5 Platos Más Pedidos por los Comensales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {top5.map((item, idx) => {
                    const medals = ['🥇 #1', '🥈 #2', '🥉 #3', '🏅 #4', '🏅 #5'];
                    const borders = [
                      'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300',
                      'border-slate-300 bg-slate-50/60',
                      'border-amber-700/30 bg-orange-50/30',
                      'border-slate-200 bg-white',
                      'border-slate-200 bg-white'
                    ];
                    const pct = totalPlatosVendidos > 0 ? ((item.cantidad / totalPlatosVendidos) * 100) : 0;
                    return (
                      <div key={idx} className={`p-4 rounded-2xl border ${borders[idx]} flex flex-col justify-between shadow-2xs`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-800">{medals[idx]}</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <h4 className="font-black text-xs text-slate-900 line-clamp-2 mb-1" title={item.nombre}>
                            {item.nombre}
                          </h4>
                          <span className="text-[10px] text-slate-400 uppercase font-medium">{item.categoria}</span>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
                          <span className="text-xs font-bold text-slate-600 font-mono">{item.cantidad} platos</span>
                          <span className="text-xs font-black text-emerald-600 font-mono">S/ {item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN 3: TABLA COMPLETA DE ROTACIÓN CON FILTROS EN VIVO */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Detalle Completo de Rotación de la Carta
                  </h3>
                  <p className="text-[10px] text-slate-400">Platos ordenados por mayor volumen de venta.</p>
                </div>
                {/* Buscador */}
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rotacionBusqueda}
                    onChange={e => setRotacionBusqueda(e.target.value)}
                    placeholder="Buscar plato o categoría..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500"
                  />
                  {rotacionBusqueda && (
                    <button onClick={() => setRotacionBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
                  )}
                </div>
              </div>

              {/* Chips de filtro por Categoría */}
              <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex gap-1.5 overflow-x-auto custom-scrollbar">
                {categoriasDisponibles.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRotacionCatFiltro(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      rotacionCatFiltro === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tabla */}
              <div className="table-scroll">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50/60 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">#</th>
                      <th className="px-4 py-3">Plato / Ración</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3 text-center">Unidades</th>
                      <th className="px-4 py-3 text-right">Precio Prom.</th>
                      <th className="px-4 py-3 text-right">Total Facturado</th>
                      <th className="px-4 py-3 text-center w-28">% Carta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs bg-white font-medium text-slate-700">
                    {rotacionFiltrada.length > 0 ? (
                      rotacionFiltrada.map((r, i) => {
                        const pct = totalFacturacionCarta > 0 ? ((r.total / totalFacturacionCarta) * 100) : 0;
                        const precioProm = r.cantidad > 0 ? (r.total / r.cantidad) : r.precio;
                        return (
                          <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-4 py-3 text-center font-bold font-mono text-slate-400">
                              {i + 1}
                            </td>
                            <td className="px-4 py-3 font-black text-slate-900">
                              {r.nombre}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase bg-slate-100 text-slate-600">
                                {r.categoria || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold font-mono text-slate-800">
                              <span className="bg-slate-100 px-2.5 py-0.5 rounded-full">
                                {r.cantidad}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              S/ {precioProm.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-black font-mono text-emerald-600">
                              S/ {r.total.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs font-bold text-slate-600">
                              <div className="flex items-center justify-center gap-1.5">
                                <span>{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-10 text-center text-slate-400 font-normal">
                          No se encontraron platos que coincidan con los filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. CONTROL PEDIDOSYA */}
      {activeTab === 'pedidosya' && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
          <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" /> Control de Ventas de PedidosYa
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Listado detallado para conciliar la liquidación semanal del portal PedidosYa.</p>
            </div>
            {(() => {
              const totalPY = ventas
                .filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'))
                .reduce((s, v) => s + v.total, 0);
              return (
                <span className="bg-indigo-100 text-indigo-900 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total PedidosYa: S/ {totalPY.toFixed(2)}
                </span>
              );
            })()}
          </div>
          <div className="table-scroll">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">ID Venta</th>
                  <th className="px-6 py-4">Fecha / Hora</th>
                  <th className="px-6 py-4">Código PedidosYa</th>
                  <th className="px-6 py-4">Detalle items</th>
                  <th className="px-6 py-4 text-right">Total (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                {(() => {
                  const itemsPY = ventas.filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'));
                  return itemsPY.length > 0 ? itemsPY.map(v => (
                    <tr key={v.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{v.id}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono">{v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}</span> · <span className="text-slate-400 font-mono text-xs">{v.hora}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-xl text-xs font-black font-mono">
                          {v.codigoPedidosYa || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={v.itemsResumen}>{v.itemsResumen}</td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-950">S/ {v.total.toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                        No se registraron ventas de PedidosYa en este periodo.
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CONSUMO DE PERSONAL (PLANILLA) */}
      {activeTab === 'consumo' && (() => {
        const clienteMap = new Map(clientes.map(c => [c.id, c]));

        const listadoPlanilla = [];
        const listadoComercial = [];

        ventas.forEach(v => {
          if (v.anulado || v.estadoPedido === 'Cancelado') return;

          if (v.metodoPago === 'Consumo') {
            listadoPlanilla.push({
              id: v.id,
              fecha: v.fecha,
              createdAt: v.createdAt,
              hora: v.hora,
              nombre: v.nombreCliente || v.mesero || 'Consumo Personal',
              documento: '',
              itemsResumen: v.itemsResumen,
              monto: v.descuentoAplicado || v.total,
              rawVenta: v
            });
          } else {
            const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
            if (splits.length > 0) {
              splits.forEach(s => {
                const cli = clienteMap.get(s.clienteId);
                const esTrab = cli?.esTrabajador || false;
                const nombre = cli?.nombre || s.nombre || v.nombreCliente || 'Cliente Crédito';
                const doc = cli?.numDoc || cli?.documento || '';
                const item = {
                  id: v.id,
                  fecha: v.fecha,
                  createdAt: v.createdAt,
                  hora: v.hora,
                  nombre,
                  documento: doc,
                  itemsResumen: v.itemsResumen,
                  monto: s.monto,
                  rawVenta: v
                };
                if (esTrab) listadoPlanilla.push(item);
                else listadoComercial.push(item);
              });
            } else if (v.metodoPago === 'Crédito') {
              listadoComercial.push({
                id: v.id,
                fecha: v.fecha,
                createdAt: v.createdAt,
                hora: v.hora,
                nombre: v.nombreCliente || 'Cliente Comercial',
                documento: '',
                itemsResumen: v.itemsResumen,
                monto: v.total,
                rawVenta: v
              });
            }
          }
        });

        // Acumulados
        const planillaPorColaborador = {};
        listadoPlanilla.forEach(item => {
          planillaPorColaborador[item.nombre] = (planillaPorColaborador[item.nombre] || 0) + item.monto;
        });

        const clientesPorComercial = {};
        listadoComercial.forEach(item => {
          const key = item.documento ? `${item.nombre} (${item.documento})` : item.nombre;
          clientesPorComercial[key] = (clientesPorComercial[key] || 0) + item.monto;
        });

        const totalPlanilla = listadoPlanilla.reduce((sum, item) => sum + item.monto, 0);
        const totalComercial = listadoComercial.reduce((sum, item) => sum + item.monto, 0);

        return (
          <div className="space-y-8">
            {/* Sección 1: Resumen de Acumulados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarjeta Planilla */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-violet-750 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-600" /> Acumulado para Planilla (Interno)
                  </h3>
                  <span className="bg-violet-100 text-violet-850 text-[10px] font-black px-2.5 py-1 rounded-full">
                    S/ {totalPlanilla.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {Object.entries(planillaPorColaborador).length > 0 ? (
                    Object.entries(planillaPorColaborador).map(([nombre, total]) => (
                      <div key={nombre} className="bg-violet-50/40 border border-violet-100/50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] text-slate-450 font-black uppercase truncate" title={nombre}>{nombre}</p>
                        <p className="text-sm font-black text-violet-700 font-mono mt-0.5">S/ {total.toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center py-6 text-slate-400 text-xs font-bold uppercase">Sin consumos de planilla en este periodo.</p>
                  )}
                </div>
              </div>

              {/* Tarjeta Comercial */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-teal-750 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-650" /> Acumulado Créditos Comerciales
                  </h3>
                  <span className="bg-teal-100 text-teal-855 text-[10px] font-black px-2.5 py-1 rounded-full">
                    S/ {totalComercial.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {Object.entries(clientesPorComercial).length > 0 ? (
                    Object.entries(clientesPorComercial).map(([nombre, total]) => (
                      <div key={nombre} className="bg-teal-50/40 border border-teal-100/50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] text-slate-450 font-black uppercase truncate" title={nombre}>{nombre}</p>
                        <p className="text-sm font-black text-teal-750 font-mono mt-0.5">S/ {total.toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center py-6 text-slate-400 text-xs font-bold uppercase">Sin créditos comerciales en este periodo.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Listado A: Crédito Clientes (Comerciales) */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-650" /> Cuentas por Cobrar · Crédito Clientes
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ventas financiadas a clientes de confianza con cuenta corriente comercial.</p>
                </div>
                <span className="bg-teal-100 text-teal-850 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total Clientes: S/ {totalComercial.toFixed(2)}
                </span>
              </div>
              <div className="table-scroll">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Cliente Comercial</th>
                      <th className="px-6 py-4">Detalle Items</th>
                      <th className="px-6 py-4 text-right">Monto Crédito</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {listadoComercial.length > 0 ? listadoComercial.map((item, idx) => {
                      return (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-teal-50/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{item.id}</td>
                          <td className="px-6 py-4 font-mono">
                            {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} · <span className="text-slate-400 text-xs">{item.hora}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-900 font-bold uppercase">{item.nombre}</span>
                            {item.documento && <span className="ml-2 bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">{item.documento}</span>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={item.itemsResumen}>{item.itemsResumen}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-teal-700">S/ {item.monto.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => reimprimirComprobante(item.rawVenta)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-teal-650 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 mx-auto"
                            >
                              <Printer className="w-3 h-3" /> Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se registraron ventas a crédito comercial en este periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Listado B: Consumo de Planilla / Personal */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-650" /> Descuentos Planilla · Consumo de Personal
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Historial completo de consumos registrados por colaboradores internos.</p>
                </div>
                <span className="bg-violet-100 text-violet-850 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total Planilla: S/ {totalPlanilla.toFixed(2)}
                </span>
              </div>
              <div className="table-scroll">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Colaborador / Personal</th>
                      <th className="px-6 py-4">Detalle Items</th>
                      <th className="px-6 py-4 text-right">Monto Descuento</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {listadoPlanilla.length > 0 ? listadoPlanilla.map((item, idx) => {
                      return (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-violet-50/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{item.id}</td>
                          <td className="px-6 py-4 font-mono">
                            {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} · <span className="text-slate-400 text-xs">{item.hora}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-900 font-bold uppercase">{item.nombre}</span>
                            <span className="ml-2 bg-violet-100 text-violet-800 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Planilla</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={item.itemsResumen}>{item.itemsResumen}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-violet-700">S/ {item.monto.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => reimprimirComprobante(item.rawVenta)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 mx-auto"
                            >
                              <Printer className="w-3 h-3" /> Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se registraron consumos de personal en este periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. RENDIMIENTO MOZOS Y CANCELACIONES */}
      {activeTab === 'mozos' && (
        <div className="space-y-8">
          {/* RENDIMIENTO POR MOZOS */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" /> Rendimiento de Mozos en el Periodo
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{mozos.length} mozo{mozos.length !== 1 ? 's' : ''} con comanda</span>
            </div>
            <div className="table-scroll">
              <table className="w-full text-left min-w-[400px]">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Mozo / Mesero</th>
                    <th className="px-6 py-4 text-center">Mesas Activas Ahora</th>
                    <th className="px-6 py-4 text-center">Mesas Atendidas y Cobradas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                  {mozos.length > 0 ? mozos.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 text-amber-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0">{m.nombre[0]}</div>
                          <span className="font-bold text-slate-800">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${m.mesasActivas > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                          {m.mesasActivas} mesa{m.mesasActivas !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                          {m.mesasAtendidas} atendida{m.mesasAtendidas !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">Sin actividad de mozos en este rango de fechas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. AUDITORÍA INTEGRAL DE ANULACIONES Y DEVOLUCIONES */}
      {activeTab === 'anulaciones' && (() => {
        const cancelacionesFiltradas = cancelaciones.filter(c => {
          if (filtroTipoAnulacion === 'Todos') return true;
          return (c.tipo || 'Comanda Cancelada') === filtroTipoAnulacion;
        });

        const totalPerdida = cancelacionesFiltradas.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const devolucionesList = cancelaciones.filter(c => c.tipo === 'Devolución en Caja');
        const montoDevoluciones = devolucionesList.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const comandasList = cancelaciones.filter(c => c.tipo !== 'Devolución en Caja');
        const montoComandas = comandasList.reduce((s, c) => s + (Number(c.total) || 0), 0);

        return (
          <div className="space-y-6">
            {/* KPI CARDS ANULACIONES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-rose-600">
                    <XCircle className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Total Incidencias</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-slate-900">{cancelacionesFiltradas.length}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Registros de cancelaciones y devoluciones</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-red-600">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Monto Impactado</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-red-600">S/ {totalPerdida.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Total en el filtro seleccionado</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-purple-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-purple-600">
                    <Receipt className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Devoluciones en Caja</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-purple-900">{devolucionesList.length}</p>
                </div>
                <div className="flex justify-between text-xs text-purple-700 font-bold border-t border-purple-50 pt-2 mt-2">
                  <span>Reembolsos</span>
                  <span className="font-mono font-black">S/ {montoDevoluciones.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-amber-600">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Comandas Salón</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-amber-900">{comandasList.length}</p>
                </div>
                <div className="flex justify-between text-xs text-amber-700 font-bold border-t border-amber-50 pt-2 mt-2">
                  <span>Pre-pago anuladas</span>
                  <span className="font-mono font-black">S/ {montoComandas.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* TABLA AUDITORÍA CON FILTRO */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-500" /> Registro Detallado de Anulaciones y Devoluciones
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Auditoría con motivo, autorizante e impacto económico.</p>
                </div>

                {/* Filtro por tipo */}
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl shrink-0">
                  {[
                    { id: 'Todos', label: 'Todos', count: cancelaciones.length },
                    { id: 'Devolución en Caja', label: 'Devoluciones', count: devolucionesList.length },
                    { id: 'Comanda Cancelada', label: 'Comandas', count: comandasList.length },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroTipoAnulacion(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        filtroTipoAnulacion === f.id
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {f.label}
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                        filtroTipoAnulacion === f.id ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-scroll">
                <table className="w-full text-left min-w-[850px]">
                  <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4">Tipo / Identificador</th>
                      <th className="px-5 py-4">Fecha / Hora</th>
                      <th className="px-5 py-4">Mesa / Origen</th>
                      <th className="px-5 py-4">Responsable</th>
                      <th className="px-5 py-4">Motivo / Justificación</th>
                      <th className="px-5 py-4">Detalle Consumo</th>
                      <th className="px-5 py-4 text-right">Importe (S/)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {cancelacionesFiltradas.length > 0 ? cancelacionesFiltradas.map((c, i) => {
                      const isDevolucion = c.tipo === 'Devolución en Caja';
                      return (
                        <tr key={i} className={`transition-colors ${isDevolucion ? 'hover:bg-purple-50/20' : 'hover:bg-amber-50/20'}`}>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider w-max ${
                                isDevolucion
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {isDevolucion ? <Receipt className="w-3 h-3 text-purple-600" /> : <AlertTriangle className="w-3 h-3 text-amber-600" />}
                                {c.tipo || 'Comanda Cancelada'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-1">
                                {isDevolucion && c.ventaId ? `Ticket #${c.ventaId}` : `Ref #${c.id}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-slate-800 text-xs">{c.fecha || 'Hoy'}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{c.hora}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {c.mesa
                              ? <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-black">Mesa {c.mesa}</span>
                              : <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 w-max"><Truck className="w-3.5 h-3.5" />{c.codigoPedidosYa || 'Delivery'}</span>
                            }
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-slate-800 uppercase text-xs font-bold">{c.canceladoPor || 'No registrado'}</span>
                          </td>
                          <td className="px-5 py-4 max-w-[220px]">
                            <p className="text-slate-600 text-xs italic bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2" title={c.motivoCancela}>
                              "{c.motivoCancela || 'Sin motivo especificado'}"
                            </p>
                          </td>
                          <td className="px-5 py-4 text-slate-500 text-xs max-w-[240px] truncate" title={c.resumenItems}>
                            {c.resumenItems || '-'}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-black text-rose-600">
                            - S/ {(Number(c.total) || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No hay registros de {filtroTipoAnulacion.toLowerCase()} en este rango de fechas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {cancelacionesFiltradas.length > 0 && (
                <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Mostrando {cancelacionesFiltradas.length} de {cancelaciones.length} eventos
                  </span>
                  <span className="font-black text-slate-900 text-sm">
                    Pérdida / Devolución Filtrada: <span className="font-mono text-xl ml-2 text-rose-600">- S/ {totalPerdida.toFixed(2)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 6. CONTROL Y AUDITORÍA DE CIERRES DE CAJA (ARQUEOS) */}
      {activeTab === 'cierres' && (() => {
        const cierresFiltrados = cierresHistorial.filter(c => {
          if (!c.fechaCierre) return true;
          const fStr = new Date(c.fechaCierre).toISOString().slice(0, 10);
          return fStr >= fechaDesde && fStr <= fechaHasta;
        });

        const totalEsperado = cierresFiltrados.reduce((s, c) => s + (Number(c.efectivoEsperado) || 0), 0);
        const totalContado = cierresFiltrados.reduce((s, c) => s + (Number(c.efectivoContado) || 0), 0);
        const totalDif = cierresFiltrados.reduce((s, c) => s + (Number(c.diferencia) || 0), 0);
        const totalElec = cierresFiltrados.reduce((s, c) => s + (Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)), 0);

        return (
          <div className="space-y-6">
            {/* KPI Cards Cierres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-purple-600">
                    <History className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Turnos Cerrados</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-slate-900">{cierresFiltrados.length}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Arqueos archivados en PostgreSQL</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-emerald-600">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Efec. Esperado Total</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-slate-900">S/ {totalEsperado.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Ventas + abonos - egresos efec.</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-blue-600">
                    <Wallet className="w-5 h-5" />
                    <span className="text-xs font-black uppercase text-slate-500">Tarjetas & Yape</span>
                  </div>
                  <p className="text-2xl font-black font-mono text-slate-900">S/ {totalElec.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Cobros electrónicos acumulados</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-slate-600">
                    <span className="text-xs font-black uppercase text-slate-500">Diferencia Acumulada</span>
                  </div>
                  <p className={`text-2xl font-black font-mono ${totalDif < -0.01 ? 'text-rose-600' : (totalDif > 0.01 ? 'text-blue-600' : 'text-emerald-600')}`}>
                    {totalDif > 0.01 ? `+S/ ${totalDif.toFixed(2)}` : `S/ ${totalDif.toFixed(2)}`}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Balance neto físico vs calculado</p>
              </div>
            </div>

            {/* Listado de Arqueos */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-600" /> Historial de Turnos y Arqueos de Caja
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Reporte auditable de gaveta y desgloses por cajero.</p>
                </div>
                <span className="bg-purple-100 text-purple-800 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                  {cierresFiltrados.length} Registros
                </span>
              </div>

              <div className="table-scroll">
                <table className="w-full text-left min-w-[750px]">
                  <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4">ID / Fecha Cierre</th>
                      <th className="px-5 py-4">Cajero</th>
                      <th className="px-5 py-4 text-right">Efec. Esperado</th>
                      <th className="px-5 py-4 text-right">Efec. Contado</th>
                      <th className="px-5 py-4 text-right">Diferencia</th>
                      <th className="px-5 py-4 text-right">Tarjeta / Yape</th>
                      <th className="px-5 py-4 text-right">Egresos</th>
                      <th className="px-5 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {cierresFiltrados.length > 0 ? (
                      cierresFiltrados.map((c) => {
                        const dif = Number(c.diferencia || 0);
                        const isExact = Math.abs(dif) < 0.01;
                        const isSobrante = dif > 0.01;
                        return (
                          <tr key={c.id} className="hover:bg-purple-50/20 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-xs">
                                  #{c.id} · {new Date(c.fechaCierre).toLocaleDateString('es-PE')}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(c.fechaCierre).toLocaleTimeString('es-PE')}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 uppercase text-xs text-slate-800 font-black">{c.cajeroNombre}</td>
                            <td className="px-5 py-4 text-right font-mono text-xs">S/ {Number(c.efectivoEsperado || 0).toFixed(2)}</td>
                            <td className="px-5 py-4 text-right font-mono text-xs text-slate-900">S/ {Number(c.efectivoContado || 0).toFixed(2)}</td>
                            <td className="px-5 py-4 text-right font-mono text-xs">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                isExact ? 'bg-emerald-100 text-emerald-700' : (isSobrante ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700')
                              }`}>
                                {isSobrante ? `+S/ ${dif.toFixed(2)}` : `S/ ${dif.toFixed(2)}`}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-xs text-slate-600">
                              S/ {(Number(c.totalTarjeta || 0) + Number(c.totalYape || 0)).toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-xs text-rose-600">
                              S/ {Number(c.egresosEfectivo || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => setCierreAImprimir(c)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-purple-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-all shadow-sm active:scale-95"
                              >
                                <Printer className="w-3 h-3 text-purple-300" /> Ticket
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No hay cierres de caja registrados en este rango de fechas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL REIMPRESIÓN TICKET DE CIERRE (REPORTES) */}
      {cierreAImprimir && (
        <div id="modal-cierre-reporte" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-purple-700">
                <Printer className="w-5 h-5 shrink-0" />
                <h3 className="font-black text-slate-900 text-base uppercase tracking-tight leading-none">Ticket de Cierre #{cierreAImprimir.id}</h3>
              </div>
              <button onClick={() => setCierreAImprimir(null)} className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vista del ticket térmico */}
            <div id="cierre-imprimible-reporte" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-5 flex flex-col">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4 flex flex-col items-center">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain mb-1 filter grayscale" />
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">{COMPANY_CONFIG.legalName}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{COMPANY_CONFIG.address} · RUC: {COMPANY_CONFIG.ruc}</p>
                <p className="text-[10px] text-purple-700 font-black mt-1 uppercase">COPIA DE CIERRE DE TURNO · #{cierreAImprimir.id}</p>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
                <div className="flex justify-between"><span>FECHA APERTURA:</span><span>{new Date(cierreAImprimir.fechaApertura).toLocaleString('es-PE')}</span></div>
                <div className="flex justify-between"><span>FECHA CIERRE:</span><span>{new Date(cierreAImprimir.fechaCierre).toLocaleString('es-PE')}</span></div>
                <div className="flex justify-between"><span>CAJERO:</span><span className="uppercase">{cierreAImprimir.cajeroNombre}</span></div>
                <div className="flex justify-between"><span>ESTADO:</span><span className="text-emerald-700 font-black">CERRADO</span></div>
              </div>

              <div className="space-y-2.5 mb-4 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>💵 EFECTIVO VENTAS:</span>
                  <span className="font-black text-slate-900">S/ {Number(cierreAImprimir.efectivoVentas || 0).toFixed(2)}</span>
                </div>
                {Number(cierreAImprimir.egresosEfectivo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>🔻 GASTOS EFECTIVO:</span>
                    <span className="font-black">- S/ {Number(cierreAImprimir.egresosEfectivo || 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(cierreAImprimir.abonosEfectivo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>➕ ABONOS EFECTIVO:</span>
                    <span className="font-black">+ S/ {Number(cierreAImprimir.abonosEfectivo || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 bg-amber-100/60 p-2 rounded-lg">
                  <span>EFECTIVO ESPERADO:</span>
                  <span>S/ {Number(cierreAImprimir.efectivoEsperado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>EFECTIVO CONTADO:</span>
                  <span className="font-black text-slate-900">S/ {Number(cierreAImprimir.efectivoContado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black">
                  <span>DIFERENCIA:</span>
                  <span className={Number(cierreAImprimir.diferencia || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    S/ {Number(cierreAImprimir.diferencia || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mb-3 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>💳 TARJETA:</span>
                  <span>S/ {Number(cierreAImprimir.totalTarjeta || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>📱 YAPE / PLIN:</span>
                  <span>S/ {Number(cierreAImprimir.totalYape || 0).toFixed(2)}</span>
                </div>
                {Number(cierreAImprimir.totalPedidosYa || 0) > 0 && (
                  <div className="flex justify-between font-bold text-rose-500">
                    <span>🛵 PEDIDOS YA:</span>
                    <span>S/ {Number(cierreAImprimir.totalPedidosYa || 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(cierreAImprimir.totalConsumo || 0) > 0 && (
                  <div className="flex justify-between font-bold text-purple-600">
                    <span>🍽️ CONSUMO / CRÉDITO:</span>
                    <span>S/ {Number(cierreAImprimir.totalConsumo || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {cierreAImprimir.nota && (
                <div className="text-[10px] text-slate-500 italic mb-3">
                  <strong>Nota:</strong> {cierreAImprimir.nota}
                </div>
              )}

              <div className="text-center text-[10px] text-slate-400 font-bold">
                *** Reimpresión de Arqueo de Turno ***
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCierreAImprimir(null)}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUNAT Comprobante Susii Style Modal */}
      {sunatModalOpen && activeComprobante && (
        <div id="modal-comprobante-sunat-print-container" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
            <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" /> {
                  activeComprobante.metodoPago === 'Consumo' ? '👤 CONSUMO PERSONAL 👤' :
                  activeComprobante.metodoPago === 'Cortesía' ? '🎁 TICKET DE CORTESÍA 🎁' :
                  'TICKET DE VENTA'
                }
              </h3>
              <button onClick={() => setSunatModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div id="comprobante-sunat-ticket-print" className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-mono text-xs leading-relaxed">
              <div className="text-center font-bold" style={{ fontSize: '14px', marginBottom: '2px' }}>{COMPANY_CONFIG.legalName}</div>
              <div className="text-center text-[10px] leading-tight mb-2">
                {COMPANY_CONFIG.address}<br />
                R.U.C. N° {COMPANY_CONFIG.ruc}
              </div>
              
              <div className="text-center font-bold mb-1" style={{ fontSize: '11px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? '👤 VALE DE CONSUMO PERSONAL' :
                activeComprobante.metodoPago === 'Cortesía' ? '🎁 CORTESÍA / CONSUMO INTERNO' :
                activeComprobante.tipo === 'Factura' ? 'FACTURA ELECTRÓNICA' :
                activeComprobante.tipo === 'Ticket' ? 'TICKET DE VENTA' : 'BOLETA ELECTRÓNICA'
              }</div>
              <div className="text-center font-bold mb-3" style={{ fontSize: '13px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? `CONS-00${activeComprobante.mesaNum || 'SM'}-${activeComprobante.correlativo}` :
                activeComprobante.metodoPago === 'Cortesía' ? `COR-00${activeComprobante.mesaNum || 'SM'}` :
                `N° ${activeComprobante.correlativo}`
              }</div>
              
              <div className="flex justify-between border-t border-b border-dashed border-slate-300 py-1.5 mb-2 font-bold">
                <span>{activeComprobante.fecha} {activeComprobante.hora}</span>
                <span>Mesa {activeComprobante.mesaNum}</span>
              </div>
              
              {(() => {
                const itemsImprimibles = (activeComprobante.items || []).filter(item => item && (item.precio > 0 || (item.categoria && BARRA_CATEGORIAS.includes(item.categoria)) || (item.notas && item.notas.includes('CORTESÍA')) || (item.nombre && item.nombre.includes('CORTESÍA'))));

                return (
                  <>
                    <div className="space-y-1 mb-3">
                      <div><strong>Cliente:</strong> <span className="uppercase">{activeComprobante.clienteNombre}</span></div>
                      {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                        <div><strong>{activeComprobante.tipo === 'Factura' ? 'RUC' : 'DNI'}:</strong> <span>{activeComprobante.clienteDoc}</span></div>
                      )}
                      {activeComprobante.clienteDireccion && (
                        <div><strong>Dirección:</strong> <span className="uppercase text-[9px] leading-none block mt-0.5">{activeComprobante.clienteDireccion}</span></div>
                      )}
                      <div><strong>Items:</strong> <span>{itemsImprimibles.length}</span></div>
                    </div>

                    {/* Box de Datos de Despacho para Delivery */}
                    {activeComprobante.deliveryInfo && (
                      <div style={{ border: '1px dashed black', padding: '6px', margin: '8px 0', fontSize: '10px', lineHeight: '1.3' }} className="space-y-1 bg-slate-50 rounded-lg">
                        <div className="text-center font-bold uppercase mb-1" style={{ fontSize: '11px' }}>🛵 DATOS DE DESPACHO / DELIVERY 🛵</div>
                        <div><strong>DIRECCIÓN:</strong> <span className="uppercase font-bold">{activeComprobante.deliveryInfo.direccion}</span></div>
                        <div className="flex justify-between">
                          <div><strong>TELÉFONO:</strong> <span>{activeComprobante.deliveryInfo.telefono}</span></div>
                          <div><strong>ENVÍO:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.montoDelivery || 0).toFixed(2)}</span></div>
                        </div>
                        {activeComprobante.deliveryInfo.conCuanto && parseFloat(activeComprobante.deliveryInfo.conCuanto) > 0 && (
                          <div className="border-t border-slate-300 pt-1 mt-1 flex justify-between font-bold">
                            <div><strong>PAGA CON:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.conCuanto).toFixed(2)}</span></div>
                            <div><strong>VUELTO:</strong> <span className="text-emerald-700">S/ {parseFloat(activeComprobante.deliveryInfo.vuelto).toFixed(2)}</span></div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
                    
                    {/* Items Table Header */}
                    <div className="flex font-bold border-b border-dashed border-slate-350 pb-1 mb-1">
                      <span className="w-8 shrink-0">Cant</span>
                      <span className="flex-1 pl-1">DESCRIPCIÓN</span>
                      <span className="w-14 text-right shrink-0">P.Unit</span>
                      <span className="w-18 text-right shrink-0">TOTAL</span>
                    </div>
                    
                    {itemsImprimibles.map((item, idx) => {
                      const subTotalItem = item.cant * item.precio;
                      const cantStr = item.cant % 1 === 0 ? item.cant.toFixed(0) : item.cant.toFixed(2);
                      return (
                        <div key={idx} className="flex flex-col mb-1.5">
                          <div className="flex items-start">
                            <span className="w-8 shrink-0 font-bold">{cantStr}x</span>
                            <span className="flex-1 uppercase pl-1">{item.nombre}</span>
                            <span className="w-14 text-right shrink-0">{item.precio.toFixed(2)}</span>
                            <span className="w-18 text-right shrink-0">{subTotalItem.toFixed(2)}</span>
                          </div>
                          {item.notas && (
                            <div className="pl-8 text-[9px] text-slate-500 font-bold leading-tight uppercase text-left break-all">
                              {item.notas}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              <div className="space-y-1 text-right font-bold" style={{ fontSize: '11px' }}>
                {activeComprobante.descuentoAplicado > 0 && (
                  <>
                    <div className="flex justify-between text-slate-700">
                      <span>IMPORTE BRUTO</span> 
                      <span>S/ {(activeComprobante.total + activeComprobante.descuentoAplicado).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900">
                      <span>{activeComprobante.ofertaDescripcion ? activeComprobante.ofertaDescripcion.toUpperCase() : 'DESCUENTO'}</span> 
                      <span>- S/ {activeComprobante.descuentoAplicado.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between" style={{ fontSize: '12px', fontWeight: '900' }}><span>TOTAL</span> <span>S/ {activeComprobante.total.toFixed(2)}</span></div>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="mb-4">
                  <strong className="block text-[10px]">IMPORTE EN LETRAS:</strong>
                  <span className="uppercase text-[10px] leading-tight block">{activeComprobante.totalLetras}</span>
                </div>
              )}
              
              
              <div>
                <strong>FORMA DE PAGO:</strong> <span className="uppercase">{
                  activeComprobante.metodoPago === 'Consumo' ? 'DESCUENTO PLANILLA (PERSONAL)' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'CORTESÍA / CONSUMO INTERNO' :
                  activeComprobante.metodoPago === 'Mixto' ? 'PAGO MIXTO' :
                  activeComprobante.metodoPago === 'Efectivo' ? 'CONTADO' : 'CONTADO (' + activeComprobante.metodoPago + ')'
                }</span>
              </div>
              
              {activeComprobante.metodoPago === 'Mixto' && (
                <div className="mt-1.5 border-t border-dashed border-black pt-1.5 space-y-0.5 text-[10px]">
                  {activeComprobante.montoEfectivo > 0 && (
                    <div className="flex justify-between"><span>- EFECTIVO:</span> <span>S/ {activeComprobante.montoEfectivo.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoTarjeta > 0 && (
                    <div className="flex justify-between"><span>- TARJETA:</span> <span>S/ {activeComprobante.montoTarjeta.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoYape > 0 && (
                    <div className="flex justify-between"><span>- YAPE/PLIN:</span> <span>S/ {activeComprobante.montoYape.toFixed(2)}</span></div>
                  )}
                </div>
              )}
              
              {FACTURACION_ELECTRONICA && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' ? (
                <div className="flex justify-center my-5">
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                    style={{ width: '120px', height: '120px' }} 
                    className="border p-1 bg-white"
                  />
                </div>
              ) : (
                <div style={{ display: 'none' }}>
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                  />
                </div>
              )}

              {(activeComprobante.metodoPago === 'Consumo' || activeComprobante.metodoPago === 'Cortesía') && (
                <div className="mt-8 mb-4 border-t border-slate-400 pt-6 text-center">
                  <p className="border-t border-dashed border-slate-350 mx-auto w-3/4 mb-1"></p>
                  <p className="text-[10px] font-black uppercase tracking-wider">FIRMA COLABORADOR</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-medium">{activeComprobante.clienteNombre}</p>
                </div>
              )}
              
              <div className="text-center font-bold mt-4" style={{ fontSize: '10px' }}>¡Gracias por su preferencia!</div>
              <div className="text-center text-[9px] leading-tight text-slate-500 mt-1">
                {
                  activeComprobante.metodoPago === 'Consumo' ? 'VALE INTERNO AUTORIZADO DE COLABORADOR' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'TICKET DE CONSUMO INTERNO AUTORIZADO' :
                  'Documento interno de control. No es comprobante de pago: solicite su boleta o factura en caja.'
                }
              </div>

              {activeComprobante.enlacePdf && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="text-center text-[10px] mt-4 font-bold no-print pt-2 border-t border-slate-100">
                  <a href={activeComprobante.enlacePdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 flex items-center justify-center gap-1.5">
                    📄 Descargar Comprobante SUNAT (PDF)
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest rounded-xl text-xs flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20">
                <Receipt className="w-4 h-4" /> Imprimir 80mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reporte Gerencial */}
      {gerencialModalOpen && (
        <div id="modal-reporte-gerencial-container" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
            <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0 no-print">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" /> Reporte Gerencial Ejecutivo
              </h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
                  <Printer className="w-3.5 h-3.5" /> Imprimir / Guardar PDF
                </button>
                <button onClick={() => setGerencialModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Checkboxes para filtrar secciones del reporte */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3.5 no-print shrink-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incluir en el Reporte:</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirBalance}
                    onChange={e => setIncluirBalance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Balance / IGV
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirMozos}
                    onChange={e => setIncluirMozos(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Mozos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirRotacion}
                    onChange={e => setIncluirRotacion(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Rotación y Pollos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirGastos}
                    onChange={e => setIncluirGastos(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Compras y Gastos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirPedidosYa}
                    onChange={e => setIncluirPedidosYa(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  PedidosYa
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirPersonal}
                    onChange={e => setIncluirPersonal(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Personal (Planilla)
                </label>
              </div>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-sans">
              <div className="text-center border-b pb-6 mb-6">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{COMPANY_CONFIG.name}</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Reporte de Gestión Gerencial</p>
                <p className="text-xs text-slate-400 mt-2 font-mono">Periodo: {fechaDesde} al {fechaHasta}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Generado el: {new Date().toLocaleString('es-PE')}</p>
              </div>

              {incluirBalance && (
                <div className="mb-8">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    1. Balance y Resumen Gerencial Ejecutivo
                  </h2>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="border rounded-2xl p-4 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ventas</p>
                      <p className="text-xl font-black font-mono text-slate-800 mt-1 font-sans">S/ {resumen.ventasTotal.toFixed(2)}</p>
                      <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 font-bold">
                        <p>Base Imp.: S/ {resumen.ventasBase.toFixed(2)}</p>
                        <p className="font-semibold text-emerald-600">IGV (10.5%): S/ {resumen.ventasIGV.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Compras / Gastos</p>
                      <p className="text-xl font-black font-mono text-slate-800 mt-1 font-sans">S/ {resumen.comprasTotal.toFixed(2)}</p>
                      <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 font-bold">
                        <p>Base Imp.: S/ {resumen.comprasBase.toFixed(2)}</p>
                        <p className="font-semibold text-rose-600">IGV (10.5%): S/ {resumen.comprasIGV.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-slate-900 text-white">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IGV Neto a Liquidar</p>
                      <p className="text-xl font-black font-mono text-amber-400 mt-1 font-sans">S/ {resumen.igvAPagar.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-400 mt-2">Diferencia entre débito fiscal y crédito fiscal.</p>
                    </div>
                    <div className="border rounded-2xl p-4 bg-purple-500/10 border-purple-500/20 text-purple-950">
                      <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Plato Estrella de la Carta</p>
                      <p className="text-lg font-black text-purple-900 mt-1 truncate">
                        {rotacion.length > 0 ? rotacion[0].nombre : 'Sin ventas'}
                      </p>
                      <p className="text-[11px] font-bold text-purple-700 mt-1">
                        {rotacion.length > 0 ? `${rotacion[0].cantidad} platos vendidos · S/ ${rotacion[0].total.toFixed(2)}` : '0 platos'}
                      </p>
                      <p className="text-[9px] text-purple-600/80 mt-2 leading-tight">Plato con mayor volumen de rotación en el periodo.</p>
                    </div>
                  </div>
                </div>
              )}

              {incluirMozos && (
                <div className="mb-8">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    2. Rendimiento de Mozos (Mesas Atendidas)
                  </h2>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b">
                        <tr>
                          <th className="px-4 py-3">Nombre Mozo</th>
                          <th className="px-4 py-3 text-center">Mesas Activas</th>
                          <th className="px-4 py-3 text-center">Mesas Atendidas y Cobradas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700">
                        {mozos.length > 0 ? mozos.map((m, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-bold text-slate-800">{m.nombre}</td>
                            <td className="px-4 py-3 text-center">{m.mesasActivas}</td>
                            <td className="px-4 py-3 text-center text-emerald-600 font-bold">{m.mesasAtendidas}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="3" className="px-4 py-3 text-center text-slate-400">Sin registros en el periodo</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {incluirRotacion && (
                <div className="mb-8 break-inside-avoid-page">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    3. Rotación Detallada de Productos por Categoría
                  </h2>
                  <div className="space-y-6">
                    {(() => {
                      const grouped = {};
                      rotacion.forEach(r => {
                        const cat = r.categoria || 'Otros';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(r);
                      });

                      const categories = Object.keys(grouped).sort();
                      if (categories.length === 0) {
                        return <p className="text-xs text-slate-400 text-center py-4">Sin datos de rotación en el periodo.</p>;
                      }

                      return categories.map(cat => {
                        const items = grouped[cat].sort((a, b) => b.cantidad - a.cantidad);
                        const totalCatQty = items.reduce((sum, item) => sum + item.cantidad, 0);
                        const totalCatRev = items.reduce((sum, item) => sum + item.total, 0);

                        return (
                          <div key={cat} className="border rounded-2xl overflow-hidden bg-slate-50/20 break-inside-avoid mb-4">
                            <div className="bg-slate-100/80 px-4 py-2.5 border-b flex justify-between items-center">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{cat}</span>
                              <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase">
                                <span>Cant. Total: <strong className="text-slate-800">{totalCatQty}</strong></span>
                                <span>Total Ventas: <strong className="text-slate-800">S/ {totalCatRev.toFixed(2)}</strong></span>
                              </div>
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-455 text-[9px] font-black uppercase tracking-wider border-b">
                                <tr>
                                  <th className="px-4 py-2">Producto</th>
                                  <th className="px-4 py-2 text-center">Cantidad Vendida</th>
                                  <th className="px-4 py-2 text-right">Precio Prom.</th>
                                  <th className="px-4 py-2 text-right">Recaudación (S/)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y font-semibold text-slate-700 bg-white">
                                {items.map((r, idx) => {
                                  const precioProm = r.cantidad > 0 ? (r.total / r.cantidad) : r.precio;
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/20">
                                      <td className="px-4 py-2 text-slate-850 font-bold">{r.nombre}</td>
                                      <td className="px-4 py-2 text-center font-bold">{r.cantidad}</td>
                                      <td className="px-4 py-2 text-right font-mono text-slate-600">
                                        S/ {precioProm.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-2 text-right font-mono text-slate-900 font-bold">S/ {r.total.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {incluirGastos && (
                <div className="mb-8 break-inside-avoid">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                    4. Detalle de Compras y Gastos del Periodo
                  </h2>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider border-b">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Comprobante</th>
                          <th className="px-4 py-3">Proveedor / RUC</th>
                          <th className="px-4 py-3 text-right">Base Imp.</th>
                          <th className="px-4 py-3 text-right">IGV (10.5%)</th>
                          <th className="px-4 py-3 text-right">Total (S/)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700 bg-white">
                        {compras.length > 0 ? compras.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono text-[10px]">{c.creadoEn ? c.creadoEn.split('T')[0] : ''}</td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold">{c.tipoDocumento || 'Factura'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 uppercase text-[11px]">{c.proveedor}</span>
                                <span className="text-[9px] text-slate-450 font-mono">{c.ruc || 'S/D'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">S/ {c.baseImponible.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-600">S/ {c.igv.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">S/ {c.total.toFixed(2)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="6" className="px-4 py-4 text-center text-slate-400">Sin compras o gastos registrados en el periodo</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(incluirPedidosYa || incluirPersonal) && (
                <div className={`grid ${incluirPedidosYa && incluirPersonal ? 'grid-cols-2' : 'grid-cols-1'} gap-6 mt-8 break-inside-avoid`}>
                  {incluirPedidosYa && (
                    <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        5. Conciliación PedidosYa
                      </h2>
                      <div className="border rounded-2xl p-4 bg-indigo-50/20 flex flex-col justify-between h-[130px]">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Recaudado PedidosYa</p>
                          <p className="text-3xl font-black text-indigo-950 mt-2 font-mono">
                            S/ {(() => {
                              const totalPY = ventas
                                .filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'))
                                .reduce((s, v) => s + v.total, 0);
                              return totalPY.toFixed(2);
                            })()}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Monto consolidado para conciliar la liquidación semanal del portal PedidosYa.
                        </p>
                      </div>
                    </div>
                  )}

                  {incluirPersonal && (
                    <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
                        6. Consumo de Personal (Planilla)
                      </h2>
                      <div className="border rounded-2xl overflow-hidden max-h-[130px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider border-b sticky top-0">
                            <tr>
                              <th className="px-4 py-2">Colaborador</th>
                              <th className="px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-medium text-slate-700 bg-white">
                            {(() => {
                              const consumos = ventas.filter(v => v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía');
                              const porMozo = {};
                              consumos.forEach(v => {
                                const mName = v.mesero || v.nombreCliente || 'Sin Nombre';
                                porMozo[mName] = (porMozo[mName] || 0) + v.total;
                              });
                              const entries = Object.entries(porMozo);
                              return entries.length > 0 ? entries.map(([mozo, total]) => (
                                <tr key={mozo}>
                                  <td className="px-4 py-2 font-bold text-slate-850 truncate max-w-[120px]">{mozo}</td>
                                  <td className="px-4 py-2 text-right font-mono font-bold text-violet-700">S/ {total.toFixed(2)}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan="2" className="px-4 py-4 text-center text-slate-400">Sin consumos en el periodo</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-16 flex justify-around text-xs break-inside-avoid">
                <div className="text-center w-48">
                  <div className="border-b border-slate-300 h-10 mb-2"></div>
                  <p className="font-bold text-slate-700">Firma Administrador</p>
                </div>
                <div className="text-center w-48">
                  <div className="border-b border-slate-300 h-10 mb-2"></div>
                  <p className="font-bold text-slate-700">Firma Propietario</p>
                  <p className="text-[10px] text-slate-400">{COMPANY_CONFIG.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page {
          size: auto;
          margin: 15mm 20mm !important;
        }
        @media print {
          /* Ocultar elementos de navegación y fondos */
          aside, header, #sidebar-menu, #sidebar-backdrop, button, nav, .no-print {
            display: none !important;
          }
          /* Ocultar el resto del contenido de la página excepto el modal a imprimir */
          main > *:not(section),
          section > *:not(#modal-comprobante-sunat-print-container):not(#modal-reporte-gerencial-container):not(#modal-cierre):not(#modal-cierre-reporte) {
            display: none !important;
          }
           /* Garantizar que el body y todos los contenedores padre fluyan libremente sin alturas fijas */
          html, body, #root, #root > div, #root > div > main, #root > div > main > section {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: auto !important;
            display: block !important;
            position: static !important;
          }
          /* Formatear el contenedor del ticket en 74mm en la esquina superior izquierda */
          #modal-comprobante-sunat-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container div.bg-slate-950, 
          #modal-comprobante-sunat-print-container div.shrink-0 {
            display: none !important;
          }
          #comprobante-sunat-ticket-print {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print div,
          #comprobante-sunat-ticket-print blockquote {
            page-break-inside: avoid !important;
          }
          #modal-cierre-reporte {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre-reporte > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre-reporte button {
            display: none !important;
          }
          #cierre-imprimible-reporte {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible-reporte * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible-reporte div {
            page-break-inside: avoid !important;
          }
          #modal-reporte-gerencial-container {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          #modal-reporte-gerencial-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
          }
          #modal-reporte-gerencial-container .overflow-y-auto {
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-inside-avoid-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </section>
  );
}

