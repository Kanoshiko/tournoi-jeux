import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Hero, { formatEventDate } from '../../components/Hero';
import LevelPicker from '../../components/LevelPicker';
import {
  fetchCurrentTournament,
  fetchGames,
  fetchPlayerCount,
  getMyPlayer,
  registerPlayer,
  type Game,
  type Tournament,
} from '../../lib/api';
import { forgetToken, recalledToken, rememberToken } from '../../lib/playerStore';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'none' }
  | { kind: 'ready'; tournament: Tournament; games: Game[]; count: number };

export default function Inscription() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pseudo, setPseudo] = useState('');
  const [level, setLevel] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Déjà inscrit sur ce téléphone : on renvoie vers sa page.
        const saved = recalledToken();
        if (saved) {
          const me = await getMyPlayer(saved);
          if (me) {
            navigate(`/moi/${saved}`, { replace: true });
            return;
          }
          forgetToken();
        }
        const tournament = await fetchCurrentTournament();
        if (!tournament) {
          if (!cancelled) setState({ kind: 'none' });
          return;
        }
        const [games, count] = await Promise.all([fetchGames(tournament.id), fetchPlayerCount(tournament.id)]);
        if (!cancelled) setState({ kind: 'ready', tournament, games, count });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state.kind === 'loading') {
    return (
      <main className="page">
        <Hero eyebrow="Tournoi par équipes" title="Chargement…" />
      </main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main className="page">
        <Hero eyebrow="Tournoi par équipes" title="Oups" />
        <p className="alert" role="alert">Impossible de joindre le serveur : {state.message}. Réessaie dans un instant.</p>
      </main>
    );
  }
  if (state.kind === 'none') {
    return (
      <main className="page">
        <Hero eyebrow="Tournoi par équipes" title="Pas de tournoi en cours" />
        <p className="card">Les inscriptions ne sont pas encore ouvertes. Surveille le Discord du club !</p>
      </main>
    );
  }

  const { tournament, games, count } = state;
  const date = formatEventDate(tournament.event_date);

  if (tournament.status !== 'inscriptions') {
    return (
      <main className="page">
        <Hero eyebrow={tournament.name} title="Inscriptions closes">
          {date && <p>{date}</p>}
        </Hero>
        <div className="stack">
          <p className="card">Les inscriptions sont terminées. Si tu es inscrit, retrouve ton équipe et ta table avec ton pseudo et ton code.</p>
          <Link className="btn" to="/retrouver">Retrouver mon inscription</Link>
        </div>
      </main>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!pseudo.trim()) {
      setFormError('Indique ton prénom ou un pseudo.');
      return;
    }
    setSubmitting(true);
    try {
      const { token } = await registerPlayer(tournament.id, pseudo, level);
      rememberToken(token);
      navigate(`/moi/${token}`, { state: { justRegistered: true } });
    } catch (err) {
      setFormError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <Hero eyebrow={tournament.name} title="Tournoi par équipes">
        {date && <p>{date}</p>}
      </Hero>

      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="pseudo">Ton prénom ou pseudo</label>
          <input
            id="pseudo"
            type="text"
            autoComplete="nickname"
            maxLength={30}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="input"
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? 'form-error' : undefined}
          />
        </div>

        <LevelPicker value={level} onChange={setLevel} games={games} />

        <Link to="/jeux" className="card row-link">
          <span>
            <strong>{games.length} jeux au programme</strong>
            <br />
            <span className="muted">Pour t’entraîner avant le jour J</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>

        {formError && (
          <p id="form-error" className="alert" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Inscription…' : 'Je m’inscris'}
        </button>
        <p className="muted center small">
          {count === 0 ? 'Sois le premier inscrit !' : `${count} joueur${count > 1 ? 's' : ''} déjà inscrit${count > 1 ? 's' : ''}`}
          {' · '}
          <Link to="/retrouver">Déjà inscrit ?</Link>
        </p>
      </form>
    </main>
  );
}
