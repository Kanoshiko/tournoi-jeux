import { supabase } from './supabase';

export type Tournament = {
  id: string;
  name: string;
  event_date: string | null;
  status: 'inscriptions' | 'brouillon' | 'publie' | 'termine';
};

export type Game = {
  id: string;
  name: string;
  complexity: number;
  min_players: number;
  max_players: number;
  duration_min: number;
};

export type MyPlayer = {
  tournament_id: string;
  pseudo: string;
  level: number;
  animal: string;
  tournament_status: Tournament['status'];
};

/** Le tournoi en cours : le plus récent qui n'est pas terminé. */
export async function fetchCurrentTournament(): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, event_date, status')
    .neq('status', 'termine')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tournament | null;
}

export async function fetchGames(tournamentId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, complexity, min_players, max_players, duration_min')
    .eq('tournament_id', tournamentId)
    .order('complexity', { ascending: false })
    .order('name');
  if (error) throw new Error(error.message);
  return data as Game[];
}

export async function fetchPlayerCount(tournamentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('player_count', { p_tournament_id: tournamentId });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function registerPlayer(tournamentId: string, pseudo: string, level: number) {
  const { data, error } = await supabase
    .rpc('sign_up_player', { p_tournament_id: tournamentId, p_pseudo: pseudo, p_level: level })
    .single();
  if (error) throw new Error(error.message);
  return data as { token: string; animal: string };
}

export async function getMyPlayer(token: string): Promise<MyPlayer | null> {
  const { data, error } = await supabase.rpc('get_player', { p_token: token }).maybeSingle();
  if (error) throw new Error(error.message);
  return data as MyPlayer | null;
}

export async function updateMyPlayer(token: string, pseudo: string, level: number) {
  const { error } = await supabase.rpc('update_player', { p_token: token, p_pseudo: pseudo, p_level: level });
  if (error) throw new Error(error.message);
}

export async function deleteMyPlayer(token: string) {
  const { error } = await supabase.rpc('delete_player', { p_token: token });
  if (error) throw new Error(error.message);
}

export async function findPlayer(tournamentId: string, pseudo: string, animal: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('find_player', {
    p_tournament_id: tournamentId,
    p_pseudo: pseudo,
    p_animal: animal,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isToken = (s: string | undefined): s is string => !!s && UUID.test(s);
