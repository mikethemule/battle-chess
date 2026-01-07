import { defineConfig } from 'vite';

export default defineConfig({
  // Configuration options for Battle Chess
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
});
