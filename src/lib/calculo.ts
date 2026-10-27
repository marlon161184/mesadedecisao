/**
 * Regras de cálculo da Mesa de Decisão (R1 a R8).
 * Módulo único, puro e testado: todas as telas usam estas funções.
 * Nada aqui inclui honorários do consultor facilitador (fora de escopo).
 */

// ---------- Tipos ----------

export type Categoria =
  | "posts_instagram"
  | "videos_sociais"
  | "posts_linkedin"
  | "posts_corretores"
  | "pecas_endomarketing"
  | "placas_ooh"
  | "videos_painel";

export interface Premissas {
  janela_meses: number;
  aplicar_desconto_negociado: boolean;
  verba_midia_mensal: number;
  meses_com_verba: number;
  produtos_performance: number;
  pct_gestao_midia_folhetim: number;
  pct_comissao_midia_fmd: number;
  desconto_xcv_mensal: number;
  fator_evidencia_declarado: number;
  volume_base_mensal: Record<Categoria, number>;
  /** Premissas numéricas adicionais (ex.: imputacao_rebu_c3). */
  extras: Record<string, number>;
}

export const PREMISSAS_PADRAO: Premissas = {
  janela_meses: 6,
  aplicar_desconto_negociado: true,
  verba_midia_mensal: 50000,
  meses_com_verba: 6,
  produtos_performance: 3,
  pct_gestao_midia_folhetim: 0.12,
  pct_comissao_midia_fmd: 0.2,
  desconto_xcv_mensal: 0.5,
  fator_evidencia_declarado: 1,
  volume_base_mensal: {
    posts_instagram: 8,
    videos_sociais: 4,
    posts_linkedin: 4,
    posts_corretores: 4,
    pecas_endomarketing: 5,
    placas_ooh: 10,
    videos_painel: 2,
  },
  extras: { imputacao_rebu_c3: 0.5 },
};

export interface ItemCalculo {
  tipo_preco: "recorrente" | "pontual" | "variavel" | "por_credito";
  unidade: "mes" | "projeto" | "produto_mes" | "percentual_verba";
  valor_lista: number | null;
  valor_negociado: number | null;
  valor_min?: number | null;
  valor_max?: number | null;
  multiplicador?: number | null;
  modulo_id?: string | null;
  /** Item recorrente de lista sujeito ao desconto mensal da XCV. */
  sujeito_desconto_lista?: boolean | null;
  /** Chave de premissa com a fração do valor imputada na janela. */
  premissa_imputacao?: string | null;
}

export interface Faixa {
  central: number;
  min: number;
  max: number;
  /** true quando veio de valor_min/valor_max (exibir como faixa). */
  eFaixa: boolean;
}

/** Contexto do player, para regras específicas (desconto XCV, percentuais de mídia). */
export interface ContextoPlayer {
  nome?: string;
  /** Usado em R2: valores imputados contam inteiros no compromisso do contrato. */
  contratoInteiro?: boolean;
}

const eXcv = (nome?: string) => !!nome && /xcv|wivo/i.test(nome);
const eFolhetim = (nome?: string) => !!nome && /folhetim/i.test(nome);
const eFmd = (nome?: string) => !!nome && /f&md|fmd/i.test(nome);

// ---------- Premissas ----------

export function lerPremissas(linhas: { chave: string; valor: unknown }[]): Premissas {
  const p: Premissas = {
    ...PREMISSAS_PADRAO,
    volume_base_mensal: { ...PREMISSAS_PADRAO.volume_base_mensal },
    extras: { ...PREMISSAS_PADRAO.extras },
  };
  for (const { chave, valor } of linhas) {
    if (!(chave in p) || chave === "extras") {
      const n = Number(valor);
      if (Number.isFinite(n)) p.extras[chave] = n;
      continue;
    }
    const k = chave as keyof Premissas;
    if (k === "volume_base_mensal" && valor && typeof valor === "object") {
      p.volume_base_mensal = { ...p.volume_base_mensal, ...(valor as Record<Categoria, number>) };
    } else if (k === "aplicar_desconto_negociado") {
      p.aplicar_desconto_negociado = valor === true || valor === "true";
    } else {
      const n = Number(valor);
      if (Number.isFinite(n)) (p[k] as number) = n;
    }
  }
  return p;
}

// ---------- R1 · Valor do item na janela ----------

/** Preço unitário efetivo: negociado (se aplicável e existente) ou lista, com desconto XCV. */
export function precoEfetivo(item: ItemCalculo, p: Premissas, ctx: ContextoPlayer = {}): number {
  const usaNegociado = p.aplicar_desconto_negociado && item.valor_negociado != null;
  if (usaNegociado) return item.valor_negociado as number;
  const lista = item.valor_lista ?? item.valor_negociado ?? 0;
  if (p.aplicar_desconto_negociado && eXcv(ctx.nome) && item.tipo_preco === "recorrente" && item.sujeito_desconto_lista && item.valor_lista != null) {
    return lista * (1 - p.desconto_xcv_mensal);
  }
  return lista;
}

function aplicarRegra(item: ItemCalculo, preco: number, p: Premissas, ctx: ContextoPlayer): number {
  const fracao = item.premissa_imputacao && !ctx.contratoInteiro ? (p.extras[item.premissa_imputacao] ?? 1) : 1;
  return fracao * aplicarRegraBase(item, preco, p, ctx);
}

function aplicarRegraBase(item: ItemCalculo, preco: number, p: Premissas, ctx: ContextoPlayer): number {
  const mult = item.multiplicador ?? 1;
  if (item.tipo_preco === "variavel" || item.unidade === "percentual_verba") {
    let pctv = preco;
    if (!pctv) pctv = eFolhetim(ctx.nome) ? p.pct_gestao_midia_folhetim : eFmd(ctx.nome) ? p.pct_comissao_midia_fmd : 0;
    return pctv * p.verba_midia_mensal * p.meses_com_verba;
  }
  if (item.unidade === "produto_mes") return preco * p.produtos_performance * p.janela_meses;
  if (item.tipo_preco === "recorrente" || item.unidade === "mes") return preco * mult * p.janela_meses;
  if (item.tipo_preco === "por_credito") return preco * mult;
  return preco; // pontual
}

export function valorItemNaJanela(item: ItemCalculo, p: Premissas, ctx: ContextoPlayer = {}): Faixa {
  if (item.valor_min != null && item.valor_max != null) {
    const min = aplicarRegra(item, item.valor_min, p, ctx);
    const max = aplicarRegra(item, item.valor_max, p, ctx);
    return { central: (min + max) / 2, min, max, eFaixa: true };
  }
  const v = aplicarRegra(item, precoEfetivo(item, p, ctx), p, ctx);
  return { central: v, min: v, max: v, eFaixa: false };
}

// ---------- R3 · Totais ----------

const somarFaixas = (fs: Faixa[]): Faixa =>
  fs.reduce(
    (a, f) => ({ central: a.central + f.central, min: a.min + f.min, max: a.max + f.max, eFaixa: a.eFaixa || f.eFaixa }),
    { central: 0, min: 0, max: 0, eFaixa: false },
  );

export function totalProposta(itens: ItemCalculo[], p: Premissas, ctx: ContextoPlayer = {}): Faixa {
  return somarFaixas(itens.map((i) => valorItemNaJanela(i, p, ctx)));
}

export function totalPorModulo(itens: ItemCalculo[], p: Premissas, ctx: ContextoPlayer = {}): Record<string, Faixa> {
  const grupos: Record<string, ItemCalculo[]> = {};
  for (const i of itens) (grupos[i.modulo_id ?? "sem_modulo"] ??= []).push(i);
  return Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, totalProposta(v, p, ctx)]));
}

export function totalPorRfp(
  itens: ItemCalculo[],
  rfpDoModulo: Record<string, string>,
  p: Premissas,
  ctx: ContextoPlayer = {},
): Record<string, Faixa> {
  const grupos: Record<string, ItemCalculo[]> = {};
  for (const i of itens) (grupos[(i.modulo_id && rfpDoModulo[i.modulo_id]) || "sem_rfp"] ??= []).push(i);
  return Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, totalProposta(v, p, ctx)]));
}

// ---------- R2 · Compromisso total do contrato ----------

/** Retorna o compromisso do contrato quando ele é maior que a janela; senão null. */
export function compromissoContrato(
  itens: ItemCalculo[],
  contratoMeses: number | null | undefined,
  p: Premissas,
  ctx: ContextoPlayer = {},
): Faixa | null {
  if (!contratoMeses || contratoMeses <= p.janela_meses) return null;
  return totalProposta(itens, { ...p, janela_meses: contratoMeses, meses_com_verba: contratoMeses }, { ...ctx, contratoInteiro: true });
}

// ---------- R4 · Custo unitário normalizado ----------

export interface EntregaCalculo {
  categoria: Categoria;
  quantidade_mes: number;
  e_teto: boolean;
}

export interface CustoUnitario {
  custoMensal: number;
  volumeEntregue: number;
  volumeBase: number;
  /** Peças-base equivalentes: entregas limitadas ao volume-base de cada categoria. */
  pecasEquivalentes: number;
  custoPorPeca: number | null;
  porCategoria: { categoria: Categoria; entregue: number; base: number; teto: boolean }[];
  /** true se alguma entrega declarada é "até" (teto). */
  rotuloTeto: boolean;
}

/** Custo mensal recorrente (preço efetivo × multiplicador) dos itens informados. */
export function custoRecorrenteMensal(itens: ItemCalculo[], p: Premissas, ctx: ContextoPlayer = {}): number {
  return itens
    .filter((i) => i.tipo_preco === "recorrente")
    .reduce((s, i) => s + precoEfetivo(i, p, ctx) * (i.multiplicador ?? 1), 0);
}

export function custoUnitarioNormalizado(
  custoMensal: number,
  entregas: EntregaCalculo[],
  p: Premissas,
): CustoUnitario {
  const cats = Object.keys(p.volume_base_mensal) as Categoria[];
  const porCategoria = cats.map((c) => {
    const es = entregas.filter((e) => e.categoria === c);
    return {
      categoria: c,
      entregue: es.reduce((s, e) => s + e.quantidade_mes, 0),
      base: p.volume_base_mensal[c],
      teto: es.some((e) => e.e_teto),
    };
  });
  const pecasEquivalentes = porCategoria.reduce((s, c) => s + Math.min(c.entregue, c.base), 0);
  return {
    custoMensal,
    volumeEntregue: porCategoria.reduce((s, c) => s + c.entregue, 0),
    volumeBase: porCategoria.reduce((s, c) => s + c.base, 0),
    pecasEquivalentes,
    custoPorPeca: pecasEquivalentes > 0 ? custoMensal / pecasEquivalentes : null,
    porCategoria,
    rotuloTeto: porCategoria.some((c) => c.teto),
  };
}

// ---------- R5 · Cobertura ----------

export interface RequisitoCalculo {
  id: string;
  peso: number;
  criticidade: "essencial" | "desejavel";
}

export interface CoberturaCalculo {
  requisito_id: string;
  nivel: number | null;
  evidencia: "declarado" | "comprovado" | "nao_informado";
  custo_estimado_para_cobrir?: number | null;
}

export interface FaixaCobertura {
  conservadora: number;
  /** null quando nenhum requisito foi informado. */
  otimista: number | null;
}

export function coberturaModulo(
  requisitos: RequisitoCalculo[],
  coberturas: CoberturaCalculo[],
  p: Premissas,
): FaixaCobertura {
  const mapa = new Map(coberturas.map((c) => [c.requisito_id, c]));
  let num = 0;
  let denCons = 0;
  let denOt = 0;
  for (const r of requisitos) {
    const c = mapa.get(r.id);
    denCons += r.peso;
    if (!c || c.nivel == null) continue;
    const fator = c.evidencia === "comprovado" ? 1 : p.fator_evidencia_declarado;
    num += r.peso * c.nivel * fator;
    denOt += r.peso;
  }
  return {
    conservadora: denCons > 0 ? num / denCons : 0,
    otimista: denOt > 0 ? num / denOt : null,
  };
}

export function coberturaRfp(modulos: { peso_no_rfp: number; cobertura: FaixaCobertura }[]): FaixaCobertura {
  const pesoTotal = modulos.reduce((s, m) => s + m.peso_no_rfp, 0);
  const cons = pesoTotal > 0 ? modulos.reduce((s, m) => s + m.peso_no_rfp * m.cobertura.conservadora, 0) / pesoTotal : 0;
  const comOt = modulos.filter((m) => m.cobertura.otimista != null);
  const pesoOt = comOt.reduce((s, m) => s + m.peso_no_rfp, 0);
  const ot = pesoOt > 0 ? comOt.reduce((s, m) => s + m.peso_no_rfp * (m.cobertura.otimista as number), 0) / pesoOt : null;
  return { conservadora: cons, otimista: ot };
}

// ---------- R6 · Essenciais não cobertos ----------

export function essenciaisNaoCobertos<R extends RequisitoCalculo>(
  requisitos: R[],
  coberturas: CoberturaCalculo[],
): { requisito: R; cobertura: CoberturaCalculo | null }[] {
  const mapa = new Map(coberturas.map((c) => [c.requisito_id, c]));
  return requisitos
    .filter((r) => r.criticidade === "essencial")
    .map((r) => ({ requisito: r, cobertura: mapa.get(r.id) ?? null }))
    .filter(({ cobertura }) => !cobertura || cobertura.nivel == null || cobertura.nivel === 0);
}

// ---------- R7 · Custo ajustado ao escopo ----------

export function custoAjustado(
  totalJanela: number,
  bloqueios: { cobertura: CoberturaCalculo | null }[],
): { precoProposta: number; acrescimo: number; ajustado: number; semEstimativa: number } {
  let acrescimo = 0;
  let semEstimativa = 0;
  for (const b of bloqueios) {
    const v = b.cobertura?.custo_estimado_para_cobrir;
    if (v == null) semEstimativa++;
    else acrescimo += v;
  }
  return { precoProposta: totalJanela, acrescimo, ajustado: totalJanela + acrescimo, semEstimativa };
}

// ---------- R8 · Eficiência ----------

/** Pontos de cobertura conservadora (0–100) por R$ 100 mil. */
export function eficiencia(coberturaConservadora: number, custo: number): number | null {
  if (!(custo > 0)) return null;
  return (coberturaConservadora * 100) / (custo / 100000);
}
