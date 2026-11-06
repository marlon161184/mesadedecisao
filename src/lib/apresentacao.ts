/**
 * Apresentação ao Conselho: monta os slides a partir da base viva, dos filtros da URL e das leituras guiadas.
 * Função pura. Usa apenas dados que a sessão já lê (base e estado da decisão em contagens, nunca notas).
 */
import type { Base, Rfp } from "./base";
import type { Filtros } from "./filtros";
import type { Premissas } from "./calculo";
import { analisarRfp, modulosDoRfp, premissasEfetivas, type AnaliseProposta } from "./equalizacao";
import { pontosAutomaticos, pontosManuais, ORDEM_SEV, ROTULO_SEV, type Ponto } from "./pontos";
import { cenariosNomeados, dataDecisao, enumerarComposicoes, fronteira } from "./composicao";
import { pendentesPerguntas, perguntasDoPlayer, formatarPrazo } from "./perguntas";
import { formatarBRL, formatarData, formatarPct } from "./formato";
import type { ConteudoDocumentos } from "./conteudo";
import {
  GLOSSARIO, RODAPE_ESTIMADO, calcularEstresse, ehEstimativa, leituraCenariosSalvos, leituraCobertura, leituraComposicoes,
  leituraDecisao, leituraEntregas, leituraEstresse, leituraMatriz, leituraMesaCenarios, leituraPareceres, leituraPontos,
  leituraRfps, leituraVisao, ressalvas, ressalvasComposicao, textosRessalvas, type EstadoDecisao, type Leitura, type Ressalvas,
} from "./leitura";

export const LINHAS_POR_SLIDE = 6;
export const MAX_TOPICOS = 4;
export const MAX_FRASES_SLIDE = 4;

export interface Tabela { colunas: string[]; linhas: string[][]; numericas?: number[] }
export interface Coluna { titulo: string; itens: string[] }

export interface Slide {
  id: string;
  secao: string;
  titulo: string;
  tipo: "capa" | "padrao";
  subtitulo?: string;
  tabela?: Tabela;
  colunas?: Coluna[];
  topicos?: string[];
  leitura?: string[];
  /** Ressalvas sempre visíveis onde o número aparece. */
  rodape: string[];
}

export interface EntradaApresentacao {
  base: Base;
  filtros: Filtros;
  decisoes?: EstadoDecisao[];
  documentos?: ConteudoDocumentos | null;
  /** Pareceres publicados em parecer_proposta (só ids; texto não entra no slide). */
  pareceresPublicados?: { proposta_id: string }[];
}

const brl = formatarBRL;
const pct = formatarPct;

/** Divide linhas em blocos de no máximo n. Sempre devolve ao menos um bloco. */
export function paginar<T>(xs: T[], n = LINHAS_POR_SLIDE): T[][] {
  if (!xs.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const glossarioTextos = (j: number) => [GLOSSARIO.janela(j), GLOSSARIO.cobertura, GLOSSARIO.ponto, GLOSSARIO.declarado, GLOSSARIO.modulo, GLOSSARIO.estimado];

/** Frases da leitura para slide: sem as definições (explicadas no slide 2), no máximo 4. */
export function leituraParaSlide(l: Leitura, j: number): string[] {
  const g = glossarioTextos(j);
  return l.frases
    .map((f) => g.reduce((s, x) => s.replace(x, ""), f).trim())
    .filter(Boolean)
    .slice(0, MAX_FRASES_SLIDE);
}

const rodape = (r: Ressalvas) => textosRessalvas(r);

interface Rodada { rfp: Rfp; analises: AnaliseProposta[]; pontos: Ponto[] }

function rodadas(base: Base, f: Filtros, p: Premissas): Rodada[] {
  return base.rfps
    .filter((r) => !f.fase || r.fase === f.fase)
    .map((rfp) => {
      const analises = analisarRfp(base, rfp.numero, { filtros: { ...f, rfp: rfp.numero }, premissas: p });
      const pontos = [...analises.flatMap((a) => pontosAutomaticos(a, p)), ...pontosManuais(base, analises)]
        .sort((a, b) => ORDEM_SEV[a.severidade] - ORDEM_SEV[b.severidade]);
      return { rfp, analises, pontos };
    });
}

const nomeRfp = (r: Rfp) => `RFP ${r.numero} (${r.nome})`;
const est = (a: AnaliseProposta) => (ehEstimativa(a.proposta) ? " · estimado" : "");

export const POSICAO_ATUAL = "06/11/2026";

/** Pareceres publicados (parecer_proposta) com valor e cobertura da base viva; ordem por nome da agência. Nunca usa notas. */
export function linhasPareceresAtuais(
  publicados: { proposta_id: string }[],
  rfps: { analises: AnaliseProposta[] }[],
): { nome: string; estimado: boolean; celulas: string[] }[] {
  const vistos = new Set<string>();
  const out: { nome: string; estimado: boolean; celulas: string[] }[] = [];
  for (const p of publicados) {
    if (vistos.has(p.proposta_id)) continue;
    vistos.add(p.proposta_id);
    const a = rfps.flatMap((r) => r.analises).find((x) => x.proposta.id === p.proposta_id);
    if (!a) continue;
    out.push({
      nome: a.player.nome, estimado: ehEstimativa(a.proposta),
      celulas: [`${a.player.nome}${est(a)}`, `V${a.proposta.versao}`, a.total.central > 0 ? brl(a.total.central) : "sem preço", pct(a.cobertura.conservadora)],
    });
  }
  return out.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

export function montarApresentacao(entrada: EntradaApresentacao): Slide[] {
  const { base, filtros: f, decisoes = [], documentos } = entrada;
  const p = premissasEfetivas(base, f);
  const J = p.janela_meses;
  const rs = rodadas(base, f, p);
  const comPropostas = rs.filter((r) => r.analises.length);
  const todas = comPropostas.flatMap((r) => r.analises);
  const ressalvasGerais = ressalvas(base, todas.map((a) => a.proposta.id));
  const slides: Slide[] = [];
  const add = (s: Omit<Slide, "tipo" | "rodape"> & Partial<Pick<Slide, "tipo" | "rodape">>) =>
    slides.push({ tipo: "padrao", rodape: [], ...s, ...(s.topicos ? { topicos: s.topicos.slice(0, MAX_TOPICOS) } : {}) });

  // 1 · Capa
  const dd = dataDecisao(base);
  add({
    id: "capa", secao: "Capa", tipo: "capa",
    titulo: "Seleção de parceiros de marketing e CRM",
    subtitulo: dd ? `Data da decisão: ${formatarData(dd)}` : "Data da decisão a definir",
  });

  // 2 · Como ler
  add({
    id: "como-ler", secao: "Como ler",
    titulo: "Quatro ideias para ler esta apresentação",
    topicos: [GLOSSARIO.cobertura, GLOSSARIO.ponto, GLOSSARIO.janela(J), GLOSSARIO.estimado],
    leitura: [
      "Cada título já é a conclusão do slide. Os números vêm direto da Mesa, com os filtros e premissas atuais.",
      `Onde houver valor provisório, o rodapé avisa: "${RODAPE_ESTIMADO}".`,
    ],
  });

  // 3 · Resumo em uma página
  const cen = leituraCenariosSalvos(base);
  const porEf = [...cen.itens].sort((a, b) => (b.r.eficiencia ?? 0) - (a.r.eficiencia ?? 0))[0];
  const pendTotal = comPropostas.reduce((s, r) => s + pendentesPerguntas(base.perguntas.filter((q) => q.rfp_id === r.rfp.id), base.respostas, r.analises.map((a) => a.proposta)).length, 0);
  const criticos = comPropostas.reduce((s, r) => s + r.pontos.filter((x) => x.severidade === "critico").length, 0);
  add({
    id: "resumo", secao: "Resumo",
    titulo: porEf ? `Hoje, o melhor custo-benefício entre os cenários é ${porEf.nome}` : "Resumo da situação",
    colunas: [
      { titulo: "Situação", itens: [
        `${todas.length} propostas em ${comPropostas.length} RFPs; ${todas.filter((a) => a.proposta.status === "validada").length} validadas.`,
        `${criticos} alertas críticos em aberto.`,
      ] },
      { titulo: "Recomendação possível", itens: porEf
        ? [`${porEf.nome}: ${brl(porEf.r.total.central)} na janela, cobre ${pct(porEf.r.cobertura.conservadora)}.`, "Condicionada às respostas pendentes e à proposta oficial onde houver estimativa."]
        : ["Ainda não há cenário salvo para recomendar."] },
      { titulo: "Depende de decisão", itens: [
        `${pendTotal} respostas pendentes das agências.`,
        ...(ressalvasGerais.estimativas.length ? [`Proposta oficial de ${ressalvasGerais.estimativas.map((e) => e.player).join(", ")}.`] : []),
        "Escolha do cenário e aprovação da ata.",
      ] },
    ],
    rodape: rodape(ressalvasGerais),
  });

  // 4 · O que está em jogo
  add({
    id: "em-jogo", secao: "O que está em jogo",
    titulo: `Estamos escolhendo ${base.rfps.length === 1 ? "um parceiro" : "parceiros"} para ${base.rfps.length} frentes`,
    tabela: {
      colunas: ["Pedido", "O que cobre", "Período", "Propostas"],
      linhas: rs.slice(0, LINHAS_POR_SLIDE).map((r) => [`RFP ${r.rfp.numero}`, r.rfp.nome, r.rfp.periodo ?? `Fase ${r.rfp.fase}`, String(r.analises.length)]),
      numericas: [3],
    },
    topicos: [
      `Janela de comparação: ${J} meses.`,
      `Verba de mídia considerada: ${brl(p.verba_midia_mensal)} por mês, fora dos honorários das agências.`,
      ...rs.filter((r) => r.rfp.fase === 2).map((r) => `RFP ${r.rfp.numero} é fase 2: entra depois.`),
    ],
  });

  // 5 · Visão geral por RFP
  for (const r of comPropostas) {
    const l = leituraVisao(base, nomeRfp(r.rfp), r.analises, r.pontos, p);
    const porCusto = [...r.analises].sort((a, b) => (a.total.central > 0 ? a.total.central : Infinity) - (b.total.central > 0 ? b.total.central : Infinity));
    const porCob = [...r.analises].sort((a, b) => b.cobertura.conservadora - a.cobertura.conservadora);
    const comPreco = porCusto.filter((a) => a.total.central > 0);
    const titulo = comPreco.length <= 1 ? `RFP ${r.rfp.numero}: só ${(comPreco[0] ?? porCusto[0]!).player.nome} tem preço`
      : porCusto[0]!.proposta.id === porCob[0]!.proposta.id ? `RFP ${r.rfp.numero}: ${porCusto[0]!.player.nome} é a mais barata e a que mais cobre`
        : `RFP ${r.rfp.numero}: ${porCusto[0]!.player.nome} é a mais barata, ${porCob[0]!.player.nome} cobre mais`;
    paginar(porCusto).forEach((bloco, i, all) => add({
      id: `visao-${r.rfp.numero}-${i}`, secao: "Visão geral",
      titulo: all.length > 1 ? `${titulo} (${i + 1}/${all.length})` : titulo,
      tabela: {
        colunas: ["Agência", `Custo em ${J} meses`, "Cobertura", "Alertas críticos"],
        linhas: bloco.map((a) => [`${a.player.nome}${est(a)}`, a.total.central > 0 ? brl(a.total.central) : "sem preço", pct(a.cobertura.conservadora), String(r.pontos.filter((x) => x.propostaId === a.proposta.id && x.severidade === "critico").length)]),
        numericas: [1, 2, 3],
      },
      leitura: leituraParaSlide(l, J),
      rodape: rodape(l.ressalvas),
    }));
  }

  // 6 · Matriz por módulo (um slide por RFP)
  for (const r of comPropostas) {
    const mods = modulosDoRfp(base, r.rfp.numero);
    const l = leituraMatriz(base, nomeRfp(r.rfp), r.analises, mods);
    const ags = r.analises.slice(0, 4);
    const semPreco = mods.filter((m) => !r.analises.some((a) => (a.modulos.find((x) => x.modulo.id === m.id)?.total?.central ?? 0) > 0));
    paginar(mods).forEach((bloco, i, all) => add({
      id: `matriz-${r.rfp.numero}-${i}`, secao: "Matriz por módulo",
      titulo: (semPreco.length ? `RFP ${r.rfp.numero}: ${semPreco.length} de ${mods.length} módulos sem preço de ninguém` : `RFP ${r.rfp.numero}: todos os ${mods.length} módulos têm preço`) + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
      tabela: {
        colunas: ["Módulo", ...ags.map((a) => a.player.nome)],
        linhas: bloco.map((m) => [`${m.codigo} ${m.nome}`, ...ags.map((a) => {
          const t = a.modulos.find((x) => x.modulo.id === m.id)?.total;
          return t && t.central > 0 ? brl(t.central) : "sem preço";
        })]),
        numericas: ags.map((_, k) => k + 1),
      },
      leitura: leituraParaSlide(l, J).slice(0, 3),
      rodape: rodape(l.ressalvas),
    }));
  }

  // 7 · Entregas normalizadas
  for (const r of comPropostas.filter((x) => x.analises.some((a) => a.custoUnitario))) {
    const l = leituraEntregas(base, r.analises, p);
    const com = r.analises.filter((a) => a.custoUnitario).sort((a, b) => (a.custoUnitario!.custoPorPeca ?? Infinity) - (b.custoUnitario!.custoPorPeca ?? Infinity));
    const m = com[0]!;
    add({
      id: `entregas-${r.rfp.numero}`, secao: "Entregas normalizadas",
      titulo: m.custoUnitario!.custoPorPeca != null ? `${m.player.nome} tem a peça equivalente mais barata: ${brl(m.custoUnitario!.custoPorPeca)}` : "Sem dados para custo por peça",
      tabela: {
        colunas: ["Agência", "Peças por mês", "Necessárias", "Custo por peça"],
        linhas: com.slice(0, LINHAS_POR_SLIDE).map((a) => [a.player.nome, String(a.custoUnitario!.volumeEntregue), String(a.custoUnitario!.volumeBase), a.custoUnitario!.custoPorPeca == null ? "—" : brl(a.custoUnitario!.custoPorPeca)]),
        numericas: [1, 2, 3],
      },
      leitura: leituraParaSlide(l, J),
      rodape: rodape(l.ressalvas),
    });
  }

  // 8 · Cobertura
  {
    const linhas = comPropostas.flatMap((r) => r.analises.map((a) => ({ r, a })));
    const ids = new Set(todas.map((a) => a.proposta.id));
    const comprovadas = base.coberturas.filter((c) => ids.has(c.proposta_id) && c.evidencia === "comprovado").length;
    const l = leituraCobertura(base, todas);
    paginar(linhas).forEach((bloco, i, all) => add({
      id: `cobertura-${i}`, secao: "Cobertura",
      titulo: (comprovadas === 0 ? "Nenhuma cobertura foi comprovada: tudo o que vemos é declarado pelas agências" : "Cobertura por agência") + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
      tabela: {
        colunas: ["Agência", "RFP", "Conservadora", "Otimista", "Essenciais abertos"],
        linhas: bloco.map(({ r, a }) => [a.player.nome, String(r.rfp.numero), pct(a.cobertura.conservadora), a.cobertura.otimista == null ? "—" : pct(a.cobertura.otimista), String(a.bloqueios.length)]),
        numericas: [2, 3, 4],
      },
      leitura: leituraParaSlide(l, J),
      rodape: rodape(l.ressalvas),
    }));
  }

  // 9 · Uma página por agência
  const playerIds = [...new Set(todas.map((a) => a.player.id))];
  const ordemPlayers = playerIds
    .map((id) => base.players.find((x) => x.id === id)!)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  for (const pl of ordemPlayers) {
    const minhas = comPropostas.flatMap((r) => r.analises.filter((a) => a.player.id === pl.id).map((a) => ({ r, a })));
    const total = minhas.reduce((s, x) => s + x.a.total.central, 0);
    const fortes = minhas.flatMap(({ r, a }) => a.modulos
      .filter((m) => m.cobertura.conservadora > 0)
      .map((m) => ({ v: m.cobertura.conservadora, t: `${m.modulo.codigo} ${m.modulo.nome}: cobre ${pct(m.cobertura.conservadora)} (RFP ${r.rfp.numero}).` })))
      .sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.t);
    const riscos = minhas.flatMap(({ r, a }) => r.pontos.filter((x) => x.propostaId === a.proposta.id))
      .sort((a, b) => ORDEM_SEV[a.severidade] - ORDEM_SEV[b.severidade]).slice(0, 3).map((x) => `${ROTULO_SEV[x.severidade]}: ${x.texto}`);
    const perg = minhas.flatMap(({ r, a }) => perguntasDoPlayer(base.perguntas, r.rfp.id, pl.id).map((q) => ({ q, a })));
    const pend = minhas.flatMap(({ r, a }) => pendentesPerguntas(base.perguntas.filter((q) => q.rfp_id === r.rfp.id), base.respostas, [a.proposta]));
    const prazos = perg.map((x) => x.q.prazo_resposta).filter((x): x is string => !!x).sort();
    const res = ressalvas(base, minhas.map((x) => x.a.proposta.id));
    add({
      id: `agencia-${pl.id}`, secao: "Agências",
      titulo: `${pl.nome}: ${brl(total)} em ${J} meses${res.estimativas.length ? " (estimado)" : ""}`,
      tabela: {
        colunas: ["RFP", "Custo", "Cobertura", "Essenciais abertos"],
        linhas: minhas.slice(0, 3).map(({ r, a }) => [`RFP ${r.rfp.numero}`, brl(a.total.central), pct(a.cobertura.conservadora), String(a.bloqueios.length)]),
        numericas: [1, 2, 3],
      },
      colunas: [
        { titulo: "Pontos fortes", itens: fortes.length ? fortes : ["Nenhum módulo com cobertura informada."] },
        { titulo: "Riscos", itens: riscos.length ? riscos : ["Nenhum alerta registrado."] },
      ],
      topicos: [`${pend.length} de ${perg.length} perguntas sem resposta${prazos.length ? `; prazo ${formatarPrazo(prazos[0]!)}` : ""}.`],
      rodape: rodape(res),
    });
  }

  // 10 · Pontos de atenção críticos e altos: resumo por agência + lista dos críticos
  {
    const todos = comPropostas.flatMap((r) => r.pontos);
    const graves = todos.filter((x) => x.severidade === "critico" || x.severidade === "alto");
    const l = leituraPontos(base, todos, todas);
    const crit = graves.filter((x) => x.severidade === "critico");
    const nomes = [...new Set(graves.map((x) => x.playerNome ?? "Geral"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    add({
      id: "pontos-resumo", secao: "Pontos de atenção",
      titulo: `${crit.length} alertas críticos e ${graves.length - crit.length} altos pedem resposta antes da decisão`,
      tabela: {
        colunas: ["Agência", "Críticos", "Altos", "Principal alerta"],
        linhas: nomes.slice(0, LINHAS_POR_SLIDE).map((n) => {
          const ps = graves.filter((x) => (x.playerNome ?? "Geral") === n);
          return [n, String(ps.filter((x) => x.severidade === "critico").length), String(ps.filter((x) => x.severidade === "alto").length), ps[0]!.texto];
        }),
        numericas: [1, 2],
      },
      leitura: leituraParaSlide(l, J).slice(0, 3),
      rodape: rodape(l.ressalvas),
    });
    if (crit.length) paginar(crit).forEach((bloco, i, all) => add({
      id: `pontos-criticos-${i}`, secao: "Pontos de atenção",
      titulo: `Os ${crit.length} alertas críticos, em linguagem de risco` + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
      tabela: { colunas: ["Agência", "Alerta", "O que fazer"], linhas: bloco.map((x) => [x.playerNome ?? "Geral", x.texto, x.acao]) },
      rodape: rodape(l.ressalvas),
    }));
  }

  // 11 · Cenários (um slide por cenário)
  for (const { nome, r } of cen.itens) {
    const l = leituraComposicoes(base, [{ nome, r }], "simulador");
    const res = ressalvasComposicao(base, [r]);
    const grupos = new Map<string, { mods: string[]; valor: number }>();
    for (const m of r.modulos) {
      const k = m.player?.nome ?? (m.opcao.tipo === "interno" ? "Interno" : "A cotar");
      const g = grupos.get(k) ?? { mods: [], valor: 0 };
      g.mods.push(m.modulo.codigo); g.valor += m.player ? m.total : 0;
      grupos.set(k, g);
    }
    add({
      id: `cenario-${nome}`, secao: "Cenários",
      titulo: `${nome}: ${brl(r.total.central)}, cobre ${pct(r.cobertura.conservadora)}`,
      tabela: {
        colunas: ["Quem faz", "Módulos", "Custo"],
        linhas: [...grupos].slice(0, LINHAS_POR_SLIDE).map(([k, g]) => [k, g.mods.join(", "), k === "A cotar" || k === "Interno" ? "sem preço" : brl(g.valor)]),
        numericas: [2],
      },
      leitura: leituraParaSlide(l, J).slice(0, 3),
      rodape: [...rodape(res), ...(r.motivosInviavel.length ? [`Não passa nas regras mínimas: ${r.motivosInviavel.join("; ")}.`] : [])],
    });
  }

  // 12 · Mesa de cenários
  {
    const cands = enumerarComposicoes(base, p, { incluirNaoValidadas: true, dataDecisao: dd });
    const { viaveis, nomeados } = cenariosNomeados(cands);
    const front = fronteira(cands.filter((c) => c.r.nPlayers > 0));
    const l = leituraMesaCenarios(base, cands, nomeados, front, viaveis);
    const quem = (c: (typeof nomeados)[number]["c"]) => [...new Set(c.r.modulos.map((m) => m.player?.nome).filter(Boolean))].join(" + ") || "—";
    const cb = nomeados.find((n) => n.titulo === "Melhor custo-benefício");
    add({
      id: "mesa-cenarios", secao: "Mesa de cenários",
      titulo: cb ? `Melhor custo-benefício entre ${cands.length.toLocaleString("pt-BR")} combinações: ${quem(cb.c)}` : "Mesa de cenários",
      tabela: {
        colunas: ["Critério", "Agências", "Custo", "Cobertura"],
        linhas: nomeados.slice(0, LINHAS_POR_SLIDE).map((n) => [n.titulo, quem(n.c), brl(n.c.r.total.central), pct(n.c.r.cobertura.conservadora)]),
        numericas: [2, 3],
      },
      leitura: leituraParaSlide(l, J).slice(0, 3),
      rodape: rodape(l.ressalvas),
    });
  }

  // 13 · Teste de estresse
  {
    const e = calcularEstresse(base);
    const l = leituraEstresse(base, e.linhas, e.rs);
    paginar(e.linhas).forEach((bloco, i, all) => add({
      id: `estresse-${i}`, secao: "Teste de estresse",
      titulo: (l.frases[l.frases.length - 1] ?? "Teste de estresse").replace(/\.$/, "") + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
      tabela: {
        colunas: ["Cenário", "Hoje", "Volume +20%", "Sem desconto XCV", "Preço máximo"],
        linhas: bloco.map((x) => [x.nome, brl(x.base), brl(x.volume), brl(x.xcv), brl(x.maximo)]),
        numericas: [1, 2, 3, 4],
      },
      leitura: leituraParaSlide(l, J).slice(1, 4),
      rodape: rodape(l.ressalvas),
    }));
  }

  // 14 · Perguntas às agências
  {
    const linhas = comPropostas.flatMap((r) => r.analises.map((a) => {
      const qs = perguntasDoPlayer(base.perguntas, r.rfp.id, a.player.id);
      const pend = pendentesPerguntas(qs, base.respostas, [a.proposta]).length;
      const prazo = qs.map((q) => q.prazo_resposta).filter((x): x is string => !!x).sort()[0];
      return [`${a.player.nome} · RFP ${r.rfp.numero}`, String(qs.length), String(qs.length - pend), String(pend), prazo ? formatarPrazo(prazo) : "—"];
    })).filter((l) => l[1] !== "0");
    const pend = linhas.reduce((s, l) => s + Number(l[3]), 0);
    paginar(linhas).forEach((bloco, i, all) => add({
      id: `perguntas-${i}`, secao: "Perguntas",
      titulo: (linhas.length ? `${pend} perguntas ainda sem resposta das agências` : "Nenhuma pergunta cadastrada para as agências") + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
      tabela: { colunas: ["Agência", "Feitas", "Respondidas", "Pendentes", "Prazo"], linhas: bloco, numericas: [1, 2, 3] },
      leitura: ["Perguntas gerais valem para todas as agências; as específicas só para a agência a que foram enviadas.", "Resposta pendente não elimina ninguém, mas mantém a dúvida aberta na hora de decidir."],
    }));
  }

  // 15 · Pareceres e RFPs (só quando a sessão tem acesso a esse conteúdo)
  if (documentos) {
    const atuais = linhasPareceresAtuais(entrada.pareceresPublicados ?? [], comPropostas);
    if (atuais.length) {
      const temEst = atuais.some((l) => l.estimado);
      add({
        id: "pareceres", secao: "Pareceres",
        titulo: `Pareceres: posição de ${POSICAO_ATUAL}`,
        tabela: { colunas: ["Agência", "Versão", "Valor na janela", "Cobertura"], linhas: atuais.slice(0, LINHAS_POR_SLIDE).map((l) => l.celulas), numericas: [2, 3] },
        leitura: [
          `Há ${atuais.length} ${atuais.length === 1 ? "parecer publicado" : "pareceres publicados"} sobre as versões atuais das propostas.`,
          "Valor e cobertura vêm dos dados vivos da Mesa, não de notas anteriores.",
          "A posição de 28/10/2026 avaliou versões anteriores e foi substituída.",
        ],
        rodape: temEst ? [RODAPE_ESTIMADO] : [],
      });
    } else {
      add({
        id: "pareceres", secao: "Pareceres",
        titulo: "Pareceres: posição de 28/10/2026 (versões anteriores)",
        topicos: ["Os pareceres disponíveis avaliaram versões anteriores das propostas.", "Valores e notas dessa posição não refletem as propostas atuais."],
        leitura: ["Ainda não há parecer publicado sobre as versões atuais das propostas."],
      });
    }
    const lr = leituraRfps(documentos);
    add({ id: "rfps", secao: "RFPs", titulo: "O que cada pedido de proposta pede", topicos: lr.topicos, leitura: lr.frases });
  }

  // 16 · Decisão
  {
    const l = decisoes[0] ? leituraDecisao(decisoes[0]) : null;
    add({
      id: "decisao", secao: "Decisão",
      titulo: "O que precisa ser decidido e os próximos passos",
      ...(decisoes.length ? { tabela: {
        colunas: ["Pedido", "Etapa", "Portões pendentes", "Respostas pendentes"],
        linhas: decisoes.slice(0, LINHAS_POR_SLIDE).map((d) => [d.rfpNome, leituraDecisao(d).frases[0]!.replace(/^Em .*?, estamos na etapa: /, "").replace(/\.$/, ""), String(d.portoesPendentes), String(d.perguntasPendentes)]),
        numericas: [2, 3],
      } } : {}),
      topicos: [
        "Receber as respostas pendentes e a proposta oficial onde ainda há estimativa.",
        "Validar as propostas e fechar os portões.",
        "Pontuar às cegas, revelar e testar a sensibilidade.",
        "Escolher o cenário, votar e aprovar a ata.",
      ],
      leitura: l ? l.frases.slice(1, 4) : [],
    });
  }

  // 17 · Anexo: premissas, itens estimados e fontes
  add({
    id: "anexo-premissas", secao: "Anexo",
    titulo: "Anexo: premissas usadas nos cálculos",
    tabela: {
      colunas: ["Premissa", "Valor"],
      linhas: [
        ["Janela de comparação", `${J} meses`],
        ["Preço considerado", p.aplicar_desconto_negociado ? "Negociado" : "Lista"],
        ["Verba de mídia", `${brl(p.verba_midia_mensal)} por mês`],
        ["Produtos em performance", String(p.produtos_performance)],
        ["Peso do declarado", pct(p.fator_evidencia_declarado)],
        ["Data da decisão", dd ? formatarData(dd) : "—"],
      ],
    },
  });
  const avisos = ressalvasGerais.avisos;
  paginar(avisos).forEach((bloco, i, all) => add({
    id: `anexo-avisos-${i}`, secao: "Anexo",
    titulo: `Anexo: ${avisos.length} itens com valor provisório` + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
    tabela: { colunas: ["Agência", "Item", "Aviso"], linhas: bloco.map((a) => [a.player, a.descricao, a.incerteza.length > 110 ? `${a.incerteza.slice(0, 107)}...` : a.incerteza]) },
    rodape: rodape(ressalvasGerais),
  }));
  const fontes = todas.map((a) => [a.player.nome, `V${a.proposta.versao}`, a.proposta.fonte_arquivo ?? "não informado", a.proposta.status]);
  paginar(fontes).forEach((bloco, i, all) => add({
    id: `anexo-fontes-${i}`, secao: "Anexo",
    titulo: "Anexo: fontes das propostas" + (all.length > 1 ? ` (${i + 1}/${all.length})` : ""),
    tabela: { colunas: ["Agência", "Versão", "Fonte", "Status"], linhas: bloco },
    rodape: rodape(ressalvasGerais),
  }));

  return slides;
}
