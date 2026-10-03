import { describe, expect, it } from 'vitest';
import { average, pointsForPosition, pointsForTable } from './scoring';

describe('pointsForPosition', () => {
  it('donne 4 au premier et 1 au dernier quelle que soit la taille', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      expect(pointsForPosition(1, n)).toBe(4);
      expect(pointsForPosition(n, n)).toBe(1);
    }
  });

  it('suit le tableau du document de règles', () => {
    expect([1, 2, 3].map((p) => pointsForPosition(p, 3))).toEqual([4, 2.5, 1]);
    expect([1, 2, 3, 4].map((p) => pointsForPosition(p, 4))).toEqual([4, 3, 2, 1]);
    expect([1, 2, 3, 4, 5].map((p) => pointsForPosition(p, 5))).toEqual([4, 3.25, 2.5, 1.75, 1]);
  });

  it('garde une moyenne de 2,5 par table', () => {
    for (const n of [3, 4, 5]) {
      const pts = Array.from({ length: n }, (_, i) => pointsForPosition(i + 1, n));
      expect(average(pts)).toBeCloseTo(2.5);
    }
  });

  it('refuse les valeurs hors limites', () => {
    expect(() => pointsForPosition(0, 4)).toThrow();
    expect(() => pointsForPosition(5, 4)).toThrow();
    expect(() => pointsForPosition(1, 1)).toThrow();
  });
});

describe('pointsForTable', () => {
  it('calcule une table sans égalité', () => {
    expect(pointsForTable([2, 1, 4, 3])).toEqual([3, 4, 1, 2]);
  });

  it('partage les points en cas d’égalité', () => {
    expect(pointsForTable([1, 1, 3, 4])).toEqual([3.5, 3.5, 2, 1]);
    expect(pointsForTable([1, 2, 2, 2])).toEqual([4, 2, 2, 2]);
  });

  it('refuse des places incohérentes', () => {
    expect(() => pointsForTable([1, 1, 2, 4])).toThrow();
    expect(() => pointsForTable([2, 3, 4, 5])).toThrow();
  });
});

describe('average', () => {
  it('reproduit l’exemple de l’équipe A', () => {
    expect(average([3, 4, 1, 2.5])).toBeCloseTo(2.625);
  });
  it('renvoie null sans résultat', () => {
    expect(average([])).toBeNull();
  });
});
