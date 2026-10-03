import { useEffect, useState } from 'react';
import { useAdminContext } from './AdminLayout';
import { fetchPlayers, removePlayer, updatePlayerLevel, type AdminPlayer } from '../../lib/adminApi';
import { tierOf } from '../../lib/levels';

export default function Inscrits() {
  const { tournament } = useAdminContext();
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetchPlayers(tournament.id).then(setPlayers).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, [tournament.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeLevel(id: string, level: number) {
    setError(null);
    try {
      await updatePlayerLevel(id, level);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await removePlayer(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <h1 className="h-admin">Inscrits</h1>
        <p className="muted">
          {players ? `${players.length} joueur${players.length > 1 ? 's' : ''}` : '…'} · l’animal secret permet à un joueur de retrouver son inscription
        </p>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Pseudo</th>
              <th scope="col">Niveau</th>
              <th scope="col">Animal secret</th>
              <th scope="col">Inscrit le</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {players?.length === 0 && <tr><td colSpan={5} className="muted">Personne pour l’instant.</td></tr>}
            {players?.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.pseudo}</strong></td>
                <td>
                  <label className="sr-only" htmlFor={`lvl-${p.id}`}>Niveau de {p.pseudo}</label>
                  <select id={`lvl-${p.id}`} className="input input-xs" value={p.level} onChange={(e) => changeLevel(p.id, Number(e.target.value))}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>{' '}
                  <span className="muted small">{tierOf(p.level).label}</span>
                </td>
                <td>{p.animal}</td>
                <td className="muted small">{new Date(p.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="actions">
                  {confirmDelete === p.id ? (
                    <>
                      <span className="small">Retirer {p.pseudo} ?</span>
                      <button type="button" className="btn-link danger" disabled={busy} onClick={() => remove(p.id)}>Oui</button>
                      <button type="button" className="btn-link" onClick={() => setConfirmDelete(null)}>Non</button>
                    </>
                  ) : (
                    <button type="button" className="btn-link danger" onClick={() => setConfirmDelete(p.id)}>Retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
