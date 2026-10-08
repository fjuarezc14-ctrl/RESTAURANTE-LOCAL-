// GET /api/respaldo → descarga un respaldo completo de la base (solo Administrador y siempre con sesión).
// Se registra en la auditoría. Si pg_dump falla antes de enviar datos, responde un error normal;
// si falla a mitad de la descarga, se corta la conexión (el navegador marca la descarga como fallida).
const express = require('express');
const { ErrorApp } = require('../middlewares/errores');
const { soloAdmin } = require('../middlewares/permisos');
const { requiereSesion } = require('../middlewares/sesion');
const { registrarAuditoria } = require('../servicios/auditoria');
const { getEmpresaConfig } = require('../servicios/empresa');
const { iniciarPgDump } = require('../servicios/respaldo');

const router = express.Router();

router.get('/api/respaldo', requiereSesion, soloAdmin, async (req, res, next) => {
  try {
    const empresa = await getEmpresaConfig();
    const marca = String(empresa.brandShort || empresa.name || 'restaurante').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fecha = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 16).replace('T', '_').replace(':', '-'); // hora de Lima
    const archivo = `respaldo-${marca}-${fecha}.dump`;

    const proceso = iniciarPgDump();
    let enviados = 0;
    let errores = '';
    proceso.stderr.on('data', (t) => { errores += t; });
    proceso.stdout.on('data', (trozo) => {
      if (enviados === 0) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
        res.setHeader('Cache-Control', 'no-store');
      }
      enviados += trozo.length;
      if (!res.write(trozo)) {
        proceso.stdout.pause();
        res.once('drain', () => proceso.stdout.resume());
      }
    });
    proceso.on('error', (err) => {
      console.error('[respaldo] no se pudo ejecutar pg_dump:', err.message);
      if (enviados === 0 && !res.headersSent) next(new ErrorApp('SERVICIO_NO_DISPONIBLE', 'No se pudo generar el respaldo en este servidor.'));
      else res.destroy();
    });
    proceso.on('close', async (codigo) => {
      if (codigo !== 0) {
        console.error(`[respaldo] pg_dump terminó con código ${codigo}: ${errores.trim()}`);
        if (enviados === 0 && !res.headersSent) return next(new ErrorApp('SERVICIO_NO_DISPONIBLE', 'No se pudo generar el respaldo en este servidor.'));
        return res.destroy();
      }
      try {
        await registrarAuditoria(null, req, { accion: 'RESPALDO_DESCARGADO', entidad: 'BaseDeDatos', despues: { archivo, bytes: enviados } });
      } catch (err) {
        console.error('[respaldo] no se pudo registrar en la auditoría:', err.message);
      }
      res.end();
    });
    // Si el administrador cancela la descarga, se detiene pg_dump
    res.on('close', () => { if (proceso.exitCode === null) proceso.kill(); });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
