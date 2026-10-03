import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AdminState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'notAdmin'; email: string }
  | { status: 'admin'; email: string };

/**
 * Un admin est un utilisateur connecté dont l'e-mail figure dans la table `admins`.
 * La règle RLS de cette table ne laisse la lire qu'aux admins : si la lecture
 * renvoie une ligne, on est admin. La base reste seule juge des droits ;
 * ce test ne sert qu'à afficher le bon écran.
 */
async function resolve(session: Session | null): Promise<AdminState> {
  if (!session?.user.email) return { status: 'signedOut' };
  const email = session.user.email;
  const { data, error } = await supabase.from('admins').select('email').limit(1);
  if (error || !data || data.length === 0) return { status: 'notAdmin', email };
  return { status: 'admin', email };
}

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const next = await resolve(data.session);
      if (alive) setState(next);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Pas d'appel à la base directement dans ce rappel : on le diffère.
      setTimeout(async () => {
        const next = await resolve(session);
        if (alive) setState(next);
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/admin` },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await supabase.auth.signOut();
}
