// ============================================================
// APP EXPRESS: middlewares y rutas. El servidor se inicia en server.js.
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const { prisma } = require('./db');
const { manejarErrores, rutaNoEncontrada } = require('./middlewares/errores');
const { cargarSesion } = require('./middlewares/sesion');

const app = express();

app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/eventos') && compression.filter(req, res) }));

// Detrás del proxy de la web, req.ip es la IP del cliente (límite de intentos). En la red local no hay proxy:
// confiar en X-Forwarded-For permitiría falsear la IP.
if (process.env.MODO_INSTALACION === 'web') app.set('trust proxy', 1);

// Cabeceras de seguridad. La CSP queda apagada hasta probarla con la web servida desde dist/ (instalador Windows);
// HSTS solo detrás de HTTPS.
app.use(helmet({ contentSecurityPolicy: false, hsts: process.env.MODO_INSTALACION === 'web' }));

// Mismo origen por defecto: en desarrollo Vite hace de proxy y en Windows el backend sirve la web.
// Solo si la web vive en otro dominio se habilita CORS para esos orígenes (CORS_ORIGIN=https://a.pe,https://b.pe).
const origenesPermitidos = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
if (origenesPermitidos.length) app.use(cors({ origin: origenesPermitidos, credentials: true }));
// Las compras pueden traer el XML de SUNAT completo; el resto de la API, como máximo 100 KB
app.use('/api/compras', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '100kb' }));

// Sesión por cookie en todo /api/* (con AUTH_OBLIGATORIA=false no rechaza a nadie)
app.use(cargarSesion);

// Un router por módulo (ver src/rutas/)
app.use(require('./rutas/auth'));
app.use(require('./rutas/configuracion'));
app.use(require('./rutas/clientes'));
app.use(require('./rutas/mesas'));
app.use(require('./rutas/pedidos'));
app.use(require('./rutas/delivery'));
app.use(require('./rutas/productos'));
app.use(require('./rutas/categorias'));
app.use(require('./rutas/ofertas'));
app.use(require('./rutas/usuarios'));
app.use(require('./rutas/dispositivos'));
app.use(require('./rutas/ventas'));
app.use(require('./rutas/caja'));
app.use(require('./rutas/compras'));
app.use(require('./rutas/reportes'));

// Cualquier otra ruta /api/* responde 404 en JSON
app.use('/api', rutaNoEncontrada);

// ============================================================
// FRONTEND COMPILADO (INSTALADOR WINDOWS)
// Si existe la carpeta dist, el backend sirve la app en el mismo puerto.
// En Docker/desarrollo no existe y Vite sirve el frontend.
// ============================================================
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  console.log(`🖥️ Sirviendo frontend desde ${FRONTEND_DIST}`);
}

// Formato único de errores: va al final, después de todas las rutas
app.use(manejarErrores);

module.exports = { app, prisma };
