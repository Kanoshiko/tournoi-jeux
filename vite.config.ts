/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Netlify fournit COMMIT_REF au moment du build : on l'affiche dans le diagnostic
// pour vérifier quelle version est en ligne.
const commit = (process.env.COMMIT_REF ?? 'local').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
