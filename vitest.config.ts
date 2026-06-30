import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run tests from src directory
    include: ['src/**/*.test.ts'],
    // Exclude playwright tests
    exclude: ['tests/**'],
    // Use vitest globals
    globals: true,
  },
});
