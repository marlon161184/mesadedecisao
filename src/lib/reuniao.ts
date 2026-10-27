/** Regras do acesso por link de reunião (somente leitura). Puras e testadas. */

export const VALIDADE_PADRAO_H = 4;
export const VALIDADE_MAX_H = 12;
export const LIMITE_TENTATIVAS = 10;
export const JANELA_TENTATIVAS_MS = 60_000;
export const INATIVIDADE_REUNIAO_MS = 60 * 60 * 1000;
export const REVALIDAR_MS = 60_000;
/** Resposta única para token inválido, expirado, encerrado ou excesso de tentativas. */
export const RESPOSTA_RECUSA = { ok: false as const, mensagem: "Reunião encerrada" };

export function validadeHoras(h: unknown): number {
  const n = Math.round(Number(h));
  if (!Number.isFinite(n) || n < 1) return VALIDADE_PADRAO_H;
  return Math.min(VALIDADE_MAX_H, n);
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Token aleatório de 32 bytes (43 caracteres base64url). */
export function gerarToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return base64url(b);
}

export async function hashToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function tokenComFormato(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(t);
}

export type EstadoReuniao = { expira_em: string; encerrada_em: string | null };
export function reuniaoValida(r: EstadoReuniao | null | undefined, agora = Date.now()): boolean {
  return !!r && r.encerrada_em == null && new Date(r.expira_em).getTime() > agora;
}

/** Recusa quando já houve LIMITE_TENTATIVAS ou mais na janela de 1 minuto. */
export function excedeuLimite(tentativasNaJanela: number): boolean {
  return tentativasNaJanela >= LIMITE_TENTATIVAS;
}

export function horaFim(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** Lê o token do fragmento (#t=) ou da busca (?t=) do link de entrada. */
export function tokenDoEndereco(hash: string, search: string): string | null {
  const h = new URLSearchParams(hash.replace(/^#/, "")).get("t");
  const s = new URLSearchParams(search.replace(/^\?/, "")).get("t");
  const t = h ?? s;
  return tokenComFormato(t) ? t : null;
}
