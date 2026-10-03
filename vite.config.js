import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// Con CLIENTE=<carpeta de installer/clientes/> se muestra el logo de ese cliente en lugar del de Valetec
const logoCliente = process.env.CLIENTE
  ? path.resolve('installer/clientes', process.env.CLIENTE, 'logo.png')
  : null;
const usarLogoCliente = Boolean(logoCliente && fs.existsSync(logoCliente));

function logoDelCliente() {
  return {
    name: 'logo-del-cliente',
    enforce: 'pre',
    resolveId(source) {
      if (/(^|\/)assets\/logo\.png$/.test(source)) return logoCliente;
    },
    configureServer(server) {
      server.middlewares.use('/logo.png', (req, res) => {
        res.setHeader('Content-Type', 'image/png');
        fs.createReadStream(logoCliente).pipe(res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    usarLogoCliente && logoDelCliente(),
  ],
  server: {
    hmr: {
      overlay: false
    },
    allowedHosts: true,
    host: true, // Listen on all local IPs (needed for Docker)
    port: 5188,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:3010',
        changeOrigin: true,
        rewrite: (path) => path,
      }
    }
  }
})
