import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../../components/Hero';
import { fetchCurrentTournament, fetchGames, type Game } from '../../lib/api';
import { TIERS, tierOf } from '../../lib/levels';
import { recalledToken } from '../../lib/playerStore';

export default function Jeux() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = recalledToken() ? `/moi/${recalledToken()}` : '/';

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchCurrentTournament();
        setGames(t ? await fetchGames(t.id) : []);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  return (
    <main className="page">
      <Hero eyebrow="Pour t’entraîner" title="Les jeux du tournoi" />
      {error && <p className="alert" role="alert">Impossible de charger les jeux : {error}</p>}
      {games === null && !error && <p className="muted">Chargement…</p>}
      {games && games.length === 0 && <p className="card">Le catalogue n’est pas encore publié.</p>}
      {games && games.length > 0 && (
        <div className="stack">
          {[...TIERS].reverse().map((tier) => {
            const list = games.filter((g) => tierOf(g.complexity).key === tier.key);
            if (list.length === 0) return null;
            return (
              <section key={tier.key} className="stack-sm" aria-labelledby={`t-${tier.key}`}>
                <h2 id={`t-${tier.key}`} className="h-section">
                  {tier.label} <span className="muted small">· complexité {tier.min} à {tier.max}</span>
                </h2>
                <ul className="list">
                  {list.map((g) => (
                    <li key={g.id} className="card game-row">
                      <span className={`cx cx-${tier.key}`}>{g.complexity}</span>
                      <span>
                        <strong>{g.name}</strong>
                        <br />
                        <span className="muted small">{g.min_players} à {g.max_players} joueurs · {g.duration_min} min</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="back"><Link to={back}>‹ Retour</Link></p>
    </main>
  );
}
