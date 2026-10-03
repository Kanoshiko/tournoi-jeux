import { describe, expect, it } from 'vitest';
import { distribute, DistributionError, sizeCombos, type AlgoGame, type AlgoPlayer, type Distribution } from './distribution';
import { hungarian, seededRandom } from './util';

const players = (levels: number[]): AlgoPlayer[] => levels.map((level, i) => ({ id: `p${i + 1}`, level }));

let gid = 0;
const game = (complexity: number, min = 2, max = 4, duration = 60): AlgoGame => ({
  id: `g${++gid}-c${complexity}`,
  complexity,
  min_players: min,
  max_players: max,
  duration_min: duration,
});

/** Un catalogue large : 2 jeux par complexité, de 2 à 5 joueurs, plus des jeux familiaux rapides. */
const wideCatalog = (): AlgoGame[] => [
  ...Array.from({ length: 10 }, (_, i) => game(i + 1, 2, 5, 60)),
  ...Array.from({ length: 10 }, (_, i) => game(i + 1, 3, 4, 90)),
  game(1, 2, 5, 15),
  game(1, 2, 6, 20),
  game(2, 2, 5, 20),
  game(2, 3, 5, 25),
];

/** Vérifie toutes les règles du document sur une répartition. */
function checkRules(d: Distribution, ps: AlgoPlayer[], games: AlgoGame[], teamCount: number, tolerance: number) {
  const level = new Map(ps.map((p) => [p.id, p.level]));

  // Chaque joueur est placé exactement une fois.
  const placed = d.tables.flatMap((t) => t.playerIds);
  expect(placed.sort()).toEqual(ps.map((p) => p.id).sort());

  // Tables de 3 à 5, jamais plus que le nombre d'équipes.
  for (const t of d.tables) {
    expect(t.playerIds.length).toBeGreaterThanOrEqual(3);
    expect(t.playerIds.length).toBeLessThanOrEqual(Math.min(5, teamCount));
  }

  // Tables homogènes : la table suivante ne contient personne de plus fort.
  for (let i = 1; i < d.tables.length; i++) {
    const prevMin = Math.min(...d.tables[i - 1].playerIds.map((id) => level.get(id)!));
    const curMax = Math.max(...d.tables[i].playerIds.map((id) => level.get(id)!));
    expect(curMax).toBeLessThanOrEqual(prevMin);
  }

  // Jeux : compatibles, chacun utilisé une seule fois.
  const used = new Set<string>();
  for (const t of d.tables) {
    for (const id of [t.gameId, t.secondGameId]) {
      if (!id) continue;
      expect(used.has(id)).toBe(false);
      used.add(id);
      const g = games.find((x) => x.id === id)!;
      expect(t.playerIds.length).toBeGreaterThanOrEqual(g.min_players);
      expect(t.playerIds.length).toBeLessThanOrEqual(g.max_players);
      expect(Math.abs(g.complexity - t.avgLevel)).toBeLessThanOrEqual(tolerance + 1e-9);
    }
    if (t.secondGameId) expect(t.gameId).not.toBeNull();
  }

  // Équipes : coéquipiers jamais à la même table, tailles égales à 1 près.
  for (const t of d.tables) {
    const teamsHere = t.playerIds.map((id) => d.teamOf[id]);
    expect(new Set(teamsHere).size).toBe(teamsHere.length);
  }
  const sizes = d.teams.map((t) => t.playerIds.length);
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  expect(d.teams).toHaveLength(teamCount);
}

describe('hungarian', () => {
  it('trouve l’affectation de coût minimal', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const a = hungarian(cost);
    expect(a.reduce((s, j, i) => s + cost[i][j], 0)).toBe(5);
  });
  it('gère plus de colonnes que de lignes', () => {
    expect(hungarian([[5, 1, 9]])).toEqual([1]);
  });
});

describe('sizeCombos', () => {
  it('préfère les tables de 4', () => {
    expect(sizeCombos(16, 4)[0]).toEqual({ three: 0, four: 4, five: 0 });
  });
  it('sans tables de 5 quand il n’y a que 4 équipes', () => {
    expect(sizeCombos(18, 4)[0]).toEqual({ three: 2, four: 3, five: 0 });
    expect(sizeCombos(17, 4).every((c) => c.five === 0)).toBe(true);
  });
  it('utilise une table de 5 quand c’est possible', () => {
    expect(sizeCombos(17, 5)[0]).toEqual({ three: 0, four: 3, five: 1 });
  });
  it('signale les cas impossibles', () => {
    expect(sizeCombos(5, 4)).toEqual([]);
    expect(sizeCombos(2, 5)).toEqual([]);
  });
});

describe('distribute : exemple du document (18 joueurs, 4 équipes)', () => {
  const ps = players([10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3, 2, 1]);
  const games = wideCatalog();
  const d = distribute({ players: ps, games, teamCount: 4, tolerance: 2, seed: 42 });

  it('forme 3 tables de 4 et 2 tables de 3', () => {
    expect(d.tables.map((t) => t.playerIds.length).sort()).toEqual([3, 3, 4, 4, 4]);
  });
  it('respecte toutes les règles', () => {
    checkRules(d, ps, games, 4, 2);
  });
  it('trouve un jeu pour chaque table', () => {
    expect(d.tables.every((t) => t.gameId)).toBe(true);
    expect(d.warnings).toEqual([]);
  });
  it('équipes de 5, 5, 4 et 4', () => {
    expect(d.teams.map((t) => t.playerIds.length).sort()).toEqual([4, 4, 5, 5]);
  });
});

describe('distribute : jeux', () => {
  it('donne un 2e jeu rapide aux tables familiales', () => {
    const ps = players([2, 2, 1, 1]);
    const games = [game(1, 2, 5, 15), game(2, 2, 5, 20), game(9, 2, 4, 120)];
    const d = distribute({ players: ps, games, teamCount: 4, tolerance: 2 });
    expect(d.tables[0].gameId).not.toBeNull();
    expect(d.tables[0].secondGameId).not.toBeNull();
  });

  it('ne donne pas de 2e jeu à une table initiée, même avec un jeu court', () => {
    const ps = players([5, 5, 4, 4]);
    const games = [game(4, 2, 4, 30), game(5, 2, 4, 25)];
    const d = distribute({ players: ps, games, teamCount: 4, tolerance: 2 });
    expect(d.tables[0].secondGameId).toBeNull();
  });

  it('signale une table sans jeu compatible au lieu d’échouer', () => {
    const ps = players([10, 10, 9, 9, 2, 2, 1, 1]);
    const games = [game(9, 2, 4, 120)];
    const d = distribute({ players: ps, games, teamCount: 4, tolerance: 2 });
    expect(d.tables[0].gameId).not.toBeNull();
    expect(d.tables[1].gameId).toBeNull();
    expect(d.warnings[0]).toMatch(/Table 2/);
  });

  it('place les tables irrégulières là où un jeu les accepte', () => {
    // 17 joueurs, 5 équipes : une table de 5, seul le jeu familial accepte 5 joueurs.
    const ps = players([10, 10, 9, 9, 7, 7, 6, 6, 5, 5, 4, 4, 2, 2, 1, 1, 1]);
    const games = [game(9, 3, 4), game(7, 3, 4), game(5, 3, 4), game(4, 3, 4), game(1, 3, 5)];
    const d = distribute({ players: ps, games, teamCount: 5, tolerance: 2 });
    const five = d.tables.find((t) => t.playerIds.length === 5)!;
    expect(five.number).toBe(d.tables.length);
    expect(d.tables.every((t) => t.gameId)).toBe(true);
  });
});

describe('distribute : cas limites', () => {
  it('refuse moins de 3 joueurs', () => {
    expect(() => distribute({ players: players([5, 5]), games: [], teamCount: 4, tolerance: 2 })).toThrow(DistributionError);
  });
  it('explique pourquoi 5 joueurs ne passent pas avec 4 équipes', () => {
    expect(() => distribute({ players: players([5, 5, 5, 5, 5]), games: [], teamCount: 4, tolerance: 2 })).toThrow(/Augmente/);
  });
  it('accepte 5 joueurs avec 5 équipes', () => {
    const d = distribute({ players: players([5, 5, 5, 5, 5]), games: wideCatalog(), teamCount: 5, tolerance: 2 });
    expect(d.tables).toHaveLength(1);
  });
  it('est reproductible avec la même graine', () => {
    const ps = players([8, 7, 7, 6, 5, 5, 5, 4, 3, 3, 2, 1]);
    const a = distribute({ players: ps, games: wideCatalog(), teamCount: 4, tolerance: 2, seed: 7 });
    const b = distribute({ players: ps, games: wideCatalog(), teamCount: 4, tolerance: 2, seed: 7 });
    expect(a.teamOf).toEqual(b.teamOf);
  });
});

describe('distribute : propriétés sur 600 tirages aléatoires', () => {
  it('respecte toujours les règles du document', () => {
    const rand = seededRandom(2026);
    let runs = 0;
    for (let k = 0; k < 600; k++) {
      const n = 3 + Math.floor(rand() * 58); // 3 à 60 joueurs
      const teamCount = 3 + Math.floor(rand() * 6); // 3 à 8 équipes
      const tolerance = 1 + Math.floor(rand() * 3);
      const ps = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, level: 1 + Math.floor(rand() * 10) }));
      const games = wideCatalog();
      try {
        const d = distribute({ players: ps, games, teamCount, tolerance, seed: k });
        checkRules(d, ps, games, teamCount, tolerance);
        runs++;
      } catch (e) {
        // Seuls les cas réellement impossibles peuvent échouer.
        expect(e).toBeInstanceOf(DistributionError);
        expect(sizeCombos(n, teamCount)).toEqual([]);
      }
    }
    expect(runs).toBeGreaterThan(450);
  });

  it('équilibre les niveaux entre équipes (40 joueurs, 5 équipes)', () => {
    const rand = seededRandom(9);
    const ps = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, level: 1 + Math.floor(rand() * 10) }));
    const d = distribute({ players: ps, games: wideCatalog(), teamCount: 5, tolerance: 2 });
    const avgs = d.teams.map((t) => t.levelSum / t.playerIds.length);
    expect(Math.max(...avgs) - Math.min(...avgs)).toBeLessThan(1.5);
  });
});
