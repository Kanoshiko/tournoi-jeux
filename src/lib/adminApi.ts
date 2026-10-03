/**
 * Accès admin aux tables. Chaque appel passe par les règles RLS :
 * un utilisateur non admin obtient une erreur ou une liste vide.
 */
import { supabase } from './supabase';
import type { GameInput } from './games';
import type { Game, Tournament } from './api';
import type { Draft } from '../algo/draft';
import { newTableKey } from '../algo/draft';
import { teamColor } from './teams';


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

// ---------------------------------------------------------------------------
// Répartition
// ---------------------------------------------------------------------------

/** Répartition enregistrée en base, convertie en brouillon modifiable (null s'il n'y en a pas). */
export async function fetchSavedDraft(tournamentId: string): Promise<Draft | null> {
  const teams = check(
    await supabase.from('teams').select('id, position').eq('tournament_id', tournamentId).order('position'),
  ) as { id: string; position: number }[];
  const tables = check(
    await supabase
      .from('game_tables')
      .select('id, number, game_id, second_game_id')
      .eq('tournament_id', tournamentId)
      .order('number'),
  ) as { id: string; number: number; game_id: string | null; second_game_id: string | null }[];
  if (tables.length === 0) return null;
  const seats = check(
    await supabase.from('seats').select('player_id, table_id, team_id').in('table_id', tables.map((t) => t.id)),
  ) as { player_id: string; table_id: string; team_id: string }[];
  const positionOf = new Map(teams.map((t) => [t.id, t.position]));
  const teamOf: Record<string, number> = {};
  for (const s of seats) teamOf[s.player_id] = positionOf.get(s.team_id) ?? 0;
  return {
    tables: tables.map((t) => ({
      key: newTableKey(),
      gameId: t.game_id,
      secondGameId: t.second_game_id,
      playerIds: seats.filter((s) => s.table_id === t.id).map((s) => s.player_id),
    })),
    teamOf,
  };
}

export async function saveDraft(tournamentId: string, draft: Draft, teamCount: number) {
  const teams = Array.from({ length: teamCount }, (_, position) => ({
    position,
    color_name: teamColor(position).name,
    color_hex: teamColor(position).hex,
  }));
  const tables = draft.tables
    .filter((t) => t.playerIds.length > 0)
    .map((t, i) => ({
      number: i + 1,
      game_id: t.gameId ?? '',
      second_game_id: t.secondGameId ?? '',
      seats: t.playerIds.map((player_id) => ({ player_id, team: draft.teamOf[player_id] })),
    }));
  const { error } = await supabase.rpc('save_distribution', {
    p_tournament_id: tournamentId,
    p_teams: teams,
    p_tables: tables,
  });
  if (error) throw new Error(error.message);
}

export async function addLatePlayer(tournamentId: string, pseudo: string, level: number) {
  const { data, error } = await supabase
    .rpc('admin_add_player', { p_tournament_id: tournamentId, p_pseudo: pseudo, p_level: level })
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; animal: string };
}
