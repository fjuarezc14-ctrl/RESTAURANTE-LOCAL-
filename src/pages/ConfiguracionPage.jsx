import React, { useState, useEffect } from 'react';
import { Building2, Save, RotateCcw, CheckCircle2, AlertCircle, Phone, MapPin, Mail, FileText, Receipt, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';
import { useCompany } from '../context/CompanyContext';
import { TIPOS_NEGOCIO, DEFAULT_BARRA_CATEGORIAS } from '../config/company';

export default function ConfiguracionPage({ currentUser }) {
  const { empresa, reloadEmpresa } = useCompany();

  const [formData, setFormData] = useState({
    name: '',
    brandShort: '',
    tagline: '',
    legalName: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    ticketFooter: '',
    tipoNegocio: 'polleria',
    barraCategorias: DEFAULT_BARRA_CATEGORIAS,
  });

  const [barraInput, setBarraInput] = useState(DEFAULT_BARRA_CATEGORIAS.join(', '));
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  // Sincronizar estado local con la configuración de empresa
  useEffect(() => {
    if (empresa) {
      const cats = Array.isArray(empresa.barraCategorias) && empresa.barraCategorias.length > 0
        ? empresa.barraCategorias
        : DEFAULT_BARRA_CATEGORIAS;
      setFormData({
        name: empresa.name || '',
        brandShort: empresa.brandShort || '',
        tagline: empresa.tagline || '',
        legalName: empresa.legalName || '',
        ruc: empresa.ruc || '',
        address: empresa.address || '',
        phone: empresa.phone || '',
        email: empresa.email || '',
        ticketFooter: empresa.ticketFooter || '',
        tipoNegocio: empresa.tipoNegocio || 'polleria',
        barraCategorias: cats,
      });
      setBarraInput(cats.join(', '));
    }
  }, [empresa]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setMensajeExito('');
    setMensajeError('');
  };

  const handleReset = () => {
    if (empresa) {
      const cats = Array.isArray(empresa.barraCategorias) && empresa.barraCategorias.length > 0
        ? empresa.barraCategorias
        : DEFAULT_BARRA_CATEGORIAS;
      setFormData({
        name: empresa.name || '',
        brandShort: empresa.brandShort || '',
        tagline: empresa.tagline || '',
        legalName: empresa.legalName || '',
        ruc: empresa.ruc || '',
        address: empresa.address || '',
        phone: empresa.phone || '',
        email: empresa.email || '',
        ticketFooter: empresa.ticketFooter || '',
        tipoNegocio: empresa.tipoNegocio || 'polleria',
        barraCategorias: cats,
      });
      setBarraInput(cats.join(', '));
      setMensajeExito('');
      setMensajeError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensajeExito('');
    setMensajeError('');

    // Validar RUC
    const rucLimpio = formData.ruc.trim();
    if (!/^\d{11}$/.test(rucLimpio)) {
      setMensajeError('El RUC debe tener exactamente 11 dígitos numéricos.');
      return;
    }

    // Validar Razón Social y Nombre
    if (!formData.legalName.trim()) {
      setMensajeError('La Razón Social no puede estar vacía.');
      return;
    }

    if (!formData.name.trim()) {
      setMensajeError('El Nombre Comercial no puede estar vacío.');
      return;
    }

    setGuardando(true);
    try {
      const res = await api.updateEmpresa({
        ...formData,
        ruc: rucLimpio,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      await reloadEmpresa();
      setMensajeExito('¡Datos de la empresa actualizados exitosamente en todo el sistema!');
    } catch (err) {
      setMensajeError(err.message || 'Error al guardar la configuración');
    } finally {
      setGuardando(false);
    }
  };

  const isAdmin = currentUser?.rol === 'Administrador';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 w-full">
      <div className="max-w-6xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Configuración de la Empresa
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Gestiona el RUC, Razón Social, Dirección y membretes oficiales de impresión sin tocar código.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start md:self-auto border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {isAdmin ? 'Acceso Administrador' : 'Solo Lectura'}
        </div>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {mensajeError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{mensajeError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Edición */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-600" />
                Datos Tributarios y Fiscales
              </h2>
              <p className="text-xs text-slate-400">Datos con los que se emitirán las Boletas, Facturas y Reportes ante SUNAT.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Número de R.U.C. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="ruc"
                  value={formData.ruc}
                  onChange={handleChange}
                  maxLength={11}
                  disabled={!isAdmin || guardando}
                  placeholder="20601234567"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nombre Corto / Marca <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="brandShort"
                  value={formData.brandShort}
                  onChange={handleChange}
                  disabled={!isAdmin || guardando}
                  placeholder="SEÑOR HERNÁNDEZ"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 uppercase focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Razón Social Legal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="legalName"
                value={formData.legalName}
                onChange={handleChange}
                disabled={!isAdmin || guardando}
                placeholder="SEÑOR HERNÁNDEZ RESTAURANTE E.I.R.L."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 uppercase focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Aparece en el encabezado de las facturas y reportes contables oficiales.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nombre Comercial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isAdmin || guardando}
                  placeholder="Restaurante Señor Hernández"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Eslogan / Tagline
                </label>
                <input
                  type="text"
                  name="tagline"
                  value={formData.tagline}
                  onChange={handleChange}
                  disabled={!isAdmin || guardando}
                  placeholder="Restaurante & Gastronomía Peruana"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                />
              </div>
            </div>

            <div className="border-b border-slate-100 pb-3 pt-2">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-600" />
                Ubicación y Contacto
              </h2>
              <p className="text-xs text-slate-400">Dirección y números de contacto impresos en las comandas y tickets de venta.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Dirección del Local / Fiscal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isAdmin || guardando}
                placeholder="Av. Marina Nro. 789 - Cajamarca"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Teléfono(s) / Celular
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isAdmin || guardando}
                  placeholder="(076) 364-589 / 987-654-321"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isAdmin || guardando}
                  placeholder="contacto@valetecgourmet.pe"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
                />
              </div>
            </div>

            <div className="border-b border-slate-100 pb-3 pt-2">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-600" />
                Pie de Ticket
              </h2>
              <p className="text-xs text-slate-400">Mensaje de despedida o agradecimiento al final de cada comprobante impreso.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Mensaje al Pie del Comprobante
              </label>
              <input
                type="text"
                name="ticketFooter"
                value={formData.ticketFooter}
                onChange={handleChange}
                disabled={!isAdmin || guardando}
                placeholder="¡Gracias por su visita! · RESTAURANTE SEÑOR HERNÁNDEZ"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
              />
            </div>

            <div className="border-b border-slate-100 pb-3 pt-2">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-cyan-600" />
                Giro y Modalidad del Negocio
              </h2>
              <p className="text-xs text-slate-400">Define las características y módulos activos para tu tipo de establecimiento.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Tipo de Establecimiento Gastronómico
              </label>
              <select
                name="tipoNegocio"
                value={formData.tipoNegocio || 'polleria'}
                onChange={handleChange}
                disabled={!isAdmin || guardando}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 bg-white transition"
              >
                {TIPOS_NEGOCIO.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {TIPOS_NEGOCIO.find(t => t.id === (formData.tipoNegocio || 'polleria'))?.desc}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Categorías Destinadas a BARRA (Separadas por comas)
              </label>
              <input
                type="text"
                name="barraCategoriasInput"
                value={barraInput}
                onChange={e => {
                  setBarraInput(e.target.value);
                  const cats = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setFormData(prev => ({ ...prev, barraCategorias: cats }));
                }}
                disabled={!isAdmin || guardando}
                placeholder="Bebidas y Refrescos, Cervezas, Bar y Cocteles, Postres"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Los platos o productos de estas categorías se despacharán al monitor de Barra. Todas las demás irán automáticamente a Cocina.
              </span>
            </div>

            {isAdmin && (
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={guardando}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restablecer
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Vista Previa del Ticket en Vivo */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-2">
              <span>🧾</span> Vista Previa del Ticket Térmico
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Así se visualizará el membrete y pie de tus boletas y tickets impresos en vivo:
            </p>

            {/* Simulación de Ticket 80mm */}
            <div className="bg-white text-slate-900 font-mono text-[11px] p-5 rounded-2xl shadow-inner border border-slate-200 space-y-3 leading-relaxed">
              <div className="text-center space-y-0.5">
                <p className="font-black text-xs uppercase tracking-tight">{formData.name || 'NOMBRE DEL RESTAURANTE'}</p>
                <p className="font-bold text-[10px] uppercase text-slate-600">{formData.legalName || 'RAZÓN SOCIAL'}</p>
                <p className="text-[10px] text-slate-700">R.U.C. N° {formData.ruc || '00000000000'}</p>
                <p className="text-[10px] text-slate-600">{formData.address || 'DIRECCIÓN FISCAL'}</p>
                {formData.phone && <p className="text-[10px] text-slate-600">Telf: {formData.phone}</p>}
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 text-center font-bold text-[10px]">
                BOLETA DE VENTA ELECTRÓNICA
                <p className="font-mono text-slate-500">B001-00000123</p>
              </div>

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>1x Lomo Saltado</span>
                  <span className="font-bold">S/ 28.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Chicha Morada (Jarra)</span>
                  <span className="font-bold">S/ 12.00</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between text-slate-500">
                  <span>OP. GRAVADA</span>
                  <span>S/ 36.20</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>I.G.V. (10.5%)</span>
                  <span>S/ 3.80</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-200">
                  <span>TOTAL A PAGAR:</span>
                  <span>S/ 40.00</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-600 italic">
                {formData.ticketFooter || '¡Gracias por su visita!'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
