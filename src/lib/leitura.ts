/**
 * Leitura guiada: textos em linguagem simples gerados a partir dos resultados já calculados.
 * Funções puras e determinísticas. Nenhum valor digitado: todo número vem dos dados.
 */
import type { Base, Player, Proposta } from "./base";
import type { Premissas } from "./calculo";
import type { AnaliseProposta } from "./equalizacao";
import type { Ponto } from "./pontos";
import type { Candidato, Estresse, Nomeado, ResultadoComposicao } from "./composicao";
import { resultadoDoCenario } from "./cenarios";
import { pendentesPerguntas, perguntasDoPlayer, formatarPrazo } from "./perguntas";
import { formatarBRL, formatarPct } from "./formato";
import type { ConteudoDocumentos } from "./conteudo";

export interface Ressalvas {
  /** Propostas que são estimativa interna, não proposta oficial. */
  estimativas: { player: string; versao: number }[];
  /** Itens cujo campo incerteza começa com "AVISO". */
  avisos: { player: string; descricao: string; incerteza: string }[];
  /** Agências cuja cobertura é toda "declarada", sem nenhum item "comprovado". */
  soDeclarada: string[];
}

export interface Leitura {
  frases: string[];
  topicos: string[];
  ressalvas: Ressalvas;
}

export const RODAPE_ESTIMADO = "ESTIMADO, aguardando proposta oficial";

export const GLOSSARIO = {
  janela: (j: number) => `A janela é o período de ${j} meses que a Newe pretende contratar agora; todos os preços são somados nesse período.`,
  cobertura: "Cobertura é quanto do que pedimos no RFP a agência diz atender, de 0% a 100%.",
  ponto: "Ponto de atenção é um alerta sobre risco, lacuna ou condição que precisa ser esclarecida antes de contratar.",
  declarado: "Declarado significa que a agência afirma atender; comprovado significa que ela demonstrou com prova. Hoje a régua trata o declarado com cautela.",
  modulo: "Módulo é um bloco do que pedimos, como criativo, mídia, CRM ou site.",
  estimado: "Estimado é um valor calculado pela Newe enquanto a proposta oficial não chega; oficial é o valor escrito pela agência.",
};

const brl = (v: number) => formatarBRL(v);
const pct = (v: number) => formatarPct(v);
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const ehEstimativa = (p: Pick<Proposta, "fonte_arquivo">) => /estimativa interna/i.test(p.fonte_arquivo ?? "");
export const ehAviso = (incerteza: string | null | undefined) => /^\s*aviso/i.test(incerteza ?? "");

/** Ressalvas das propostas informadas (as que aparecem na tela). */
export function ressalvas(base: Pick<Base, "propostas" | "players" | "itens" | "coberturas">, propostaIds: string[]): Ressalvas {
  const ids = new Set(propostaIds);
  const props = base.propostas.filter((p) => ids.has(p.id));
  const nome = (p: Proposta) => base.players.find((x) => x.id === p.player_id)?.nome ?? "Agência";
  const estimativas = props.filter(ehEstimativa).map((p) => ({ player: nome(p), versao: p.versao }));
  const avisos = base.itens
    .filter((i) => ids.has(i.proposta_id) && ehAviso(i.incerteza))
    .map((i) => ({ player: nome(props.find((p) => p.id === i.proposta_id)!), descricao: i.descricao, incerteza: (i.incerteza ?? "").trim() }))
    .sort((a, b) => a.player.localeCompare(b.player, "pt-BR") || a.descricao.localeCompare(b.descricao, "pt-BR"));
  const soDeclarada = [...new Set(props.filter((p) => {
    const cs = base.coberturas.filter((c) => c.proposta_id === p.id);
    return cs.some((c) => c.evidencia === "declarado") && !cs.some((c) => c.evidencia === "comprovado");
  }).map(nome))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { estimativas, avisos, soDeclarada };
}

export const temRessalvas = (r: Ressalvas) => r.estimativas.length + r.avisos.length + r.soDeclarada.length > 0;

/** Texto curto das ressalvas, para rodapé de slide e bloco de destaque. */
export function textosRessalvas(r: Ressalvas): string[] {
  const out: string[] = [];
  for (const e of r.estimativas) out.push(`${e.player} V${e.versao}: ${RODAPE_ESTIMADO}.`);
  if (r.avisos.length) out.push(`${plural(r.avisos.length, "item com aviso", "itens com aviso")} (valor no máximo da faixa, preço de lista ou sem preço, que conta como R$ 0 até a agência cotar).`);
  if (r.soDeclarada.length) out.push(`Cobertura só declarada, sem nada comprovado: ${lista(r.soDeclarada)}.`);
  return out;
}

const idsDe = (as: AnaliseProposta[]) => as.map((a) => a.proposta.id);
const estimada = (a: AnaliseProposta) => (ehEstimativa(a.proposta) ? " (estimado)" : "");

// ---------------- Visão geral ----------------

export function leituraVisao(base: Base, rfpNome: string, analises: AnaliseProposta[], pontos: Ponto[], p: Premissas): Leitura {
  const r = ressalvas(base, idsDe(analises));
  if (!analises.length) return { frases: [`${rfpNome} ainda não tem propostas para comparar.`], topicos: [], ressalvas: r };
  const porCusto = [...analises].sort((a, b) => a.total.central - b.total.central);
  const porCob = [...analises].sort((a, b) => b.cobertura.conservadora - a.cobertura.conservadora);
  const barata = porCusto[0]!, cara = porCusto[porCusto.length - 1]!, completa = porCob[0]!;
  const criticos = (a: AnaliseProposta) => pontos.filter((x) => x.propostaId === a.proposta.id && x.severidade === "critico").length;
  const totalCrit = pontos.filter((x) => x.severidade === "critico").length;
  const frases = [
    `Comparamos ${plural(analises.length, "proposta", "propostas")} em ${rfpNome}. ${GLOSSARIO.janela(p.janela_meses)}`,
    analises.length > 1
      ? `A mais barata é ${barata.player.nome}${estimada(barata)}, com ${brl(barata.total.central)}; a mais cara é ${cara.player.nome}${estimada(cara)}, com ${brl(cara.total.central)}.`
      : `A única proposta é de ${barata.player.nome}${estimada(barata)}, com ${brl(barata.total.central)}.`,
    `${GLOSSARIO.cobertura} Quem cobre mais é ${completa.player.nome}, com ${pct(completa.cobertura.conservadora)}.`,
    `${GLOSSARIO.ponto} ${totalCrit ? `Há ${plural(totalCrit, "alerta crítico", "alertas críticos")} neste RFP.` : "Não há alerta crítico neste RFP."}`,
  ];
  if (analises.length > 1)
    frases.push(barata.proposta.id === completa.proposta.id
      ? `Na prática, ${barata.player.nome} é ao mesmo tempo a mais barata e a que cobre mais.`
      : `Na prática, nenhuma agência é ao mesmo tempo a mais barata e a mais completa: a escolha é entre preço (${barata.player.nome}) e cobertura (${completa.player.nome}).`);
  if (r.estimativas.length) frases.push(`Atenção: ${lista(r.estimativas.map((e) => e.player))} ainda é estimativa da Newe, não proposta oficial.`);
  const topicos = porCusto.slice(0, 4).map((a) =>
    `${a.player.nome}${estimada(a)}: ${brl(a.total.central)} em ${p.janela_meses} meses, cobre ${pct(a.cobertura.conservadora)}, ${plural(criticos(a), "alerta crítico", "alertas críticos")}.`);
  return { frases: frases.slice(0, 6), topicos, ressalvas: r };
}

// ---------------- Matriz por módulo ----------------

export function leituraMatriz(base: Base, rfpNome: string, analises: AnaliseProposta[], modulos: { id: string; codigo: string; nome: string }[]): Leitura {
  const r = ressalvas(base, idsDe(analises));
  const linhas = modulos.map((m) => {
    const ofertas = analises
      .map((a) => ({ a, mod: a.modulos.find((x) => x.modulo.id === m.id) }))
      .filter((x) => x.mod?.total && x.mod.total.central > 0)
      .sort((x, y) => x.mod!.total!.central - y.mod!.total!.central);
    return { m, ofertas };
  });
  const semPreco = linhas.filter((l) => !l.ofertas.length).map((l) => `${l.m.codigo} (${l.m.nome})`);
  const frases = [
    `Esta tela abre ${rfpNome} por módulo. ${GLOSSARIO.modulo}`,
    `Para cada módulo, mostramos quem cotou e por quanto na janela, para comparar partes iguais entre si.`,
    semPreco.length ? `Ficaram sem preço de nenhuma agência: ${lista(semPreco)}. Esses blocos precisam de cotação ou solução interna.` : "Todos os módulos receberam ao menos um preço.",
  ];
  const topicos = linhas.slice(0, 6).map(({ m, ofertas }) => ofertas.length
    ? `${m.codigo} ${m.nome}: ${plural(ofertas.length, "agência cotou", "agências cotaram")}; menor preço com ${ofertas[0]!.a.player.nome}${estimada(ofertas[0]!.a)} (${brl(ofertas[0]!.mod!.total!.central)}).`
    : `${m.codigo} ${m.nome}: nenhuma agência cotou.`);
  return { frases, topicos, ressalvas: r };
}

// ---------------- Entregas normalizadas ----------------

export function leituraEntregas(base: Base, analises: AnaliseProposta[], p: Premissas): Leitura {
  const r = ressalvas(base, idsDe(analises));
  const volumeBase = Object.values(p.volume_base_mensal).reduce((s, v) => s + v, 0);
  const comCusto = analises.filter((a) => a.custoUnitario);
  if (!comCusto.length)
    return { frases: [`Este RFP não tem módulo de criação recorrente, então não há custo por peça para comparar.`, `A Newe precisa de cerca de ${volumeBase} peças por mês no volume-base.`], topicos: [], ressalvas: r };
  const comPeca = comCusto.filter((a) => a.custoUnitario!.custoPorPeca != null).sort((a, b) => a.custoUnitario!.custoPorPeca! - b.custoUnitario!.custoPorPeca!);
  const teto = comCusto.filter((a) => a.custoUnitario!.rotuloTeto).map((a) => a.player.nome);
  const frases = [
    `A Newe precisa de ${volumeBase} peças por mês no volume-base (posts, vídeos, peças internas e placas).`,
    `Aqui comparamos quantas peças cada agência entrega por mês e quanto custa cada peça equivalente, contando só até o volume que precisamos.`,
    comPeca.length ? `A peça equivalente mais barata é a de ${comPeca[0]!.player.nome}, a ${brl(comPeca[0]!.custoUnitario!.custoPorPeca!)}.` : "Nenhuma agência informou entregas suficientes para calcular o custo por peça.",
  ];
  if (teto.length) frases.push(`${lista(teto)} ${teto.length === 1 ? "informa" : "informam"} volumes "até": é um teto, não uma garantia de entrega.`);
  const topicos = comCusto.slice(0, 4).map((a) => {
    const c = a.custoUnitario!;
    return `${a.player.nome}: ${c.volumeEntregue} peças por mês para ${c.volumeBase} necessárias; ${c.custoPorPeca == null ? "sem custo por peça" : `${brl(c.custoPorPeca)} por peça`}.`;
  });
  return { frases, topicos, ressalvas: r };
}

// ---------------- Cobertura ----------------

export function leituraCobertura(base: Base, analises: AnaliseProposta[]): Leitura {
  const r = ressalvas(base, idsDe(analises));
  if (!analises.length) return { frases: ["Não há propostas para medir cobertura neste RFP."], topicos: [], ressalvas: r };
  const ids = new Set(idsDe(analises));
  const cobs = base.coberturas.filter((c) => ids.has(c.proposta_id));
  const comprovadas = cobs.filter((c) => c.evidencia === "comprovado").length;
  const declaradas = cobs.filter((c) => c.evidencia === "declarado").length;
  const porCob = [...analises].sort((a, b) => b.cobertura.conservadora - a.cobertura.conservadora);
  const abertos = new Map<string, string[]>();
  for (const a of analises) for (const b of a.bloqueios) { const k = b.requisito.codigo ?? b.requisito.id; abertos.set(k, [...(abertos.get(k) ?? []), a.player.nome]); }
  const frases = [
    GLOSSARIO.cobertura,
    `A medida conservadora conta como zero o que a agência não informou; a otimista olha só o que foi informado.`,
    `${porCob[0]!.player.nome} tem a maior cobertura conservadora, com ${pct(porCob[0]!.cobertura.conservadora)}.`,
    `${GLOSSARIO.declarado} Hoje são ${plural(declaradas, "resposta declarada", "respostas declaradas")} e ${plural(comprovadas, "comprovada", "comprovadas")}.`,
  ];
  if (abertos.size) frases.push(`Há ${plural(abertos.size, "requisito essencial", "requisitos essenciais")} sem cobertura em ao menos uma agência; essencial é o que a Newe não pode deixar de ter.`);
  const topicos = porCob.slice(0, 4).map((a) =>
    `${a.player.nome}: ${pct(a.cobertura.conservadora)} conservadora${a.cobertura.otimista != null ? `, ${pct(a.cobertura.otimista)} otimista` : ""}; ${plural(a.bloqueios.length, "essencial aberto", "essenciais abertos")}.`);
  return { frases, topicos, ressalvas: r };
}

// ---------------- Players ----------------

export function leituraPlayers(base: Base, rfp: { id: string; nome: string }, analises: AnaliseProposta[]): Leitura {
  const r = ressalvas(base, idsDe(analises));
  const perguntas = base.perguntas.filter((q) => q.rfp_id === rfp.id);
  const props = analises.map((a) => a.proposta);
  const pend = pendentesPerguntas(perguntas, base.respostas, props);
  const prazos = perguntas.map((q) => q.prazo_resposta).filter((x): x is string => !!x).sort();
  const frases = [
    `Esta tela mostra o perfil de cada agência em ${rfp.nome} e o que ainda precisamos perguntar a ela.`,
    `Perguntas gerais valem para todas; perguntas por agência são endereçadas só a ela.`,
    pend.length ? `Há ${plural(pend.length, "resposta pendente", "respostas pendentes")} no total.` : "Não há perguntas pendentes de resposta.",
  ];
  if (prazos.length) frases.push(`O prazo de resposta mais próximo é ${formatarPrazo(prazos[0]!)}, horário de Brasília.`);
  const topicos = analises.slice(0, 4).map((a) => {
    const n = pend.filter((x) => x.p.id === a.proposta.id).length;
    const total = perguntasDoPlayer(perguntas, rfp.id, a.player.id).length;
    return `${a.player.nome}${estimada(a)}: ${brl(a.total.central)}, cobre ${pct(a.cobertura.conservadora)}; ${n} de ${total} perguntas sem resposta.`;
  });
  return { frases, topicos, ressalvas: r };
}

// ---------------- Pontos de atenção ----------------

export function leituraPontos(base: Base, pontos: Ponto[], analises: AnaliseProposta[]): Leitura {
  const r = ressalvas(base, idsDe(analises));
  const graves = pontos.filter((p) => p.severidade === "critico" || p.severidade === "alto");
  const crit = graves.filter((p) => p.severidade === "critico").length;
  const porPlayer = new Map<string, Ponto[]>();
  for (const p of graves) porPlayer.set(p.playerNome ?? "Geral", [...(porPlayer.get(p.playerNome ?? "Geral") ?? []), p]);
  const frases = [
    GLOSSARIO.ponto,
    `Crítico pode impedir a contratação como está; alto muda preço, prazo ou risco de forma relevante.`,
    graves.length ? `Há ${plural(crit, "alerta crítico", "alertas críticos")} e ${plural(graves.length - crit, "alto", "altos")}, de ${plural(pontos.length, "alerta", "alertas")} no total.` : `Não há alerta crítico nem alto; são ${plural(pontos.length, "alerta", "alertas")} de menor gravidade.`,
    `Cada alerta vem com a pergunta que resolve a dúvida; o caminho prático é enviar essas perguntas antes de decidir.`,
  ];
  const topicos = [...porPlayer].slice(0, 4).map(([nome, ps]) => `${nome}: ${ps.length} grave(s). Exemplo: ${ps[0]!.texto}`);
  return { frases, topicos, ressalvas: r };
}

// ---------------- Composições (Simulador, Cenários) ----------------

export interface ComposicaoNomeada { nome: string; r: ResultadoComposicao }

export function ressalvasComposicao(base: Base, rs: ResultadoComposicao[]): Ressalvas {
  const ids = [...new Set(rs.flatMap((r) => r.modulos.map((m) => m.proposta?.id).filter((x): x is string => !!x)))];
  return ressalvas(base, ids);
}

const players = (r: ResultadoComposicao) => [...new Set(r.modulos.map((m) => m.player?.nome).filter((x): x is string => !!x))];

export function leituraComposicoes(base: Base, itens: ComposicaoNomeada[], contexto: "simulador" | "cenarios"): Leitura {
  const r = ressalvasComposicao(base, itens.map((i) => i.r));
  if (!itens.length) return { frases: ["Ainda não há composição para ler. Escolha agências por módulo ou salve um cenário."], topicos: [], ressalvas: r };
  if (contexto === "simulador" || itens.length === 1) {
    const { nome, r: c } = itens[0]!;
    const abertos = c.modulos.filter((m) => m.semCobertura).map((m) => m.modulo.codigo);
    return {
      frases: [
        `${nome} junta ${players(c).length ? lista(players(c)) : "nenhuma agência"} e custa ${brl(c.total.central)} na janela, cerca de ${brl(c.mediaMensal)} por mês.`,
        `${GLOSSARIO.cobertura} Esta combinação cobre ${pct(c.cobertura.conservadora)}.`,
        abertos.length ? `Ficam abertos, sem agência ou a cotar: ${lista(abertos)}.` : "Nenhum módulo fica sem cobertura.",
        `${c.veredito}`,
      ].filter(Boolean),
      topicos: [
        `${plural(c.contagem.critico, "alerta crítico", "alertas críticos")} e ${plural(c.contagem.alto, "alto", "altos")}.`,
        `${plural(c.lacunas.length, "requisito sem atendimento", "requisitos sem atendimento")}.`,
        ...(c.compromisso && c.compromisso.adicional > 0 ? [`Contratos mais longos que a janela somam mais ${brl(c.compromisso.adicional)} de compromisso.`] : []),
      ],
      ressalvas: r,
    };
  }
  const by = (f: (x: ComposicaoNomeada) => number) => [...itens].sort((a, b) => f(a) - f(b))[0]!;
  const barata = by((x) => x.r.total.central);
  const completa = by((x) => -x.r.cobertura.conservadora * 1e12 + x.r.total.central);
  const eficiente = by((x) => -(x.r.eficiencia ?? 0));
  return {
    frases: [
      `Cada cenário é uma combinação de agências por módulo. Comparamos ${plural(itens.length, "cenário", "cenários")} pelo custo na janela e pela cobertura.`,
      `O mais econômico é ${barata.nome}, com ${brl(barata.r.total.central)}.`,
      `O de maior cobertura é ${completa.nome}, com ${pct(completa.r.cobertura.conservadora)}.`,
      `O melhor custo-benefício, ou seja, mais cobertura por real gasto, é ${eficiente.nome}.`,
    ],
    topicos: itens.slice(0, 4).map((x) => {
      const abertos = x.r.modulos.filter((m) => m.semCobertura).length;
      return `${x.nome}: ${brl(x.r.total.central)}, cobre ${pct(x.r.cobertura.conservadora)}, ${plural(abertos, "módulo aberto", "módulos abertos")}.`;
    }),
    ressalvas: r,
  };
}

export function leituraCenariosSalvos(base: Base): { leitura: Leitura; itens: ComposicaoNomeada[] } {
  const itens = base.cenarios.map((c) => ({ nome: c.nome, r: resultadoDoCenario(base, c) }));
  return { leitura: leituraComposicoes(base, itens, "cenarios"), itens };
}

// ---------------- Mesa de cenários ----------------

export function leituraMesaCenarios(base: Base, cands: Candidato[], nomeados: Nomeado[], fronteira: Candidato[], viaveis: boolean): Leitura {
  const r = ressalvasComposicao(base, nomeados.map((n) => n.c.r));
  const nomeComp = (c: Candidato) => lista(players(c.r)) || "nenhuma agência";
  return {
    frases: [
      `A Mesa calculou ${cands.length.toLocaleString("pt-BR")} combinações possíveis de agências por módulo.`,
      viaveis ? "Há combinações que passam em todas as regras mínimas." : "Nenhuma combinação passa em todas as regras mínimas; mostramos as que têm menos impedimentos.",
      `A fronteira reúne as ${plural(fronteira.length, "combinação", "combinações")} em que não dá para cobrir mais sem pagar mais.`,
    ],
    topicos: nomeados.slice(0, 4).map((n) => `${n.titulo}: ${nomeComp(n.c)}, ${brl(n.c.r.total.central)}, cobre ${pct(n.c.r.cobertura.conservadora)}.`),
    ressalvas: r,
  };
}

// ---------------- Teste de estresse ----------------

export interface LinhaEstresse { nome: string; base: number; volume: number; xcv: number; maximo: number }

export const ESTRESSES: { chave: "volume" | "xcv" | "maximo"; rotulo: string; e: Estresse }[] = [
  { chave: "volume", rotulo: "volume 20% maior", e: { volume: 0.2 } },
  { chave: "xcv", rotulo: "desconto da XCV não valer", e: { xcvSemDesconto: true } },
  { chave: "maximo", rotulo: "preços no máximo da faixa", e: { precoMaximo: true } },
];

export function calcularEstresse(base: Base): { linhas: LinhaEstresse[]; rs: ResultadoComposicao[] } {
  const rs: ResultadoComposicao[] = [];
  const linhas = base.cenarios.map((c) => {
    const b = resultadoDoCenario(base, c);
    rs.push(b);
    const v = (e: Estresse) => resultadoDoCenario(base, c, { estresse: e }).total.central;
    return { nome: c.nome, base: b.total.central, volume: v(ESTRESSES[0]!.e), xcv: v(ESTRESSES[1]!.e), maximo: v(ESTRESSES[2]!.e) };
  });
  return { linhas, rs };
}

export function leituraEstresse(base: Base, linhas: LinhaEstresse[], rs: ResultadoComposicao[] = []): Leitura {
  const r = ressalvasComposicao(base, rs);
  if (!linhas.length) return { frases: ["Ainda não há cenários salvos para testar."], topicos: [], ressalvas: r };
  const maior = (k: "volume" | "xcv" | "maximo") => [...linhas].sort((a, b) => (b[k] - b.base) - (a[k] - a.base))[0]!;
  const frases = [
    `O teste de estresse pergunta: e se der errado? Recalculamos cada cenário com premissas piores.`,
    ...ESTRESSES.map(({ chave, rotulo }) => {
      const m = maior(chave);
      const d = m[chave] - m.base;
      return d > 0.5 ? `Se o ${rotulo.startsWith("volume") ? rotulo : `cenário tiver ${rotulo}`}, quem mais sobe é ${m.nome}: mais ${brl(d)}.` : `Com ${rotulo}, nenhum cenário muda de custo.`;
    }),
  ];
  const ordemB = [...linhas].sort((a, b) => a.base - b.base)[0]!.nome;
  const pior = (l: LinhaEstresse) => Math.max(l.volume, l.xcv, l.maximo);
  const ordemS = [...linhas].sort((a, b) => pior(a) - pior(b))[0]!.nome;
  frases.push(ordemB === ordemS ? `${ordemB} continua o mais barato mesmo no pior caso.` : `No pior caso, o mais barato deixa de ser ${ordemB} e passa a ser ${ordemS}.`);
  return {
    frases: frases.slice(0, 6),
    topicos: linhas.slice(0, 4).map((l) => `${l.nome}: ${brl(l.base)} hoje; até ${brl(pior(l))} no pior caso (${pct(l.base ? pior(l) / l.base - 1 : 0)}).`),
    ressalvas: r,
  };
}

// ---------------- Decisão ----------------

export interface EstadoDecisao {
  rfpNome: string;
  criterios: number;
  portoes: number;
  portoesPendentes: number;
  perguntasPendentes: number;
  naoValidadas: number;
  pontuacaoAberta: boolean;
  revelado: boolean;
  votacaoAberta: boolean;
  votacaoEncerrada: boolean;
  /** Quantos sócios já enviaram notas (contagem, nunca as notas). */
  enviaram: number;
  socios: number;
}

export function leituraDecisao(e: EstadoDecisao): Leitura {
  const etapa = e.votacaoEncerrada ? "votação encerrada; falta registrar a ata"
    : e.votacaoAberta ? "votação aberta"
      : e.revelado ? "notas reveladas; próxima etapa é a sensibilidade e a escolha do cenário"
        : e.pontuacaoAberta ? "pontuação cega aberta"
          : "preparação, antes da pontuação";
  const frases = [
    `Em ${e.rfpNome}, estamos na etapa: ${etapa}.`,
    `A decisão segue sete passos: preparar, portões, pontuação cega, revelação, sensibilidade, escolha do cenário e ata.`,
    `Portão é uma condição mínima: quem não passa, não segue. Há ${plural(e.portoes, "portão", "portões")}, ${e.portoesPendentes} com avaliação pendente.`,
    `Pontuação cega significa que cada sócio dá suas notas sem ver as dos outros; as notas só aparecem na revelação.`,
  ];
  if (e.pontuacaoAberta && !e.revelado) frases.push(`${e.enviaram} de ${e.socios} sócios já enviaram notas. As notas seguem ocultas.`);
  return {
    frases,
    topicos: [
      `${plural(e.criterios, "critério de avaliação", "critérios de avaliação")}.`,
      `${plural(e.perguntasPendentes, "resposta pendente", "respostas pendentes")} das agências.`,
      `${plural(e.naoValidadas, "proposta ainda não validada", "propostas ainda não validadas")}.`,
    ],
    ressalvas: { estimativas: [], avisos: [], soDeclarada: [] },
  };
}

// ---------------- Pareceres e RFPs (conteúdo restrito) ----------------

export function leituraPareceres(docs: Pick<ConteudoDocumentos, "fornecedores">): Leitura {
  const fs = [...docs.fornecedores].sort((a, b) => Number(a.ranking) - Number(b.ranking));
  const top = fs[0];
  return {
    frases: [
      `Os pareceres dão a cada fornecedor uma nota de 0 a 10 de aderência ao que a Newe precisa; é uma régua de apoio, não uma sentença.`,
      top ? `${top.nome} lidera, com nota ${String(top.score).replace(".", ",")} e aderência ${top.nivelFit.toLowerCase()}.` : "Não há pareceres publicados.",
      `Cada parecer tem duas leituras: a objetiva, com os fatos, e a pragmática, com a conclusão para decidir.`,
    ],
    topicos: fs.slice(0, 4).map((f) => `${f.nome} (${String(f.score).replace(".", ",")}): ${f.pragmatica.conclusao.split(". ")[0]}.`),
    ressalvas: { estimativas: [], avisos: [], soDeclarada: [] },
  };
}

export function leituraRfps(docs: Pick<ConteudoDocumentos, "rfps">): Leitura {
  return {
    frases: [
      `RFP é o pedido formal de proposta: o documento que diz às agências o que a Newe precisa.`,
      `São ${plural(docs.rfps.length, "pedido", "pedidos")}, lidos aqui na íntegra, como foram enviados.`,
    ],
    topicos: docs.rfps.slice(0, 4).map((r) => `${r.titulo}: ${r.resumo.split(". ")[0]}.`),
    ressalvas: { estimativas: [], avisos: [], soDeclarada: [] },
  };
}

export type { Player };

/** Monta o estado da decisão a partir do modelo da tela Decisão. Usa só contagens: nunca notas. */
export function estadoDecisao(m: {
  rfp: { numero: number; nome: string };
  criterios: unknown[]; portoes: unknown[]; portoesPendentes: unknown[]; pendentesPerguntas: unknown[]; naoValidadas: unknown[];
  trilha: { pontuacao_aberta: boolean; votacao_aberta: boolean; votacao_encerrada: boolean } | null;
  revelado: boolean; enviaram: unknown[];
}, socios: number): EstadoDecisao {
  return {
    rfpNome: `RFP ${m.rfp.numero} (${m.rfp.nome})`,
    criterios: m.criterios.length, portoes: m.portoes.length, portoesPendentes: m.portoesPendentes.length,
    perguntasPendentes: m.pendentesPerguntas.length, naoValidadas: m.naoValidadas.length,
    pontuacaoAberta: !!m.trilha?.pontuacao_aberta, revelado: m.revelado,
    votacaoAberta: !!m.trilha?.votacao_aberta, votacaoEncerrada: !!m.trilha?.votacao_encerrada,
    enviaram: m.enviaram.length, socios,
  };
}
