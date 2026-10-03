import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAdminContext } from './AdminLayout';
import { createGame, deleteGame, updateGame } from '../../lib/adminApi';
import { fetchGames, type Game } from '../../lib/api';
import { emptyDraft, isQuickFamilyGame, parseGame, toDraft, type GameDraft } from '../../lib/games';
import { tierOf } from '../../lib/levels';

function GameFields({ draft, onChange, idPrefix }: { draft: GameDraft; onChange: (d: GameDraft) => void; idPrefix: string }) {
  const set = (k: keyof GameDraft) => (e: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [k]: e.target.value });
  return (
    <>
      <div className="field span-2">
        <label htmlFor={`${idPrefix}-name`}>Nom du jeu</label>
        <input id={`${idPrefix}-name`} className="input input-sm" maxLength={80} value={draft.name} onChange={set('name')} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-cx`}>Complexité (1–10)</label>
        <input id={`${idPrefix}-cx`} className="input input-sm" inputMode="numeric" value={draft.complexity} onChange={set('complexity')} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-min`}>Joueurs min</label>
        <input id={`${idPrefix}-min`} className="input input-sm" inputMode="numeric" value={draft.min_players} onChange={set('min_players')} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-max`}>Joueurs max</label>
        <input id={`${idPrefix}-max`} className="input input-sm" inputMode="numeric" value={draft.max_players} onChange={set('max_players')} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-dur`}>Durée (min)</label>
        <input id={`${idPrefix}-dur`} className="input input-sm" inputMode="numeric" value={draft.duration_min} onChange={set('duration_min')} />
      </div>
    </>
  );
}

export default function Jeux() {
  const { tournament } = useAdminContext();
  const [games, setGames] = useState<Game[] | null>(null);
  const [draft, setDraft] = useState<GameDraft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; draft: GameDraft; errors: string[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetchGames(tournament.id).then(setGames).catch((e) => setErrors([(e as Error).message]));
  useEffect(() => { load(); }, [tournament.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: FormEvent) {
    e.preventDefault();
    const r = parseGame(draft);
    if (!r.ok) { setErrors(r.errors); return; }
    setBusy(true);
    try {
      await createGame(tournament.id, r.game);
      setDraft(emptyDraft);
      setErrors([]);
      await load();
      document.getElementById('add-name')?.focus();
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const r = parseGame(editing.draft);
    if (!r.ok) { setEditing({ ...editing, errors: r.errors }); return; }
    setBusy(true);
    try {
      await updateGame(editing.id, r.game);
      setEditing(null);
      await load();
    } catch (err) {
      setEditing({ ...editing, errors: [(err as Error).message] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteGame(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 className="h-admin">Catalogue des jeux</h1>
        <p className="muted">
          {games ? `${games.length} jeu${games.length > 1 ? 'x' : ''}` : '…'} · visibles par les joueurs pour s’entraîner · pas de jeux coopératifs ·
          un exemplaire par ligne (ajoute deux fois un jeu présent en double)
        </p>
      </div>

      <form className="card form-grid" onSubmit={add} noValidate aria-labelledby="add-title">
        <h2 id="add-title" className="h-section span-all">Ajouter un jeu</h2>
        <GameFields draft={draft} onChange={setDraft} idPrefix="add" />
        <div className="field field-end">
          <button type="submit" className="btn btn-sm" disabled={busy}>Ajouter</button>
        </div>
        {errors.length > 0 && (
          <ul className="alert span-all" role="alert">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </form>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Jeu</th>
              <th scope="col">Complexité</th>
              <th scope="col">Joueurs</th>
              <th scope="col">Durée</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {games?.length === 0 && (
              <tr><td colSpan={5} className="muted">Aucun jeu pour l’instant.</td></tr>
            )}
            {games?.map((g) =>
              editing?.id === g.id ? (
                <tr key={g.id}>
                  <td colSpan={5}>
                    <form className="form-grid" onSubmit={saveEdit} noValidate>
                      <GameFields draft={editing.draft} onChange={(d) => setEditing({ ...editing, draft: d })} idPrefix={`e-${g.id}`} />
                      <div className="field field-end row-wrap">
                        <button type="submit" className="btn btn-sm" disabled={busy}>Enregistrer</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
                      </div>
                      {editing.errors.length > 0 && (
                        <ul className="alert span-all" role="alert">{editing.errors.map((m) => <li key={m}>{m}</li>)}</ul>
                      )}
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={g.id}>
                  <td><strong>{g.name}</strong></td>
                  <td>
                    <span className={`cx cx-sm cx-${tierOf(g.complexity).key}`}>{g.complexity}</span>{' '}
                    <span className="muted small">{tierOf(g.complexity).label}</span>
                  </td>
                  <td>{g.min_players} – {g.max_players}</td>
                  <td>
                    {g.duration_min} min
                    {isQuickFamilyGame(g) && <span className="badge">Rapide · 2 sous-manches</span>}
                  </td>
                  <td className="actions">
                    {confirmDelete === g.id ? (
                      <>
                        <span className="small">Supprimer ?</span>
                        <button type="button" className="btn-link danger" disabled={busy} onClick={() => remove(g.id)}>Oui</button>
                        <button type="button" className="btn-link" onClick={() => setConfirmDelete(null)}>Non</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-link" onClick={() => setEditing({ id: g.id, draft: toDraft(g), errors: [] })}>Modifier</button>
                        <button type="button" className="btn-link danger" onClick={() => setConfirmDelete(g.id)}>Supprimer</button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
