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
      'src/features/settings/utils/**/*.spec.ts',
      'src/features/storage/**/*.spec.ts',
      'src/features/modal/**/*.spec.ts',
      'src/features/theme/**/*.spec.ts',
      'src/features/layouts/chrome/**/*.spec.ts',
      '../sdk/src/**/*.spec.ts',
    ],
  },
});
