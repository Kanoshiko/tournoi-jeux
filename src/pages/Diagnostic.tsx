import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseConfigured, supabaseUrl } from '../lib/supabase';
import { pointsForPosition } from '../algo/scoring';

type Check = { label: string; ok: boolean | null; detail: string };

type Ping = {
  server_time: string;
  tournaments: number;
  games: number;
  players: number;
  is_admin: boolean;
};

export default function Diagnostic() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'Version en ligne', ok: true, detail: `commit ${__APP_COMMIT__} · build ${new Date(__APP_BUILT_AT__).toLocaleString('fr-FR')}` },
    { label: 'Configuration Supabase', ok: supabaseConfigured, detail: supabaseConfigured ? new URL(supabaseUrl).host : 'Variables VITE_SUPABASE_* absentes' },
    { label: 'Appel à la base (ping)', ok: null, detail: 'En cours…' },
    { label: 'Lecture du catalogue de jeux', ok: null, detail: 'En cours…' },
    { label: 'Liste des joueurs protégée', ok: null, detail: 'En cours…' },
    { label: 'Barème (code de l’algorithme)', ok: pointsForPosition(2, 5) === 3.25, detail: '2e sur 5 = 3,25 pts' },
  ]);

  useEffect(() => {
    const set = (label: string, ok: boolean, detail: string) =>
      setChecks((cs) => cs.map((c) => (c.label === label ? { ...c, ok, detail } : c)));

    if (!supabaseConfigured) {
      for (const label of ['Appel à la base (ping)', 'Lecture du catalogue de jeux', 'Liste des joueurs protégée']) {
        set(label, false, 'Non testé : configuration Supabase absente');
      }
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc('ping');
      if (error) set('Appel à la base (ping)', false, error.message);
      else {
        const p = data as Ping;
        set('Appel à la base (ping)', true,
          `heure serveur ${new Date(p.server_time).toLocaleTimeString('fr-FR')} · ${p.tournaments} tournoi(s), ${p.games} jeu(x), ${p.players} joueur(s)`);
      }

      const games = await supabase.from('games').select('name, complexity').order('complexity', { ascending: false });
      if (games.error) set('Lecture du catalogue de jeux', false, games.error.message);
      else set('Lecture du catalogue de jeux', true, games.data.map((g) => `${g.name} (${g.complexity})`).join(', ') || 'catalogue vide');

      // Sans être admin, la table des joueurs doit paraître vide (RLS).
      const players = await supabase.from('players').select('id, code').limit(5);
      if (players.error) set('Liste des joueurs protégée', true, `accès refusé (${players.error.code})`);
      else set('Liste des joueurs protégée', players.data.length === 0,
        players.data.length === 0 ? 'aucun joueur ni code visible sans connexion admin' : 'ATTENTION : des joueurs sont visibles');
    })();
  }, []);

  const allOk = checks.every((c) => c.ok === true);
  const failed = checks.some((c) => c.ok === false);
  const pending = !failed && checks.some((c) => c.ok === null);

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Diagnostic</p>
        <h1>{pending ? 'Vérification…' : allOk ? 'Tout communique' : 'Un problème est détecté'}</h1>
      </header>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.label} className="card check">
            <span className={`dot ${c.ok === null ? 'wait' : c.ok ? 'ok' : 'ko'}`} aria-hidden="true" />
            <div>
              <strong>{c.label}</strong>
              <p>{c.detail}</p>
            </div>
            <span className="sr-only">{c.ok === null ? 'en cours' : c.ok ? 'réussi' : 'échec'}</span>
          </li>
        ))}
      </ul>
      <p><Link to="/">Retour à l’accueil</Link></p>
    </main>
  );
}
