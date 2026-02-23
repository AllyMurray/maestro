import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    root: './src',
    include: ['**/*.test.ts', '**/*.integration.test.ts'],
    // better-sqlite3 is rebuilt for Electron's Node ABI by electron-rebuild.
    // When vitest runs on system Node (different ABI), fork workers don't exit
    // cleanly after tests complete. All tests pass — only process cleanup fails.
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.integration.test.ts', '__test-utils__/**', 'index.ts', 'preload.ts'],
    },
  },
  resolve: {
    alias: {
      '@maestro/shared': path.resolve(__dirname, '..', 'shared', 'src', 'index.ts'),
    },
  },
});
