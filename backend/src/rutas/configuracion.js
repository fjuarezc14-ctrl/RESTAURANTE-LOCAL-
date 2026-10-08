// Rutas de configuración: datos de la empresa, estado del servidor y direcciones de red
const express = require('express');
const os = require('os');
const { prisma } = require('../db');
const { DEFAULT_BARRA_CATEGORIAS, getEmpresaConfig, guardarConfigEnCache } = require('../servicios/empresa');
const { interfacesIPv4, ipRutaPorDefecto, puntajeIp, enContenedor } = require('../servicios/red');
const { ErrorApp } = require('../middlewares/errores');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { datosEmpresa } = require('../../shared/esquemas/empresa.js');
const { soloAdmin } = require('../middlewares/permisos');

const router = express.Router();
validarIdsEnUrl(router);

// GET /api/empresa -> Obtener datos actuales de la empresa
router.get('/api/empresa', async (req, res, next) => {
  try {
    const config = await getEmpresaConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /api/empresa -> Actualizar datos de la empresa desde la app
router.put('/api/empresa', soloAdmin, validar({ body: datosEmpresa }), async (req, res, next) => {
  try {
    const { name, brandShort, tagline, legalName, ruc, address, phone, email, ticketFooter, tipoNegocio, barraCategorias } = req.body;
    let conf = await prisma.empresaConfig.findFirst();
    const dataToSave = {
      name: name ? String(name).trim() : conf?.name,
      brandShort: brandShort ? String(brandShort).trim() : conf?.brandShort,
      tagline: tagline !== undefined ? String(tagline).trim() : conf?.tagline,
      legalName: legalName ? String(legalName).trim() : conf?.legalName,
      ruc: ruc ? String(ruc).trim() : conf?.ruc,
      address: address ? String(address).trim() : conf?.address,
      phone: phone ? String(phone).trim() : conf?.phone,
      email: email !== undefined ? String(email).trim() : conf?.email,
      ticketFooter: ticketFooter ? String(ticketFooter).trim() : conf?.ticketFooter,
      tipoNegocio: tipoNegocio ? String(tipoNegocio).trim() : (conf?.tipoNegocio || 'polleria'),
      barraCategorias: Array.isArray(barraCategorias) && barraCategorias.length > 0 ? barraCategorias : (conf?.barraCategorias || DEFAULT_BARRA_CATEGORIAS),
    };

    if (conf) {
      conf = await prisma.empresaConfig.update({
        where: { id: conf.id },
        data: dataToSave
      });
    } else {
      conf = await prisma.empresaConfig.create({
        data: {
          ...dataToSave,
          name: dataToSave.name || process.env.COMPANY_NAME || "Valetec Gourmet",
          brandShort: dataToSave.brandShort || process.env.BRAND_SHORT || "VALETEC GOURMET",
          legalName: dataToSave.legalName || process.env.LEGAL_NAME || "VALETEC GOURMET S.A.C.",
          ruc: dataToSave.ruc || process.env.COMPANY_RUC || "20600000001",
        }
      });
    }
    guardarConfigEnCache(conf);
    res.json({ ok: true, config: conf });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ESTADO DEL SERVIDOR
// ============================================================
router.get('/api/status', async (req, res) => {
  const token = process.env.APISUNAT_TOKEN;
  const modoDemo = !token || token.includes('tu_token') || token.trim() === '';
  const emp = await getEmpresaConfig();
  res.json({
    ok: true,
    mensaje: `🚀 ${emp.name} Backend API funcionando al 100%`,
    modoDemo,
    apisunatActivo: !modoDemo
  });
});

// GET /api/red/direcciones -> Direcciones para conectar celulares y tablets (se calculan al momento)
router.get('/api/red/direcciones', async (req, res, next) => {
  if (process.env.MODO_INSTALACION === 'web') {
    return next(new ErrorApp('NO_ENCONTRADO', 'No disponible en esta instalación.', { status: 404 }));
  }
  try {
    const puerto = process.env.PORT || 3003;
    const ipFija = (process.env.IP_SERVIDOR || '').trim();
    const docker = enContenedor();
    const ipRuta = docker ? null : await ipRutaPorDefecto();
    // En Docker las IPs que se ven son internas del contenedor: a los celulares no les sirven.
    // Ahí solo vale IP_SERVIDOR (en el .env) o la dirección con la que se abrió el navegador.
    const lista = docker ? [] : interfacesIPv4();

    if (ipFija && !lista.some(i => i.ip === ipFija)) {
      lista.push({ ip: ipFija, interfaz: 'IP_SERVIDOR', virtual: false });
    }

    const ordenadas = lista
      .map(i => ({ ...i, principal: false, puntaje: i.ip === ipFija ? -1 : puntajeIp(i, ipRuta) }))
      .sort((x, y) => x.puntaje - y.puntaje);
    if (ordenadas[0]) ordenadas[0].principal = true;

    res.json({
      puerto,
      enContenedor: docker,
      hostname: os.hostname(),
      ips: ordenadas.map(({ puntaje, ...i }) => i),
      urls: ordenadas.map(i => `http://${i.ip}:${puerto}`),
      urlHostname: `http://${os.hostname()}:${puerto}`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
