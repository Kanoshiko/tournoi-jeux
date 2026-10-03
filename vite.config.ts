/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Netlify fournit COMMIT_REF au moment du build : on l'affiche dans le diagnostic
// pour vérifier quelle version est en ligne.
const commit = (process.env.COMMIT_REF ?? 'local').slice(0, 7);

// Sur Netlify, un build sans configuration Supabase donnerait un site cassé :
// on préfère faire échouer le build (l'ancienne version reste alors en ligne).
if (process.env.NETLIFY === 'true') {
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes sur Netlify : ${missing.join(', ')}`);
  }
}

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
