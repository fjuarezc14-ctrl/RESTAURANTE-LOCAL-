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
      // Íconos de lucide que se llaman igual que objetos del navegador: sin el import, <History /> no da
      // error de lint sino que rompe la página al renderizar ("Illegal constructor")
      'no-restricted-globals': ['error', ...['Bluetooth', 'Clipboard', 'Fence', 'File', 'Gamepad', 'History', 'Image',
        'Keyboard', 'Lock', 'Navigation', 'Option', 'Presentation', 'Text'].map(name => ({
        name, message: `Importa el ícono ${name} de lucide-react (sin import se usa el objeto del navegador).`,
      }))],
      // Usar un valor antes de declararlo en el mismo componente (ej. en la lista de dependencias de un
      // useEffect) rompe la página al renderizar; dentro de funciones que se llaman después no hay problema
      'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      // Páginas grandes: avisar para seguir partiéndolas en src/modulos/
      'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }],
      // Reglas del compilador de React: quedan como aviso hasta revisar cada caso con pruebas
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
      // Los contextos exportan su hook junto al proveedor (useCompany) y components/ui reexporta los de avisos
      'react-refresh/only-export-components': ['warn', {
        allowExportNames: ['useCompany', 'useAviso', 'useConfirmar', 'usePedirDato', 'useNotificaciones', 'mostrarAvisoGlobal'],
      }],
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
