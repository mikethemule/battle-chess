import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Configuration options for Battle Chess
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    // Ensure single Three.js instance to prevent uniform/material issues
    dedupe: ['three'],
    alias: {
      three: path.resolve('./node_modules/three'),
    },
  },
});
