import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/features/auth/utils/**/*.spec.ts', 'src/features/settings/utils/**/*.spec.ts'],
  },
});
