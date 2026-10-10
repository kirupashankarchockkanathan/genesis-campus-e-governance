import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// API_TARGET lets the end-to-end suite point the dev server at its own API.
const target = process.env.API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
