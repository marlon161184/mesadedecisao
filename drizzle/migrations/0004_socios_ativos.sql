create or replace function public.socios_ativos()
returns setof uuid language sql stable security definer set search_path = public as $$
  select user_id from public.user_roles where role = 'socio' and public.is_member(auth.uid())
$$;
grant execute on function public.socios_ativos() to authenticated;