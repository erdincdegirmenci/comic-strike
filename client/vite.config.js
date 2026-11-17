import { defineConfig } from 'vite';

// Geliştirmede Vite 5173'te çalışır; API ve Socket.IO istekleri 3000'deki sunucuya yönlenir.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Rapier (WASM içerir) ve Three.js ayrı dosyalarda: oyun kodu değişse bile tarayıcı önbelleğinde kalırlar
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
