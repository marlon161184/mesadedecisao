-- Teste do acesso individual (papel Observador). Bloco que termina em RAISE: tudo é desfeito.
-- Esperado: erro "OK · ..." (sucesso) ou "FALHA · ...".
DO $$
declare
  u uuid := gen_random_uuid(); fora uuid := gen_random_uuid(); t record; prob text := ''; n int; papel text; col text; filtro text;
begin
  insert into public.acesso_autorizado (email, grupo) values ('teste.rls@lista.invalid', 'Colaboradores');
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Teste.RLS@lista.invalid', '{}', '{}', now(), now()),
    (fora, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fora@lista.invalid', '{}', '{}', now(), now());
  select string_agg(role::text, ',') into papel from public.user_roles where user_id = u;
  if coalesce(papel,'') <> 'observador' then prob := prob || ' convidado não recebeu só observador (' || coalesce(papel,'nenhum') || ');'; end if;
  if exists (select 1 from public.user_roles where user_id = fora) then prob := prob || ' e-mail fora da lista recebeu papel;'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.rfp; if n = 0 then prob := prob || ' observador não lê rfp;'; end if;
  select count(*) into n from public.acesso_autorizado; if n > 0 then prob := prob || ' observador lê a lista de acessos;'; end if;
  select count(*) into n from public.log_entrada; if n > 0 then prob := prob || ' observador lê o log;'; end if;
  for t in select c.table_name from information_schema.tables c where c.table_schema = 'public' and c.table_type = 'BASE TABLE' loop
    select column_name into col from information_schema.columns where table_schema='public' and table_name=t.table_name and is_generated='NEVER' and identity_generation is null order by ordinal_position limit 1;
    -- Editar o próprio perfil (nome) já era permitido; só o perfil alheio conta como falha.
    filtro := case when t.table_name = 'profiles' then format('id <> %L', u) else 'true' end;
    begin
      execute format('update public.%I set %I = %I where %s', t.table_name, col, col, filtro);
      get diagnostics n = row_count;
      if n > 0 then prob := prob || ' alterou ' || t.table_name || ';'; end if;
    exception when others then null; end;
    begin
      execute format('delete from public.%I where true', t.table_name);
      get diagnostics n = row_count;
      if n > 0 then prob := prob || ' apagou ' || t.table_name || ';'; end if;
    exception when others then null; end;
  end loop;
  begin insert into public.rfp (numero, nome, fase, status, janela_meses) values (99, 'x', 1, 'x', 1); prob := prob || ' inseriu rfp;'; exception when others then null; end;
  begin insert into public.user_roles (user_id, role) values (u, 'admin'); prob := prob || ' se promoveu a admin;'; exception when others then null; end;
  begin insert into public.acesso_autorizado (email, grupo) values ('x@x.invalid', 'Sócios'); prob := prob || ' editou a lista;'; exception when others then null; end;
  if prob = '' then raise exception 'OK · acesso individual: lista, papel de leitura e bloqueio de escrita conferidos'; end if;
  raise exception 'FALHA ·%', prob;
end $$;
