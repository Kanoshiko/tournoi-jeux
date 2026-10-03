import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAdminContext } from './AdminLayout';
import { fetchPlayers, updateTournament, type AdminPlayer } from '../../lib/adminApi';
import { fetchGames, type Game, type Tournament } from '../../lib/api';
import { TIERS, tierOf } from '../../lib/levels';

const STATUS: Record<Tournament['status'], { label: string; help: string }> = {
  inscriptions: { label: 'Inscriptions ouvertes', help: 'Les joueurs peuvent s’inscrire, modifier ou annuler leur inscription.' },
  brouillon: { label: 'Inscriptions closes', help: 'Plus d’inscription. Les équipes se préparent, invisibles des joueurs.' },
  publie: { label: 'Répartition publiée', help: 'Les joueurs voient leur équipe et leur table.' },
  termine: { label: 'Tournoi terminé', help: '' },
};

export default function Tournoi() {
  const { tournament, reloadTournament } = useAdminContext();
  const [name, setName] = useState(tournament.name);
  const [date, setDate] = useState(tournament.event_date ?? '');
  const [teams, setTeams] = useState(String(tournament.team_count));
  const [tolerance, setTolerance] = useState(String(tournament.complexity_tolerance));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    Promise.all([fetchPlayers(tournament.id), fetchGames(tournament.id)])
      .then(([p, g]) => { setPlayers(p); setGames(g); })
      .catch((e) => setError((e as Error).message));
  }, [tournament.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    setBusy(true);
    try {
      await updateTournament(tournament.id, {
        name: name.trim(),
        event_date: date || null,
        team_count: Number(teams),
        complexity_tolerance: Number(tolerance),
      });
      await reloadTournament();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Tournament['status']) {
    setError(null);
    setBusy(true);
    try {
      await updateTournament(tournament.id, { status });
      await reloadTournament();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const st = STATUS[tournament.status];

  return (
    <div className="stack">
      <h1 className="h-admin">Tournoi</h1>

      <section className="card stack-sm" aria-labelledby="st">
        <h2 id="st" className="h-section">Statut : {st.label}</h2>
        <p className="muted">{st.help}</p>
        <div className="row-wrap">
          {tournament.status === 'inscriptions' && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setStatus('brouillon')}>Clore les inscriptions</button>
          )}
          {tournament.status === 'brouillon' && (
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setStatus('inscriptions')}>Rouvrir les inscriptions</button>
          )}
        </div>
      </section>

      <section className="stats" aria-label="Chiffres clés">
        <Link to="/admin/inscrits" className="card stat"><span>Inscrits</span><strong>{players.length}</strong></Link>
        <Link to="/admin/jeux" className="card stat"><span>Jeux</span><strong>{games.length}</strong></Link>
        {TIERS.map((t) => (
          <div key={t.key} className="card stat">
            <span>{t.label} <span className="muted">({t.min}–{t.max})</span></span>
            <strong>
              {players.filter((p) => tierOf(p.level).key === t.key).length}
              <small> joueurs · {games.filter((g) => tierOf(g.complexity).key === t.key).length} jeux</small>
            </strong>
          </div>
        ))}
      </section>

      <form className="card stack-sm form-grid" onSubmit={save} noValidate>
        <h2 className="h-section span-all">Réglages</h2>
        <div className="field span-2">
          <label htmlFor="t-name">Nom du tournoi</label>
          <input id="t-name" className="input input-sm" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-date">Date</label>
          <input id="t-date" type="date" className="input input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-teams">Nombre d’équipes</label>
          <select id="t-teams" className="input input-sm" value={teams} onChange={(e) => setTeams(e.target.value)}>
            {[3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-tol">Tolérance de complexité</label>
          <select id="t-tol" className="input input-sm" value={tolerance} onChange={(e) => setTolerance(e.target.value)}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>± {n}</option>)}
          </select>
        </div>
        <p className="muted small span-all">
          Il faut au moins autant d’équipes que de joueurs à la plus grande table : 5 équipes permettent des tables de 5.
        </p>
        {error && <p className="alert span-all" role="alert">{error}</p>}
        <div className="row-wrap span-all">
          <button type="submit" className="btn btn-sm" disabled={busy}>Enregistrer</button>
          {saved && <span className="ok-text" role="status">Enregistré</span>}
        </div>
      </form>
    </div>
  );
}
