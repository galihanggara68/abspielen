import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js', 'tools/corpus/__tests__/**/*.test.js'],
  },
});
