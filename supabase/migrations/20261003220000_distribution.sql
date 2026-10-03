-- Répartition : enregistrement par les admins, retardataires, vue joueur.

-- ---------------------------------------------------------------------------
-- Enregistrement atomique d'une répartition (remplace la précédente).
-- p_teams  : [{position, color_name, color_hex}, …]
-- p_tables : [{number, game_id, second_game_id, seats: [{player_id, team}]}, …]
--            où « team » est la position de l'équipe.
-- Refusé si des résultats sont déjà saisis (on ne les efface jamais en silence).
-- ---------------------------------------------------------------------------
create function public.save_distribution(p_tournament_id uuid, p_teams jsonb, p_tables jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_ids uuid[] := '{}';
  v_id uuid;
  v_table uuid;
  t jsonb;
  tb jsonb;
  s jsonb;
begin
  if not private.is_admin() then
    raise exception 'Réservé aux organisateurs' using errcode = '42501';
  end if;
  if exists (select 1 from public.results r
             join public.game_tables gt on gt.id = r.table_id
             where gt.tournament_id = p_tournament_id) then
    raise exception 'Des résultats sont déjà saisis : la répartition ne peut plus être remplacée' using errcode = 'P0001';
  end if;

  delete from public.game_tables where tournament_id = p_tournament_id;
  delete from public.teams where tournament_id = p_tournament_id;

  for t in select value from jsonb_array_elements(p_teams) order by (value->>'position')::int loop
    insert into public.teams (tournament_id, position, color_name, color_hex)
    values (p_tournament_id, (t->>'position')::int, t->>'color_name', t->>'color_hex')
    returning id into v_id;
    v_team_ids := v_team_ids || v_id;
  end loop;

  for tb in select value from jsonb_array_elements(p_tables) loop
    insert into public.game_tables (tournament_id, number, game_id, second_game_id)
    values (p_tournament_id, (tb->>'number')::int,
            nullif(tb->>'game_id', '')::uuid, nullif(tb->>'second_game_id', '')::uuid)
    returning id into v_table;
    for s in select value from jsonb_array_elements(tb->'seats') loop
      insert into public.seats (player_id, table_id, team_id)
      values ((s->>'player_id')::uuid, v_table, v_team_ids[(s->>'team')::int + 1]);
    end loop;
  end loop;

  -- Cohérence : joueurs et jeux doivent appartenir à ce tournoi.
  if exists (select 1 from public.seats st
             join public.game_tables gt on gt.id = st.table_id
             join public.players p on p.id = st.player_id
             where gt.tournament_id = p_tournament_id and p.tournament_id <> p_tournament_id)
     or exists (select 1 from public.game_tables gt
                join public.games g on g.id in (gt.game_id, gt.second_game_id)
                where gt.tournament_id = p_tournament_id and g.tournament_id <> p_tournament_id) then
    raise exception 'Joueur ou jeu d’un autre tournoi' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retardataire ajouté par un admin, même inscriptions closes.
-- ---------------------------------------------------------------------------
create function public.admin_add_player(p_tournament_id uuid, p_pseudo text, p_level int)
returns table (id uuid, animal text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal text;
  v_id uuid;
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
begin
  if not private.is_admin() then
    raise exception 'Réservé aux organisateurs' using errcode = '42501';
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
  select a into v_animal
  from unnest(private.animals()) as a
  where not exists (select 1 from public.players p
                    where p.tournament_id = p_tournament_id
                      and private.normalize_word(p.animal) = private.normalize_word(a))
  order by random()
  limit 1;
  if v_animal is null then
    raise exception 'Plus aucun animal disponible' using errcode = 'P0001';
  end if;
  insert into public.players (tournament_id, pseudo, level, animal)
  values (p_tournament_id, v_pseudo, p_level, v_animal)
  returning players.id into v_id;
  return query select v_id, v_animal;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vue joueur : son équipe et sa table, une fois la répartition publiée.
-- Renvoie null avant publication ; {placed: false} si le joueur n'est pas placé.
-- ---------------------------------------------------------------------------
create function public.get_my_assignment(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, s.table_id, s.team_id
    from public.players p
    join public.tournaments t on t.id = p.tournament_id
    left join public.seats s on s.player_id = p.id
    where p.token = p_token and t.status in ('publie', 'termine')
  )
  select case when me.table_id is null then jsonb_build_object('placed', false)
  else jsonb_build_object(
    'placed', true,
    'team', (
      select jsonb_build_object(
        'name', tm.color_name,
        'hex', tm.color_hex,
        'members', (
          select jsonb_agg(jsonb_build_object(
                   'pseudo', p2.pseudo, 'level', p2.level, 'table', gt2.number,
                   'game', g2.name, 'second_game', g2b.name, 'me', p2.id = me.id)
                 order by gt2.number)
          from public.seats s2
          join public.players p2 on p2.id = s2.player_id
          join public.game_tables gt2 on gt2.id = s2.table_id
          left join public.games g2 on g2.id = gt2.game_id
          left join public.games g2b on g2b.id = gt2.second_game_id
          where s2.team_id = me.team_id))
      from public.teams tm where tm.id = me.team_id),
    'table', (
      select jsonb_build_object(
        'number', gt.number,
        'game', g.name, 'complexity', g.complexity,
        'second_game', g2.name,
        'players', (
          select jsonb_agg(jsonb_build_object(
                   'pseudo', p3.pseudo, 'team', tm3.color_name, 'hex', tm3.color_hex, 'me', p3.id = me.id)
                 order by p3.level desc, p3.pseudo)
          from public.seats s3
          join public.players p3 on p3.id = s3.player_id
          join public.teams tm3 on tm3.id = s3.team_id
          where s3.table_id = me.table_id))
      from public.game_tables gt
      left join public.games g on g.id = gt.game_id
      left join public.games g2 on g2.id = gt.second_game_id
      where gt.id = me.table_id)
  ) end
  from me;
$$;

revoke all on function public.save_distribution(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.admin_add_player(uuid, text, int) from public, anon;
revoke all on function public.get_my_assignment(uuid) from public;
grant execute on function public.save_distribution(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.admin_add_player(uuid, text, int) to authenticated;
grant execute on function public.get_my_assignment(uuid) to anon, authenticated;
