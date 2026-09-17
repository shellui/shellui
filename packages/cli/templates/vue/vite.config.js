import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  cacheDir: 'node_modules/.vite-app',
  base: mode === 'production' ? '/app/' : '/',
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    outDir: 'dist/web/app',
    emptyOutDir: true,
  },
}))
