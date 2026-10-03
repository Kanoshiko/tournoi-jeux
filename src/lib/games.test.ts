import { describe, expect, it } from 'vitest';
import { isQuickFamilyGame, parseGame } from './games';

const draft = (o: Partial<Record<string, string>> = {}) => ({
  name: 'Azul', complexity: '3', min_players: '2', max_players: '4', duration_min: '40', ...o,
});

describe('parseGame', () => {
  it('accepte un jeu valide et nettoie le nom', () => {
    const r = parseGame(draft({ name: '  Azul  ' }));
    expect(r).toEqual({ ok: true, game: { name: 'Azul', complexity: 3, min_players: 2, max_players: 4, duration_min: 40 } });
  });

  it('refuse les champs vides ou hors limites', () => {
    const r = parseGame(draft({ name: ' ', complexity: '11', duration_min: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });

  it('refuse min > max', () => {
    const r = parseGame(draft({ min_players: '5', max_players: '3' }));
    expect(r.ok).toBe(false);
  });

  it('refuse un jeu qui ne peut pas former une table de 3 à 5', () => {
    expect(parseGame(draft({ min_players: '2', max_players: '2' })).ok).toBe(false);
    expect(parseGame(draft({ min_players: '6', max_players: '8' })).ok).toBe(false);
    expect(parseGame(draft({ min_players: '1', max_players: '3' })).ok).toBe(true);
  });

  it('refuse les nombres non entiers', () => {
    expect(parseGame(draft({ complexity: '3.5' })).ok).toBe(false);
  });
});

describe('isQuickFamilyGame', () => {
  it('ne concerne que les jeux familiaux de 30 minutes ou moins', () => {
    expect(isQuickFamilyGame({ complexity: 2, duration_min: 20 })).toBe(true);
    expect(isQuickFamilyGame({ complexity: 4, duration_min: 30 })).toBe(false);
    expect(isQuickFamilyGame({ complexity: 3, duration_min: 45 })).toBe(false);
  });
});
