/**
 * Brouillon de répartition modifiable par l'admin, et ses contrôles.
 * Les « erreurs » empêchent d'enregistrer (la base les refuserait) ;
 * les « alertes » sont des avertissements que l'admin peut accepter.
 */
import type { AlgoGame, AlgoPlayer, Distribution } from './distribution';
import { isQuick } from './distribution';

export type DraftTable = { key: string; gameId: string | null; secondGameId: string | null; playerIds: string[] };
export type Draft = { tables: DraftTable[]; teamOf: Record<string, number> };

let keySeq = 0;
export const newTableKey = () => `t${++keySeq}-${Date.now()}`;

export function draftFromDistribution(d: Distribution): Draft {
  return {
    tables: d.tables.map((t) => ({ key: newTableKey(), gameId: t.gameId, secondGameId: t.secondGameId, playerIds: [...t.playerIds] })),
    teamOf: { ...d.teamOf },
  };
}

export type Check = { errors: string[]; warnings: string[]; unplaced: string[] };

export function checkDraft(
  draft: Draft,
  players: AlgoPlayer[],
  games: (AlgoGame & { name: string })[],
  teamCount: number,
  tolerance: number,
  pseudoOf: (id: string) => string,
  colorName: (team: number) => string,
): Check {
  const errors: string[] = [];
  const warnings: string[] = [];
  const level = new Map(players.map((p) => [p.id, p.level]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  const placed = new Set<string>();
  const usedGames = new Map<string, number>();

  const tables = draft.tables.filter((t) => t.playerIds.length > 0);
  tables.forEach((t, i) => {
    const n = i + 1;
    const size = t.playerIds.length;
    t.playerIds.forEach((id) => placed.add(id));

    // Coéquipiers à la même table : interdit.
    const byTeam = new Map<number, string[]>();
    for (const id of t.playerIds) {
      const team = draft.teamOf[id];
      if (team === undefined) {
        errors.push(`Table ${n} : ${pseudoOf(id)} n’a pas d’équipe.`);
        continue;
      }
      byTeam.set(team, [...(byTeam.get(team) ?? []), id]);
    }
    for (const [team, ids] of byTeam) {
      if (ids.length > 1) {
        errors.push(`Table ${n} : ${ids.map(pseudoOf).join(' et ')} sont tous deux dans l’équipe ${colorName(team)}.`);
      }
    }

    if (size < 3 || size > 5) warnings.push(`Table ${n} : ${size} joueur${size > 1 ? 's' : ''} (prévu : 3 à 5).`);

    const avg = t.playerIds.reduce((s, id) => s + (level.get(id) ?? 0), 0) / size;
    for (const [slot, gid] of [['', t.gameId], [' (2e jeu)', t.secondGameId]] as const) {
      if (!gid) continue;
      const g = gameById.get(gid);
      if (!g) continue;
      usedGames.set(gid, (usedGames.get(gid) ?? 0) + 1);
      if (size < g.min_players || size > g.max_players) {
        warnings.push(`Table ${n}${slot} : ${g.name} se joue de ${g.min_players} à ${g.max_players}, la table compte ${size} joueurs.`);
      }
      if (Math.abs(g.complexity - avg) > tolerance + 1e-9) {
        warnings.push(`Table ${n}${slot} : ${g.name} (complexité ${g.complexity}) est loin du niveau moyen ${avg.toFixed(1).replace('.', ',')}.`);
      }
    }
    if (!t.gameId) warnings.push(`Table ${n} : aucun jeu choisi.`);
    if (t.secondGameId && !t.gameId) errors.push(`Table ${n} : un 2e jeu sans 1er jeu.`);
    const first = t.gameId ? gameById.get(t.gameId) : undefined;
    if (first && avg <= 3.5 && isQuick(first) && !t.secondGameId) {
      warnings.push(`Table ${n} : jeu rapide, pense à un 2e jeu pour la 2e sous-manche.`);
    }
  });

  for (const [gid, count] of usedGames) {
    if (count > 1) errors.push(`${gameById.get(gid)?.name ?? 'Un jeu'} est attribué à ${count} tables (un seul exemplaire).`);
  }

  const counts = Array.from({ length: teamCount }, () => 0);
  for (const id of placed) {
    const team = draft.teamOf[id];
    if (team !== undefined && team < teamCount) counts[team]++;
  }
  if (placed.size > 0 && Math.max(...counts) - Math.min(...counts) > 1) {
    warnings.push(`Équipes déséquilibrées : ${counts.map((c, i) => `${colorName(i)} ${c}`).join(', ')}.`);
  }

  const unplaced = players.filter((p) => !placed.has(p.id)).map((p) => p.id);
  if (unplaced.length > 0) {
    warnings.push(`${unplaced.length} joueur${unplaced.length > 1 ? 's' : ''} non placé${unplaced.length > 1 ? 's' : ''} : ${unplaced.map(pseudoOf).join(', ')}.`);
  }

  return { errors, warnings, unplaced };
}

/** Déplace un joueur vers une table (ou le retire si `tableKey` est null). */
export function movePlayer(draft: Draft, playerId: string, tableKey: string | null): Draft {
  return {
    ...draft,
    tables: draft.tables.map((t) => {
      const without = t.playerIds.filter((id) => id !== playerId);
      return t.key === tableKey ? { ...t, playerIds: [...without, playerId] } : { ...t, playerIds: without };
    }),
  };
}

/** Équipe la moins représentée qui n'est pas déjà à cette table (pour placer un retardataire). */
export function suggestTeam(draft: Draft, tableKey: string, teamCount: number): number {
  const table = draft.tables.find((t) => t.key === tableKey);
  const present = new Set((table?.playerIds ?? []).map((id) => draft.teamOf[id]));
  const counts = Array.from({ length: teamCount }, () => 0);
  for (const t of draft.tables) for (const id of t.playerIds) if (draft.teamOf[id] !== undefined) counts[draft.teamOf[id]]++;
  const candidates = counts.map((c, i) => ({ c, i })).filter(({ i }) => !present.has(i));
  const pool = candidates.length > 0 ? candidates : counts.map((c, i) => ({ c, i }));
  return pool.sort((a, b) => a.c - b.c || a.i - b.i)[0].i;
}
