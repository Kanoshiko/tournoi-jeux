/**
 * Mémorise le lien personnel du joueur sur cet appareil, pour qu'il retrouve
 * sa page en revenant sur le site. Le stockage peut être indisponible
 * (navigation privée) : on ne fait alors simplement rien.
 */
const KEY = 'tournoi-jeux:player-token';

export function rememberToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* stockage indisponible */
  }
}

export function recalledToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}
