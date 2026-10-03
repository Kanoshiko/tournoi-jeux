import { describe, expect, it } from 'vitest';
import { TEAM_COLORS, textOn } from './teams';

describe('textOn', () => {
  it('met du texte foncé sur le jaune et du blanc sur les couleurs sombres', () => {
    expect(textOn('#C99700')).toBe('#1b1f1d');
    expect(textOn('#2463B5')).toBe('#ffffff');
  });
  it('a une couleur de texte pour chaque équipe', () => {
    for (const c of TEAM_COLORS) expect(['#ffffff', '#1b1f1d']).toContain(textOn(c.hex));
  });
});
