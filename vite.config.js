import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredApiBaseUrl = String(env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  let backendTarget = 'http://127.0.0.1:5000'

  if (configuredApiBaseUrl) {
    try {
      backendTarget = new URL(configuredApiBaseUrl).origin
    } catch {
      backendTarget = 'http://127.0.0.1:5000'
    }
  }

  const noStoreHeaders = {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase'
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide'
              }
              if (
                id.includes('react') ||
                id.includes('scheduler') ||
                id.includes('framer-motion') ||
                id.includes('motion-dom') ||
                id.includes('motion-utils')
              ) {
                return 'vendor-react'
              }
              if (id.includes('@simplewebauthn')) {
                return 'vendor-webauthn'
              }
              return 'vendor-others'
            }
          }
        }
      },
      chunkSizeWarningLimit: 800,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      cors: true,
      headers: noStoreHeaders,
      hmr: {
        clientPort: 5173,
      },
      proxy: {
        '/api': {
          target: backendTarget,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          secure: false,
        },
        '/socket.io': {
          target: backendTarget,
          secure: false,
          ws: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
  }
})
