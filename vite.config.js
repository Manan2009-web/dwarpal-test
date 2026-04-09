import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = String(env.VITE_DEV_BACKEND_URL || 'http://127.0.0.1:5000').trim().replace(/\/+$/, '')
  const noStoreHeaders = {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  }

  return {
    plugins: [react()],
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
      headers: noStoreHeaders,
    },
  }
})
