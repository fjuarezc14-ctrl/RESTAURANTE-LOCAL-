import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Reglas comunes al frontend y al backend
const reglas = {
  // `_algo` y los catch sin usar se permiten; `{ quitar, ...resto }` también
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
}

export default defineConfig([
  // installer/build/stage es la copia ofuscada que arma el instalador
  globalIgnores(['dist', 'installer/build', 'scratch', '**/node_modules']),

  // Frontend (React en el navegador)
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reglas,
      // Avisos propios en lugar de los del navegador (useAviso, useConfirmar, usePedirDato)
      'no-alert': 'error',
      // Páginas grandes: avisar para seguir partiéndolas en src/modulos/
      'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }],
      // Reglas del compilador de React: quedan como aviso hasta revisar cada caso con pruebas
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },

  // Backend (Node con CommonJS)
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: reglas,
  },
  // Lo que se comparte con el frontend, las pruebas y los .mjs son módulos ES
  {
    files: ['backend/shared/**/*.js', 'backend/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'module', globals: globals.node },
    rules: reglas,
  },

  // Configuración de herramientas e instalador (Node)
  {
    files: ['*.{js,mjs}', 'installer/**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: reglas,
  },
  {
    files: ['installer/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
])
