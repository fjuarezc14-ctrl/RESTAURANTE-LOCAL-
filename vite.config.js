import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
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
