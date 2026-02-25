import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    root: './src',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    setupFiles: ['./__test-utils__/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '__test-utils__/**', 'main.tsx', 'types/**'],
      thresholds: {
        statements: 45,
        branches: 40,
        functions: 40,
        lines: 45,
      },
    },
  },
  resolve: {
    alias: {
      '@maestro/shared': path.resolve(__dirname, '..', 'shared', 'src', 'index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
