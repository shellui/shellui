import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  cacheDir: 'node_modules/.vite-app',
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    outDir: 'dist/web/app',
    emptyOutDir: true,
  },
  ...(mode === 'production' ? { base: '/app/' } : {}),
}));
