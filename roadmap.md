# Roadmap

## Ajuste · janela de reunião
- [x] Encerramento livre em Brasília, atalhos e aviso no Admin
- [x] Limite de 96 h no formulário, servidor e banco
- [x] Selo e lista com data de encerramento; testes unitários, banco e tela sem criar reunião

## Prompt 2 · Equalização
- [x] Dados iniciais, regras P-01..P-09, totais conferidos em teste
- [x] Visão geral, Matriz, Entregas, Cobertura, Players, Pontos, Admin (CRUD, fluxo + checklist, CSV)
- [ ] Verificação visual logada — bloqueado: não existe conta ainda (criar em Cloud → Users)

## Ajuste de marca (provisório)
- [x] Logo NEWE salva em src/assets + componente único <LogoNewe variante="auto|preto|luz" />
- [x] Login, cabeçalho, barra lateral, PDF de cenário e favicon passaram a usar o componente
- [ ] Trocar pelos arquivos finais da Rebu — aguarda os arquivos (basta substituir os dois .asset.json)


## Prompt 3 · Simulador e cenários
- [x] cronograma_pagamento + dados iniciais
- [x] Simulador 3 zonas, totalizadores, desembolso, sobreposição, expectativa x realidade, lacunas, veredito
- [x] Pontos C-01..C-11 + pontos das propostas
- [x] Parecer por regra + rascunho com IA (revisão humana obrigatória)
- [x] Cenários: salvar, versões, duplicar, recomendado, comentários, comparar 4, CSV, PDF (impressão)
- [x] Mesa de cenários, teste de estresse, cenários A–D com totais conferidos em teste
- [x] Data de decisão (C-08): 30/10/2026
- [ ] Textos das perguntas-filtro dos RFPs 2 e 3 — aguarda os briefings

## Prompt 4 · Decisão
- [x] Trilha em 7 etapas, pontuação cega travada, revelação, sensibilidade, pré-mortem, votação, ata com snapshot e hash
- [x] Modo reunião, PDF da ata com marca d'água, aceite com IP, documentos em área privada, sessão de 30 min, IA desligada por padrão
- [x] Regras de acesso testadas com Admin e dois sócios fictícios (desfeito ao final)
- [ ] Notificações por e-mail — aguarda domínio de envio
- [ ] Segundo fator de login — não implementado (opcional)
- [ ] Verificação visual logada — aguarda a primeira conta

## Ajuste · versão móvel
- [x] Menu compacto abaixo de 1024 px, filtros em painel inferior, seletor de RFP em abas, margens 16/32/48 px
- [x] Tabelas em cartões ou rolagem interna, gráficos adaptáveis, simulador em abas, trilha compacta, pontuação em cartões, modo reunião com setas
- [x] Varredura 360/390/430/768/1024 px sem estouro
- [ ] Pontuação em cartões e votação no celular — conferir quando a pontuação for aberta (hoje está bloqueada)

## Acesso por link de reunião (somente leitura)
- [x] Admin › Reuniões: criar (nome, data, encerramento em Brasília até 96h), token de 43 caracteres guardado só como hash, QR, acessos, conectados, encerrar
- [x] Entrada /entrar: nome obrigatório, troca token→sessão no servidor, limite 10/min por IP, resposta única "Reunião encerrada", no-referrer, token removido da URL
- [x] Papel REUNIÃO só com reunião ativa (e 60 min de atividade); RLS bloqueia escrita, notas/pré-mortem/votos não revelados, auditoria, filtros alheios, PDFs; sem exportação nem IA
- [x] Abre no modo reunião com atalho para a Mesa; selo com nome, horário e conectados; revalida a cada 60 s
- [x] Log: criação, encerramento, entrada (nome, IP), acessos negados
- [x] Testes: unitários (token) + RLS em bloco desfeito (supabase/tests/reuniao_rls.sql)
