# Mesadedecisao

Construa a plataforma web privada “NEWE · Mesa de Decisão”, em português do Brasil. Use React, TypeScript, Tailwind e shadcn/ui, com Lovable Cloud (Supabase) para autenticação, banco e armazenamento. Este é o PROMPT 1 DE 4: construímos a fundação (marca, papéis, dados e regras). As telas analíticas virão nos prompts seguintes. Não invente telas além das pedidas aqui.

1. CONTEXTO E OBJETIVO
A NEWE é uma marca de urbanismo e viver bem de São José do Rio Preto (SP), do Grupo Hyndra. Está contratando parceiros em três concorrências (RFPs):
- RFP 1 · Custódia da marca (fase 1, 6 meses)
- RFP 2 · Criativo, dados, performance e CRM (fase 1, nov/2026 a abr/2027)
- RFP 3 · Comercial: pitch, playbook, formação e acompanhamento do lead qualificado (FASE 2, a partir de mai/2027; mostrar sempre o selo “Fase 2”)
As propostas chegam em formatos incomparáveis: fee mensal, créditos, projeto, comissão sobre mídia, contratos de 6 e de 12 meses, preço de lista e preço negociado. O objetivo da plataforma é compará-las em base única (“banana com banana”), permitir simular composições de players e apoiar a decisão dos sócios com rastreabilidade.
Escreva a marca sempre como NEWE (nunca “Newe Urbanismo Integrativo”).

2. FORA DE ESCOPO (IMPORTANTE)
Os honorários do consultor que conduz o processo NÃO fazem parte da plataforma: não crie player, linha de custo, campo ou total para isso. Nenhum totalizador inclui consultoria do facilitador.

3. PAPÉIS E ACESSO
- Admin: cura os dados (propostas, itens, requisitos, cobertura, comentários). Não vota nem pontua.
- Sócio: vê tudo, simula, pontua e vota. Cada sócio só edita as suas próprias notas e votos.
- Observador: somente leitura, sem ver notas individuais antes da revelação.
Login por e-mail com convite (sem cadastro público). Todo o app exige autenticação; nenhuma página é indexada (noindex). Row Level Security em todas as tabelas. Registre um log de auditoria (quem, quando, o quê) para qualquer alteração de proposta, item, cobertura, nota ou voto.

4. DESIGN SYSTEM NEWE (aplicar em todo o app)
A marca NEWE diz “Luxo é para se sentir”: solar, genuína, acolhedora, sem ostentação. A interface deve ser calma, editorial e legível em reunião (telas grandes), com muito ar e pouco ruído.
Cores (tokens, claro / escuro):
- amarelo-newe #ffc841 (cor principal; botão primário, destaques). Texto sobre ele: sempre preto.
- luz #fffaea (fundo padrão das páginas no tema claro; texto sobre fundos escuros)
- preto #0f0f0f (texto no tema claro; fundo do tema escuro). Nunca use #000 nem #fff puros.
- terracota #dc7319 (abertura de seção e destaque). Texto sobre ele: preto, nunca luz.
- flamboyant #971b36, ipe-do-cerrado #b74185, verde-cerrado #7b8407, terra-vermelha #bd472a: cores de apoio, usadas como fundo de blocos ou em gráficos, com texto luz. Verde-cerrado com texto luz só para textos de 24px ou mais.
- ink-muted #5b5445 (claro) / #cfc8b5 (escuro) para texto secundário; line = preto a 25% de opacidade para fios de 1px; line-strong = preto sólido.
- focus: anel de 2px, preto no claro e amarelo-newe no escuro.
Tema escuro: fundo preto, texto luz, amarelo-newe como destaque. Ofereça alternância claro/escuro e respeite prefers-color-scheme.
Tipografia (Google Fonts, substitutas das licenciadas): títulos em Marcellus (equivale à PP Museum Light; prefira caixa alta com espaçamento aberto nas chamadas), texto em Albert Sans, rótulos e números de apoio em DM Mono, em caixa alta (ex.: “VISÃO GERAL”, legendas, números de página). Números financeiros em DM Mono com alinhamento tabular.
Forma: cantos retos (radius 0 a 2px), fios finos de 1px em vez de sombras, sem gradientes, sem glassmorphism. Botão primário amarelo-newe com texto preto; secundário com borda line-strong. Etiquetas (badges) retangulares em DM Mono caixa alta.
Logotipo: o logotipo oficial é a palavra NEWE escrita à mão (arquivos logo-preto.svg para fundo claro e logo-luz.svg para fundo escuro, que serão enviados depois). Por enquanto, reserve um componente Logo com um espaço de mesmo tamanho e uma etiqueta provisória em texto “NEWE”, fácil de trocar pelo SVG. Nunca estique, gire, aplique sombra ou contorno. Margem de segurança igual à largura da primeira letra E. Tamanho mínimo 25px.
Ícones: traço fino de 1,5px, estilo linha irregular e orgânico (use Lucide com stroke 1.5 como substituto provisório). Sem emoji em nenhum lugar.
Cores por player nos gráficos (fixas em todo o app): Rebu = flamboyant, Folhetim = verde-cerrado, XCV/WiVO = ipe-do-cerrado, F&MD = terracota. Novos players recebem terra-vermelha, depois cinzas quentes. Nunca dependa só da cor: use rótulos e padrões.
Voz dos textos: direta, português claro, falando em “nós” quando for institucional; sem jargão corporativo vazio, sem exclamações, sem ostentação. Títulos curtos e afirmativos.
Layout: desktop primeiro (reunião em telas grandes), legível em tablet, leitura em celular. Grade de 12 colunas, margens generosas, alternando blocos de conteúdo e vazios.

5. MODELO DE DADOS (tabelas)
rfp: id, numero (1,2,3), nome, fase (1 ou 2), periodo, status, descricao, janela_meses (padrão 6).
modulo: id, rfp_id, codigo, nome, descricao, peso_no_rfp, essencial (bool), entrega_chave (texto, para detectar sobreposição: ex. ativos_foto_video, manifesto, crm, site, gestao_midia).
requisito: id, modulo_id, descricao, peso (1 a 5), criticidade (essencial | desejavel), fonte (documento e seção), eliminatorio (bool).
player: id, nome, tipo (agencia, plataforma, consultoria, referencia), cidade, cor_token, observacoes, status (proponente | referencia_sem_proposta | convidado).
proposta: id, player_id, versao, data_proposta, validade_dias, validade_ate (calculado), contrato_meses_proposto, fonte_arquivo, status (recebida | em_equalizacao | validada), observacoes.
item_proposta: id, proposta_id, modulo_id, descricao, tipo_preco (recorrente | pontual | variavel | por_credito), valor_lista, valor_negociado, valor_min, valor_max (para faixas), unidade (mes | projeto | produto_mes | percentual_verba), multiplicador (ex. nº de produtos), incluido_no_subtotal_da_proposta (bool), incerteza (texto), fonte_pagina, entrega_chave.
entrega_declarada: id, proposta_id, categoria (ex. posts_instagram, videos_sociais, posts_linkedin, posts_corretores, pecas_endomarketing, placas_ooh, videos_painel), quantidade_mes, e_teto (bool, “até”), observacao.
cobertura: id, proposta_id, requisito_id, nivel (cobre = 1 | parcial = 0.5 | nao_cobre = 0 | nao_informado = nulo), evidencia (declarado | comprovado | nao_informado), nota_tecnica, custo_estimado_para_cobrir (opcional, em R$ na janela).
ponto_atencao: id, escopo (proposta | modulo | composicao), referencia_id, severidade (critico | alto | medio | info), texto, origem (regra | manual), regra_codigo.
comentario_tecnico: id, proposta_id, modulo_id, texto.
pergunta_filtro: id, rfp_id, texto; resposta_filtro: id, pergunta_id, proposta_id, resposta, avaliacao.
premissa: chave, valor, descricao (veja seção 6).
cenario: id, nome, descricao, autor, recomendado (bool), criado_em; cenario_modulo: cenario_id, modulo_id, proposta_id (nulo = sem cobertura).
criterio: id, rfp_id, nome, peso (soma 100 por RFP), descricao.
portao: id, rfp_id, descricao, requisito_id (opcional); portao_resultado: portao_id, proposta_id, resultado (passa | reprova | pendente), justificativa.
nota_socio: criterio_id, proposta_id, socio_id, nota (1 a 5), justificativa, enviado_em (cego até a revelação).
voto: cenario_id, socio_id, decisao (aprovar | aprovar_com_ressalvas | rejeitar), justificativa.
ata: id, cenario_id, texto, ressalvas, proximos_passos, versao, gerada_em.
log_auditoria: quem, quando, tabela, registro, antes, depois.

6. PREMISSAS GLOBAIS (editáveis pelo Admin, com valor padrão)
- janela_meses = 6 (janela de comparação)
- aplicar_desconto_negociado = verdadeiro (se falso, usa valor_lista)
- verba_midia_mensal = 50000
- meses_com_verba = 6
- produtos_performance = 3 (marca + empreendimento 1 + empreendimento 2)
- pct_gestao_midia_folhetim = 12% ; pct_comissao_midia_fmd = 20%
- desconto_xcv_mensal = 50% (aplica só aos itens recorrentes da XCV marcados como “lista”)
- fator_evidencia_declarado = 100% (opções 100%, 70%, 0%: quanto vale um requisito declarado e não comprovado)
- volume_base_mensal (escopo-base para custo unitário): 8 posts ou carrosséis Instagram, 4 vídeos sociais, 4 posts LinkedIn, 4 posts para corretores, 5 peças de endomarketing, 10 placas OOH, 2 vídeos para painel digital

7. REGRAS DE CÁLCULO (implementar como funções testadas, em um único módulo, reutilizadas por todas as telas)
R1. Valor do item na janela:
- recorrente: (negociado se aplicar_desconto_negociado e existir, senão lista) × multiplicador × janela_meses
- pontual: valor negociado ou lista
- variavel (percentual sobre a verba): pct × verba_midia_mensal × meses_com_verba
- por produto/mês: valor × produtos_performance × janela_meses
- Se houver valor_min e valor_max, calcule o valor central (média) e guarde também o mínimo e o máximo para exibir faixa e não um número falsamente exato.
R2. Compromisso total do contrato: se contrato_meses_proposto > janela_meses, mostre ao lado do valor na janela o compromisso total do contrato (ex.: F&MD propõe 12 meses).
R3. Total da proposta na janela = soma de R1 dos itens. Total por módulo e por RFP idem.
R4. Custo unitário normalizado: custo recorrente mensal de criação ÷ peças-base equivalentes do mês, exibindo “volume entregue vs. volume-base”. Quando a entrega declarada for teto (“até”), rotule como teto.
R5. Cobertura de um módulo = soma(peso do requisito × nível × fator de evidência) ÷ soma(peso dos requisitos), em duas versões: CONSERVADORA (não informado = 0) e OTIMISTA (não informado = excluído do denominador). Mostre sempre a faixa conservadora–otimista. Cobertura de um RFP = média dos módulos ponderada por peso_no_rfp.
R6. Essenciais não cobertos: lista de requisitos essenciais com nível 0 ou nulo. Eles não entram só no percentual; aparecem em destaque como bloqueios.
R7. Custo ajustado ao escopo = total na janela + soma de custo_estimado_para_cobrir dos requisitos essenciais não cobertos. Exiba sempre separado do preço da proposta.
R8. Eficiência = cobertura conservadora ÷ custo (pontos de cobertura por R$ 100 mil).

8. STACK E QUALIDADE
Formatação brasileira (R$ 1.234,56; datas dd/mm/aaaa). Todos os valores são calculados no cliente a partir das tabelas e das premissas, nunca digitados. Escreva testes unitários para R1 a R8. Acessibilidade: contraste mínimo AA, foco visível, navegação por teclado.

ENTREGA DESTA ETAPA: projeto com autenticação por convite, papéis, todas as tabelas com RLS, página inicial vazia já com a marca, tema claro/escuro, tipografia, tokens, componentes básicos (Botão, Etiqueta, Cartão com fio, Tabela, Rótulo mono, Faixa de seção em terracota) e as funções de cálculo com testes. Ao terminar, liste as tabelas criadas e as funções implementadas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mesadedecisao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3c70fb89-bfcd-44d2-abeb-4f307f984e4a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
