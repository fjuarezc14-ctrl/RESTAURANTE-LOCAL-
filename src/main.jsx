// Polyfill global de crypto.randomUUID para conexiones HTTP por IP de red local
if (typeof globalThis !== 'undefined') {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto.randomUUID = function randomUUID() {
      return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c) {
        var r = (globalThis.crypto.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(1))[0] : Math.floor(Math.random() * 256));
        return (+c ^ (r & (15 >> (+c / 4)))).toString(16);
      });
    };
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { CompanyProvider } from './context/CompanyContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </ErrorBoundary>
  </StrictMode>,
)
