/**
 * Algorithme de répartition du tournoi (voir le document de règles).
 *
 * 1. Tailles de tables : 4 en priorité, quelques tables de 3 ou 5 pour absorber
 *    le reste. Une table ne dépasse jamais le nombre d'équipes.
 * 2. Tables homogènes : joueurs triés par niveau, découpés en paquets consécutifs.
 *    On essaie chaque position possible des tables irrégulières.
 * 3. Jeux : affectation de coût minimal (écart complexité / niveau moyen),
 *    dans la tolérance et la fourchette de joueurs de chaque jeu.
 *    Les tables familiales dont le jeu est rapide reçoivent un 2e jeu (2 sous-manches).
 * 4. Équipes : coéquipiers jamais à la même table, tailles égales à 1 près,
 *    niveaux répartis. Chaque table mélange donc des équipes différentes.
 *
 * Tout est déterministe pour une graine donnée : « Regénérer » change la graine.
 */
import { hungarian, seededRandom } from './util';

export type AlgoPlayer = { id: string; level: number };
export type AlgoGame = {
  id: string;
  complexity: number;
  min_players: number;
  max_players: number;
  duration_min: number;
};

export type AlgoTable = {
  number: number;
  playerIds: string[];
  avgLevel: number;
  gameId: string | null;
  secondGameId: string | null;
};

export type AlgoTeam = { index: number; playerIds: string[]; levelSum: number };

export type Distribution = {
  tables: AlgoTable[];
  teams: AlgoTeam[];
  /** Équipe de chaque joueur (indice dans `teams`). */
  teamOf: Record<string, number>;
  warnings: string[];
};

export type DistributionInput = {
  players: AlgoPlayer[];
  games: AlgoGame[];
  teamCount: number;
  tolerance: number;
  seed?: number;
};

export class DistributionError extends Error {}

const MIN_TABLE = 3;
const MAX_TABLE = 5;
/** Pénalité d'une table sans jeu compatible (bien plus forte qu'un écart de complexité). */
const NO_GAME_PENALTY = 1000;
/** Pénalité d'une table familiale rapide sans 2e jeu disponible. */
const NO_SECOND_GAME_PENALTY = 5;
/** Légère préférence pour les tables de 4. */
const IRREGULAR_PENALTY = 0.25;
/** Nombre maximal de dispositions de tables évaluées. */
const MAX_ARRANGEMENTS = 3000;

export const isQuick = (g: Pick<AlgoGame, 'complexity' | 'duration_min'>) => g.complexity <= 3 && g.duration_min <= 30;
const FAMILY_MAX_AVG = 3.5;

/** Combinaisons de tailles (nombre de tables de 3, 4, 5) dont la somme vaut n. */
export function sizeCombos(n: number, teamCount: number): { three: number; four: number; five: number }[] {
  const maxSize = Math.min(MAX_TABLE, teamCount);
  const combos: { three: number; four: number; five: number }[] = [];
  if (maxSize < 4) {
    // Avec 3 équipes, seules des tables de 3 sont possibles.
    if (maxSize === 3 && n % 3 === 0 && n >= 3) combos.push({ three: n / 3, four: 0, five: 0 });
    return combos;
  }
  for (let five = 0; five * 5 <= n && (five === 0 || maxSize >= 5); five++) {
    for (let three = 0; three * 3 + five * 5 <= n; three++) {
      const rest = n - three * 3 - five * 5;
      if (rest % 4 === 0) combos.push({ three, four: rest / 4, five });
    }
  }
  return combos
    .filter((c) => c.three + c.four + c.five > 0)
    .sort((a, b) => a.three + a.five - (b.three + b.five) || a.three - b.three);
}

/** Toutes les dispositions distinctes d'un multi-ensemble de tailles (plafonnées). */
function arrangements(counts: Record<number, number>, limit: number): number[][] {
  const out: number[][] = [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const cur: number[] = [];
  const rec = () => {
    if (out.length >= limit) return;
    if (cur.length === total) {
      out.push([...cur]);
      return;
    }
    for (const size of [4, 5, 3]) {
      if (counts[size] > 0) {
        counts[size]--;
        cur.push(size);
        rec();
        cur.pop();
        counts[size]++;
      }
    }
  };
  rec();
  return out;
}

type GameChoice = { gameIdx: (number | null)[]; secondIdx: (number | null)[]; cost: number };

/** Choix optimal des jeux pour une liste de tables (taille, niveau moyen). */
function chooseGames(tables: { size: number; avg: number }[], games: AlgoGame[], tolerance: number): GameChoice {
  const n = tables.length;
  const m = games.length;
  const fits = (t: { size: number; avg: number }, g: AlgoGame) =>
    t.size >= g.min_players && t.size <= g.max_players && Math.abs(g.complexity - t.avg) <= tolerance + 1e-9;

  // Colonnes : les vrais jeux, puis une colonne « sans jeu » par table.
  const matrix = tables.map((t) => [
    ...games.map((g) => (fits(t, g) ? Math.abs(g.complexity - t.avg) : NO_GAME_PENALTY * 10)),
    ...tables.map(() => NO_GAME_PENALTY),
  ]);
  const assignment = hungarian(matrix);
  const gameIdx = assignment.map((j) => (j < m ? j : null));
  let cost = assignment.reduce((s, j, i) => s + matrix[i][j], 0);

  // 2e jeu pour les tables familiales dont le jeu est rapide.
  const used = new Set(gameIdx.filter((j): j is number => j !== null));
  const secondIdx: (number | null)[] = new Array(n).fill(null);
  tables
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => gameIdx[i] !== null && t.avg <= FAMILY_MAX_AVG && isQuick(games[gameIdx[i]!]))
    .sort((a, b) => a.t.avg - b.t.avg)
    .forEach(({ t, i }) => {
      let best: number | null = null;
      for (let j = 0; j < m; j++) {
        if (used.has(j) || !isQuick(games[j]) || !fits(t, games[j])) continue;
        if (best === null || Math.abs(games[j].complexity - t.avg) < Math.abs(games[best].complexity - t.avg)) best = j;
      }
      if (best === null) {
        cost += NO_SECOND_GAME_PENALTY;
      } else {
        used.add(best);
        secondIdx[i] = best;
        cost += Math.abs(games[best].complexity - t.avg);
      }
    });

  return { gameIdx, secondIdx, cost };
}

export function distribute(input: DistributionInput): Distribution {
  const { players, games, teamCount, tolerance } = input;
  const rand = seededRandom(input.seed ?? 1);
  const n = players.length;

  if (teamCount < 3) throw new DistributionError('Il faut au moins 3 équipes.');
  if (n < MIN_TABLE) throw new DistributionError(`Il faut au moins ${MIN_TABLE} joueurs.`);

  const combos = sizeCombos(n, teamCount);
  if (combos.length === 0) {
    throw new DistributionError(
      `Impossible de former des tables de 3 à ${Math.min(MAX_TABLE, teamCount)} joueurs avec ${n} joueurs et ${teamCount} équipes. ` +
        'Augmente le nombre d’équipes, ou ajoute ou retire un joueur.',
    );
  }

  // Tri par niveau décroissant ; à niveau égal, ordre tiré au sort.
  const sorted = players
    .map((p) => ({ ...p, r: rand() }))
    .sort((a, b) => b.level - a.level || a.r - b.r);

  // On évalue les combinaisons les plus régulières (et la suivante, au cas où
  // des tables irrégulières permettraient de mieux placer les jeux).
  const minIrregular = combos[0].three + combos[0].five;
  const candidates = combos.filter((c) => c.three + c.five <= minIrregular + 1);

  let best: { sizes: number[]; choice: GameChoice; score: number } | null = null;
  let evaluated = 0;
  for (const c of candidates) {
    const layouts = arrangements({ 3: c.three, 4: c.four, 5: c.five }, MAX_ARRANGEMENTS - evaluated);
    for (const sizes of layouts) {
      evaluated++;
      let offset = 0;
      const tables = sizes.map((size) => {
        const levels = sorted.slice(offset, offset + size).map((p) => p.level);
        offset += size;
        return { size, avg: levels.reduce((a, b) => a + b, 0) / size };
      });
      const choice = chooseGames(tables, games, tolerance);
      const score = choice.cost + IRREGULAR_PENALTY * (c.three + c.five);
      if (!best || score < best.score - 1e-9) best = { sizes, choice, score };
    }
    if (evaluated >= MAX_ARRANGEMENTS) break;
  }
  if (!best) throw new DistributionError('Aucune disposition de tables trouvée.');

  // Construction des tables.
  const tables: AlgoTable[] = [];
  let offset = 0;
  best.sizes.forEach((size, i) => {
    const members = sorted.slice(offset, offset + size);
    offset += size;
    const gi = best!.choice.gameIdx[i];
    const si = best!.choice.secondIdx[i];
    tables.push({
      number: i + 1,
      playerIds: members.map((p) => p.id),
      avgLevel: members.reduce((a, p) => a + p.level, 0) / size,
      gameId: gi === null ? null : games[gi].id,
      secondGameId: si === null ? null : games[si].id,
    });
  });

  // Équipes : tables de la plus forte à la plus faible, chaque joueur dans
  // l'équipe absente de sa table qui a le moins de membres, puis le plus petit
  // total de niveaux.
  const teams: AlgoTeam[] = Array.from({ length: teamCount }, (_, index) => ({ index, playerIds: [], levelSum: 0 }));
  const teamOf: Record<string, number> = {};
  const levelOf = new Map(players.map((p) => [p.id, p.level]));
  for (const table of tables) {
    const present = new Set<number>();
    for (const pid of table.playerIds) {
      const choices = teams
        .filter((t) => !present.has(t.index))
        .map((t) => ({ t, r: rand() }))
        .sort((a, b) => a.t.playerIds.length - b.t.playerIds.length || a.t.levelSum - b.t.levelSum || a.r - b.r);
      const team = choices[0].t;
      team.playerIds.push(pid);
      team.levelSum += levelOf.get(pid)!;
      teamOf[pid] = team.index;
      present.add(team.index);
    }
  }

  // Avertissements pour l'admin.
  const warnings: string[] = [];
  for (const t of tables) {
    if (!t.gameId) {
      warnings.push(
        `Table ${t.number} (${t.playerIds.length} joueurs, niveau moyen ${t.avgLevel.toFixed(1).replace('.', ',')}) : aucun jeu compatible, à choisir à la main.`,
      );
    } else if (t.avgLevel <= FAMILY_MAX_AVG && isQuick(games.find((g) => g.id === t.gameId)!) && !t.secondGameId) {
      warnings.push(`Table ${t.number} : jeu rapide mais pas de 2e jeu disponible pour la 2e sous-manche.`);
    }
  }

  return { tables, teams, teamOf, warnings };
}
