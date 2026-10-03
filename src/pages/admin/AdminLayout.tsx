import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { signOut, useAdmin } from '../../lib/auth';
import { fetchAdminTournament, type AdminTournament } from '../../lib/adminApi';
import { formatEventDate } from '../../components/Hero';
import Login from './Login';

export type AdminContext = {
  tournament: AdminTournament;
  reloadTournament: () => Promise<void>;
};

export const useAdminContext = () => useOutletContext<AdminContext>();

export default function AdminLayout() {
  const admin = useAdmin();
  const [tournament, setTournament] = useState<AdminTournament | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reloadTournament = useCallback(async () => {
    try {
      setTournament(await fetchAdminTournament());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (admin.status === 'admin') reloadTournament();
  }, [admin.status, reloadTournament]);

  if (admin.status === 'loading') return <main className="admin-login"><p className="muted">Chargement…</p></main>;
  if (admin.status === 'signedOut') return <Login />;
  if (admin.status === 'notAdmin') {
    return (
      <main className="admin-login">
        <div className="card stack-sm">
          <h1 className="h-admin">Accès réservé</h1>
          <p>L’adresse <strong>{admin.email}</strong> n’est pas déclarée comme organisateur.</p>
          <p className="muted small">Demande à un organisateur de t’ajouter.</p>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Se déconnecter</button>
        </div>
      </main>
    );
  }

  const date = tournament ? formatEventDate(tournament.event_date) : null;

  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Administration">
        <div className="admin-brand">
          <strong>{tournament?.name ?? 'Tournoi'}</strong>
          <span>{date ?? 'Date à définir'}</span>
        </div>
        <NavLink to="/admin" end>Tournoi</NavLink>
        <NavLink to="/admin/jeux">Catalogue des jeux</NavLink>
        <NavLink to="/admin/inscrits">Inscrits</NavLink>
        <div className="admin-nav-foot">
          <span className="small">{admin.email}</span>
          <button type="button" className="link-on-dark small" onClick={signOut}>Se déconnecter</button>
        </div>
      </nav>
      <main className="admin-main">
        {error && <p className="alert" role="alert">{error}</p>}
        {tournament === undefined && !error && <p className="muted">Chargement…</p>}
        {tournament === null && <p className="card">Aucun tournoi en cours.</p>}
        {tournament && <Outlet context={{ tournament, reloadTournament } satisfies AdminContext} />}
      </main>
    </div>
  );
}
