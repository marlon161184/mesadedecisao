-- Teste da entrada de propostas por upload. Bloco que termina em RAISE: tudo é desfeito.
-- Esperado: erro "OK · ..." (sucesso) ou "FALHA · ...".
DO $$
declare
  adm uuid := gen_random_uuid(); soc uuid := gen_random_uuid(); obs uuid := gen_random_uuid();
  prob text := ''; n int; rid uuid := gen_random_uuid(); pid uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm.rls@teste.invalid', '{}', '{}', now(), now()),
    (soc, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'soc.rls@teste.invalid', '{}', '{}', now(), now()),
    (obs, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obs.rls@teste.invalid', '{}', '{}', now(), now());
  delete from public.user_roles where user_id in (adm, soc, obs);
  insert into public.user_roles (user_id, role) values (adm, 'admin'), (soc, 'socio'), (obs, 'observador');
  insert into public.acesso_autorizado (email, grupo, user_id) values ('soc.rls@teste.invalid', 'Sócios', soc);
  select id into pid from public.proposta limit 1;

  -- Admin cria rascunho e parecer não publicado.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.proposta_rascunho (id, arquivo_caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho, criado_por)
    values (rid, 'rascunho/x/y.pdf', 'teste.pdf', 'pdf', 10, adm);
  insert into public.parecer_proposta (proposta_id, texto, origem, revisado, publicado) values (pid, 'rascunho', 'ia', false, false);
  begin
    insert into public.parecer_proposta (proposta_id, texto, origem, revisado, publicado) values (pid, 'x', 'ia', false, true);
    prob := prob || ' publicou parecer sem revisão;';
  exception when others then null; end;
  begin
    insert into public.proposta_rascunho (arquivo_caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho, criado_por) values ('a', 'a.exe', 'exe', 10, adm);
    prob := prob || ' aceitou tipo inválido;';
  exception when others then null; end;
  begin
    insert into public.proposta_rascunho (arquivo_caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho, criado_por) values ('a', 'a.pdf', 'pdf', 30000000, adm);
    prob := prob || ' aceitou arquivo acima de 20 MB;';
  exception when others then null; end;
  execute 'reset role';

  -- Sócio e observador: não veem rascunho nem parecer não publicado; não gravam.
  for n in 1..2 loop
    perform set_config('request.jwt.claims', json_build_object('sub', case when n = 1 then soc else obs end, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if exists (select 1 from public.proposta_rascunho) then prob := prob || ' não-admin vê rascunho;'; end if;
    if exists (select 1 from public.parecer_proposta where not publicado) then prob := prob || ' não-admin vê parecer não publicado;'; end if;
    begin
      insert into public.proposta_rascunho (arquivo_caminho, arquivo_nome, arquivo_tipo, arquivo_tamanho) values ('b', 'b.pdf', 'pdf', 10);
      prob := prob || ' não-admin criou rascunho;';
    exception when others then null; end;
    update public.proposta_rascunho set status = 'aprovado' where id = rid;
    begin
      insert into storage.objects (bucket_id, name) values ('propostas', 'rascunho/intruso.pdf');
      prob := prob || ' não-admin subiu arquivo;';
    exception when others then null; end;
    execute 'reset role';
  end loop;
  if (select status from public.proposta_rascunho where id = rid) <> 'enviado' then prob := prob || ' não-admin alterou rascunho;'; end if;

  -- Publicado: sócio do grupo Sócios lê; observador não.
  update public.parecer_proposta set revisado = true, publicado = true where proposta_id = pid and texto = 'rascunho';
  perform set_config('request.jwt.claims', json_build_object('sub', soc, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.parecer_proposta where texto = 'rascunho') then prob := prob || ' sócio não lê parecer publicado;'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', obs, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if exists (select 1 from public.parecer_proposta) then prob := prob || ' observador lê parecer;'; end if;
  execute 'reset role';

  if not exists (select 1 from public.log_auditoria where tabela = 'proposta_rascunho' and quem = adm) then prob := prob || ' upload sem auditoria;'; end if;

  if prob = '' then raise exception 'OK · upload de propostas: rascunho e parecer só do Admin, publicação após revisão, auditoria'; end if;
  raise exception 'FALHA ·%', prob;
end $$;
