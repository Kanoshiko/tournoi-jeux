/**
 * Barème du tournoi (voir le document de règles).
 *
 * Le premier d'une table marque toujours 4 points et le dernier 1 point,
 * quelle que soit la taille de la table : points = 1 + 3 × (n − r) / (n − 1).
 * La moyenne d'une table vaut donc toujours 2,5 points.
 */

export const MAX_POINTS = 4;
export const MIN_POINTS = 1;

/** Points d'une place `position` (1 = premier) sur une table de `tableSize` joueurs. */
export function pointsForPosition(position: number, tableSize: number): number {
  if (!Number.isInteger(tableSize) || tableSize < 2) {
    throw new Error(`Taille de table invalide : ${tableSize}`);
  }
  if (!Number.isInteger(position) || position < 1 || position > tableSize) {
    throw new Error(`Place invalide : ${position} sur ${tableSize}`);
  }
  return MIN_POINTS + ((MAX_POINTS - MIN_POINTS) * (tableSize - position)) / (tableSize - 1);
}

/**
 * Points de chaque joueur d'une table à partir des places saisies.
 * Les égalités (même place) se partagent la moyenne des points des places occupées.
 * Exemple à 4 joueurs : places [1, 1, 3, 4] → [3,5 ; 3,5 ; 2 ; 1].
 */
export function pointsForTable(ranks: readonly number[]): number[] {
  const n = ranks.length;
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i < n; i++) {
    // Une place r implique que r − 1 joueurs font strictement mieux.
    const better = sorted.filter((r) => r < sorted[i]).length;
    if (sorted[i] !== better + 1) {
      throw new Error(`Places incohérentes : ${ranks.join(', ')}`);
    }
  }
  return ranks.map((r) => {
    const tied = ranks.filter((x) => x === r).length;
    let total = 0;
    for (let p = r; p < r + tied; p++) total += pointsForPosition(p, n);
    return total / tied;
  });
}

/** Moyenne simple ; renvoie null pour une liste vide (aucun résultat encore). */
export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
