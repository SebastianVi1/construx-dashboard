import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_API_')

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    // Dev reverse proxy. This is NOT a CORS config: CORS headers are a backend
    // responsibility and a frontend change alone cannot produce them. Proxying
    // keeps the browser on one origin (Vite) and forwards /api server-to-server,
    // so the cross-origin check never happens. Defaults to the local backend.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://backend:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
