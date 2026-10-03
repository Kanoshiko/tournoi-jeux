-- Inscription des joueurs : lien personnel sécurisé.
--
-- Le code à 4 chiffres est facile à retenir mais aussi à deviner (10 000 valeurs).
-- Il ne sert donc qu'à retrouver son inscription, couplé au pseudo.
-- Le lien personnel repose sur un jeton aléatoire (UUID) : c'est lui qui permet
-- de consulter, modifier ou supprimer son inscription.

alter table public.players
  add column token uuid not null default gen_random_uuid();
alter table public.players
  add constraint players_token_unique unique (token);

-- L'ancienne fonction register_player (qui renvoyait l'id interne) est désactivée
-- plutôt que supprimée ; sign_up_player la remplace.
revoke all on function public.register_player(uuid, text, int) from public, anon, authenticated;

create function public.sign_up_player(p_tournament_id uuid, p_pseudo text, p_level int)
returns table (token uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_code text;
  v_token uuid;
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
  returning players.token into v_token;

  return query select v_token, v_code;
end;
$$;

-- Lecture de sa propre inscription via son lien personnel.
create function public.get_player(p_token uuid)
returns table (tournament_id uuid, pseudo text, level int, code text, tournament_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.tournament_id, p.pseudo, p.level, p.code, t.status
  from public.players p
  join public.tournaments t on t.id = p.tournament_id
  where p.token = p_token;
$$;

-- Modification tant que les inscriptions sont ouvertes.
create function public.update_player(p_token uuid, p_pseudo text, p_level int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players%rowtype;
  v_status text;
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
begin
  select * into v_player from public.players p where p.token = p_token;
  if not found then
    raise exception 'Inscription introuvable' using errcode = 'P0002';
  end if;
  select t.status into v_status from public.tournaments t where t.id = v_player.tournament_id;
  if v_status <> 'inscriptions' then
    raise exception 'Les inscriptions sont closes : demande à un organisateur' using errcode = 'P0001';
  end if;
  if char_length(v_pseudo) not between 1 and 30 then
    raise exception 'Le pseudo doit faire entre 1 et 30 caractères' using errcode = '22023';
  end if;
  if p_level is null or p_level not between 1 and 10 then
    raise exception 'Le niveau doit être compris entre 1 et 10' using errcode = '22023';
  end if;
  if exists (select 1 from public.players p
             where p.tournament_id = v_player.tournament_id
               and p.id <> v_player.id
               and lower(btrim(p.pseudo)) = lower(v_pseudo)) then
    raise exception 'Ce pseudo est déjà pris' using errcode = '23505';
  end if;

  update public.players set pseudo = v_pseudo, level = p_level where id = v_player.id;
end;
$$;

-- Désinscription tant que les inscriptions sont ouvertes.
create function public.delete_player(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players%rowtype;
  v_status text;
begin
  select * into v_player from public.players p where p.token = p_token;
  if not found then
    raise exception 'Inscription introuvable' using errcode = 'P0002';
  end if;
  select t.status into v_status from public.tournaments t where t.id = v_player.tournament_id;
  if v_status <> 'inscriptions' then
    raise exception 'Les inscriptions sont closes : demande à un organisateur' using errcode = 'P0001';
  end if;
  delete from public.players where id = v_player.id;
end;
$$;

-- Retrouver son lien personnel (autre téléphone, lien perdu) : pseudo + code.
-- Les deux doivent correspondre, ce qui rend le code seul inutile à deviner.
create function public.find_player(p_tournament_id uuid, p_pseudo text, p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.token
  from public.players p
  where p.tournament_id = p_tournament_id
    and lower(btrim(p.pseudo)) = lower(btrim(coalesce(p_pseudo, '')))
    and p.code = btrim(coalesce(p_code, ''));
$$;

revoke all on function public.sign_up_player(uuid, text, int) from public;
revoke all on function public.get_player(uuid) from public;
revoke all on function public.update_player(uuid, text, int) from public;
revoke all on function public.delete_player(uuid) from public;
revoke all on function public.find_player(uuid, text, text) from public;
grant execute on function public.sign_up_player(uuid, text, int) to anon, authenticated;
grant execute on function public.get_player(uuid) to anon, authenticated;
grant execute on function public.update_player(uuid, text, int) to anon, authenticated;
grant execute on function public.delete_player(uuid) to anon, authenticated;
grant execute on function public.find_player(uuid, text, text) to anon, authenticated;
