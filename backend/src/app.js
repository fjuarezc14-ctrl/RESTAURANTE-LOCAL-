// ============================================================
// APP EXPRESS: middlewares y rutas. El servidor se inicia en server.js.
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { prisma } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// Un router por módulo (ver src/rutas/)
app.use(require('./rutas/configuracion'));
app.use(require('./rutas/clientes'));
app.use(require('./rutas/mesas'));
app.use(require('./rutas/pedidos'));
app.use(require('./rutas/delivery'));
app.use(require('./rutas/productos'));
app.use(require('./rutas/categorias'));
app.use(require('./rutas/ofertas'));
app.use(require('./rutas/usuarios'));
app.use(require('./rutas/ventas'));
app.use(require('./rutas/caja'));
app.use(require('./rutas/compras'));
app.use(require('./rutas/reportes'));

// ============================================================
// FRONTEND COMPILADO (INSTALADOR WINDOWS)
// Si existe la carpeta dist, el backend sirve la app en el mismo puerto.
// En Docker/desarrollo no existe y Vite sirve el frontend.
// ============================================================
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  console.log(`🖥️ Sirviendo frontend desde ${FRONTEND_DIST}`);
}

module.exports = { app, prisma };
