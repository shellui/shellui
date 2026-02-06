import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        types: path.resolve(__dirname, 'src/features/config/types.ts'),
        'constants/urls': path.resolve(__dirname, 'src/constants/urls.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        // React core
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        // Workspace packages
        '@shellui/sdk',
        // All dependencies (matched by prefix)
        /^@radix-ui\//,
        /^@sentry\//,
        'class-variance-authority',
        'clsx',
        'i18next',
        'react-i18next',
        'react-router',
        'roarr',
        'sonner',
        'tailwind-merge',
        'vaul',
        /^workbox-/,
      ],
      output: {
        // Place CSS as style.css at the dist root
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0]?.endsWith('.css')) {
            return 'style.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
