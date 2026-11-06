import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser is ~1.5 MB minified. Keep it in its own chunk so it caches separately from app code,
    // and raise the warning limit just past it so a growing app chunk still triggers the warning.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[/\\]phaser[/\\]/ }],
        },
      },
    },
  },
});
