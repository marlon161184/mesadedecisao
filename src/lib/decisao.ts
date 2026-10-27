/** Regras da trilha de decisão: médias, divergências, sensibilidade e regra de votação. */

export interface CriterioD { id: string; nome: string; peso: number }
export interface NotaD { criterio_id: string; proposta_id: string; socio_id: string; nota: number; justificativa?: string | null }
export type Decisao = "aprovar" | "aprovar_com_ressalvas" | "rejeitar";
export type Regra = "unanimidade" | "maioria" | "sem_rejeicao";

export const LIMIAR_DIVERGENCIA = 1.2;
export const VARIACAO_MAX = 10;

export const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Desvio-padrão populacional. */
export function desvioPadrao(xs: number[]) {
  const m = media(xs);
  if (m == null) return 0;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/** Média das notas dos sócios por critério e proposta. */
export function mediasPorCriterio(notas: NotaD[]) {
  const g = new Map<string, number[]>();
  for (const n of notas) {
    const k = `${n.criterio_id}|${n.proposta_id}`;
    g.set(k, [...(g.get(k) ?? []), n.nota]);
  }
  const out: Record<string, Record<string, number>> = {};
  for (const [k, xs] of g) {
    const [c, p] = k.split("|") as [string, string];
    (out[p] ??= {})[c] = media(xs)!;
  }
  return out; // proposta -> criterio -> média
}

/** Nota ponderada pelos pesos (critério sem nota fica fora do denominador). */
export function notaPonderada(medias: Record<string, number> | undefined, pesos: Record<string, number>) {
  if (!medias) return null;
  let s = 0, w = 0;
  for (const [c, peso] of Object.entries(pesos)) {
    const m = medias[c];
    if (m == null) continue;
    s += m * peso;
    w += peso;
  }
  return w > 0 ? s / w : null;
}

export function ranking(medias: Record<string, Record<string, number>>, pesos: Record<string, number>) {
  return Object.keys(medias)
    .map((p) => ({ proposta: p, nota: notaPonderada(medias[p], pesos) ?? 0 }))
    .sort((a, b) => b.nota - a.nota || a.proposta.localeCompare(b.proposta));
}

export interface Divergencia { criterio_id: string; proposta_id: string; desvio: number; notas: NotaD[] }
export function divergencias(notas: NotaD[], limiar = LIMIAR_DIVERGENCIA): Divergencia[] {
  const g = new Map<string, NotaD[]>();
  for (const n of notas) g.set(`${n.criterio_id}|${n.proposta_id}`, [...(g.get(`${n.criterio_id}|${n.proposta_id}`) ?? []), n]);
  const out: Divergencia[] = [];
  for (const [k, ns] of g) {
    const d = desvioPadrao(ns.map((n) => n.nota));
    if (ns.length > 1 && d >= limiar - 1e-9) {
      const [criterio_id, proposta_id] = k.split("|") as [string, string];
      out.push({ criterio_id, proposta_id, desvio: d, notas: ns });
    }
  }
  return out.sort((a, b) => b.desvio - a.desvio);
}

export const pesosDe = (cs: CriterioD[]) => Object.fromEntries(cs.map((c) => [c.id, c.peso]));

/** Move `d` pontos de `de` para `para`, respeitando os limites ±VARIACAO_MAX do peso original e >= 0. Soma se mantém. */
export function transferir(base: Record<string, number>, para: string, de: string, d: number) {
  const p = { ...base };
  p[para] = (p[para] ?? 0) + d;
  p[de] = (p[de] ?? 0) - d;
  return p[de]! < 0 ? null : p;
}

export interface Sensibilidade {
  lider: string | null;
  testadas: number;
  alteram: number;
  menorVirada: { para: string; de: string; pontos: number; novoLider: string } | null;
  tornado: { criterio_id: string; margemMin: number; margemMax: number; amplitude: number }[];
}

/** Varia pesos em passos de 1 ponto, até ±10, de um critério para outro (soma 100 mantida). */
export function sensibilidade(medias: Record<string, Record<string, number>>, criterios: CriterioD[], max = VARIACAO_MAX): Sensibilidade {
  const pesos = pesosDe(criterios);
  const r0 = ranking(medias, pesos);
  const lider = r0[0]?.proposta ?? null;
  const ordem0 = r0.map((x) => x.proposta).join(",");
  let testadas = 0, alteram = 0;
  let menor: Sensibilidade["menorVirada"] = null;
  const margem = (pp: Record<string, number>) => {
    const r = ranking(medias, pp);
    if (!lider || r.length < 2) return 0;
    const nl = r.find((x) => x.proposta === lider)!.nota;
    const outro = r.filter((x) => x.proposta !== lider)[0]!.nota;
    return nl - outro;
  };
  for (const a of criterios) for (const b of criterios) {
    if (a.id === b.id) continue;
    for (let d = 1; d <= max; d++) {
      const p = transferir(pesos, a.id, b.id, d);
      if (!p) break;
      testadas++;
      const r = ranking(medias, p);
      if (r.map((x) => x.proposta).join(",") !== ordem0 && r.some((x, i) => i > 0 && x.nota < r[i - 1]!.nota - 1e-9)) alteram++;
      const nl = r.find((x) => x.proposta === lider)?.nota ?? 0;
      if (r[0] && r[0].proposta !== lider && r[0].nota > nl + 1e-9 && (!menor || d < menor.pontos)) menor = { para: a.id, de: b.id, pontos: d, novoLider: r[0].proposta };
    }
  }
  const tornado = criterios.map((c) => {
    const outros = criterios.filter((o) => o.id !== c.id);
    const somaOutros = outros.reduce((s, o) => s + o.peso, 0);
    const ajuste = (delta: number) => {
      const p: Record<string, number> = { [c.id]: Math.max(0, c.peso + delta) };
      const real = p[c.id]! - c.peso;
      for (const o of outros) p[o.id] = somaOutros > 0 ? o.peso - (real * o.peso) / somaOutros : 0;
      return margem(p);
    };
    const m1 = ajuste(-max), m2 = ajuste(max);
    return { criterio_id: c.id, margemMin: Math.min(m1, m2), margemMax: Math.max(m1, m2), amplitude: Math.abs(m2 - m1) };
  }).sort((x, y) => y.amplitude - x.amplitude);
  return { lider, testadas, alteram, menorVirada: menor, tornado };
}

export const ehCriterioCusto = (nome: string) => /custo/i.test(nome);

/** Pesos sem o critério de custo, renormalizados para 100. */
export function pesosSemCusto(criterios: CriterioD[]) {
  const sem = criterios.filter((c) => !ehCriterioCusto(c.nome));
  const s = sem.reduce((a, c) => a + c.peso, 0);
  return Object.fromEntries(sem.map((c) => [c.id, s ? (c.peso * 100) / s : 0]));
}

export interface ResultadoVotacao { completa: boolean; aprovado: boolean; rejeicoes: number; ressalvas: number; aprovacoes: number; faltam: number; condicoes: string[]; motivosRejeicao: string[] }

export function avaliarVotacao(regra: Regra, votos: { decisao: Decisao; justificativa: string | null }[], totalSocios: number): ResultadoVotacao {
  const rej = votos.filter((v) => v.decisao === "rejeitar");
  const ress = votos.filter((v) => v.decisao === "aprovar_com_ressalvas");
  const apr = votos.filter((v) => v.decisao === "aprovar");
  const faltam = Math.max(0, totalSocios - votos.length);
  const favor = apr.length + ress.length;
  const completa = faltam === 0;
  const aprovado =
    regra === "maioria" ? favor > totalSocios / 2
    : regra === "sem_rejeicao" ? completa && rej.length === 0 && favor > 0
    : completa && favor === totalSocios && totalSocios > 0;
  return {
    completa, aprovado, rejeicoes: rej.length, ressalvas: ress.length, aprovacoes: apr.length, faltam,
    condicoes: ress.map((v) => v.justificativa ?? "").filter(Boolean),
    motivosRejeicao: rej.map((v) => v.justificativa ?? "").filter(Boolean),
  };
}

export const NOME_REGRA: Record<Regra, string> = {
  unanimidade: "Todos os sócios aprovam (ressalvas viram condições)",
  maioria: "Maioria simples dos sócios aprova",
  sem_rejeicao: "Nenhuma rejeição entre os votos",
};

/** Justificativa obrigatória para notas 1, 2 e 5. */
export const exigeJustificativa = (nota: number) => nota <= 2 || nota === 5;

/** Pré-mortem: até 5 linhas. */
export const premorteValido = (t: string) => t.trim().length > 0 && t.split("\n").length <= 5 && t.length <= 900;

/** JSON canônico (chaves ordenadas) para o hash do snapshot. */
export function jsonCanonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${jsonCanonico((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

export async function hashSnapshot(v: unknown) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jsonCanonico(v)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type StatusEtapa = "concluida" | "em_andamento" | "bloqueada" | "aguardando";
