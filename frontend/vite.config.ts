import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server pinned to 5173 (the port the README Quickstart and the backend CORS
// allow-list both reference). `strictPort` fails fast rather than silently hopping
// to 5174 — a wrong port would break auth calls against the CORS-gated backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
