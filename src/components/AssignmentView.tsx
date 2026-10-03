import type { Assignment } from '../lib/api';
import { textOn } from '../lib/teams';

/** Équipe et table du joueur, une fois la répartition publiée. */
export default function AssignmentView({ a }: { a: Assignment }) {
  if (!a.placed) {
    return (
      <p className="info">
        La répartition est publiée, mais tu n’es pas encore placé à une table. Va voir un organisateur.
      </p>
    );
  }
  const { team, table } = a;
  const mates = team.members.filter((m) => !m.me);
  return (
    <div className="stack">
      <section className="team-banner" style={{ background: team.hex, color: textOn(team.hex) }} aria-labelledby="team-title">
        <p className="small">Tu joues pour</p>
        <h2 id="team-title">Équipe {team.name}</h2>
        <p className="small">{team.members.length} membres</p>
      </section>

      <section className="card stack-sm" aria-labelledby="table-title">
        <p className="eyebrow muted">Ta table</p>
        <div className="row-wrap space-between">
          <h2 id="table-title" className="h-table">Table {table.number}</h2>
          {table.complexity !== null && <span className="muted small">Complexité {table.complexity}/10</span>}
        </div>
        <p className="table-game">
          {table.game ?? 'Jeu à confirmer par les organisateurs'}
          {table.second_game && <span className="muted small"> puis {table.second_game}</span>}
        </p>
        <ul className="list-plain">
          {table.players.map((p) => (
            <li key={p.pseudo} className="seat">
              <span className="dot" style={{ background: p.hex }} aria-hidden="true" />
              <span className="seat-name">{p.me ? <strong>{p.pseudo} (toi)</strong> : p.pseudo}</span>
              <span className="muted small">Équipe {p.team}</span>
            </li>
          ))}
        </ul>
      </section>

      {mates.length > 0 && (
        <section className="stack-sm" aria-labelledby="mates-title">
          <h2 id="mates-title" className="h-section">Tes coéquipiers</h2>
          <ul className="list">
            {mates.map((m) => (
              <li key={m.pseudo} className="card">
                <strong>{m.pseudo}</strong> <span className="muted small">· niveau {m.level}</span>
                <br />
                <span className="muted small">
                  Table {m.table}
                  {m.game && ` · ${m.game}`}
                  {m.second_game && ` puis ${m.second_game}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
