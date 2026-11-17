import { defineConfig } from 'vite';

// Geliştirme: Vite 5173'te çalışır; /api ve /hub istekleri 5000'deki C# sunucuya yönlenir.
// Build: dosyalar C# projesinin "game" klasörüne yazılır ve EXE'nin içine gömülür.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/hub': { target: 'http://localhost:5000', ws: true },
    },
  },
  build: {
    outDir: '../server/ComicStrike.Server/game',
    emptyOutDir: true,
    target: 'es2022',
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
