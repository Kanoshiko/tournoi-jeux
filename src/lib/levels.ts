/** Catégories de niveau des joueurs et de complexité des jeux (même échelle 1–10). */

export type TierKey = 'familial' | 'initie' | 'expert';

export type Tier = {
  key: TierKey;
  label: string;
  /** Libellé du curseur d'inscription, volontairement peu compétitif. */
  signupLabel: string;
  min: number;
  max: number;
  description: string;
};

export const TIERS: readonly Tier[] = [
  {
    key: 'familial',
    label: 'Familial',
    signupLabel: 'Petit',
    min: 1,
    max: 3,
    description: 'Des règles expliquées en quelques minutes et des parties courtes, pour jouer sans prise de tête.',
  },
  {
    key: 'initie',
    label: 'Initié',
    signupLabel: 'Moyen',
    min: 4,
    max: 6,
    description: 'Une dizaine de minutes de règles et des parties d’environ une heure, avec un peu de stratégie.',
  },
  {
    key: 'expert',
    label: 'Expert',
    signupLabel: 'Gros',
    min: 7,
    max: 10,
    description: 'Des règles longues ne te font pas peur : tu aimes les jeux riches et les parties de deux heures.',
  },
];

export function tierOf(level: number): Tier {
  const tier = TIERS.find((t) => level >= t.min && level <= t.max);
  if (!tier) throw new Error(`Niveau hors échelle : ${level}`);
  return tier;
}

/** Jeux proches d'un niveau, du plus proche au plus éloigné (à complexité égale, par nom). */
export function gamesNearLevel<T extends { name: string; complexity: number }>(
  games: readonly T[],
  level: number,
  tolerance = 1,
): T[] {
  return games
    .filter((g) => Math.abs(g.complexity - level) <= tolerance)
    .sort((a, b) => Math.abs(a.complexity - level) - Math.abs(b.complexity - level) || a.name.localeCompare(b.name, 'fr'));
}
