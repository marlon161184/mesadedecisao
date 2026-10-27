-- Teste do papel REUNIÃO (somente leitura). Roda inteiro num bloco que termina com
-- RAISE EXCEPTION, então tudo é desfeito: nenhum usuário, nota ou reunião de teste fica no banco.
-- Resultado esperado: erro "OK · ..." (sucesso) ou "FALHA · ..." (regra quebrada).
DO $$
declare
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); p uuid := gen_random_uuid();
  c_crit uuid; c_rfp uuid; c_prop uuid; c_cen uuid; rid uuid; n int; t record; col text; prob text := ''; info jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (s1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's1@teste.invalid', '{}', '{}', now(), now()),
    (s2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's2@teste.invalid', '{}', '{}', now(), now()),
    (p,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p@reuniao.newe.invalid', '{"reuniao":true}', '{"nome":"Convidada"}', now(), now());
  insert into public.user_roles (user_id, role) values (s1, 'socio'), (s2, 'socio');
  select c.id, c.rfp_id into c_crit, c_rfp from public.criterio c where not exists (select 1 from public.revelacao r where r.rfp_id = c.rfp_id) limit 1;
  select pr.id into c_prop from public.proposta pr limit 1;
  select id into c_cen from public.cenario limit 1;
  insert into public.nota_socio (criterio_id, proposta_id, socio_id, nota) values (c_crit, c_prop, s1, 4);
  insert into public.premorte (cenario_id, socio_id, texto) values (c_cen, s1, 'teste');
  insert into public.voto (cenario_id, socio_id, decisao, justificativa) values (c_cen, s1, 'aprovar', 'teste');
  insert into public.filtro_salvo (dono, nome, parametros) values (s1, 'teste', '{}');
  insert into storage.objects (bucket_id, name) values ('propostas', 'teste-rls/proposta.pdf');
  insert into public.reuniao (nome, token_hash, expira_em) values ('Teste RLS', encode(sha256('tok-teste'::bytea), 'hex'), now() + interval '4 hours') returning id into rid;
  insert into public.reuniao_participante (user_id, reuniao_id, nome, ip) values (p, rid, 'Convidada', '127.0.0.1');

  -- Age como a sessão de reunião
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.rfp; if n = 0 then prob := prob || ' não lê rfp;'; end if;
  select count(*) into n from public.item_proposta; if n = 0 then prob := prob || ' não lê itens;'; end if;
  select count(*) into n from public.nota_socio; if n > 0 then prob := prob || ' leu nota_socio antes da revelação;'; end if;
  select count(*) into n from public.premorte; if n > 0 then prob := prob || ' leu pré-mortem não revelado;'; end if;
  select count(*) into n from public.voto; if n > 0 then prob := prob || ' leu voto em andamento;'; end if;
  select count(*) into n from public.log_auditoria; if n > 0 then prob := prob || ' leu auditoria;'; end if;
  select count(*) into n from public.filtro_salvo; if n > 0 then prob := prob || ' leu filtro alheio;'; end if;
  select count(*) into n from public.proposta_arquivo; if n > 0 then prob := prob || ' leu lista de PDFs;'; end if;
  select count(*) into n from public.reuniao; if n > 0 then prob := prob || ' leu tabela de reuniões (hash);'; end if;
  -- URL assinada exige leitura do objeto no bucket privado
  select count(*) into n from storage.objects where bucket_id = 'propostas'; if n > 0 then prob := prob || ' enxerga PDF do bucket;'; end if;
  info := public.minha_reuniao(); if info is null or info->>'nome' <> 'Teste RLS' then prob := prob || ' selo sem dados;'; end if;

  -- Nenhuma escrita em nenhuma tabela pública
  for t in select tablename from pg_tables where schemaname = 'public' loop
    begin
      execute format('insert into public.%I select * from public.%I limit 1', t.tablename, t.tablename);
      get diagnostics n = row_count;
      if n > 0 then prob := prob || ' inseriu em ' || t.tablename || ';'; end if;
    exception when insufficient_privilege then null;
      when others then prob := prob || ' insert em ' || t.tablename || ' passou do RLS (' || sqlstate || ');';
    end;
    select a.attname into col from pg_attribute a where a.attrelid = ('public.' || quote_ident(t.tablename))::regclass and a.attnum > 0 and not a.attisdropped and a.attidentity = '' and a.attgenerated = '' order by a.attnum limit 1;
    begin
      execute format('update public.%I set %I = %I', t.tablename, col, col);
      get diagnostics n = row_count;
      if n > 0 then prob := prob || ' alterou ' || t.tablename || ';'; end if;
    exception when insufficient_privilege then null; end;
    begin
      execute format('delete from public.%I', t.tablename);
      get diagnostics n = row_count;
      if n > 0 then prob := prob || ' apagou de ' || t.tablename || ';'; end if;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into storage.objects (bucket_id, name) values ('propostas', 'teste-rls/intruso.pdf');
    prob := prob || ' enviou arquivo ao bucket;';
  exception when insufficient_privilege then null; end;

  -- Depois da revelação, a nota passa a ser visível
  execute 'reset role';
  insert into public.revelacao (rfp_id) values (c_rfp);
  execute 'set local role authenticated';
  select count(*) into n from public.nota_socio where socio_id = s1; if n <> 1 then prob := prob || ' não leu nota revelada;'; end if;

  -- Encerrar a reunião derruba o acesso na hora
  execute 'reset role';
  update public.reuniao set encerrada_em = now() where id = rid;
  execute 'set local role authenticated';
  select count(*) into n from public.rfp; if n > 0 then prob := prob || ' ainda lê depois de encerrada;'; end if;
  if public.minha_reuniao() is not null then prob := prob || ' selo ainda ativo depois de encerrada;'; end if;

  -- Expirada (sem encerramento) também derruba
  execute 'reset role';
  update public.reuniao set encerrada_em = null, expira_em = now() - interval '1 minute' where id = rid;
  execute 'set local role authenticated';
  select count(*) into n from public.rfp; if n > 0 then prob := prob || ' ainda lê depois de expirada;'; end if;

  -- 60 minutos sem atividade também derruba
  execute 'reset role';
  update public.reuniao set expira_em = now() + interval '1 hour' where id = rid;
  update public.reuniao_participante set ultimo_acesso = now() - interval '61 minutes' where user_id = p;
  execute 'set local role authenticated';
  select count(*) into n from public.rfp; if n > 0 then prob := prob || ' ainda lê após 60 min inativo;'; end if;

  execute 'reset role';
  if prob <> '' then raise exception 'FALHA ·%', prob; end if;
  raise exception 'OK · papel REUNIÃO só lê, respeita a revelação e cai ao encerrar (tudo desfeito)';
end $$;
