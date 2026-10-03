/** Validation d'un jeu du catalogue, partagée par les formulaires admin. */

export type GameInput = {
  name: string;
  complexity: number;
  min_players: number;
  max_players: number;
  duration_min: number;
};

export type GameDraft = { [K in keyof GameInput]: string };

export const emptyDraft: GameDraft = { name: '', complexity: '', min_players: '', max_players: '', duration_min: '' };

const int = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : NaN);

/** Renvoie le jeu validé, ou la liste des erreurs à afficher. */
export function parseGame(d: GameDraft): { ok: true; game: GameInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = d.name.trim();
  const complexity = int(d.complexity);
  const min = int(d.min_players);
  const max = int(d.max_players);
  const duration = int(d.duration_min);

  if (!name) errors.push('Le nom est obligatoire.');
  else if (name.length > 80) errors.push('Le nom ne doit pas dépasser 80 caractères.');
  if (!(complexity >= 1 && complexity <= 10)) errors.push('La complexité doit être un nombre de 1 à 10.');
  if (!(min >= 1 && min <= 10)) errors.push('Le nombre minimum de joueurs doit être entre 1 et 10.');
  if (!(max >= 1 && max <= 10)) errors.push('Le nombre maximum de joueurs doit être entre 1 et 10.');
  if (min >= 1 && max >= 1 && min > max) errors.push('Le minimum de joueurs dépasse le maximum.');
  if (min >= 1 && max >= 1 && (max < 3 || min > 5)) {
    errors.push('Le jeu doit pouvoir se jouer à 3, 4 ou 5 joueurs pour former une table.');
  }
  if (!(duration >= 5 && duration <= 600)) errors.push('La durée doit être entre 5 et 600 minutes.');

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, game: { name, complexity, min_players: min, max_players: max, duration_min: duration } };
}

/** Jeu familial rapide : joué en deux sous-manches (voir le document de règles). */
export function isQuickFamilyGame(g: Pick<GameInput, 'complexity' | 'duration_min'>): boolean {
  return g.complexity <= 3 && g.duration_min <= 30;
}

export function toDraft(g: GameInput): GameDraft {
  return {
    name: g.name,
    complexity: String(g.complexity),
    min_players: String(g.min_players),
    max_players: String(g.max_players),
    duration_min: String(g.duration_min),
  };
}
