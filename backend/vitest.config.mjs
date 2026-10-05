import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    globalSetup: ['test/global-setup.mjs'],
    // Todas las suites comparten la misma BD de pruebas
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    // La app escribe en consola en cada operación; solo se muestran los errores
    onConsoleLog: (_log, tipo) => tipo === 'stderr',
  },
});
