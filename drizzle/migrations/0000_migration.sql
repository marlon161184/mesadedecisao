
-- Papéis
create type public.app_role as enum ('admin','socio','observador');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  criado_em timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "ver proprio papel ou admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "membros veem perfis" on public.profiles for select to authenticated
  using (public.is_member(auth.uid()) or id = auth.uid());
create policy "editar proprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Novo usuário: cria perfil; o primeiro usuário vira admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auditoria
create table public.log_auditoria (
  id bigserial primary key,
  quem uuid,
  quando timestamptz not null default now(),
  tabela text not null,
  operacao text not null,
  registro text,
  antes jsonb,
  depois jsonb
);
grant select on public.log_auditoria to authenticated;
grant all on public.log_auditoria to service_role;
alter table public.log_auditoria enable row level security;
create policy "admin e socios leem auditoria" on public.log_auditoria for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'socio'));

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  reg text;
begin
  reg := coalesce(r->>'id', r->>'chave',
    concat_ws(':', r->>'criterio_id', r->>'cenario_id', r->>'portao_id', r->>'proposta_id', r->>'socio_id', r->>'modulo_id'));
  insert into public.log_auditoria (quem, tabela, operacao, registro, antes, depois)
  values (auth.uid(), tg_table_name, tg_op, reg,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Tabelas de domínio
create table public.rfp (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero in (1,2,3)),
  nome text not null,
  fase int not null default 1 check (fase in (1,2)),
  periodo text,
  status text not null default 'aberta',
  descricao text,
  janela_meses int not null default 6 check (janela_meses > 0)
);

create table public.modulo (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfp(id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text,
  peso_no_rfp numeric not null default 1 check (peso_no_rfp >= 0),
  essencial boolean not null default false,
  entrega_chave text
);

create table public.requisito (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.modulo(id) on delete cascade,
  descricao text not null,
  peso int not null default 3 check (peso between 1 and 5),
  criticidade text not null default 'desejavel' check (criticidade in ('essencial','desejavel')),
  fonte text,
  eliminatorio boolean not null default false
);

create table public.player (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null check (tipo in ('agencia','plataforma','consultoria','referencia')),
  cidade text,
  cor_token text,
  observacoes text,
  status text not null default 'proponente' check (status in ('proponente','referencia_sem_proposta','convidado'))
);

create table public.proposta (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player(id) on delete cascade,
  versao int not null default 1,
  data_proposta date,
  validade_dias int,
  validade_ate date generated always as (data_proposta + validade_dias) stored,
  contrato_meses_proposto int,
  fonte_arquivo text,
  status text not null default 'recebida' check (status in ('recebida','em_equalizacao','validada')),
  observacoes text
);

create table public.item_proposta (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  modulo_id uuid references public.modulo(id) on delete set null,
  descricao text not null,
  tipo_preco text not null check (tipo_preco in ('recorrente','pontual','variavel','por_credito')),
  valor_lista numeric,
  valor_negociado numeric,
  valor_min numeric,
  valor_max numeric,
  unidade text not null default 'mes' check (unidade in ('mes','projeto','produto_mes','percentual_verba')),
  multiplicador numeric not null default 1,
  incluido_no_subtotal_da_proposta boolean not null default true,
  incerteza text,
  fonte_pagina text,
  entrega_chave text
);

create table public.entrega_declarada (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  categoria text not null check (categoria in ('posts_instagram','videos_sociais','posts_linkedin','posts_corretores','pecas_endomarketing','placas_ooh','videos_painel')),
  quantidade_mes numeric not null default 0,
  e_teto boolean not null default false,
  observacao text
);

create table public.cobertura (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  requisito_id uuid not null references public.requisito(id) on delete cascade,
  nivel numeric check (nivel in (0, 0.5, 1)),
  evidencia text not null default 'nao_informado' check (evidencia in ('declarado','comprovado','nao_informado')),
  nota_tecnica text,
  custo_estimado_para_cobrir numeric,
  unique (proposta_id, requisito_id)
);

create table public.ponto_atencao (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('proposta','modulo','composicao')),
  referencia_id uuid,
  severidade text not null check (severidade in ('critico','alto','medio','info')),
  texto text not null,
  origem text not null default 'manual' check (origem in ('regra','manual')),
  regra_codigo text
);

create table public.comentario_tecnico (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid references public.proposta(id) on delete cascade,
  modulo_id uuid references public.modulo(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);

create table public.pergunta_filtro (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfp(id) on delete cascade,
  texto text not null
);

create table public.resposta_filtro (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.pergunta_filtro(id) on delete cascade,
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  resposta text,
  avaliacao text
);

create table public.premissa (
  chave text primary key,
  valor jsonb not null,
  descricao text
);

create table public.cenario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  autor uuid default auth.uid(),
  recomendado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.cenario_modulo (
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  modulo_id uuid not null references public.modulo(id) on delete cascade,
  proposta_id uuid references public.proposta(id) on delete set null,
  primary key (cenario_id, modulo_id)
);

create table public.criterio (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfp(id) on delete cascade,
  nome text not null,
  peso numeric not null check (peso >= 0 and peso <= 100),
  descricao text
);

create table public.portao (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfp(id) on delete cascade,
  descricao text not null,
  requisito_id uuid references public.requisito(id) on delete set null
);

create table public.portao_resultado (
  portao_id uuid not null references public.portao(id) on delete cascade,
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  resultado text not null default 'pendente' check (resultado in ('passa','reprova','pendente')),
  justificativa text,
  primary key (portao_id, proposta_id)
);

create table public.revelacao (
  rfp_id uuid primary key references public.rfp(id) on delete cascade,
  revelado_em timestamptz not null default now(),
  revelado_por uuid default auth.uid()
);

create table public.nota_socio (
  criterio_id uuid not null references public.criterio(id) on delete cascade,
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  socio_id uuid not null default auth.uid(),
  nota int not null check (nota between 1 and 5),
  justificativa text,
  enviado_em timestamptz not null default now(),
  primary key (criterio_id, proposta_id, socio_id)
);

create table public.voto (
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  socio_id uuid not null default auth.uid(),
  decisao text not null check (decisao in ('aprovar','aprovar_com_ressalvas','rejeitar')),
  justificativa text,
  criado_em timestamptz not null default now(),
  primary key (cenario_id, socio_id)
);

create table public.ata (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  texto text,
  ressalvas text,
  proximos_passos text,
  versao int not null default 1,
  gerada_em timestamptz not null default now()
);

-- Grants, RLS e políticas para tabelas curadas pelo Admin
do $$
declare t text;
begin
  foreach t in array array['rfp','modulo','requisito','player','proposta','item_proposta','entrega_declarada','cobertura','ponto_atencao','comentario_tecnico','pergunta_filtro','resposta_filtro','premissa','criterio','portao','portao_resultado','revelacao','ata']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "membros leem" on public.%I for select to authenticated using (public.is_member(auth.uid()))', t);
    execute format('create policy "admin insere" on public.%I for insert to authenticated with check (public.has_role(auth.uid(),''admin''))', t);
    execute format('create policy "admin altera" on public.%I for update to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t);
    execute format('create policy "admin exclui" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

-- Cenários: Admin e Sócios simulam; cada um edita os seus
grant select, insert, update, delete on public.cenario, public.cenario_modulo to authenticated;
grant all on public.cenario, public.cenario_modulo to service_role;
alter table public.cenario enable row level security;
alter table public.cenario_modulo enable row level security;
create policy "membros leem" on public.cenario for select to authenticated using (public.is_member(auth.uid()));
create policy "socio ou admin cria" on public.cenario for insert to authenticated
  with check ((public.has_role(auth.uid(),'socio') or public.has_role(auth.uid(),'admin')) and autor = auth.uid());
create policy "autor ou admin altera" on public.cenario for update to authenticated
  using (autor = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (autor = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "autor ou admin exclui" on public.cenario for delete to authenticated
  using (autor = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.pode_editar_cenario(_cenario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cenario c where c.id = _cenario
    and (c.autor = auth.uid() or public.has_role(auth.uid(),'admin')))
$$;
create policy "membros leem" on public.cenario_modulo for select to authenticated using (public.is_member(auth.uid()));
create policy "editor insere" on public.cenario_modulo for insert to authenticated with check (public.pode_editar_cenario(cenario_id));
create policy "editor altera" on public.cenario_modulo for update to authenticated using (public.pode_editar_cenario(cenario_id)) with check (public.pode_editar_cenario(cenario_id));
create policy "editor exclui" on public.cenario_modulo for delete to authenticated using (public.pode_editar_cenario(cenario_id));

-- Notas: cegas até a revelação do RFP
create or replace function public.notas_reveladas(_criterio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.criterio c join public.revelacao r on r.rfp_id = c.rfp_id where c.id = _criterio)
$$;
grant select, insert, update, delete on public.nota_socio, public.voto to authenticated;
grant all on public.nota_socio, public.voto to service_role;
alter table public.nota_socio enable row level security;
alter table public.voto enable row level security;
create policy "propria ou revelada" on public.nota_socio for select to authenticated
  using (socio_id = auth.uid() or (public.is_member(auth.uid()) and public.notas_reveladas(criterio_id)));
create policy "socio insere a sua" on public.nota_socio for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));
create policy "socio altera a sua" on public.nota_socio for update to authenticated
  using (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'))
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));
create policy "socio exclui a sua" on public.nota_socio for delete to authenticated
  using (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));

create policy "membros leem votos" on public.voto for select to authenticated using (public.is_member(auth.uid()));
create policy "socio vota" on public.voto for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));
create policy "socio altera voto" on public.voto for update to authenticated
  using (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'))
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));
create policy "socio exclui voto" on public.voto for delete to authenticated
  using (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));

-- Gatilhos de auditoria
do $$
declare t text;
begin
  foreach t in array array['rfp','modulo','requisito','player','proposta','item_proposta','entrega_declarada','cobertura','ponto_atencao','comentario_tecnico','resposta_filtro','premissa','criterio','portao','portao_resultado','revelacao','cenario','cenario_modulo','nota_socio','voto','ata','user_roles']
  loop
    execute format('create trigger auditoria_%s after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t, t);
  end loop;
end $$;

-- Dados de partida
insert into public.rfp (numero, nome, fase, periodo, status, descricao) values
 (1, 'Custódia da marca', 1, '6 meses', 'aberta', 'Guarda e evolução da marca NEWE na fase 1.'),
 (2, 'Criativo, dados, performance e CRM', 1, 'nov/2026 a abr/2027', 'aberta', 'Produção criativa, mídia de performance, dados e CRM.'),
 (3, 'Comercial: pitch, playbook, formação e acompanhamento do lead qualificado', 2, 'a partir de mai/2027', 'aberta', 'Estrutura comercial da fase 2.');

insert into public.player (nome, tipo, cor_token, status) values
 ('Rebu', 'agencia', 'flamboyant', 'proponente'),
 ('Folhetim', 'agencia', 'verde-cerrado', 'proponente'),
 ('XCV/WiVO', 'plataforma', 'ipe-do-cerrado', 'proponente'),
 ('F&MD', 'agencia', 'terracota', 'proponente');

insert into public.premissa (chave, valor, descricao) values
 ('janela_meses', '6', 'Janela de comparação em meses'),
 ('aplicar_desconto_negociado', 'true', 'Se falso, usa o valor de lista'),
 ('verba_midia_mensal', '50000', 'Verba de mídia mensal em R$'),
 ('meses_com_verba', '6', 'Meses com verba de mídia'),
 ('produtos_performance', '3', 'Marca + empreendimento 1 + empreendimento 2'),
 ('pct_gestao_midia_folhetim', '0.12', 'Percentual de gestão de mídia da Folhetim'),
 ('pct_comissao_midia_fmd', '0.20', 'Percentual de comissão de mídia da F&MD'),
 ('desconto_xcv_mensal', '0.50', 'Desconto sobre itens recorrentes de lista da XCV'),
 ('fator_evidencia_declarado', '1', 'Quanto vale um requisito declarado e não comprovado (1, 0.7 ou 0)'),
 ('volume_base_mensal', '{"posts_instagram":8,"videos_sociais":4,"posts_linkedin":4,"posts_corretores":4,"pecas_endomarketing":5,"placas_ooh":10,"videos_painel":2}', 'Escopo-base mensal para custo unitário');
