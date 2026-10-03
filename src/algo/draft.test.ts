import { describe, expect, it } from 'vitest';
import { checkDraft, movePlayer, suggestTeam, type Draft } from './draft';

const players = [
  { id: 'a', level: 8 }, { id: 'b', level: 8 }, { id: 'c', level: 7 }, { id: 'd', level: 7 },
  { id: 'e', level: 2 }, { id: 'f', level: 2 }, { id: 'g', level: 1 }, { id: 'h', level: 1 },
];
const games = [
  { id: 'G8', name: 'Expert', complexity: 8, min_players: 2, max_players: 4, duration_min: 90 },
  { id: 'G2', name: 'Famille', complexity: 2, min_players: 2, max_players: 5, duration_min: 20 },
  { id: 'G1', name: 'Mini', complexity: 1, min_players: 2, max_players: 5, duration_min: 15 },
];
const base = (): Draft => ({
  tables: [
    { key: 'x', gameId: 'G8', secondGameId: null, playerIds: ['a', 'b', 'c', 'd'] },
    { key: 'y', gameId: 'G2', secondGameId: 'G1', playerIds: ['e', 'f', 'g', 'h'] },
  ],
  teamOf: { a: 0, b: 1, c: 2, d: 3, e: 1, f: 0, g: 3, h: 2 },
});
const check = (d: Draft) => checkDraft(d, players, games, 4, 2, (id) => id.toUpperCase(), (i) => `E${i}`);

describe('checkDraft', () => {
  it('ne signale rien sur une répartition correcte', () => {
    expect(check(base())).toEqual({ errors: [], warnings: [], unplaced: [] });
  });

  it('bloque deux coéquipiers à la même table', () => {
    const d = base();
    d.teamOf.b = 0;
    const r = check(d);
    expect(r.errors[0]).toMatch(/A et B sont tous deux dans l’équipe E0/);
  });

  it('bloque un jeu attribué deux fois', () => {
    const d = base();
    d.tables[1].secondGameId = 'G8';
    expect(check(d).errors.join()).toMatch(/Expert est attribué à 2 tables/);
  });

  it('avertit pour un joueur non placé et une table trop petite', () => {
    const d = movePlayer(base(), 'h', null);
    const r = check(d);
    expect(r.unplaced).toEqual(['h']);
    expect(r.warnings.join()).toMatch(/non placé/);
  });

  it('avertit pour un jeu hors tolérance ou hors fourchette', () => {
    const d = base();
    d.tables[0].gameId = 'G2';
    d.tables[1].gameId = 'G8';
    d.tables[1].secondGameId = null;
    expect(check(d).warnings.join()).toMatch(/loin du niveau moyen/);
  });
});

describe('movePlayer / suggestTeam', () => {
  it('déplace un joueur d’une table à l’autre', () => {
    const d = movePlayer(base(), 'a', 'y');
    expect(d.tables[0].playerIds).toEqual(['b', 'c', 'd']);
    expect(d.tables[1].playerIds).toContain('a');
  });
  it('propose une équipe absente de la table', () => {
    const d = base();
    d.tables.push({ key: 'z', gameId: null, secondGameId: null, playerIds: ['a'] });
    d.tables[0].playerIds = ['b', 'c', 'd'];
    expect(suggestTeam(d, 'z', 4)).not.toBe(0);
  });
});
