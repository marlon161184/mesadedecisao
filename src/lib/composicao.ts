/**
 * Simulador de composição: aplica R1–R8 a uma escolha de player por módulo.
 * Puro e testado. Nenhum total inclui honorários do consultor facilitador.
 */
import {
  coberturaModulo, coberturaRfp, compromissoContrato, eficiencia as r8, valorItemNaJanela,
  type Faixa, type FaixaCobertura, type Premissas,
} from "./calculo";
import type { Base, Item, Modulo, Player, Proposta, Requisito } from "./base";
import { analisarProposta, paraCobertura, paraItemCalculo, paraRequisito, diasAte } from "./equalizacao";
import { pontosAutomaticos, ORDEM_SEV, type Ponto, type Severidade } from "./pontos";

export type Opcao =
  | { tipo: "player"; propostaId: string }
  | { tipo: "a_cotar" }
  | { tipo: "interno"; comentario: string };

export interface Composicao {
  escolhas: Record<string, Opcao>; // por modulo_id
  contarApenas: Record<string, string>; // entrega_chave -> player_id
  incluirFase2: boolean;
  incluirNaoValidadas: boolean;
}

export interface Estresse {
  volume?: number; // ex.: 0.2 = +20% na produção recorrente do criativo
  xcvSemDesconto?: boolean;
  precoMaximo?: boolean;
  crmACotar?: number; // valor na janela para o P3 "a cotar"
}

export interface ItemComp { item: Item; player: Player; valor: Faixa; excluido: boolean; sobreposto: boolean }

export interface ModuloComp {
  modulo: Modulo;
  rfpNumero: number;
  opcao: Opcao;
  proposta: Proposta | null;
  player: Player | null;
  itens: ItemComp[];
  total: number;
  cobertura: FaixaCobertura;
  essencial: boolean;
  semCobertura: boolean;
}

export interface Lacuna { modulo: Modulo; requisito: Requisito; player: string; nota: string | null; custo: number | null; naoInformado: boolean }

export interface Sobreposicao { entregaChave: string; players: { id: string; nome: string; valor: number }[]; escolhido: string | null }

export interface ResultadoComposicao {
  modulos: ModuloComp[];
  total: Faixa;
  mediaMensal: number;
  compromisso: { total: number; adicional: number; porPlayer: { nome: string; meses: number; valor: number }[] } | null;
  ajustado: { acrescimo: number; ajustado: number; semEstimativa: number };
  porRfp: { numero: number; valor: number; cobertura: FaixaCobertura }[];
  porPlayer: { id: string; nome: string; cor: string | null; valor: number; pct: number }[];
  porTipo: { tipo: string; valor: number }[];
  desembolso: { mes: number; porPlayer: Record<string, number>; total: number }[];
  cobertura: FaixaCobertura;
  lacunas: Lacuna[];
  eficiencia: number | null;
  sobreposicoes: Sobreposicao[];
  pontos: Ponto[];
  contagem: Record<Severidade, number>;
  concentracao: number;
  nPlayers: number;
  veredito: string;
  portoesReprovados: number;
  viavel: boolean;
  motivosInviavel: string[];
}

const eXcv = (n?: string) => !!n && /xcv|wivo/i.test(n);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function modulosDaComposicao(base: Base, incluirFase2: boolean) {
  return base.modulos
    .map((m) => ({ m, rfp: base.rfps.find((r) => r.id === m.rfp_id)! }))
    .filter(({ rfp }) => rfp && (incluirFase2 || rfp.fase === 1))
    .sort((a, b) => a.rfp.numero - b.rfp.numero || a.m.codigo.localeCompare(b.m.codigo));
}

export const moduloEssencial = (base: Base, m: Modulo) =>
  m.essencial || base.requisitos.some((r) => r.modulo_id === m.id && r.criticidade === "essencial");

/** Propostas com item de preço no módulo (opções do seletor). */
export function opcoesDoModulo(base: Base, moduloId: string) {
  const ids = new Set(base.itens.filter((i) => i.modulo_id === moduloId).map((i) => i.proposta_id));
  return base.propostas
    .filter((p) => ids.has(p.id))
    .map((p) => ({ proposta: p, player: base.players.find((pl) => pl.id === p.player_id)! }));
}

function valorItem(item: Item, player: Player, modulo: Modulo, p: Premissas, e: Estresse): Faixa {
  let it = paraItemCalculo(item);
  if (e.xcvSemDesconto && eXcv(player.nome)) it = { ...it, valor_negociado: null, sujeito_desconto_lista: false };
  const v = valorItemNaJanela(it, p, { nome: player.nome });
  let f = e.precoMaximo ? { ...v, central: v.max, min: v.max } : v;
  if (e.volume && modulo.codigo === "P1" && item.tipo_preco === "recorrente") {
    const k = 1 + e.volume;
    f = { ...f, central: f.central * k, min: f.min * k, max: f.max * k };
  }
  return f;
}

/** Pontos P-xx das propostas, por proposta (pode ser pré-calculado para a enumeração). */
export function pontosDasPropostas(base: Base, p: Premissas, hoje?: Date) {
  const mapa = new Map<string, Ponto[]>();
  for (const prop of base.propostas) {
    const player = base.players.find((x) => x.id === prop.player_id)!;
    const pts: Ponto[] = [];
    for (const n of player.rfp_numeros) {
      const a = analisarProposta(base, n, prop, player, { filtros: {}, premissas: p, ...(hoje ? { hoje } : {}) });
      for (const pt of pontosAutomaticos(a, p)) if (!pts.some((x) => x.id === pt.id)) pts.push(pt);
    }
    mapa.set(prop.id, pts);
  }
  return mapa;
}

export function analisarComposicao(
  base: Base,
  comp: Composicao,
  p: Premissas,
  op: { hoje?: Date; dataDecisao?: string | null; estresse?: Estresse; pontosPropostas?: Map<string, Ponto[]> } = {},
): ResultadoComposicao {
  const e = op.estresse ?? {};
  const hoje = op.hoje ?? new Date();
  const lista = modulosDaComposicao(base, comp.incluirFase2);

  // 1. Itens por módulo
  const modulos: ModuloComp[] = lista.map(({ m, rfp }) => {
    const opcao: Opcao = comp.escolhas[m.id] ?? { tipo: "a_cotar" };
    const proposta = opcao.tipo === "player" ? base.propostas.find((x) => x.id === opcao.propostaId) ?? null : null;
    const player = proposta ? base.players.find((x) => x.id === proposta.player_id) ?? null : null;
    const itens: ItemComp[] = proposta && player
      ? base.itens.filter((i) => i.proposta_id === proposta.id && i.modulo_id === m.id)
          .map((item) => ({ item, player, valor: valorItem(item, player, m, p, e), excluido: false, sobreposto: false }))
      : [];
    const reqs = base.requisitos.filter((r) => r.modulo_id === m.id).map(paraRequisito);
    const cobs = proposta ? base.coberturas.filter((c) => c.proposta_id === proposta.id).map(paraCobertura) : [];
    const cobertura = proposta ? coberturaModulo(reqs, cobs, p) : { conservadora: 0, otimista: 0 };
    return {
      modulo: m, rfpNumero: rfp.numero, opcao, proposta, player, itens, total: 0, cobertura,
      essencial: moduloEssencial(base, m), semCobertura: !proposta,
    };
  });

  // 2. Sobreposição de entrega-chave entre players diferentes
  const porChave = new Map<string, ItemComp[]>();
  for (const mc of modulos) for (const ic of mc.itens) if (ic.item.entrega_chave) {
    const k = ic.item.entrega_chave;
    porChave.set(k, [...(porChave.get(k) ?? []), ic]);
  }
  const sobreposicoes: Sobreposicao[] = [];
  let riscoDupla = 0;
  for (const [k, ics] of porChave) {
    const players = [...new Map(ics.map((x) => [x.player.id, x.player])).values()];
    if (players.length < 2) continue;
    const escolhido = comp.contarApenas[k] && players.some((x) => x.id === comp.contarApenas[k]) ? comp.contarApenas[k]! : null;
    const valores = players.map((pl) => ({ id: pl.id, nome: pl.nome, valor: ics.filter((x) => x.player.id === pl.id).reduce((s, x) => s + x.valor.central, 0) }));
    for (const ic of ics) { ic.sobreposto = true; if (escolhido && ic.player.id !== escolhido) ic.excluido = true; }
    if (!escolhido) riscoDupla += valores.reduce((s, v) => s + v.valor, 0) - Math.max(...valores.map((v) => v.valor));
    sobreposicoes.push({ entregaChave: k, players: valores, escolhido });
  }

  // 3. Totais
  const contados = modulos.flatMap((mc) => mc.itens.filter((x) => !x.excluido));
  let central = 0, min = 0, max = 0, eFaixa = false;
  for (const x of contados) { central += x.valor.central; min += x.valor.min; max += x.valor.max; eFaixa ||= x.valor.eFaixa; }
  const crmExtra = e.crmACotar ? modulos.filter((mc) => mc.modulo.codigo === "P3" && mc.semCobertura).length * e.crmACotar : 0;
  central += crmExtra; min += crmExtra; max += crmExtra;
  if (riscoDupla > 0) { min -= riscoDupla; eFaixa = true; }
  for (const mc of modulos) mc.total = mc.itens.filter((x) => !x.excluido).reduce((s, x) => s + x.valor.central, 0) + (mc.modulo.codigo === "P3" && mc.semCobertura ? e.crmACotar ?? 0 : 0);
  const total: Faixa = { central, min, max, eFaixa };

  const mapaPlayer = new Map<string, { id: string; nome: string; cor: string | null; valor: number }>();
  for (const x of contados) {
    const cur = mapaPlayer.get(x.player.id) ?? { id: x.player.id, nome: x.player.nome, cor: x.player.cor_token, valor: 0 };
    cur.valor += x.valor.central;
    mapaPlayer.set(x.player.id, cur);
  }
  const porPlayer = [...mapaPlayer.values()].map((v) => ({ ...v, pct: central > 0 ? v.valor / central : 0 })).sort((a, b) => b.valor - a.valor);
  const tipos: Record<string, number> = { recorrente: 0, pontual: 0, variavel: 0 };
  for (const x of contados) {
    const t = x.item.tipo_preco === "variavel" ? "variavel" : x.item.tipo_preco === "recorrente" ? "recorrente" : "pontual";
    tipos[t] = (tipos[t] ?? 0) + x.valor.central;
  }
  const porTipo = Object.entries(tipos).map(([tipo, valor]) => ({ tipo, valor }));

  // Compromisso de contratos maiores que a janela
  const porPlayerComp: { nome: string; meses: number; valor: number }[] = [];
  let adicional = 0;
  const propostasUsadas = [...new Map(modulos.filter((m) => m.proposta).map((m) => [m.proposta!.id, m])).values()];
  for (const mc of propostasUsadas) {
    const its = contados.filter((x) => x.item.proposta_id === mc.proposta!.id).map((x) => paraItemCalculo(x.item));
    const c = compromissoContrato(its, mc.proposta!.contrato_meses_proposto, p, { nome: mc.player!.nome });
    if (c) {
      const naJanela = contados.filter((x) => x.item.proposta_id === mc.proposta!.id).reduce((s, x) => s + x.valor.central, 0);
      adicional += c.central - naJanela;
      porPlayerComp.push({ nome: mc.player!.nome, meses: mc.proposta!.contrato_meses_proposto!, valor: c.central });
    }
  }
  const compromisso = porPlayerComp.length ? { total: central + adicional, adicional, porPlayer: porPlayerComp } : null;

  // Desembolso mês a mês
  const J = p.janela_meses;
  const desembolso = Array.from({ length: J }, (_, i) => ({ mes: i + 1, porPlayer: {} as Record<string, number>, total: 0 }));
  const somar = (mes: number, nome: string, v: number) => {
    const d = desembolso[Math.min(Math.max(mes, 1), J) - 1]!;
    d.porPlayer[nome] = (d.porPlayer[nome] ?? 0) + v;
    d.total += v;
  };
  for (const x of contados) {
    const cron = Array.isArray(x.item.cronograma_pagamento) ? (x.item.cronograma_pagamento as { dias: number; pct: number }[]) : null;
    if (cron && cron.length) {
      for (const parc of cron) somar(Math.floor(Number(parc.dias) / 30) + 1, x.player.nome, (x.valor.central * Number(parc.pct)) / 100);
    } else if (x.item.tipo_preco === "recorrente" || x.item.tipo_preco === "variavel") {
      const meses = x.item.tipo_preco === "variavel" ? Math.min(J, p.meses_com_verba) : J;
      for (let m = 1; m <= meses; m++) somar(m, x.player.nome, x.valor.central / meses);
    } else somar(1, x.player.nome, x.valor.central);
  }
  if (crmExtra) for (let m = 1; m <= J; m++) somar(m, "CRM a cotar", crmExtra / J);

  // 4. Cobertura, lacunas, eficiência
  const cobertura = coberturaRfp(modulos.map((m) => ({ peso_no_rfp: Number(m.modulo.peso_no_rfp), cobertura: m.cobertura })));
  const porRfp = [...new Set(modulos.map((m) => m.rfpNumero))].map((numero) => {
    const ms = modulos.filter((m) => m.rfpNumero === numero);
    return {
      numero,
      valor: ms.reduce((s, m) => s + m.total, 0),
      cobertura: coberturaRfp(ms.map((m) => ({ peso_no_rfp: Number(m.modulo.peso_no_rfp), cobertura: m.cobertura }))),
    };
  });
  const lacunas: Lacuna[] = [];
  for (const mc of modulos) {
    for (const r of base.requisitos.filter((x) => x.modulo_id === mc.modulo.id && x.criticidade === "essencial")) {
      const c = mc.proposta ? base.coberturas.find((x) => x.proposta_id === mc.proposta!.id && x.requisito_id === r.id) : undefined;
      if (mc.proposta && c && c.nivel != null && c.nivel > 0) continue;
      lacunas.push({
        modulo: mc.modulo, requisito: r,
        player: mc.player?.nome ?? (mc.opcao.tipo === "interno" ? "Time interno NEWE" : "Sem player"),
        nota: c?.nota_tecnica ?? null, custo: c?.custo_estimado_para_cobrir ?? null,
        naoInformado: !c || c.nivel == null,
      });
    }
  }
  const acrescimo = lacunas.reduce((s, l) => s + (l.custo ?? 0), 0);
  const ajustado = { acrescimo, ajustado: central + acrescimo, semEstimativa: lacunas.filter((l) => l.custo == null).length };
  const eficiencia = r8(cobertura.conservadora, central);
  const concentracao = porPlayer[0]?.pct ?? 0;
  const nPlayers = porPlayer.length;

  // 5. Pontos de atenção da composição (C-01 a C-11) + pontos das propostas
  const pontos: Ponto[] = [];
  const add = (codigo: string, severidade: Severidade, texto: string, acao: string, moduloId: string | null = null, sufixo = "") =>
    pontos.push({ id: `${codigo}${sufixo}`, codigo, origem: "regra", severidade, texto, acao, pergunta: texto, propostaId: null, playerNome: null, moduloId });

  for (const s of sobreposicoes) if (!s.escolhido)
    add("C-01", "critico", `Sobreposição em ${s.entregaChave}: ${s.players.map((x) => x.nome).join(" e ")} entregam o mesmo item. O total soma os dois.`,
      "Escolher qual player conta para esta entrega.", null, `-${s.entregaChave}`);
  for (const mc of modulos) if (mc.essencial && mc.semCobertura)
    add("C-02", "alto", `${mc.modulo.codigo} ${mc.modulo.nome} está ${mc.opcao.tipo === "a_cotar" ? "a cotar" : mc.opcao.tipo === "interno" ? "com o time interno" : "sem player"}, sem cobertura dos requisitos essenciais.`,
      "Cotar o módulo ou estimar o custo para cobrir os essenciais.", mc.modulo.id, `-${mc.modulo.id}`);
  const deMod = (cod: string) => modulos.find((m) => m.modulo.codigo === cod)?.player?.id;
  const tripla = deMod("P1") && deMod("P1") === deMod("P2") && deMod("P2") === deMod("P3");
  if (concentracao > 0.6 || tripla) {
    const nome = tripla ? modulos.find((m) => m.modulo.codigo === "P1")!.player!.nome : porPlayer[0]!.nome;
    add("C-03", "alto", `Risco de dependência de fornecedor: ${nome}${concentracao > 0.6 ? ` concentra ${pct(concentracao)} do valor da janela` : ""}${tripla ? " e está no criativo, na mídia e no CRM ao mesmo tempo" : ""}.`,
      "Avaliar dividir módulos ou exigir cláusulas de saída e portabilidade.");
  }
  if (deMod("C3") && deMod("C3") === deMod("P1"))
    add("C-04", "alto", `Conflito de interesse: ${modulos.find((m) => m.modulo.codigo === "C3")!.player!.nome} valida (C3) e produz o criativo (P1).`,
      "Separar quem valida de quem produz.");
  if (compromisso && compromisso.adicional > 0)
    add("C-05", "medio", `Contratos maiores que a janela: compromisso adicional de ${brl(compromisso.adicional)} além da janela de ${J} meses.`,
      "Negociar contrato do tamanho da janela ou cláusula de saída.");
  let portoesReprovados = 0;
  for (const mc of propostasUsadas) {
    const rfpIds = new Set(modulos.filter((m) => m.proposta?.id === mc.proposta!.id).map((m) => m.modulo.rfp_id));
    for (const po of base.portoes.filter((x) => rfpIds.has(x.rfp_id))) {
      const r = base.portaoResultados.find((x) => x.portao_id === po.id && x.proposta_id === mc.proposta!.id)?.resultado ?? "pendente";
      if (r === "reprova") portoesReprovados++;
      if (r !== "passa")
        add("C-06", "critico", `Portão "${po.descricao}" ${r === "reprova" ? "reprovado" : "pendente"} para ${mc.player!.nome}.`,
          r === "reprova" ? "Trocar o player do módulo." : "Obter a evidência e registrar o resultado do portão.", null, `-${po.id}-${mc.proposta!.id}`);
    }
  }
  if (nPlayers > 4) add("C-07", "medio", `${nPlayers} players ao mesmo tempo: custo de coordenação.`, "Reduzir o número de fornecedores ou definir quem coordena.");
  for (const mc of propostasUsadas) {
    const v = mc.proposta!.validade_ate;
    const dias = diasAte(v, hoje);
    const antesDecisao = v && op.dataDecisao && v < op.dataDecisao;
    if ((dias != null && dias < 0) || antesDecisao)
      add("C-08", "critico", `A proposta de ${mc.player!.nome} ${dias != null && dias < 0 ? "está vencida" : "vence antes da data de decisão"}.`,
        "Pedir prorrogação da validade por escrito.", null, `-${mc.proposta!.id}`);
  }
  if (central > 0 && total.max - total.min > 0.15 * central)
    add("C-09", "medio", `Incerteza de preço: a faixa (${brl(total.min)} a ${brl(total.max)}) passa de 15% do total.`, "Pedir valores fechados para os itens em faixa.");
  const c3 = modulos.find((m) => m.modulo.codigo === "C3");
  const r32 = base.requisitos.find((r) => r.codigo === "R3.2");
  const temProducao = modulos.some((m) => m.modulo.codigo === "P1" && m.itens.some((x) => x.item.tipo_preco === "recorrente" && !x.excluido));
  if (c3?.proposta && r32 && temProducao) {
    const n = base.coberturas.find((x) => x.proposta_id === c3.proposta!.id && x.requisito_id === r32.id)?.nivel;
    if (n == null || n < 1)
      add("C-10", "alto", `Capacidade de validação: ${c3.player!.nome} não cobre R3.2 (40 a 50 peças por mês) e a composição tem produção recorrente.`,
        "Ampliar a capacidade de validação ou rever o volume de produção.");
  }
  for (const x of contados) if (x.item.teto_verba_mensal != null && p.verba_midia_mensal > Number(x.item.teto_verba_mensal))
    add("C-11", "medio", `A verba de ${brl(p.verba_midia_mensal)} por mês passa do teto coberto por ${x.player.nome} (${brl(Number(x.item.teto_verba_mensal))}).`,
      "Confirmar o custo de gestão acima do teto.", x.item.modulo_id, `-${x.item.id}`);

  const pp = op.pontosPropostas ?? pontosDasPropostas(base, p, hoje);
  for (const mc of propostasUsadas) for (const pt of pp.get(mc.proposta!.id) ?? []) if (!pontos.some((x) => x.id === pt.id)) pontos.push(pt);
  pontos.sort((a, b) => ORDEM_SEV[a.severidade] - ORDEM_SEV[b.severidade]);
  const contagem = { critico: 0, alto: 0, medio: 0, info: 0 } as Record<Severidade, number>;
  for (const pt of pontos) contagem[pt.severidade]++;

  const motivosInviavel: string[] = [];
  if (portoesReprovados) motivosInviavel.push(`${portoesReprovados} portão(ões) reprovado(s)`);
  if (contagem.critico) motivosInviavel.push(`${contagem.critico} ponto(s) crítico(s)`);
  const essSem = modulos.filter((m) => m.essencial && m.semCobertura).length;
  if (essSem) motivosInviavel.push(`${essSem} módulo(s) essencial(is) sem cobertura`);

  const veredito = `Cobre ${pct(cobertura.conservadora)} (faixa ${pct(cobertura.conservadora)} a ${pct(cobertura.otimista ?? cobertura.conservadora)}) do que os RFPs pedem, com ${lacunas.length} bloqueio(s) essencial(is).`;

  return {
    modulos, total, mediaMensal: central / J, compromisso, ajustado, porRfp, porPlayer, porTipo, desembolso, cobertura,
    lacunas, eficiencia, sobreposicoes, pontos, contagem, concentracao, nPlayers, veredito, portoesReprovados,
    viavel: motivosInviavel.length === 0, motivosInviavel,
  };
}

/** Composição a partir das linhas salvas do cenário. */
export function composicaoDoCenario(
  linhas: { modulo_id: string; proposta_id: string | null; opcao: string; comentario: string | null }[],
  config: Record<string, unknown> | null,
): Composicao {
  const escolhas: Record<string, Opcao> = {};
  for (const l of linhas) {
    escolhas[l.modulo_id] = l.opcao === "interno" ? { tipo: "interno", comentario: l.comentario ?? "" }
      : l.proposta_id && l.opcao === "player" ? { tipo: "player", propostaId: l.proposta_id } : { tipo: "a_cotar" };
  }
  const c = config ?? {};
  return {
    escolhas,
    contarApenas: (c["contarApenas"] as Record<string, string>) ?? {},
    incluirFase2: !!c["incluirFase2"],
    incluirNaoValidadas: c["incluirNaoValidadas"] !== false,
  };
}

// ---------- Mesa de cenários: enumeração ----------

export interface Candidato { comp: Composicao; r: ResultadoComposicao; chave: string }

export function enumerarComposicoes(base: Base, p: Premissas, op: { incluirNaoValidadas: boolean; limite?: number; dataDecisao?: string | null }) {
  const limite = op.limite ?? 200000;
  const mods = modulosDaComposicao(base, false).map(({ m }) => m);
  const opcoes = mods.map((m) => [
    ...opcoesDoModulo(base, m.id).filter((o) => op.incluirNaoValidadas || o.proposta.status === "validada").map((o) => ({ tipo: "player", propostaId: o.proposta.id }) as Opcao),
    { tipo: "a_cotar" } as Opcao,
  ]);
  // Descarta os piores candidatos (menor cobertura por real) até caber no limite.
  const produto = () => opcoes.reduce((s, o) => s * o.length, 1);
  while (produto() > limite) {
    const i = opcoes.reduce((best, o, idx) => (o.length > opcoes[best]!.length ? idx : best), 0);
    const m = mods[i]!;
    const nota = (o: Opcao) => {
      if (o.tipo !== "player") return Infinity;
      const r = analisarComposicao(base, { escolhas: { [m.id]: o }, contarApenas: {}, incluirFase2: false, incluirNaoValidadas: true }, p, { pontosPropostas: new Map() });
      return r.eficiencia ?? 0;
    };
    const pior = opcoes[i]!.filter((o) => o.tipo === "player").sort((a, b) => nota(a) - nota(b))[0];
    opcoes[i] = opcoes[i]!.filter((o) => o !== pior);
  }
  const pp = pontosDasPropostas(base, p);
  const out: Candidato[] = [];
  const idx = mods.map(() => 0);
  for (;;) {
    const escolhas: Record<string, Opcao> = {};
    mods.forEach((m, i) => { escolhas[m.id] = opcoes[i]![idx[i]!]!; });
    const comp: Composicao = { escolhas, contarApenas: {}, incluirFase2: false, incluirNaoValidadas: op.incluirNaoValidadas };
    out.push({ comp, r: analisarComposicao(base, comp, p, { pontosPropostas: pp, dataDecisao: op.dataDecisao ?? null }), chave: idx.join("-") });
    let k = 0;
    while (k < idx.length && ++idx[k]! >= opcoes[k]!.length) { idx[k] = 0; k++; }
    if (k === idx.length) break;
  }
  return out;
}

export interface Nomeado { titulo: string; motivo: string; c: Candidato }

const invalidez = (r: ResultadoComposicao) => r.portoesReprovados * 100 + r.contagem.critico * 10 + r.modulos.filter((m) => m.essencial && m.semCobertura).length;

export function cenariosNomeados(cands: Candidato[]): { viaveis: boolean; pool: Candidato[]; nomeados: Nomeado[] } {
  const comPlayer = cands.filter((c) => c.r.nPlayers > 0);
  const viaveis = comPlayer.filter((c) => c.r.viavel);
  let pool = viaveis;
  if (!pool.length) {
    const minInv = Math.min(...comPlayer.map((c) => invalidez(c.r)));
    pool = comPlayer.filter((c) => invalidez(c.r) === minInv);
  }
  if (!pool.length) return { viaveis: false, pool, nomeados: [] };
  const by = (f: (c: Candidato) => number) => [...pool].sort((a, b) => f(a) - f(b))[0]!;
  const custos = pool.map((c) => c.r.total.central), covs = pool.map((c) => c.r.cobertura.conservadora);
  const [cmin, cmax, vmin, vmax] = [Math.min(...custos), Math.max(...custos), Math.min(...covs), Math.max(...covs)];
  const norm = (v: number, a: number, b: number) => (b - a ? (v - a) / (b - a) : 0);
  const nomeados: Nomeado[] = [
    { titulo: "Mais econômico viável", motivo: "Menor custo na janela entre as composições elegíveis.", c: by((c) => c.r.total.central) },
    { titulo: "Maior cobertura", motivo: "Maior cobertura conservadora dos requisitos; empate decidido pelo menor custo.", c: by((c) => -c.r.cobertura.conservadora * 1e12 + c.r.total.central) },
    { titulo: "Melhor custo-benefício", motivo: "Maior eficiência: pontos de cobertura por R$ 100 mil.", c: by((c) => -(c.r.eficiencia ?? 0)) },
    { titulo: "Menor risco", motivo: "Menos pontos críticos e, no empate, menor concentração em um único player.", c: by((c) => c.r.contagem.critico * 10 + c.r.concentracao + c.r.contagem.alto * 0.01) },
    {
      titulo: "Equilibrado",
      motivo: "Menor distância ao ponto ideal de menor custo e maior cobertura, ambos normalizados.",
      c: by((c) => Math.hypot(norm(c.r.total.central, cmin, cmax), 1 - norm(c.r.cobertura.conservadora, vmin, vmax))),
    },
  ];
  return { viaveis: viaveis.length > 0, pool, nomeados };
}

/** Fronteira de eficiência: para cada custo, nenhuma outra composição tem cobertura maior por custo menor ou igual. */
export function fronteira(cands: Candidato[]) {
  const ord = [...cands].sort((a, b) => a.r.total.central - b.r.total.central || b.r.cobertura.conservadora - a.r.cobertura.conservadora);
  const out: Candidato[] = [];
  let melhor = -1;
  for (const c of ord) if (c.r.cobertura.conservadora > melhor + 1e-9) { out.push(c); melhor = c.r.cobertura.conservadora; }
  return out;
}

export { ORDEM_SEV };
export type { Proposta };
