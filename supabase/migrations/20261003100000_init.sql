-- Schéma initial du tournoi de jeux de société.
-- Principe de sécurité : le navigateur n'utilise que la clé publique (publishable).
-- Toutes les tables ont la RLS activée ; les joueurs passent par des fonctions
-- SECURITY DEFINER qui ne renvoient que ce qu'ils ont le droit de voir.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- Tournois
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  event_date date,
  -- inscriptions : les joueurs s'inscrivent
  -- brouillon    : répartition générée, visible des admins seulement
  -- publie       : répartition visible des joueurs, saisie des résultats
  -- termine      : tournoi clos
  status text not null default 'inscriptions'
    check (status in ('inscriptions', 'brouillon', 'publie', 'termine')),
  team_count int not null default 4 check (team_count between 2 and 12),
  complexity_tolerance int not null default 2 check (complexity_tolerance between 0 and 9),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue de jeux (un exemplaire par ligne, pas de jeux coopératifs)
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  complexity int not null check (complexity between 1 and 10),
  min_players int not null check (min_players between 1 and 10),
  max_players int not null check (max_players between 1 and 10),
  duration_min int not null check (duration_min between 5 and 600),
  created_at timestamptz not null default now(),
  check (min_players <= max_players)
);
create index games_tournament_idx on public.games (tournament_id);

-- ---------------------------------------------------------------------------
-- Joueurs
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pseudo text not null check (char_length(btrim(pseudo)) between 1 and 30),
  level int not null check (level between 1 and 10),
  code text not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (tournament_id, code)
);
create unique index players_pseudo_unique on public.players (tournament_id, lower(btrim(pseudo)));

-- ---------------------------------------------------------------------------
-- Répartition : équipes, tables, places
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  position int not null,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  unique (tournament_id, position)
);

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  number int not null check (number >= 1),
  game_id uuid references public.games(id) on delete set null,
  -- Deuxième jeu pour les tables familiales rapides (deux sous-manches)
  second_game_id uuid references public.games(id) on delete set null,
  unique (tournament_id, number)
);

create table public.seats (
  player_id uuid primary key references public.players(id) on delete cascade,
  table_id uuid not null references public.game_tables(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  -- Deux coéquipiers ne sont jamais à la même table
  unique (table_id, team_id)
);
create index seats_table_idx on public.seats (table_id);

-- ---------------------------------------------------------------------------
-- Résultats : une place par joueur et par sous-manche (égalités autorisées)
-- ---------------------------------------------------------------------------
create table public.results (
  table_id uuid not null references public.game_tables(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  sub_round int not null default 1 check (sub_round in (1, 2)),
  rank int not null check (rank between 1 and 10),
  recorded_at timestamptz not null default now(),
  primary key (table_id, player_id, sub_round)
);

-- ---------------------------------------------------------------------------
-- RLS : tout est fermé par défaut, les admins ont tous les droits.
-- ---------------------------------------------------------------------------
alter table public.admins       enable row level security;
alter table public.tournaments  enable row level security;
alter table public.games        enable row level security;
alter table public.players      enable row level security;
alter table public.teams        enable row level security;
alter table public.game_tables  enable row level security;
alter table public.seats        enable row level security;
alter table public.results      enable row level security;

create policy admins_admin_all on public.admins
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy tournaments_public_read on public.tournaments
  for select to anon, authenticated using (true);
create policy tournaments_admin_write on public.tournaments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Le catalogue est public : les joueurs s'entraînent en amont.
create policy games_public_read on public.games
  for select to anon, authenticated using (true);
create policy games_admin_write on public.games
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Joueurs : lecture directe réservée aux admins (le code personnel ne doit pas fuiter).
create policy players_admin_all on public.players
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy teams_admin_all on public.teams
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy game_tables_admin_all on public.game_tables
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy seats_admin_all on public.seats
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy results_admin_all on public.results
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Fonctions publiques
-- ---------------------------------------------------------------------------

-- Inscription d'un joueur. Renvoie son code personnel à 4 chiffres.
create or replace function public.register_player(p_tournament_id uuid, p_pseudo text, p_level int)
returns table (player_id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_code text;
  v_id uuid;
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
begin
  select t.status into v_status from public.tournaments t where t.id = p_tournament_id;
  if v_status is null then
    raise exception 'Tournoi introuvable' using errcode = 'P0002';
  end if;
  if v_status <> 'inscriptions' then
    raise exception 'Les inscriptions sont closes' using errcode = 'P0001';
  end if;
  if char_length(v_pseudo) not between 1 and 30 then
    raise exception 'Le pseudo doit faire entre 1 et 30 caractères' using errcode = '22023';
  end if;
  if p_level is null or p_level not between 1 and 10 then
    raise exception 'Le niveau doit être compris entre 1 et 10' using errcode = '22023';
  end if;
  if exists (select 1 from public.players p
             where p.tournament_id = p_tournament_id and lower(btrim(p.pseudo)) = lower(v_pseudo)) then
    raise exception 'Ce pseudo est déjà pris' using errcode = '23505';
  end if;

  loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.players p
                          where p.tournament_id = p_tournament_id and p.code = v_code);
  end loop;

  insert into public.players (tournament_id, pseudo, level, code)
  values (p_tournament_id, v_pseudo, p_level, v_code)
  returning id into v_id;

  return query select v_id, v_code;
end;
$$;

-- Nombre d'inscrits (affiché sur la page d'inscription).
create or replace function public.player_count(p_tournament_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.players p where p.tournament_id = p_tournament_id;
$$;

-- Diagnostic : vérifie que le site parle bien à la base.
create or replace function public.ping()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'server_time', now(),
    'tournaments', (select count(*) from public.tournaments),
    'games', (select count(*) from public.games),
    'players', (select count(*) from public.players),
    'is_admin', public.is_admin()
  );
$$;

revoke all on function public.register_player(uuid, text, int) from public;
revoke all on function public.player_count(uuid) from public;
revoke all on function public.ping() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.register_player(uuid, text, int) to anon, authenticated;
grant execute on function public.player_count(uuid) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
