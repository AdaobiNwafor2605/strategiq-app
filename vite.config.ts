import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5189,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/debug': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['react-router-dom'],
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      'react-router-dom': 'react-router-dom',
    },
  },
});
