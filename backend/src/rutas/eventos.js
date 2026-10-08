// GET /api/eventos → avisos en vivo (Server-Sent Events). nginx.conf ya tiene la ruta sin buffer.
// Con AUTH_OBLIGATORIA=true solo con sesión; en la transición, como el resto de la API, sin exigirla.
const express = require('express');
const { ErrorApp } = require('../middlewares/errores');
const { suscribir } = require('../servicios/eventos');

const router = express.Router();

router.get('/api/eventos', (req, res, next) => {
  if (process.env.AUTH_OBLIGATORIA === 'true' && !req.usuario) {
    return next(new ErrorApp('NO_AUTENTICADO', 'Ingresa tu PIN para continuar.'));
  }
  suscribir(req, res);
});

module.exports = router;
