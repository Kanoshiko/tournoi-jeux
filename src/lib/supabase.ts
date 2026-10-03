import { createClient } from '@supabase/supabase-js';

// Valeurs injectées au build (fichier .env.local en local, variables Netlify en ligne).
// Elles sont publiques par conception : la sécurité repose sur les règles RLS.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);
export const supabaseUrl = url ?? '';

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});
