import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAdminContext } from './AdminLayout';
import {
  addLatePlayer,
  fetchPlayers,
  fetchSavedDraft,
  saveDraft,
  updateTournament,
  type AdminPlayer,
} from '../../lib/adminApi';
import { fetchGames, type Game } from '../../lib/api';
import { distribute, DistributionError } from '../../algo/distribution';
import { checkDraft, draftFromDistribution, movePlayer, newTableKey, suggestTeam, type Draft } from '../../algo/draft';
import { tierOf } from '../../lib/levels';
import { teamColor } from '../../lib/teams';

const fmt = (x: number) => x.toFixed(1).replace('.', ',');

export default function Repartition() {
  const { tournament, reloadTournament } = useAdminContext();
  const teamCount = tournament.team_count;
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [latePseudo, setLatePseudo] = useState('');
  const [lateLevel, setLateLevel] = useState('5');

  const setDraft = (d: Draft) => {
    setDraftState(d);
    setDirty(true);
    setNotice(null);
  };

  const load = useCallback(async () => {
    try {
      const [p, g, d] = await Promise.all([fetchPlayers(tournament.id), fetchGames(tournament.id), fetchSavedDraft(tournament.id)]);
      setPlayers(p);
      setGames(g);
      setDraftState(d);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  // Prévenir avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const playerById = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players]);
  const pseudoOf = (id: string) => playerById.get(id)?.pseudo ?? '?';

  const check = useMemo(() => {
    if (!draft || !players) return null;
    return checkDraft(draft, players, games, teamCount, tournament.complexity_tolerance, pseudoOf, (i) => teamColor(i).name);
  }, [draft, players, games, teamCount, tournament.complexity_tolerance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!players) return <p className="muted">{error ?? 'Chargement…'}</p>;

  const status = tournament.status;
  const canEdit = status === 'brouillon' || status === 'publie';

  function generate() {
    setError(null);
    setConfirmRegen(false);
    try {
      const d = distribute({
        players: players!.map((p) => ({ id: p.id, level: p.level })),
        games,
        teamCount,
        tolerance: tournament.complexity_tolerance,
        seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      });
      setDraft(draftFromDistribution(d));
    } catch (e) {
      setError(e instanceof DistributionError ? e.message : `Erreur inattendue : ${(e as Error).message}`);
    }
  }

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await saveDraft(tournament.id, draft!, teamCount);
      setDirty(false);
    }, status === 'publie' ? 'Enregistré. Les joueurs voient déjà la nouvelle version.' : 'Répartition enregistrée.');

  const setStatus = (s: typeof status, msg: string) =>
    run(async () => {
      await updateTournament(tournament.id, { status: s });
      await reloadTournament();
    }, msg);

  async function addLate(e: FormEvent) {
    e.preventDefault();
    if (!latePseudo.trim()) { setError('Indique le pseudo du retardataire.'); return; }
    await run(async () => {
      const { animal } = await addLatePlayer(tournament.id, latePseudo, Number(lateLevel));
      setPlayers(await fetchPlayers(tournament.id));
      setLatePseudo('');
      setNotice(`${latePseudo.trim()} ajouté (animal secret : ${animal}). Place-le à une table ci-dessous.`);
    });
  }

  const tableAvg = (ids: string[]) => (ids.length ? ids.reduce((s, id) => s + (playerById.get(id)?.level ?? 0), 0) / ids.length : 0);
  const usedBy = new Map<string, number>();
  draft?.tables.forEach((t, i) => {
    if (t.gameId) usedBy.set(t.gameId, i + 1);
    if (t.secondGameId) usedBy.set(t.secondGameId, i + 1);
  });

  const gameOptions = (avg: number, tableNumber: number) =>
    [...games]
      .sort((a, b) => Math.abs(a.complexity - avg) - Math.abs(b.complexity - avg) || a.name.localeCompare(b.name, 'fr'))
      .map((g) => {
        const other = usedBy.get(g.id);
        const taken = other !== undefined && other !== tableNumber ? ` · table ${other}` : '';
        return (
          <option key={g.id} value={g.id}>
            {g.name} ({g.complexity} · {g.min_players}–{g.max_players} j.){taken}
          </option>
        );
      });

  const teamStats = Array.from({ length: teamCount }, (_, i) => {
    const ids = draft ? draft.tables.flatMap((t) => t.playerIds).filter((id) => draft.teamOf[id] === i) : [];
    return { i, n: ids.length, avg: tableAvg(ids) };
  });

  return (
    <div className="stack">
      <div className="row-wrap space-between">
        <div>
          <h1 className="h-admin">Répartition</h1>
          <p className="muted">
            {players.length} joueurs · {teamCount} équipes · tolérance ± {tournament.complexity_tolerance}
            {draft && ` · ${draft.tables.filter((t) => t.playerIds.length).length} tables`}
          </p>
        </div>
        <span className={`status status-${status}`}>
          {status === 'inscriptions' && 'Inscriptions ouvertes'}
          {status === 'brouillon' && (dirty || !draft ? 'Brouillon' : 'Brouillon · non visible des joueurs')}
          {status === 'publie' && 'Publiée · visible des joueurs'}
          {status === 'termine' && 'Terminé'}
        </span>
      </div>

      {status === 'inscriptions' && (
        <div className="card stack-sm">
          <p>Les inscriptions sont encore ouvertes. Clos-les pour figer la liste avant de générer les tables.</p>
          <div><button type="button" className="btn btn-sm" disabled={busy} onClick={() => setStatus('brouillon', 'Inscriptions closes.')}>Clore les inscriptions</button></div>
        </div>
      )}

      {canEdit && (
        <div className="card row-wrap toolbar">
          {!confirmRegen ? (
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy}
              onClick={() => (draft ? setConfirmRegen(true) : generate())}>
              {draft ? 'Regénérer' : 'Générer la répartition'}
            </button>
          ) : (
            <span className="row-wrap">
              <span className="small">Remplacer la répartition actuelle{status === 'publie' ? ' (déjà publiée)' : ''} ?</span>
              <button type="button" className="btn btn-sm btn-danger" onClick={generate}>Oui, regénérer</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRegen(false)}>Annuler</button>
            </span>
          )}
          {draft && (
            <button type="button" className="btn btn-sm" disabled={busy || !dirty || (check?.errors.length ?? 0) > 0} onClick={save}>
              {dirty ? 'Enregistrer' : 'Enregistré'}
            </button>
          )}
          {draft && dirty && <button type="button" className="btn-link" disabled={busy} onClick={load}>Annuler les modifications</button>}
          <span className="grow" />
          {status === 'brouillon' && draft && (
            <button type="button" className="btn btn-sm" disabled={busy || dirty}
              title={dirty ? 'Enregistre d’abord' : undefined}
              onClick={() => setStatus('publie', 'Répartition publiée : chaque joueur voit son équipe et sa table.')}>
              Publier aux joueurs
            </button>
          )}
          {status === 'publie' && (
            <button type="button" className="btn-link danger" disabled={busy} onClick={() => setStatus('brouillon', 'Publication retirée.')}>
              Retirer la publication
            </button>
          )}
        </div>
      )}

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
      {check && (check.errors.length > 0 || check.warnings.length > 0) && (
        <div className="stack-sm">
          {check.errors.length > 0 && (
            <ul className="alert" aria-label="À corriger avant d’enregistrer">{check.errors.map((m) => <li key={m}>{m}</li>)}</ul>
          )}
          {check.warnings.length > 0 && (
            <ul className="warn" aria-label="Points d’attention">{check.warnings.map((m) => <li key={m}>{m}</li>)}</ul>
          )}
        </div>
      )}

      {draft && (
        <div className="row-wrap">
          {teamStats.map((t) => (
            <span key={t.i} className="card team-chip">
              <span className="dot" style={{ background: teamColor(t.i).hex }} aria-hidden="true" />
              <strong>{teamColor(t.i).name}</strong>
              <span className="muted small">{t.n} joueurs · niv. moy. {t.n ? fmt(t.avg) : '–'}</span>
            </span>
          ))}
        </div>
      )}

      {draft && (
        <div className="tables-grid">
          {draft.tables.map((t, idx) => {
            const n = idx + 1;
            const avg = tableAvg(t.playerIds);
            const tier = t.playerIds.length ? tierOf(Math.min(10, Math.max(1, Math.round(avg)))) : null;
            const showSecond = (t.playerIds.length > 0 && avg <= 3.5) || !!t.secondGameId;
            const setTable = (patch: Partial<typeof t>) =>
              setDraft({ ...draft, tables: draft.tables.map((x) => (x.key === t.key ? { ...x, ...patch } : x)) });
            return (
              <section key={t.key} className="card table-card" aria-labelledby={`tc-${t.key}`}>
                <div className="row-wrap space-between">
                  <h2 id={`tc-${t.key}`} className="h-section">Table {n}</h2>
                  {tier && <span className={`chip-sm chip-${tier.key}`}>{tier.label} · {fmt(avg)}</span>}
                </div>
                <label className="sr-only" htmlFor={`g1-${t.key}`}>Jeu de la table {n}</label>
                <select id={`g1-${t.key}`} className="input input-xs wide" disabled={!canEdit} value={t.gameId ?? ''}
                  onChange={(e) => setTable({ gameId: e.target.value || null })}>
                  <option value="">— Aucun jeu —</option>
                  {gameOptions(avg, n)}
                </select>
                {showSecond && (
                  <>
                    <label className="small muted" htmlFor={`g2-${t.key}`}>2e sous-manche</label>
                    <select id={`g2-${t.key}`} className="input input-xs wide" disabled={!canEdit} value={t.secondGameId ?? ''}
                      onChange={(e) => setTable({ secondGameId: e.target.value || null })}>
                      <option value="">— Pas de 2e jeu —</option>
                      {gameOptions(avg, n)}
                    </select>
                  </>
                )}
                <ul className="seat-list">
                  {t.playerIds.map((pid) => {
                    const p = playerById.get(pid);
                    const team = draft.teamOf[pid];
                    return (
                      <li key={pid} className="seat">
                        <span className="dot" style={{ background: team !== undefined ? teamColor(team).hex : '#ccc' }} aria-hidden="true" />
                        <span className="seat-name">{p?.pseudo ?? '?'} <span className="muted small">{p?.level}</span></span>
                        <label className="sr-only" htmlFor={`team-${pid}`}>Équipe de {p?.pseudo}</label>
                        <select id={`team-${pid}`} className="input input-xs" disabled={!canEdit} value={team ?? ''}
                          onChange={(e) => setDraft({ ...draft, teamOf: { ...draft.teamOf, [pid]: Number(e.target.value) } })}>
                          {Array.from({ length: teamCount }, (_, i) => <option key={i} value={i}>{teamColor(i).name}</option>)}
                        </select>
                        <label className="sr-only" htmlFor={`mv-${pid}`}>Déplacer {p?.pseudo}</label>
                        <select id={`mv-${pid}`} className="input input-xs" disabled={!canEdit} value={t.key}
                          onChange={(e) => setDraft(movePlayer(draft, pid, e.target.value || null))}>
                          {draft.tables.map((x, i) => <option key={x.key} value={x.key}>Table {i + 1}</option>)}
                          <option value="">Non placé</option>
                        </select>
                      </li>
                    );
                  })}
                </ul>
                {t.playerIds.length === 0 && (
                  <div className="row-wrap">
                    <span className="muted small">Table vide (ignorée à l’enregistrement).</span>
                    <button type="button" className="btn-link danger" onClick={() => setDraft({ ...draft, tables: draft.tables.filter((x) => x.key !== t.key) })}>Supprimer</button>
                  </div>
                )}
              </section>
            );
          })}
          {canEdit && (
            <button type="button" className="card add-table"
              onClick={() => setDraft({ ...draft, tables: [...draft.tables, { key: newTableKey(), gameId: null, secondGameId: null, playerIds: [] }] })}>
              + Ajouter une table
            </button>
          )}
        </div>
      )}

      {draft && check && check.unplaced.length > 0 && (
        <section className="card stack-sm" aria-labelledby="unplaced">
          <h2 id="unplaced" className="h-section">Non placés</h2>
          <ul className="seat-list">
            {check.unplaced.map((pid) => {
              const p = playerById.get(pid);
              return (
                <li key={pid} className="seat">
                  <span className="seat-name">{p?.pseudo} <span className="muted small">{p?.level}</span></span>
                  <label className="sr-only" htmlFor={`place-${pid}`}>Placer {p?.pseudo}</label>
                  <select id={`place-${pid}`} className="input input-xs" disabled={!canEdit} value=""
                    onChange={(e) => {
                      const key = e.target.value;
                      if (!key) return;
                      const moved = movePlayer(draft, pid, key);
                      const team = draft.teamOf[pid] ?? suggestTeam(draft, key, teamCount);
                      setDraft({ ...moved, teamOf: { ...moved.teamOf, [pid]: team } });
                    }}>
                    <option value="">Placer à…</option>
                    {draft.tables.map((x, i) => <option key={x.key} value={x.key}>Table {i + 1} ({x.playerIds.length} j.)</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {canEdit && (
        <form className="card form-grid" onSubmit={addLate} noValidate aria-labelledby="late">
          <h2 id="late" className="h-section span-all">Ajouter un retardataire</h2>
          <div className="field span-2">
            <label htmlFor="late-pseudo">Pseudo</label>
            <input id="late-pseudo" className="input input-sm" maxLength={30} value={latePseudo} onChange={(e) => setLatePseudo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="late-level">Niveau</label>
            <select id="late-level" className="input input-sm" value={lateLevel} onChange={(e) => setLateLevel(e.target.value)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} · {tierOf(n).label}</option>)}
            </select>
          </div>
          <div className="field field-end">
            <button type="submit" className="btn btn-sm" disabled={busy}>Ajouter</button>
          </div>
        </form>
      )}
    </div>
  );
}
