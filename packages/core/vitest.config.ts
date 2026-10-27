import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@shellui/sdk': fileURLToPath(new URL('../sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/features/auth/utils/**/*.spec.ts',
      'src/features/auth/backends/**/*.spec.ts',
      'src/features/auth/appBackend/**/*.spec.ts',
      'src/features/auth/components/**/*.spec.tsx',
      'src/features/settings/utils/**/*.spec.ts',
      'src/features/storage/**/*.spec.ts',
      'src/features/transfers/**/*.spec.ts',
      'src/features/ai/**/*.spec.ts',
      'src/features/security/**/*.spec.ts',
      'src/features/modal/**/*.spec.ts',
      'src/routes/utils/**/*.spec.ts',
      'src/features/overlays/**/*.spec.ts',
      'src/features/theme/**/*.spec.ts',
      'src/features/layouts/chrome/**/*.spec.ts',
      'src/features/layouts/chrome/**/*.spec.tsx',
      'src/features/layouts/branding/**/*.spec.ts',
      'src/features/layouts/floating/**/*.spec.ts',
      'src/features/layouts/windows/**/*.spec.ts',
      'src/features/layouts/sidebar/**/*.spec.tsx',
      'src/features/layouts/findMatchingNavigationItem.spec.ts',
      'src/features/layouts/isFrameForAppUrl.spec.ts',
      'src/features/chromeActions/**/*.spec.ts',
      'src/components/**/*.spec.ts',
      'src/components/**/*.spec.tsx',
      'src/features/messaging/**/*.spec.ts',
      '../sdk/src/**/*.spec.ts',
    ],
  },
});
