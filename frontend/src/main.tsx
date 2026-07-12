/**
 * Application entry point. Mounts the app under the auth provider so every screen can read the session
 * via {@link ./auth/useAuth}, and pulls in the global stylesheet (Tailwind + D17 theme tokens).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
