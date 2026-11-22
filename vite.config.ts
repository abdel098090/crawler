import { defineConfig } from 'vitest/config';

// Vite builds the browser app. Vitest (the test runner) reads the "test" part.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
