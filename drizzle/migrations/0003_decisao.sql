create table public.trilha_decisao (
  rfp_id uuid primary key references public.rfp(id) on delete cascade,
  pontuacao_aberta boolean not null default false,
  pontuacao_aberta_em timestamptz,
  encerrada_quorum boolean not null default false,
  cenario_candidato uuid references public.cenario(id) on delete set null,
  regra_decisao text not null default 'unanimidade' check (regra_decisao in ('unanimidade','maioria','sem_rejeicao')),
  votacao_aberta boolean not null default false,
  votacao_encerrada boolean not null default false,
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.trilha_decisao to authenticated;
grant all on public.trilha_decisao to service_role;
alter table public.trilha_decisao enable row level security;
create policy "membros leem" on public.trilha_decisao for select to authenticated using (public.is_member(auth.uid()));
create policy "admin insere" on public.trilha_decisao for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin altera" on public.trilha_decisao for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin') and (not votacao_aberta or regra_decisao is not null));
insert into public.trilha_decisao (rfp_id) select id from public.rfp on conflict do nothing;

alter table public.portao_resultado add column if not exists evidencia text;
alter table public.resposta_filtro add column if not exists sem_resposta boolean not null default false;

-- Notas: travadas depois do envio; justificativa obrigatória para 1, 2 e 5; só com pontuação aberta
alter table public.nota_socio add constraint nota_justificada check (nota in (3,4) or char_length(trim(coalesce(justificativa,''))) > 0);
drop policy if exists "socio altera a sua" on public.nota_socio;
drop policy if exists "socio exclui a sua" on public.nota_socio;
drop policy if exists "socio insere a sua" on public.nota_socio;
create or replace function public.pontuacao_aberta(_criterio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.criterio c join public.trilha_decisao t on t.rfp_id = c.rfp_id
    where c.id = _criterio and t.pontuacao_aberta)
  and not exists (select 1 from public.criterio c join public.revelacao r on r.rfp_id = c.rfp_id where c.id = _criterio)
$$;
create policy "socio insere a sua" on public.nota_socio for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio') and public.pontuacao_aberta(criterio_id));

-- Admin vê só quem enviou (sem valores)
create or replace function public.envios_pontuacao(_rfp uuid)
returns table (socio_id uuid, notas bigint, enviado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select n.socio_id, count(*), max(n.enviado_em) from public.nota_socio n join public.criterio c on c.id = n.criterio_id
  where c.rfp_id = _rfp and public.is_member(auth.uid()) group by n.socio_id
$$;

-- Pré-mortem
create table public.premorte (
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  socio_id uuid not null default auth.uid(),
  texto text not null check (char_length(texto) between 1 and 900 and array_length(string_to_array(texto, E'\n'),1) <= 5),
  enviado_em timestamptz not null default now(),
  primary key (cenario_id, socio_id)
);
grant select, insert on public.premorte to authenticated;
grant all on public.premorte to service_role;
alter table public.premorte enable row level security;
create or replace function public.premortes_visiveis(_cenario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.premorte p where p.cenario_id = _cenario)
       >= (select count(*) from public.user_roles where role = 'socio')
$$;
create policy "proprio ou todos enviaram" on public.premorte for select to authenticated
  using (socio_id = auth.uid() or (public.is_member(auth.uid()) and public.premortes_visiveis(cenario_id)));
create policy "socio envia o seu" on public.premorte for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio'));
create trigger auditoria_premorte after insert or update or delete on public.premorte for each row execute function public.registrar_auditoria();

-- Votos: só com votação aberta para o candidato, depois do pré-mortem, justificados e travados
create or replace function public.pode_votar(_cenario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trilha_decisao t where t.cenario_candidato = _cenario and t.votacao_aberta and not t.votacao_encerrada)
     and exists (select 1 from public.premorte p where p.cenario_id = _cenario and p.socio_id = auth.uid())
$$;
drop policy if exists "socio vota" on public.voto;
drop policy if exists "socio altera voto" on public.voto;
drop policy if exists "socio exclui voto" on public.voto;
alter table public.voto add constraint voto_justificado check (char_length(trim(coalesce(justificativa,''))) > 0) not valid;
create policy "socio vota" on public.voto for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio') and public.pode_votar(cenario_id));

-- Ata: versões, snapshot com hash, imutável depois de aprovada
alter table public.ata add column if not exists rfp_id uuid references public.rfp(id) on delete cascade;
alter table public.ata add column if not exists status text not null default 'rascunho' check (status in ('rascunho','aprovada'));
alter table public.ata add column if not exists conteudo jsonb;
alter table public.ata add column if not exists pontos_abertos jsonb not null default '[]'::jsonb;
alter table public.ata add column if not exists snapshot jsonb;
alter table public.ata add column if not exists snapshot_hash text;
alter table public.ata add column if not exists aprovada_em timestamptz;
alter table public.ata add column if not exists aprovada_por uuid;
alter table public.ata add column if not exists versao_anterior uuid references public.ata(id);
alter table public.ata add column if not exists justificativa_revisao text;
alter table public.ata add constraint ata_revisao_justificada check (versao_anterior is null or char_length(trim(coalesce(justificativa_revisao,''))) > 0);
alter table public.ata add constraint ata_aprovada_com_snapshot check (status <> 'aprovada' or (snapshot is not null and snapshot_hash is not null));
create or replace function public.proteger_ata()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'aprovada' then
    raise exception 'Ata aprovada é imutável. Crie uma nova versão com justificativa.';
  end if;
  return coalesce(new, old);
end $$;
create trigger ata_imutavel before update or delete on public.ata for each row execute function public.proteger_ata();

create table public.ata_aceite (
  ata_id uuid not null references public.ata(id) on delete restrict,
  socio_id uuid not null default auth.uid(),
  nome text not null,
  aceito_em timestamptz not null default now(),
  ip text,
  primary key (ata_id, socio_id)
);
grant select, insert on public.ata_aceite to authenticated;
grant all on public.ata_aceite to service_role;
alter table public.ata_aceite enable row level security;
create policy "membros leem" on public.ata_aceite for select to authenticated using (public.is_member(auth.uid()));
create policy "socio aceita ata aprovada" on public.ata_aceite for insert to authenticated
  with check (socio_id = auth.uid() and public.has_role(auth.uid(),'socio')
    and exists (select 1 from public.ata a where a.id = ata_id and a.status = 'aprovada'));
create trigger auditoria_ata_aceite after insert or update or delete on public.ata_aceite for each row execute function public.registrar_auditoria();

-- Exportações registradas no log
create table public.exportacao (
  id uuid primary key default gen_random_uuid(),
  quem uuid not null default auth.uid(),
  quando timestamptz not null default now(),
  tipo text not null,
  referencia text
);
grant select, insert on public.exportacao to authenticated;
grant all on public.exportacao to service_role;
alter table public.exportacao enable row level security;
create policy "admin e socios leem" on public.exportacao for select to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'socio'));
create policy "admin e socios exportam" on public.exportacao for insert to authenticated
  with check (quem = auth.uid() and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'socio')));
create trigger auditoria_exportacao after insert on public.exportacao for each row execute function public.registrar_auditoria();

-- Arquivos originais das propostas (bucket privado)
create table public.proposta_arquivo (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  versao int not null default 1,
  caminho text not null unique,
  nome text not null,
  enviado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.proposta_arquivo to authenticated;
grant all on public.proposta_arquivo to service_role;
alter table public.proposta_arquivo enable row level security;
create policy "membros leem" on public.proposta_arquivo for select to authenticated using (public.is_member(auth.uid()));
create policy "admin insere" on public.proposta_arquivo for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin exclui" on public.proposta_arquivo for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger auditoria_proposta_arquivo after insert or update or delete on public.proposta_arquivo for each row execute function public.registrar_auditoria();
create trigger auditoria_trilha after insert or update or delete on public.trilha_decisao for each row execute function public.registrar_auditoria();

create policy "membros leem propostas" on storage.objects for select to authenticated
  using (bucket_id = 'propostas' and public.is_member(auth.uid()));
create policy "admin envia propostas" on storage.objects for insert to authenticated
  with check (bucket_id = 'propostas' and public.has_role(auth.uid(),'admin'));
create policy "admin remove propostas" on storage.objects for delete to authenticated
  using (bucket_id = 'propostas' and public.has_role(auth.uid(),'admin'));

insert into public.premissa (chave, valor, descricao) values ('ia_parecer_habilitada', 'false'::jsonb, 'Redação de parecer com IA (desligada por padrão)') on conflict (chave) do nothing;