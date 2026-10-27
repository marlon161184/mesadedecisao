
alter table public.item_proposta add column if not exists cronograma_pagamento jsonb,
  add column if not exists teto_verba_mensal numeric;
comment on column public.item_proposta.cronograma_pagamento is 'Lista de parcelas [{"dias":0,"pct":50}]. Vazio: recorrente mensal, pontual 100% no mês 1.';

alter table public.cenario add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists parecer text,
  add column if not exists parecer_revisado boolean not null default false,
  add column if not exists versao int not null default 1,
  add column if not exists atualizado_em timestamptz not null default now();
create unique index if not exists cenario_um_recomendado on public.cenario (recomendado) where recomendado;

alter table public.cenario_modulo add column if not exists opcao text not null default 'player' check (opcao in ('player','a_cotar','interno')),
  add column if not exists comentario text;

create table public.cenario_versao (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  versao int not null,
  snapshot jsonb not null,
  autor uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
grant select, insert on public.cenario_versao to authenticated;
grant all on public.cenario_versao to service_role;
alter table public.cenario_versao enable row level security;
create policy "membros leem" on public.cenario_versao for select to authenticated using (public.is_member(auth.uid()));
create policy "editor registra" on public.cenario_versao for insert to authenticated with check (public.pode_editar_cenario(cenario_id));

create table public.cenario_comentario (
  id uuid primary key default gen_random_uuid(),
  cenario_id uuid not null references public.cenario(id) on delete cascade,
  autor uuid not null default auth.uid(),
  texto text not null check (length(texto) between 1 and 4000),
  criado_em timestamptz not null default now()
);
grant select, insert, delete on public.cenario_comentario to authenticated;
grant all on public.cenario_comentario to service_role;
alter table public.cenario_comentario enable row level security;
create policy "membros leem" on public.cenario_comentario for select to authenticated using (public.is_member(auth.uid()));
create policy "socio comenta" on public.cenario_comentario for insert to authenticated
  with check (autor = auth.uid() and public.has_role(auth.uid(),'socio'));
create policy "autor apaga" on public.cenario_comentario for delete to authenticated using (autor = auth.uid());
create trigger auditoria_cenario_comentario after insert or update or delete on public.cenario_comentario for each row execute function public.registrar_auditoria();

-- Recomendar exige ser sócio ou admin (qualquer um deles pode trocar o recomendado)
create or replace function public.recomendar_cenario(_cenario uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(),'socio') or public.has_role(auth.uid(),'admin')) then
    raise exception 'Sem permissão.';
  end if;
  update public.cenario set recomendado = false where recomendado and id <> _cenario;
  update public.cenario set recomendado = true where id = _cenario;
end $$;
grant execute on function public.recomendar_cenario(uuid) to authenticated;

-- Dados: cronogramas, teto de verba e premissa de data de decisão
update public.item_proposta i set cronograma_pagamento = '[{"dias":0,"pct":33.3333},{"dias":30,"pct":33.3333},{"dias":60,"pct":33.3334}]'
  from public.proposta p join public.player pl on pl.id = p.player_id where i.proposta_id = p.id and pl.nome = 'Rebu';
update public.item_proposta i set cronograma_pagamento = '[{"dias":0,"pct":50},{"dias":30,"pct":25},{"dias":60,"pct":25}]'
  from public.proposta p join public.player pl on pl.id = p.player_id
  where i.proposta_id = p.id and pl.nome = 'XCV/WiVO' and i.descricao in ('Hero Brand Production','Vídeo manifesto original de até 180 s');
update public.item_proposta i set cronograma_pagamento = '[{"dias":0,"pct":50},{"dias":30,"pct":50}]'
  from public.proposta p join public.player pl on pl.id = p.player_id
  where i.proposta_id = p.id and pl.nome = 'XCV/WiVO' and i.descricao like 'Interativo e presença digital%';
update public.item_proposta set teto_verba_mensal = 50000 where descricao like 'Ativação digital e gestão de tráfego%';
insert into public.premissa (chave, valor, descricao) values
 ('data_decisao', 'null', 'Data prevista da decisão (aaaa-mm-dd). Propostas que vencem antes dela geram alerta crítico.')
on conflict (chave) do nothing;

-- Cenários iniciais A–D
insert into public.cenario (nome, descricao, autor, config) values
 ('A · Rebu + Folhetim + F&MD', 'C3 e C4 Rebu; P1 e P4 Folhetim; P2 F&MD; P3 a cotar.', null, '{"incluirNaoValidadas":true}'),
 ('B · Rebu + XCV', 'C3 e C4 Rebu; P1, P2, P3 e P4 XCV.', null, '{"incluirNaoValidadas":true}'),
 ('C · XCV integral com Rebu na custódia', 'C3 Rebu; C4, P1, P2, P3 e P4 XCV.', null, '{"incluirNaoValidadas":true}'),
 ('D · Rebu + F&MD', 'C3 e C4 Rebu; P1, P2 e P4 F&MD; P3 a cotar.', null, '{"incluirNaoValidadas":true}');

insert into public.cenario_modulo (cenario_id, modulo_id, proposta_id, opcao)
select c.id, m.id, pr.id, case when v.player is null then 'a_cotar' else 'player' end
from (values
 ('A','C3','Rebu'),('A','C4','Rebu'),('A','P1','Folhetim'),('A','P4','Folhetim'),('A','P2','F&MD'),('A','P3',null),
 ('B','C3','Rebu'),('B','C4','Rebu'),('B','P1','XCV/WiVO'),('B','P2','XCV/WiVO'),('B','P3','XCV/WiVO'),('B','P4','XCV/WiVO'),
 ('C','C3','Rebu'),('C','C4','XCV/WiVO'),('C','P1','XCV/WiVO'),('C','P2','XCV/WiVO'),('C','P3','XCV/WiVO'),('C','P4','XCV/WiVO'),
 ('D','C3','Rebu'),('D','C4','Rebu'),('D','P1','F&MD'),('D','P2','F&MD'),('D','P4','F&MD'),('D','P3',null)
) v(cen, modulo, player)
join public.cenario c on c.nome like v.cen || ' ·%'
join public.modulo m on m.codigo = v.modulo
left join public.player pl on pl.nome = v.player
left join public.proposta pr on pr.player_id = pl.id;
