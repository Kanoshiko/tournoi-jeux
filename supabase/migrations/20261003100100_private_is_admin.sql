-- is_admin() n'a pas à être appelable via l'API : on le range dans un schéma
-- non exposé. Les règles RLS le suivent automatiquement.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

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
    'is_admin', private.is_admin()
  );
$$;
