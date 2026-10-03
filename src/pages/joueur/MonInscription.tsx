import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Hero from '../../components/Hero';
import LevelPicker from '../../components/LevelPicker';
import {
  deleteMyPlayer,
  fetchGames,
  getMyPlayer,
  isToken,
  updateMyPlayer,
  type Game,
  type MyPlayer,
} from '../../lib/api';
import { gamesNearLevel, tierOf } from '../../lib/levels';
import { forgetToken, rememberToken } from '../../lib/playerStore';

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; me: MyPlayer; games: Game[] };

export default function MonInscription() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = Boolean((location.state as { justRegistered?: boolean } | null)?.justRegistered);

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [level, setLevel] = useState(5);

  const load = useCallback(async () => {
    if (!isToken(token)) {
      setState({ kind: 'notfound' });
      return;
    }
    try {
      const me = await getMyPlayer(token);
      if (!me) {
        setState({ kind: 'notfound' });
        return;
      }
      rememberToken(token);
      const games = await fetchGames(me.tournament_id);
      setState({ kind: 'ready', me, games });
      setPseudo(me.pseudo);
      setLevel(me.level);
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <main className="page">
        <Hero title="Chargement…" />
      </main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main className="page">
        <Hero title="Oups" />
        <p className="alert" role="alert">Impossible de joindre le serveur : {state.message}. Réessaie dans un instant.</p>
      </main>
    );
  }
  if (state.kind === 'notfound') {
    return (
      <main className="page">
        <Hero title="Inscription introuvable" />
        <div className="stack">
          <p className="card">Ce lien ne correspond à aucune inscription. Elle a peut-être été supprimée.</p>
          <Link className="btn" to="/retrouver">Retrouver avec mon code</Link>
          <Link className="btn btn-ghost" to="/">S’inscrire</Link>
        </div>
      </main>
    );
  }

  const { me, games } = state;
  const tier = tierOf(me.level);
  const open = me.tournament_status === 'inscriptions';
  const nearby = gamesNearLevel(games, me.level).slice(0, 4);
  const personalLink = `${window.location.origin}/moi/${token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(personalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copie ton lien personnel :', personalLink);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyPlayer(token, pseudo, level);
      setEditing(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyPlayer(token);
      forgetToken();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <main className="page">
        <Hero title="Modifier mon inscription" />
        <form className="stack" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="pseudo">Ton prénom ou pseudo</label>
            <input id="pseudo" className="input" maxLength={30} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
          </div>
          <LevelPicker value={level} onChange={setLevel} games={games} />
          {error && <p className="alert" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setError(null); setPseudo(me.pseudo); setLevel(me.level); }}>
            Annuler
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <Hero title={justRegistered ? `C’est noté, ${me.pseudo} !` : `Bonjour ${me.pseudo}`}>
        <p className="hero-row">
          <span className={`chip chip-${tier.key}`}>{tier.label} · {me.level}/10</span>
          {open && (
            <button type="button" className="link-on-dark" onClick={() => setEditing(true)}>Modifier</button>
          )}
        </p>
      </Hero>

      <div className="stack">
        <section className="card stack-sm" aria-labelledby="code-title">
          <h2 id="code-title" className="h-small">Ton code personnel</h2>
          <p className="code">{me.code}</p>
          <p className="muted small">
            Garde ce lien : il te permettra de retrouver ton équipe et ta table le jour J. Sur un autre téléphone, ton pseudo et ce code suffisent.
          </p>
          <button type="button" className="btn btn-ghost" onClick={copyLink}>
            {copied ? 'Lien copié !' : 'Copier mon lien'}
          </button>
        </section>

        <p className="info">
          {open
            ? 'Les équipes et les tables seront publiées le jour du tournoi.'
            : me.tournament_status === 'brouillon'
              ? 'Les inscriptions sont closes. Les équipes sont en préparation.'
              : 'Les équipes et les tables sont publiées.'}
        </p>

        {nearby.length > 0 && (
          <section className="stack-sm" aria-labelledby="games-title">
            <h2 id="games-title" className="h-section">Jeux pour ton niveau</h2>
            <p className="muted small">Tu joueras probablement à l’un d’eux : entraîne-toi !</p>
            <ul className="list">
              {nearby.map((g) => (
                <li key={g.id} className="card game-row">
                  <span className={`cx cx-${tierOf(g.complexity).key}`}>{g.complexity}</span>
                  <span>
                    <strong>{g.name}</strong>
                    <br />
                    <span className="muted small">{g.min_players} à {g.max_players} joueurs · {g.duration_min} min</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/jeux">Voir les {games.length} jeux du tournoi</Link>
          </section>
        )}

        {open && (
          <section className="stack-sm danger-zone">
            {error && <p className="alert" role="alert">{error}</p>}
            {!confirmDelete ? (
              <button type="button" className="btn-text" onClick={() => setConfirmDelete(true)}>Me désinscrire</button>
            ) : (
              <div className="card stack-sm">
                <p><strong>Tu confirmes ta désinscription ?</strong></p>
                <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Oui, me désinscrire</button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Non, je reste</button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
