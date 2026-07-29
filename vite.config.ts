import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Defaults to `npm run mock`, so a fresh clone runs with no .env.local at all.
  const devBackend = env.VITE_DEV_BACKEND_ORIGIN || 'http://localhost:8787'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // Dev runs the SPA on localhost:5173 while Laravel lives elsewhere. That is
    // cross-site, and config/session.php pins same_site='lax', so the session
    // cookie would never be sent. Proxying makes dev same-origin: no CORS, no
    // SameSite. Production is cross-subdomain instead (crm.* -> api.*) and leans
    // on SESSION_DOMAIN=.rentafacilrd.com — see README.
    server: {
      proxy: {
        '/api': { target: devBackend, changeOrigin: true },
        '/sanctum': { target: devBackend, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
