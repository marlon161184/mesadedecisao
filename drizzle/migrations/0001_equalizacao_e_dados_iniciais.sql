
-- Novas colunas
alter table public.player add column if not exists rfp_numeros int[] not null default '{}';
alter table public.requisito add column if not exists codigo text;
alter table public.proposta add column if not exists tributos text, add column if not exists desconto_explicito text,
  add column if not exists reajuste text, add column if not exists exclusoes text;
alter table public.item_proposta add column if not exists sujeito_desconto_lista boolean not null default false,
  add column if not exists premissa_imputacao text;
alter table public.cobertura add column if not exists fonte_pagina text,
  add column if not exists avaliado_por uuid default auth.uid(), add column if not exists avaliado_em timestamptz not null default now();
alter table public.ponto_atencao add column if not exists acao_sugerida text;

-- Checklist de equalização
create table public.checklist_equalizacao (
  proposta_id uuid not null references public.proposta(id) on delete cascade,
  chave text not null check (chave in ('tributos','desconto','contrato_janela','fora_subtotal','verba_comissao','reajuste','validade','exclusoes','itens_mapeados','fonte_pagina')),
  concluido boolean not null default false,
  observacao text,
  atualizado_em timestamptz not null default now(),
  primary key (proposta_id, chave)
);
grant select, insert, update, delete on public.checklist_equalizacao to authenticated;
grant all on public.checklist_equalizacao to service_role;
alter table public.checklist_equalizacao enable row level security;
create policy "membros leem" on public.checklist_equalizacao for select to authenticated using (public.is_member(auth.uid()));
create policy "admin insere" on public.checklist_equalizacao for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin altera" on public.checklist_equalizacao for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin exclui" on public.checklist_equalizacao for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger auditoria_checklist_equalizacao after insert or update or delete on public.checklist_equalizacao for each row execute function public.registrar_auditoria();

-- Fluxo de status: Recebida -> Em equalização -> Validada (com checklist completo)
create or replace function public.validar_fluxo_proposta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'validada' and old.status is distinct from 'validada' then
    if old.status <> 'em_equalizacao' then
      raise exception 'A proposta precisa passar por Em equalização antes de ser validada.';
    end if;
    if (select count(*) from public.checklist_equalizacao where proposta_id = new.id and concluido) < 10 then
      raise exception 'Conclua os 10 itens do checklist de equalização antes de validar.';
    end if;
  end if;
  return new;
end $$;
create trigger fluxo_proposta before update on public.proposta for each row execute function public.validar_fluxo_proposta();

-- Filtros salvos por pessoa
create table public.filtro_salvo (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid(),
  nome text not null,
  parametros jsonb not null,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.filtro_salvo to authenticated;
grant all on public.filtro_salvo to service_role;
alter table public.filtro_salvo enable row level security;
create policy "dono le" on public.filtro_salvo for select to authenticated using (dono = auth.uid());
create policy "dono cria" on public.filtro_salvo for insert to authenticated with check (dono = auth.uid() and public.is_member(auth.uid()));
create policy "dono altera" on public.filtro_salvo for update to authenticated using (dono = auth.uid()) with check (dono = auth.uid());
create policy "dono exclui" on public.filtro_salvo for delete to authenticated using (dono = auth.uid());

-- ===== Dados iniciais =====
insert into public.premissa (chave, valor, descricao) values
 ('imputacao_rebu_c3', '0.5', 'Fração do contrato de consultoria da Rebu (C3) imputada na janela')
on conflict (chave) do nothing;

update public.rfp set periodo = '6 meses (fase 1)' where numero = 1;
update public.rfp set periodo = 'nov/2026 a abr/2027' where numero = 2;
update public.rfp set periodo = 'a partir de mai/2027', nome = 'Comercial' where numero = 3;

insert into public.modulo (rfp_id, codigo, nome, peso_no_rfp, essencial, entrega_chave, descricao)
select r.id, v.codigo, v.nome, v.peso, v.ess, v.ent, v.descr from (values
 (1,'C1','Transição do branding',15,false,null,null),
 (1,'C2','Calendário e portfólio de desdobramentos',15,false,null,null),
 (1,'C3','Validação, porta única',30,true,null,null),
 (1,'C4','Ativos e materiais institucionais',25,false,'ativos_foto_video',null),
 (1,'C5','Consultoria de ativações',15,false,null,null),
 (2,'P1','Criativo e canais',35,false,null,null),
 (2,'P2','Dados e performance',25,false,null,null),
 (2,'P3','CRM e governança do dado',30,false,'crm',null),
 (2,'P4','Site e landing pages',10,false,'site',null),
 (3,'V1','Imersão e pitch',25,false,null,null),
 (3,'V2','Playbook comercial',25,false,null,null),
 (3,'V3','Formação e role play',20,false,null,null),
 (3,'V4','Acompanhamento do lead qualificado',25,false,null,null),
 (3,'V5','Pós-venda e comunidade',5,false,null,'Módulo opcional')
) v(rfp, codigo, nome, peso, ess, ent, descr) join public.rfp r on r.numero = v.rfp;

update public.player set tipo='agencia', observacoes='Agência de branding, autora do brandbook V1.0.', rfp_numeros='{1}' where nome='Rebu';
update public.player set tipo='agencia', observacoes='Agência criativa.', rfp_numeros='{2}' where nome='Folhetim';
update public.player set tipo='agencia', observacoes='Agência com IA, martech e CRM próprio (WiVO). Itens de ativos também no RFP 1.', rfp_numeros='{1,2}' where nome='XCV/WiVO';
update public.player set tipo='agencia', cidade='São José do Rio Preto', observacoes='Agência de propaganda e performance imobiliária.', rfp_numeros='{2}' where nome='F&MD';
insert into public.player (nome, tipo, cor_token, status, observacoes, rfp_numeros) values
 ('Ferreirinha','consultoria','terra-vermelha','referencia_sem_proposta','Referência para o RFP 3, sem proposta.','{3}'),
 ('Academias customizadas','referencia','cinza-quente-1','referencia_sem_proposta','Referência para o RFP 3, sem proposta.','{3}'),
 ('Volumetry','plataforma','cinza-quente-2','referencia_sem_proposta','Referência para o RFP 2, sem proposta.','{2}');

insert into public.proposta (player_id, versao, data_proposta, validade_dias, contrato_meses_proposto, fonte_arquivo, status, observacoes, desconto_explicito, exclusoes)
select pl.id, v.versao, v.data::date, v.val, v.contrato, v.fonte, 'recebida', v.obs, v.desc, v.excl from (values
 ('Rebu',4,'2026-10-19',30,12,'Proposta Rebu V4',null,null,'Aplicações gráficas dos materiais (item 01 das considerações gerais); materiais e gifts; consultoria de ativações.'),
 ('Folhetim',1,null,null,6,'Proposta Folhetim out/2026','Proposta de out/2026, sem dia informado.',null,'Crédito do mês não transfere; crédito avulso custa 25% a mais. Não oferece dados nem CRM.'),
 ('XCV/WiVO',1,'2026-10-26',null,6,'Proposta XCV/WiVO 26/10/2026',null,'50% sobre os valores mensais de lista, na própria proposta.',null),
 ('F&MD',1,null,null,12,'Proposta F&MD Always On','Proposta sem data. Always On.',null,'Exclui produção de foto, vídeo e modelos. Diz não contemplar performance e gestão de redes, o que contradiz entregas do próprio escopo.')
) v(player, versao, data, val, contrato, fonte, obs, "desc", excl) join public.player pl on pl.nome = v.player;

insert into public.item_proposta (proposta_id, modulo_id, descricao, tipo_preco, valor_lista, valor_negociado, valor_min, valor_max, unidade, multiplicador, incluido_no_subtotal_da_proposta, incerteza, fonte_pagina, entrega_chave, sujeito_desconto_lista, premissa_imputacao)
select pr.id, m.id, v.descr, v.tipo, v.lista, v.neg, v.vmin, v.vmax, v.unid, 1, v.sub, v.inc, v.fonte, v.ent, v.suj, v.imp from (values
 ('Rebu','C4','Fotos e vídeos: 60 clipes de IA de até 5 s, 40 fotos sem pessoas, 20 com pessoas','pontual',300000::numeric,null::numeric,null::numeric,null::numeric,'projeto',true,null,'Proposta V4','ativos_foto_video',false,null),
 ('Rebu','C4','Vídeo manifesto de até 1 min','pontual',45000,null,null,null,'projeto',true,null,'Proposta V4','manifesto',false,null),
 ('Rebu','C3','Consultoria e acompanhamento, até 5 h por mês durante 12 meses (valor total do contrato)','pontual',200000,null,null,null,'projeto',true,'Valor de 12 meses; na janela imputa-se a fração da premissa imputacao_rebu_c3.','Proposta V4',null,false,'imputacao_rebu_c3'),
 ('Folhetim','P1','Fee em créditos: 110 créditos de R$ 500 por mês','recorrente',55000,null,null,null,'mes',true,null,'Proposta out/2026',null,false,null),
 ('Folhetim','P2','Gestão de mídia paga: 12% sobre a verba','variavel',0.12,null,null,null,'percentual_verba',true,null,'Proposta out/2026','gestao_midia',false,null),
 ('Folhetim','P4','Site em Astro com CMS','pontual',null,null,40000,70000,'projeto',true,'Faixa de 40 a 70 mil.','Proposta out/2026','site',false,null),
 ('XCV/WiVO','P1','Estratégia, direção, BI e Marketing Studio','recorrente',15256.39,null,null,null,'mes',true,null,'Proposta 26/10/2026',null,true,null),
 ('XCV/WiVO','P1','Gestão, atendimento, design digital e produção','recorrente',11500,null,null,null,'mes',true,null,'Proposta 26/10/2026',null,true,null),
 ('XCV/WiVO','P1','Social media','recorrente',9980,null,null,null,'mes',true,null,'Proposta 26/10/2026',null,true,null),
 ('XCV/WiVO','P1','Sales enablement','recorrente',6500,null,null,null,'mes',true,null,'Proposta 26/10/2026',null,true,null),
 ('XCV/WiVO','P1','Produção offline','recorrente',15000,null,null,null,'mes',true,null,'Proposta 26/10/2026',null,true,null),
 ('XCV/WiVO','P2','Ativação digital e gestão de tráfego, até R$ 50 mil de verba','recorrente',6000,null,null,null,'mes',true,null,'Proposta 26/10/2026','gestao_midia',true,null),
 ('XCV/WiVO','P3','Tecnologia e MarTech: sistema WiVO customizado','recorrente',10000,null,null,null,'mes',true,null,'Proposta 26/10/2026','crm',true,null),
 ('XCV/WiVO','P3','Customer Services WiVO: setup','pontual',3500,null,null,null,'projeto',false,'Fora do subtotal da proposta.','Proposta 26/10/2026','crm',false,null),
 ('XCV/WiVO','P3','Customer Services WiVO: mensalidade a partir de','recorrente',1500,null,null,null,'mes',false,'Mensalidade "a partir de"; 2 canais, 10.000 contatos, 5 colaboradores. Fora do subtotal.','Proposta 26/10/2026','crm',false,null),
 ('XCV/WiVO','C4','Hero Brand Production','pontual',144285.71,129066.67,null,null,'projeto',true,null,'Proposta 26/10/2026','ativos_foto_video',false,null),
 ('XCV/WiVO','C4','Vídeo manifesto original de até 180 s','pontual',125000,109000,null,null,'projeto',true,null,'Proposta 26/10/2026','manifesto',false,null),
 ('XCV/WiVO','P4','Interativo e presença digital: site e agente de IA','pontual',85000,51000,null,null,'projeto',true,'Manutenção de R$ 2.000 por mês consta no bloco; confirmar se está incluída.','Proposta 26/10/2026','site',false,null),
 ('F&MD','P1','Day by day','recorrente',14331.67,null,null,null,'mes',true,null,'Proposta Always On',null,false,null),
 ('F&MD','P1','Social Meta','recorrente',8320,null,null,null,'mes',true,null,'Proposta Always On',null,false,null),
 ('F&MD','P1','LinkedIn','recorrente',2240,null,null,null,'mes',true,null,'Proposta Always On',null,false,null),
 ('F&MD','P2','Squad de performance, por produto por mês','recorrente',3350,null,null,null,'produto_mes',true,'Divergência: a proposta também traz 3.500 por produto por mês.','Proposta Always On',null,false,null),
 ('F&MD','P2','Comissão de 20% sobre a mídia','variavel',0.20,null,null,null,'percentual_verba',true,null,'Proposta Always On','gestao_midia',false,null),
 ('F&MD','P4','Site','pontual',15000,null,null,null,'projeto',true,null,'Proposta Always On','site',false,null),
 ('F&MD','P4','Landing page','pontual',6000,null,null,null,'projeto',true,null,'Proposta Always On','site',false,null),
 ('F&MD','P4','3 landing pages de pesquisa','pontual',18000,null,null,null,'projeto',true,null,'Proposta Always On','site',false,null)
) v(player, modulo, descr, tipo, lista, neg, vmin, vmax, unid, sub, inc, fonte, ent, suj, imp)
join public.player pl on pl.nome = v.player join public.proposta pr on pr.player_id = pl.id
join public.modulo m on m.codigo = v.modulo;

insert into public.entrega_declarada (proposta_id, categoria, quantidade_mes, e_teto)
select pr.id, v.cat, v.qtd, v.teto from (values
 ('Folhetim','posts_instagram',8,false),('Folhetim','videos_sociais',4,false),('Folhetim','posts_linkedin',4,false),('Folhetim','posts_corretores',4,false),('Folhetim','pecas_endomarketing',5,false),('Folhetim','placas_ooh',10,false),('Folhetim','videos_painel',2,false),
 ('XCV/WiVO','posts_instagram',20,true),('XCV/WiVO','videos_sociais',8,false),('XCV/WiVO','posts_linkedin',20,false),('XCV/WiVO','posts_corretores',4,false),('XCV/WiVO','pecas_endomarketing',5,false),('XCV/WiVO','placas_ooh',10,false),
 ('F&MD','posts_instagram',8,false),('F&MD','videos_sociais',4,false),('F&MD','posts_linkedin',4,false),('F&MD','posts_corretores',4,false),('F&MD','pecas_endomarketing',5,false),('F&MD','placas_ooh',10,false),('F&MD','videos_painel',2,false)
) v(player, cat, qtd, teto) join public.player pl on pl.nome = v.player join public.proposta pr on pr.player_id = pl.id;

insert into public.requisito (modulo_id, codigo, descricao, peso, criticidade, eliminatorio, fonte)
select m.id, v.cod, v.descr, v.peso, case when v.ess then 'essencial' else 'desejavel' end, v.elim, v.fonte from (values
 ('P1','Q1.1','Produção recorrente do volume-base',5,true,false,'Briefing RFP 2'),
 ('P1','Q1.2','Eventos e réguas: Conversas, Festival, Encontros e 3 réguas',5,true,false,'Briefing RFP 2'),
 ('P1','Q1.3','Pesquisas com cliente, prospect e corretor',3,false,false,'Briefing RFP 2'),
 ('P1','Q1.4','Material comercial',3,false,false,'Briefing RFP 2'),
 ('P1','Q1.5','Estratégia antes da produção: brief aprovado e metas por trimestre',5,true,false,'Briefing RFP 2'),
 ('P1','Q1.6','Protocolo de testes A/B e retroalimentação ao CRM',5,true,false,'Briefing RFP 2'),
 ('P1','Q1.7','Aderência ao tom NEWE',5,true,false,'Briefing RFP 2'),
 ('P1','Q1.8','Produção de foto e vídeo',3,false,false,'Briefing RFP 2'),
 ('P2','Q2.1','Funil e dicionário de dados',5,true,false,'Briefing RFP 2'),
 ('P2','Q2.2','Indicadores e dashboards',5,true,false,'Briefing RFP 2'),
 ('P2','Q2.3','Prova de dados até a venda',5,true,false,'Briefing RFP 2'),
 ('P2','Q2.4','Gestão de mídia multicanal',3,false,false,'Briefing RFP 2'),
 ('P2','Q2.5','Integração mídia–CRM',4,true,false,'Briefing RFP 2'),
 ('P2','Q2.6','Linha de base e retroalimentação',4,true,false,'Briefing RFP 2'),
 ('P3','Q3.1','Propriedade e portabilidade total do dado, sem custo',5,true,true,'Briefing RFP 2'),
 ('P3','Q3.2','Perfis de acesso por papel para imobiliárias e parceiros',4,true,false,'Briefing RFP 2'),
 ('P3','Q3.3','Trilha de auditoria',4,true,true,'Briefing RFP 2'),
 ('P3','Q3.4','LGPD: consentimento, finalidade, retenção e relatório',5,true,true,'Briefing RFP 2'),
 ('P3','Q3.5','Origem, atribuição e duplicidade entre canais',4,true,false,'Briefing RFP 2'),
 ('P3','Q3.6','Integrações com formulários, Meta, Google, WhatsApp, e-mail e sistema de gestão',4,true,false,'Briefing RFP 2'),
 ('P3','Q3.7','Custo total em 12 e 24 meses',3,false,false,'Briefing RFP 2'),
 ('P3','Q3.8','Implantação, migração e treinamento',3,false,false,'Briefing RFP 2'),
 ('P4','Q4.1','Código, CMS e acessos entregues à NEWE',4,true,false,'Briefing RFP 2'),
 ('P4','Q4.2','SEO e busca por IA',3,false,false,'Briefing RFP 2'),
 ('P4','Q4.3','Landing pages e funis integrados ao CRM',4,true,false,'Briefing RFP 2'),
 ('P4','Q4.4','Agente de IA no site',2,false,false,'Briefing RFP 2'),
 ('C1','R1.1','Plano de transição do brandbook ao uso diário',4,true,false,'Briefing RFP 1'),
 ('C1','R1.2','Guia de uso para agências e time',3,false,false,'Briefing RFP 1'),
 ('C2','R2.1','Calendário de ações mês a mês',4,true,false,'Briefing RFP 1'),
 ('C2','R2.2','Portfólio de desdobramentos',3,false,false,'Briefing RFP 1'),
 ('C3','R3.1','Modelo de validação em níveis com SLA',5,true,true,'Briefing RFP 1'),
 ('C3','R3.2','Capacidade para 40 a 50 peças por mês',5,true,false,'Briefing RFP 1'),
 ('C3','R3.3','Relatório mensal de aderência',3,false,false,'Briefing RFP 1'),
 ('C3','R3.4','Política de conflito entre quem custodia e quem produz',4,true,false,'Briefing RFP 1'),
 ('C4','R4.1','Evolução de fotos e vídeos institucionais',5,true,false,'Briefing RFP 1'),
 ('C4','R4.2','Materiais e gifts para clientes',3,false,false,'Briefing RFP 1'),
 ('C4','R4.3','Aplicações gráficas dos materiais',3,false,false,'Briefing RFP 1'),
 ('C4','R4.4','Vídeo manifesto',3,false,false,'Briefing RFP 1'),
 ('C5','R5.1','Consultoria de ativações',4,true,false,'Briefing RFP 1'),
 ('V1','S1.1','Imersão na marca',3,false,false,'Briefing RFP 3'),
 ('V1','S1.2','Diagnóstico do pitch atual',3,false,false,'Briefing RFP 3'),
 ('V1','S1.3','Pitch no tom NEWE',3,false,false,'Briefing RFP 3'),
 ('V2','S2.1','Playbook por etapa do funil',3,false,false,'Briefing RFP 3'),
 ('V2','S2.2','Tratamento de objeções',3,false,false,'Briefing RFP 3'),
 ('V2','S2.3','Regras de registro no CRM',3,false,false,'Briefing RFP 3'),
 ('V2','S2.4','Apoio às políticas comerciais',3,false,false,'Briefing RFP 3'),
 ('V3','S3.1','Formação de time e corretores',3,false,false,'Briefing RFP 3'),
 ('V3','S3.2','Role play com casos reais',3,false,false,'Briefing RFP 3'),
 ('V3','S3.3','Trilha com certificação',3,false,false,'Briefing RFP 3'),
 ('V3','S3.4','Materiais replicáveis',3,false,false,'Briefing RFP 3'),
 ('V4','S4.1','Acompanhamento semanal do lead qualificado',3,false,false,'Briefing RFP 3'),
 ('V4','S4.2','Leitura de indicadores com a liderança',3,false,false,'Briefing RFP 3'),
 ('V4','S4.3','Ajustes de pitch e playbook',3,false,false,'Briefing RFP 3'),
 ('V5','S5.1','Conceito de relacionamento e Comunidade NEWE',3,false,false,'Briefing RFP 3')
) v(modulo, cod, descr, peso, ess, elim, fonte) join public.modulo m on m.codigo = v.modulo;

-- R3.4 é portão eliminatório no RFP 1
update public.requisito set eliminatorio = true where codigo = 'R3.4';

insert into public.cobertura (proposta_id, requisito_id, nivel, evidencia, nota_tecnica, avaliado_por)
select pr.id, r.id, v.nivel, v.ev, v.nota, null from (values
 ('Folhetim','Q1.1',1::numeric,'declarado',null::text),('XCV/WiVO','Q1.1',1,'declarado',null),('F&MD','Q1.1',1,'declarado',null),
 ('Folhetim','Q1.2',1,'declarado',null),('XCV/WiVO','Q1.2',0.5,'declarado',null),('F&MD','Q1.2',1,'declarado',null),
 ('Folhetim','Q1.3',1,'declarado',null),('XCV/WiVO','Q1.3',0.5,'declarado',null),('F&MD','Q1.3',0.5,'declarado',null),
 ('Folhetim','Q1.4',1,'declarado',null),('XCV/WiVO','Q1.4',1,'declarado',null),('F&MD','Q1.4',1,'declarado',null),
 ('Folhetim','Q1.5',1,'declarado',null),('XCV/WiVO','Q1.5',1,'declarado',null),('F&MD','Q1.5',null,'nao_informado',null),
 ('Folhetim','Q1.6',null,'nao_informado',null),('XCV/WiVO','Q1.6',0.5,'declarado',null),('F&MD','Q1.6',null,'nao_informado',null),
 ('Folhetim','Q1.7',null,'nao_informado',null),('XCV/WiVO','Q1.7',null,'nao_informado',null),('F&MD','Q1.7',0.5,'declarado','A proposta chama a marca de "NEWE Construtora" e lista entregáveis genéricos.'),
 ('Folhetim','Q1.8',0,'declarado',null),('XCV/WiVO','Q1.8',1,'declarado',null),('F&MD','Q1.8',0,'declarado',null),
 ('Folhetim','Q2.1',0,'declarado',null),('XCV/WiVO','Q2.1',0.5,'declarado',null),('F&MD','Q2.1',0.5,'declarado',null),
 ('Folhetim','Q2.2',0.5,'declarado',null),('XCV/WiVO','Q2.2',1,'declarado',null),('F&MD','Q2.2',1,'declarado',null),
 ('Folhetim','Q2.3',null,'nao_informado',null),('XCV/WiVO','Q2.3',null,'nao_informado',null),('F&MD','Q2.3',1,'declarado','Portfólio de 26 incorporadoras e mais de 140 empreendimentos; não comprovado.'),
 ('Folhetim','Q2.4',1,'declarado',null),('XCV/WiVO','Q2.4',1,'declarado',null),('F&MD','Q2.4',1,'declarado',null),
 ('Folhetim','Q2.5',0,'declarado',null),('XCV/WiVO','Q2.5',1,'declarado',null),('F&MD','Q2.5',1,'declarado',null),
 ('Folhetim','Q2.6',null,'nao_informado',null),('XCV/WiVO','Q2.6',null,'nao_informado',null),('F&MD','Q2.6',null,'nao_informado',null),
 ('XCV/WiVO','Q3.1',null,'nao_informado',null),
 ('XCV/WiVO','Q3.2',0.5,'declarado','Apenas 5 colaboradores.'),
 ('XCV/WiVO','Q3.3',null,'nao_informado',null),
 ('XCV/WiVO','Q3.4',null,'nao_informado',null),
 ('XCV/WiVO','Q3.5',null,'nao_informado',null),
 ('XCV/WiVO','Q3.6',1,'declarado',null),
 ('XCV/WiVO','Q3.7',0,'declarado',null),
 ('XCV/WiVO','Q3.8',0.5,'declarado',null),
 ('Folhetim','Q4.1',1,'declarado',null),('XCV/WiVO','Q4.1',null,'nao_informado',null),('F&MD','Q4.1',null,'nao_informado',null),
 ('Folhetim','Q4.2',0,'declarado',null),('XCV/WiVO','Q4.2',1,'declarado',null),('F&MD','Q4.2',1,'declarado',null),
 ('Folhetim','Q4.3',0.5,'declarado',null),('XCV/WiVO','Q4.3',1,'declarado',null),('F&MD','Q4.3',0.5,'declarado',null),
 ('Folhetim','Q4.4',0,'declarado',null),('XCV/WiVO','Q4.4',1,'declarado',null),('F&MD','Q4.4',0,'declarado',null),
 ('Rebu','R1.1',0.5,'declarado','Workshop inicial.'),
 ('Rebu','R1.2',null,'nao_informado',null),
 ('Rebu','R2.1',null,'nao_informado',null),
 ('Rebu','R2.2',null,'nao_informado',null),
 ('Rebu','R3.1',0.5,'declarado','Retorno em até 2 dias úteis.'),
 ('Rebu','R3.2',0,'declarado','Apenas 5 h por mês.'),
 ('Rebu','R3.3',null,'nao_informado',null),
 ('Rebu','R3.4',null,'nao_informado',null),
 ('Rebu','R4.1',1,'declarado',null),('XCV/WiVO','R4.1',1,'declarado',null),
 ('Rebu','R4.2',0,'declarado',null),('XCV/WiVO','R4.2',0.5,'declarado',null),
 ('Rebu','R4.3',0,'declarado','Excluído no item 01 das considerações gerais.'),('XCV/WiVO','R4.3',null,'nao_informado',null),
 ('Rebu','R4.4',1,'declarado','Manifesto de 1 min.'),('XCV/WiVO','R4.4',1,'declarado','Manifesto de 180 s, escopo maior.'),
 ('Rebu','R5.1',0,'declarado',null)
) v(player, req, nivel, ev, nota)
join public.player pl on pl.nome = v.player join public.proposta pr on pr.player_id = pl.id
join public.requisito r on r.codigo = v.req;

insert into public.criterio (rfp_id, nome, peso)
select r.id, v.nome, v.peso from (values
 (1,'Compreensão e defesa da marca',25),(1,'Modelo de validação e capacidade',20),(1,'Prova de custódia',15),(1,'Qualidade de ativos e materiais',15),(1,'Integração com CRM, funil e parceiros',10),(1,'Custo e modelo de contratação',10),(1,'Transferência de conhecimento',5),
 (2,'Arquitetura de funil e CRM defendida',25),(2,'Estratégia antes da produção',20),(2,'Prova de dados até a venda',20),(2,'Aderência ao brandbook e ao tom NEWE',15),(2,'Transferência de conhecimento',10),(2,'Custo e modelo de contratação',10),
 (3,'Pitch e formação no tom NEWE',25),(3,'Prova de resultado comercial',25),(3,'Customização',15),(3,'Integração com CRM e dados',15),(3,'Acompanhamento e transferência',10),(3,'Custo e modelo de contratação',10)
) v(rfp, nome, peso) join public.rfp r on r.numero = v.rfp;

insert into public.portao (rfp_id, descricao, requisito_id)
select r.id, v.descr, (select id from public.requisito where codigo = v.req) from (values
 (1,'Modelo de validação com SLA','R3.1'),(1,'Política de conflito','R3.4'),
 (2,'Portabilidade total do dado','Q3.1'),(2,'Trilha de auditoria','Q3.3'),(2,'LGPD','Q3.4'),
 (3,'Usa o CRM único da NEWE, sem controles paralelos',null)
) v(rfp, descr, req) join public.rfp r on r.numero = v.rfp;

insert into public.portao_resultado (portao_id, proposta_id, resultado)
select po.id, pr.id, 'pendente'
from public.portao po join public.rfp r on r.id = po.rfp_id
join public.player pl on r.numero = any(pl.rfp_numeros) and pl.status = 'proponente'
join public.proposta pr on pr.player_id = pl.id;

insert into public.comentario_tecnico (proposta_id, modulo_id, texto)
select pr.id, (select id from public.modulo where codigo = v.mod), v.txt from (values
 ('Rebu','C3','5 h por mês e retorno em 2 dias úteis não sustentam validação de 40 a 50 peças por mês. A proposta não cobre materiais e gifts, consultoria de ativações nem aplicações gráficas.'),
 ('Rebu','C4','É a autora do brandbook. Ativos baseados em renders atuais, com IA.'),
 ('XCV/WiVO','C4','Escopo de fotos e vídeos praticamente igual ao da Rebu, o que gera sobreposição.'),
 ('XCV/WiVO','P3','CRM proprietário, limitado a 5 colaboradores e 10.000 contatos. Exigir portabilidade total, trilha de auditoria e relatório LGPD antes de qualquer pontuação.'),
 ('XCV/WiVO',null,'O desconto de 50% está na própria proposta. Confirmar o preço final por escrito.'),
 ('Folhetim','P1','Escopo mais rigoroso: brief aprovado, metas por trimestre, relatório mensal de leads. Crédito do mês não transfere e crédito avulso custa 25% a mais. Não oferece dados nem CRM.'),
 ('F&MD','P1','P1 e P2: prova de portfólio imobiliário e integração com mais de 10 CRMs. Contrato proposto de 12 meses. Exclui produção de foto, vídeo e modelos. As exclusões dizem não contemplar performance e gestão de redes, o que contradiz entregas do próprio escopo. Squad de performance cobrado por produto.')
) v(player, mod, txt) join public.player pl on pl.nome = v.player join public.proposta pr on pr.player_id = pl.id;

insert into public.pergunta_filtro (rfp_id, texto)
select r.id, v.txt from (values
 (1,'Como vocês guardam uma marca que outra agência criou?'),
 (1,'Conte um caso em que a custódia barrou uma peça.'),
 (1,'Como validar 40 a 50 peças por mês sem virar gargalo?'),
 (1,'O que ocorre entre o briefing de uma agência parceira e a primeira peça?'),
 (1,'Como tratam o conflito de validar quem disputa o mesmo cliente?'),
 (1,'O que precisa ser verdade na NEWE para isso funcionar?'),
 (2,'Como a estratégia vem antes da produção no dia a dia?'),
 (2,'Mostre um caso em que vocês provaram dados até a venda.'),
 (2,'Como o resultado dos testes volta para o CRM?'),
 (2,'Quem é dono do dado e como ele sai, se encerrarmos o contrato?'),
 (2,'Como garantem o tom NEWE em alto volume?'),
 (2,'O que precisa ser verdade na NEWE para isso funcionar?'),
 (3,'Como constroem um pitch no tom de uma marca que não é de vocês?'),
 (3,'Mostre um caso de resultado comercial medido.'),
 (3,'Como o playbook conversa com o registro no CRM?'),
 (3,'Como formam corretores que não são da casa?'),
 (3,'Como acompanham o lead qualificado semana a semana?'),
 (3,'O que precisa ser verdade na NEWE para isso funcionar?')
) v(rfp, txt) join public.rfp r on r.numero = v.rfp;
