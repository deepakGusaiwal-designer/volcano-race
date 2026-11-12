import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three/examples') || id.includes('three\\examples')) {
              return 'three-extras';
            }
            if (id.includes('three')) {
              return 'three';
            }
            if (
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
