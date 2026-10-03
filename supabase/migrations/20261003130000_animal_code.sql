-- Le code à 4 chiffres devient un animal à retenir (« lapin », « loutre »…).
-- Chaque joueur d'un tournoi a un animal différent. La saisie ignore majuscules,
-- accents et espaces. Le lien personnel reste protégé par le jeton secret.

-- Normalisation : minuscules, sans accents ni espaces autour.
create or replace function private.normalize_word(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(btrim(coalesce(p, ''))),
                   'àâäáãéèêëíìîïóòôöõúùûüçñœ',
                   'aaaaaeeeeiiiiooooouuuucno');
$$;

-- Liste des animaux : courts, connus, sans paires trop proches.
create or replace function private.animals()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'lapin','hibou','panda','loutre','renard','koala','zèbre','girafe','tigre','lion',
    'ours','loup','castor','hérisson','écureuil','pingouin','phoque','dauphin','baleine','requin',
    'poulpe','crabe','tortue','grenouille','lézard','serpent','crocodile','hippopotame','rhinocéros','éléphant',
    'chameau','lama','kangourou','gorille','singe','paresseux','tatou','raton','blaireau','belette',
    'marmotte','chamois','bouquetin','cerf','sanglier','cochon','mouton','chèvre','vache','cheval',
    'âne','canard','cygne','poule','paon','perroquet','toucan','flamant','pélican','mouette',
    'aigle','faucon','corbeau','merle','moineau','colibri','abeille','fourmi','coccinelle','papillon',
    'libellule','escargot','scarabée','araignée','méduse','homard','hamster','souris','furet','bison',
    'orque','morse','lynx','guépard','jaguar','puma','suricate','fennec','okapi','tapir'
  ];
$$;

-- Nouvelle colonne, remplie pour les joueurs déjà inscrits.
alter table public.players add column animal text;

update public.players p
set animal = a.animal
from (
  select pl.id,
         (private.animals())[row_number() over (partition by pl.tournament_id order by pl.created_at)] as animal
  from public.players pl
) a
where a.id = p.id;

alter table public.players alter column animal set not null;
create unique index players_animal_unique on public.players (tournament_id, private.normalize_word(animal));

-- Le code chiffré n'est plus utilisé.
alter table public.players drop column code;

-- Fonctions recréées pour renvoyer l'animal au lieu du code.
drop function public.sign_up_player(uuid, text, int);
drop function public.get_player(uuid);
drop function public.find_player(uuid, text, text);
drop function public.register_player(uuid, text, int);

create function public.sign_up_player(p_tournament_id uuid, p_pseudo text, p_level int)
returns table (token uuid, animal text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_animal text;
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

  -- Un animal libre, tiré au hasard.
  select a into v_animal
  from unnest(private.animals()) as a
  where not exists (select 1 from public.players p
                    where p.tournament_id = p_tournament_id
                      and private.normalize_word(p.animal) = private.normalize_word(a))
  order by random()
  limit 1;
  if v_animal is null then
    raise exception 'Le tournoi est complet : plus aucun animal disponible' using errcode = 'P0001';
  end if;

  insert into public.players (tournament_id, pseudo, level, animal)
  values (p_tournament_id, v_pseudo, p_level, v_animal)
  returning players.token into v_token;

  return query select v_token, v_animal;
end;
$$;

create function public.get_player(p_token uuid)
returns table (tournament_id uuid, pseudo text, level int, animal text, tournament_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.tournament_id, p.pseudo, p.level, p.animal, t.status
  from public.players p
  join public.tournaments t on t.id = p.tournament_id
  where p.token = p_token;
$$;

-- Retrouver son lien personnel : pseudo + animal.
create function public.find_player(p_tournament_id uuid, p_pseudo text, p_animal text)
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
    and private.normalize_word(p.animal) = private.normalize_word(p_animal);
$$;

revoke all on function public.sign_up_player(uuid, text, int) from public;
revoke all on function public.get_player(uuid) from public;
revoke all on function public.find_player(uuid, text, text) from public;
grant execute on function public.sign_up_player(uuid, text, int) to anon, authenticated;
grant execute on function public.get_player(uuid) to anon, authenticated;
grant execute on function public.find_player(uuid, text, text) to anon, authenticated;

-- Les fonctions privées sont utilisées par l'index et les fonctions ci-dessus.
revoke all on function private.normalize_word(text) from public, anon;
revoke all on function private.animals() from public, anon;
grant execute on function private.normalize_word(text) to authenticated;
grant execute on function private.animals() to authenticated;
