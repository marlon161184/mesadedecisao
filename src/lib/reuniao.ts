/** Regras do acesso por link de reunião (somente leitura). Puras e testadas. */
import { z } from "zod";

export const VALIDADE_PADRAO_H = 4;
export const VALIDADE_MAX_H = 96;
export const LIMITE_TENTATIVAS = 10;
export const JANELA_TENTATIVAS_MS = 60_000;
export const INATIVIDADE_REUNIAO_MS = 60 * 60 * 1000;
export const REVALIDAR_MS = 60_000;
/** Resposta única para token inválido, expirado, encerrado ou excesso de tentativas. */
export const RESPOSTA_RECUSA = { ok: false as const, mensagem: "Reunião encerrada" };

export function validadeHoras(h: unknown): number {
  if (h === undefined) return VALIDADE_PADRAO_H;
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0 || n > VALIDADE_MAX_H) {
    throw new Error("O encerramento deve ser no futuro, até 96 horas a partir da criação.");
  }
  return n;
}

export function validarEncerramento(iso: string, agora = Date.now()): number {
  return validadeHoras((Date.parse(iso) - agora) / 3_600_000);
}

/** O mesmo contrato é validado no formulário e na entrada da função de servidor. */
export function criarReuniaoSchema(agora = Date.now()) {
  return z.object({
    nome: z.string().trim().min(2).max(120),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expira_em: z.string().datetime(),
  }).superRefine((d, ctx) => {
    try { validarEncerramento(d.expira_em, agora); }
    catch { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expira_em"], message: "O encerramento deve ser no futuro, até 96 horas a partir da criação." }); }
  });
}

/** Valor de datetime-local sempre em Brasília, independentemente do fuso do aparelho. */
export function dataHoraBrasilia(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((v) => v.type === tipo)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

export function encerramentoBrasilia(valor: string): string {
  // America/Sao_Paulo adota UTC−03, sem horário de verão desde 2019.
  const d = new Date(`${valor}:00-03:00`);
  if (!Number.isFinite(d.getTime()) || dataHoraBrasilia(d.toISOString()) !== valor) {
    throw new Error("Informe uma data e hora de encerramento válidas.");
  }
  return d.toISOString();
}

export function atalhoEncerramento(horas: number, agora = Date.now()): string {
  return dataHoraBrasilia(new Date(agora + validadeHoras(horas) * 3_600_000).toISOString());
}

export function dataFim(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function rotuloEncerramento(iso: string, agora = Date.now()): string {
  return Date.parse(iso) - agora > 24 * 3_600_000
    ? `encerra em ${dataFim(iso)} às ${horaFim(iso)}`
    : `encerra às ${horaFim(iso)}`;
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

export type ReuniaoToken = { id: string; nome: string; expira_em: string; encerrada_em: string | null };
/**
 * Decide a entrada pelo token: devolve a reunião ou um motivo interno (só para o log).
 * O navegador recebe sempre RESPOSTA_RECUSA, qualquer que seja o motivo.
 */
export async function decidirEntrada(
  token: unknown,
  tentativasNaJanela: number,
  buscarPorHash: (hash: string) => Promise<ReuniaoToken | null>,
  agora = Date.now(),
): Promise<{ r: ReuniaoToken; motivo: "" } | { r: null; motivo: "limite" | "invalido" | "encerrada" | "expirada" }> {
  if (excedeuLimite(tentativasNaJanela)) return { r: null, motivo: "limite" };
  if (!tokenComFormato(token)) return { r: null, motivo: "invalido" };
  const r = await buscarPorHash(await hashToken(token));
  if (!r) return { r: null, motivo: "invalido" };
  if (!reuniaoValida(r, agora)) return { r: null, motivo: r.encerrada_em ? "encerrada" : "expirada" };
  return { r, motivo: "" };
}
