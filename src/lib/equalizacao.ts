/**
 * Camada de equalização: junta tabelas + premissas + filtros e aplica R1–R8.
 * Puro (sem React, sem banco) para ser testado e reutilizado por todas as telas.
 */
import {
  coberturaModulo,
  coberturaRfp,
  compromissoContrato,
  custoAjustado,
  custoRecorrenteMensal,
  custoUnitarioNormalizado,
  eficiencia,
  essenciaisNaoCobertos,
  lerPremissas,
  totalProposta,
  valorItemNaJanela,
  type Categoria,
  type CoberturaCalculo,
  type CustoUnitario,
  type Faixa,
  type FaixaCobertura,
  type ItemCalculo,
  type Premissas,
  type RequisitoCalculo,
} from "./calculo";
import type { Base, Cobertura, Entrega, Item, Modulo, Player, Proposta, Requisito } from "./base";
import type { Filtros } from "./filtros";

export function premissasEfetivas(base: Pick<Base, "premissas">, f: Partial<Filtros>): Premissas {
  const p = lerPremissas(base.premissas.map((l) => ({ chave: l.chave, valor: l.valor })));
  if (f.janela) p.janela_meses = f.janela;
  if (f.preco) p.aplicar_desconto_negociado = f.preco === "negociado";
  if (f.verba != null) p.verba_midia_mensal = f.verba;
  if (f.produtos) p.produtos_performance = f.produtos;
  if (f.rigor != null) p.fator_evidencia_declarado = f.rigor;
  return p;
}

export const paraItemCalculo = (i: Item): ItemCalculo => ({
  tipo_preco: i.tipo_preco as ItemCalculo["tipo_preco"],
  unidade: i.unidade as ItemCalculo["unidade"],
  valor_lista: i.valor_lista,
  valor_negociado: i.valor_negociado,
  valor_min: i.valor_min,
  valor_max: i.valor_max,
  multiplicador: i.multiplicador,
  modulo_id: i.modulo_id,
  sujeito_desconto_lista: i.sujeito_desconto_lista,
  premissa_imputacao: i.premissa_imputacao,
});

export const paraRequisito = (r: Requisito): RequisitoCalculo & Requisito => ({
  ...r,
  criticidade: r.criticidade as "essencial" | "desejavel",
});

export const paraCobertura = (c: Cobertura): CoberturaCalculo => ({
  requisito_id: c.requisito_id,
  nivel: c.nivel,
  evidencia: c.evidencia as CoberturaCalculo["evidencia"],
  custo_estimado_para_cobrir: c.custo_estimado_para_cobrir,
});

export const temIncerteza = (i: Item) =>
  (i.valor_min != null && i.valor_max != null) || !!i.incerteza;

export function modulosDoRfp(base: Pick<Base, "rfps" | "modulos">, numero: number): Modulo[] {
  const rfp = base.rfps.find((r) => r.numero === numero);
  return base.modulos.filter((m) => m.rfp_id === rfp?.id);
}

/** Propostas de proponentes do RFP (última versão por player, salvo pedido de todas). */
export function propostasDoRfp(
  base: Pick<Base, "players" | "propostas">,
  numero: number,
  todasVersoes = false,
): { proposta: Proposta; player: Player }[] {
  const lista = base.players
    .filter((pl) => pl.status === "proponente" && pl.rfp_numeros.includes(numero))
    .flatMap((player) => {
      const ps = base.propostas.filter((p) => p.player_id === player.id).sort((a, b) => b.versao - a.versao);
      return (todasVersoes ? ps : ps.slice(0, 1)).map((proposta) => ({ proposta, player }));
    });
  return lista;
}

export function diasAte(data: string | null | undefined, hoje = new Date()): number | null {
  if (!data) return null;
  const d = new Date(`${data}T23:59:59`);
  return Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
}

export interface ModuloAnalise {
  modulo: Modulo;
  itens: { item: Item; valor: Faixa }[];
  total: Faixa | null; // null = não oferece
  cobertura: FaixaCobertura;
}

export interface AnaliseProposta {
  proposta: Proposta;
  player: Player;
  itens: { item: Item; valor: Faixa }[];
  total: Faixa;
  compromisso: Faixa | null;
  modulos: ModuloAnalise[];
  cobertura: FaixaCobertura;
  bloqueios: { requisito: Requisito & RequisitoCalculo; cobertura: CoberturaCalculo | null }[];
  ajustado: ReturnType<typeof custoAjustado>;
  eficiencia: number | null;
  portoes: { passa: number; reprova: number; pendente: number };
  entregas: Entrega[];
  custoUnitario: CustoUnitario | null;
  validadeDias: number | null;
}

export interface Opcoes {
  filtros: Partial<Filtros>;
  premissas: Premissas;
  hoje?: Date;
}

/** Aplica filtros de item (tipo, módulo, entrega-chave, variáveis, faixa de valor). */
export function filtrarItens(itens: Item[], p: Premissas, f: Partial<Filtros>, nome: string) {
  return itens
    .filter((i) => !f.semVariaveis || i.tipo_preco !== "variavel")
    .filter((i) => !f.tipo || i.tipo_preco === f.tipo)
    .filter((i) => !f.modulo || i.modulo_id === f.modulo)
    .filter((i) => !f.entrega || i.entrega_chave === f.entrega)
    .map((item) => ({ item, valor: valorItemNaJanela(paraItemCalculo(item), p, { nome }) }))
    .filter(({ valor }) => (f.vmin == null || valor.central >= f.vmin) && (f.vmax == null || valor.central <= f.vmax));
}

export function analisarProposta(
  base: Base,
  numero: number,
  proposta: Proposta,
  player: Player,
  { filtros, premissas, hoje }: Opcoes,
): AnaliseProposta {
  const modulos = modulosDoRfp(base, numero);
  const idsMod = new Set(modulos.map((m) => m.id));
  const ctx = { nome: player.nome };
  const brutos = base.itens.filter((i) => i.proposta_id === proposta.id && i.modulo_id && idsMod.has(i.modulo_id));
  const itens = filtrarItens(brutos, premissas, filtros, player.nome);
  const calc = itens.map((x) => paraItemCalculo(x.item));
  const total = totalProposta(calc, premissas, ctx);
  const compromisso = compromissoContrato(calc, proposta.contrato_meses_proposto, premissas, ctx);
  const cobs = base.coberturas.filter((c) => c.proposta_id === proposta.id).map(paraCobertura);

  const modAnal: ModuloAnalise[] = modulos.map((modulo) => {
    const its = itens.filter((x) => x.item.modulo_id === modulo.id);
    const reqs = base.requisitos.filter((r) => r.modulo_id === modulo.id).map(paraRequisito);
    return {
      modulo,
      itens: its,
      total: its.length ? totalProposta(its.map((x) => paraItemCalculo(x.item)), premissas, ctx) : null,
      cobertura: coberturaModulo(reqs, cobs, premissas),
    };
  });
  const cobertura = coberturaRfp(modAnal.map((m) => ({ peso_no_rfp: Number(m.modulo.peso_no_rfp), cobertura: m.cobertura })));
  const reqsRfp = base.requisitos.filter((r) => idsMod.has(r.modulo_id)).map(paraRequisito);
  const bloqueios = essenciaisNaoCobertos(reqsRfp, cobs);
  const ajustado = custoAjustado(total.central, bloqueios);

  const portoesRfp = new Set(base.portoes.filter((p) => base.rfps.find((r) => r.id === p.rfp_id)?.numero === numero).map((p) => p.id));
  const res = base.portaoResultados.filter((r) => r.proposta_id === proposta.id && portoesRfp.has(r.portao_id));
  const portoes = {
    passa: res.filter((r) => r.resultado === "passa").length,
    reprova: res.filter((r) => r.resultado === "reprova").length,
    pendente: portoesRfp.size - res.filter((r) => r.resultado !== "pendente").length,
  };

  const entregas = base.entregas.filter((e) => e.proposta_id === proposta.id);
  // Custo de criação recorrente: módulo de criativo (P1) do RFP 2.
  const criativo = modulos.find((m) => m.codigo === "P1");
  const custoUnitario =
    criativo && entregas.length
      ? custoUnitarioNormalizado(
          custoRecorrenteMensal(
            brutos.filter((i) => i.modulo_id === criativo.id).map(paraItemCalculo),
            premissas,
            ctx,
          ),
          entregas.map((e) => ({ categoria: e.categoria as Categoria, quantidade_mes: Number(e.quantidade_mes), e_teto: e.e_teto })),
          premissas,
        )
      : null;

  return {
    proposta,
    player,
    itens,
    total,
    compromisso,
    modulos: modAnal,
    cobertura,
    bloqueios,
    ajustado,
    eficiencia: eficiencia(cobertura.conservadora, total.central),
    portoes,
    entregas,
    custoUnitario,
    validadeDias: diasAte(proposta.validade_ate, hoje),
  };
}

export function analisarRfp(base: Base, numero: number, op: Opcoes): AnaliseProposta[] {
  const f = op.filtros;
  return propostasDoRfp(base, numero)
    .filter(({ player }) => !f.player || player.id === f.player)
    .filter(({ proposta }) => !f.validadas || proposta.status === "validada")
    .filter(({ proposta }) => !f.status || proposta.status === f.status)
    .map(({ proposta, player }) => analisarProposta(base, numero, proposta, player, op));
}

export const ROTULO_TIPO: Record<string, string> = {
  recorrente: "Recorrente",
  pontual: "Pontual",
  variavel: "Variável",
  por_credito: "Por crédito",
};

export const ROTULO_STATUS: Record<string, string> = {
  recebida: "Recebida",
  em_equalizacao: "Em equalização",
  validada: "Validada",
};

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  posts_instagram: "Posts e carrosséis Instagram",
  videos_sociais: "Vídeos sociais",
  posts_linkedin: "Posts LinkedIn",
  posts_corretores: "Posts para corretores",
  pecas_endomarketing: "Endomarketing",
  placas_ooh: "Placas OOH",
  videos_painel: "Vídeo de painel digital",
};
