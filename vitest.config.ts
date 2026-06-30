import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'raw-markdown',
      transform(code, id) {
        if (id.endsWith('.md')) {
          return { code: `export default ${JSON.stringify(code)}` };
        }
      },
    },
  ],
  test: {
    // Only run tests from src directory
    include: ['src/**/*.test.ts'],
    // Exclude playwright tests
    exclude: ['tests/**'],
    // Use vitest globals
    globals: true,
  },
});