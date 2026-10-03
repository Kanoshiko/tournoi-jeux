/**
 * Accès admin aux tables. Chaque appel passe par les règles RLS :
 * un utilisateur non admin obtient une erreur ou une liste vide.
 */
import { supabase } from './supabase';
import type { GameInput } from './games';
import type { Game, Tournament } from './api';

export type AdminTournament = Tournament & {
  team_count: number;
  complexity_tolerance: number;
};

export type AdminPlayer = {
  id: string;
  pseudo: string;
  level: number;
  animal: string;
  created_at: string;
};

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchAdminTournament(): Promise<AdminTournament | null> {
  return check(
    await supabase
      .from('tournaments')
      .select('id, name, event_date, status, team_count, complexity_tolerance')
      .neq('status', 'termine')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as AdminTournament | null;
}

export async function updateTournament(
  id: string,
  patch: Partial<Pick<AdminTournament, 'name' | 'event_date' | 'status' | 'team_count' | 'complexity_tolerance'>>,
) {
  check(await supabase.from('tournaments').update(patch).eq('id', id).select('id').single());
}

export async function createGame(tournamentId: string, g: GameInput): Promise<Game> {
  return check(
    await supabase
      .from('games')
      .insert({ ...g, tournament_id: tournamentId })
      .select('id, name, complexity, min_players, max_players, duration_min')
      .single(),
  ) as Game;
}

export async function updateGame(id: string, g: GameInput) {
  check(await supabase.from('games').update(g).eq('id', id).select('id').single());
}

export async function deleteGame(id: string) {
  check(await supabase.from('games').delete().eq('id', id).select('id'));
}

export async function fetchPlayers(tournamentId: string): Promise<AdminPlayer[]> {
  return check(
    await supabase
      .from('players')
      .select('id, pseudo, level, animal, created_at')
      .eq('tournament_id', tournamentId)
      .order('level', { ascending: false })
      .order('pseudo'),
  ) as AdminPlayer[];
}

export async function updatePlayerLevel(id: string, level: number) {
  check(await supabase.from('players').update({ level }).eq('id', id).select('id').single());
}

export async function removePlayer(id: string) {
  check(await supabase.from('players').delete().eq('id', id).select('id'));
}
