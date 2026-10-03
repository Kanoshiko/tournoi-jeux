/** Couleurs des équipes, dans l'ordre d'attribution. */
export const TEAM_COLORS = [
  { name: 'Rouge', hex: '#C8372D' },
  { name: 'Bleue', hex: '#2463B5' },
  { name: 'Jaune', hex: '#C99700' },
  { name: 'Verte', hex: '#267A43' },
  { name: 'Violette', hex: '#7A4BB0' },
  { name: 'Orange', hex: '#B5531A' },
  { name: 'Rose', hex: '#C2417F' },
  { name: 'Grise', hex: '#5E625F' },
] as const;

export const teamColor = (index: number) => TEAM_COLORS[index % TEAM_COLORS.length];

/** Couleur de texte lisible sur un fond d'équipe (le jaune demande du texte foncé). */
export function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste avec le blanc : (1 + 0.05) / (lum + 0.05) ; sous 4,5 on passe au texte foncé.
  return 1.05 / (lum + 0.05) >= 4.5 ? '#ffffff' : '#1b1f1d';
}
