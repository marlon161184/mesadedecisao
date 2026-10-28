/** Regras puras do acesso individual (lista autorizada, convites, bloqueio). Testadas em acesso.test.ts. */

export const SENHA_MINIMA = 12;
export const CONVITE_VALIDADE_DIAS = 7;
export const FALHAS_MAX = 5;
export const JANELA_FALHAS_MIN = 15;

export type StatusAcesso = "pendente" | "convidado" | "ativo" | "expirado" | "revogado";

export const NOME_STATUS: Record<StatusAcesso, string> = {
  pendente: "Pendente",
  convidado: "Convidado",
  ativo: "Ativo",
  expirado: "Expirado",
  revogado: "Revogado",
};

export function normalizarEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function statusAcesso(
  a: { convidado_em: string | null; revogado_em: string | null },
  conta: { confirmada: boolean } | null,
  agora = Date.now(),
): StatusAcesso {
  if (a.revogado_em) return "revogado";
  if (conta?.confirmada) return "ativo";
  if (!a.convidado_em) return "pendente";
  const limite = new Date(a.convidado_em).getTime() + CONVITE_VALIDADE_DIAS * 86_400_000;
  return agora > limite ? "expirado" : "convidado";
}

/** Bloqueia após FALHAS_MAX falhas seguidas na janela (um acerto zera a contagem). */
export function bloqueado(tentativas: { sucesso: boolean; quando: string }[], agora = Date.now()): boolean {
  const desde = agora - JANELA_FALHAS_MIN * 60_000;
  const recentes = tentativas
    .filter((t) => new Date(t.quando).getTime() >= desde)
    .sort((x, y) => new Date(y.quando).getTime() - new Date(x.quando).getTime());
  let falhas = 0;
  for (const t of recentes) {
    if (t.sucesso) break;
    falhas++;
  }
  return falhas >= FALHAS_MAX;
}

/**
 * Quem pode entrar: e-mail da lista autorizada não revogado, ou conta já existente com papel
 * (Admin e sócios cadastrados antes da lista). Fora disso, recusa.
 */
export function podeEntrar(
  lista: { revogado_em: string | null } | null,
  temPapel: boolean,
): boolean {
  if (lista) return !lista.revogado_em;
  return temPapel;
}

export function senhaValida(s: string): boolean {
  return s.length >= SENHA_MINIMA && s.length <= 72;
}
