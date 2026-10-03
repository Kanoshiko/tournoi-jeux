import { describe, expect, it } from 'vitest';
import { gamesNearLevel, tierOf } from './levels';

describe('tierOf', () => {
  it('range chaque niveau dans la bonne catégorie', () => {
    expect([1, 2, 3].map((l) => tierOf(l).key)).toEqual(['familial', 'familial', 'familial']);
    expect([4, 5, 6].map((l) => tierOf(l).key)).toEqual(['initie', 'initie', 'initie']);
    expect([7, 8, 9, 10].map((l) => tierOf(l).key)).toEqual(['expert', 'expert', 'expert', 'expert']);
  });
  it('refuse un niveau hors échelle', () => {
    expect(() => tierOf(0)).toThrow();
    expect(() => tierOf(11)).toThrow();
  });
});

describe('gamesNearLevel', () => {
  const games = [
    { name: 'Brass Birmingham', complexity: 9 },
    { name: 'Splendor', complexity: 4 },
    { name: 'Azul', complexity: 3 },
    { name: 'Cascadia', complexity: 5 },
    { name: 'Qwixx', complexity: 1 },
  ];
  it('garde les jeux à ±1 du niveau, les plus proches d’abord', () => {
    expect(gamesNearLevel(games, 4).map((g) => g.name)).toEqual(['Splendor', 'Azul', 'Cascadia']);
  });
  it('élargit avec la tolérance', () => {
    expect(gamesNearLevel(games, 1, 2).map((g) => g.name)).toEqual(['Qwixx', 'Azul']);
  });
});
