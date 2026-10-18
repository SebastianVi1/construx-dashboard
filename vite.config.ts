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
    server: env.VITE_API_PROXY_TARGET ? {
      proxy: { '/api': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true } },
    } : undefined,
  }
})
