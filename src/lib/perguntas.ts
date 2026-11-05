// Regras das perguntas-filtro: gerais (player_id nulo) valem para todas as propostas do RFP;
// específicas (player_id preenchido) só para as propostas daquele player.
type Pergunta = { id: string; rfp_id: string; texto: string; player_id?: string | null; secao?: string | null; ordem?: number | null; prazo_resposta?: string | null };
type Resposta = { pergunta_id: string; proposta_id: string; resposta?: string | null; sem_resposta?: boolean | null };
type PropostaRef = { id: string; player_id: string };

export const SECAO_GERAL = "Geral";

export function perguntaValePara(q: Pergunta, playerId: string): boolean {
  return !q.player_id || q.player_id === playerId;
}

export function perguntasDoPlayer<Q extends Pergunta>(perguntas: Q[], rfpId: string, playerId: string): Q[] {
  return perguntas.filter((q) => q.rfp_id === rfpId && perguntaValePara(q, playerId));
}

export function respondida(respostas: Resposta[], perguntaId: string, propostaId: string): boolean {
  return respostas.some((r) => r.pergunta_id === perguntaId && r.proposta_id === propostaId && (!!(r.resposta ?? "").trim() || !!r.sem_resposta));
}

export function pendentesPerguntas<Q extends Pergunta, P extends PropostaRef>(perguntas: Q[], respostas: Resposta[], propostas: P[]): { q: Q; p: P }[] {
  return perguntas.flatMap((q) => propostas
    .filter((p) => perguntaValePara(q, p.player_id) && !respondida(respostas, q.id, p.id))
    .map((p) => ({ q, p })));
}

/** Agrupa por seção (ordem de primeira aparição após ordenar) e ordena por `ordem`, depois texto. Gerais primeiro. */
export function agruparPorSecao<Q extends Pergunta>(perguntas: Q[]): { secao: string; itens: Q[] }[] {
  const ord = [...perguntas].sort((a, b) =>
    Number(!!a.player_id) - Number(!!b.player_id) || (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || a.texto.localeCompare(b.texto, "pt-BR"));
  const grupos = new Map<string, Q[]>();
  for (const q of ord) {
    const s = q.secao?.trim() || SECAO_GERAL;
    grupos.set(s, [...(grupos.get(s) ?? []), q]);
  }
  return [...grupos].map(([secao, itens]) => ({ secao, itens }));
}

export function formatarPrazo(iso: string): string {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const v = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}h${v("minute") === "00" ? "" : v("minute")}`;
}

/** Texto pronto para e-mail: perguntas numeradas em sequência, agrupadas por seção. */
export function textoParaEmail<Q extends Pergunta>(nomePlayer: string, perguntas: Q[]): string {
  const prazos = perguntas.map((q) => q.prazo_resposta).filter((x): x is string => !!x).sort();
  const linhas: string[] = [`Perguntas para ${nomePlayer}`];
  if (prazos.length) linhas.push(`Prazo de resposta: ${formatarPrazo(prazos[0])} (horário de Brasília)`);
  let n = 0;
  for (const g of agruparPorSecao(perguntas)) {
    linhas.push("", g.secao);
    for (const q of g.itens) linhas.push(`${++n}. ${q.texto}`);
  }
  return linhas.join("\n");
}
