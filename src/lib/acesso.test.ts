import { describe, expect, it } from "vitest";
import { bloqueado, normalizarEmail, podeEntrar, senhaValida, statusAcesso } from "./acesso";

const agora = Date.parse("2026-10-28T12:00:00Z");
const dias = (n: number) => new Date(agora - n * 86_400_000).toISOString();

describe("acesso individual", () => {
  it("normaliza e-mails em minúsculas", () => {
    expect(normalizarEmail("  Dilson.Athia@HyndraParticipacoes.com.br ")).toBe("dilson.athia@hyndraparticipacoes.com.br");
  });
  it("e-mail fora da lista e sem papel não entra", () => {
    expect(podeEntrar(null, false)).toBe(false);
  });
  it("e-mail da lista entra; revogado não", () => {
    expect(podeEntrar({ revogado_em: null }, false)).toBe(true);
    expect(podeEntrar({ revogado_em: dias(0) }, true)).toBe(false);
  });
  it("status: pendente, convidado, expirado após 7 dias, ativo, revogado", () => {
    expect(statusAcesso({ convidado_em: null, revogado_em: null }, null, agora)).toBe("pendente");
    expect(statusAcesso({ convidado_em: dias(6), revogado_em: null }, { confirmada: false }, agora)).toBe("convidado");
    expect(statusAcesso({ convidado_em: dias(8), revogado_em: null }, { confirmada: false }, agora)).toBe("expirado");
    expect(statusAcesso({ convidado_em: dias(8), revogado_em: null }, { confirmada: true }, agora)).toBe("ativo");
    expect(statusAcesso({ convidado_em: dias(1), revogado_em: dias(0) }, { confirmada: true }, agora)).toBe("revogado");
  });
  it("bloqueia após 5 falhas seguidas em 15 minutos", () => {
    const f = (min: number, sucesso = false) => ({ sucesso, quando: new Date(agora - min * 60_000).toISOString() });
    expect(bloqueado([f(1), f(2), f(3), f(4)], agora)).toBe(false);
    expect(bloqueado([f(1), f(2), f(3), f(4), f(5)], agora)).toBe(true);
    expect(bloqueado([f(1), f(2), f(3), f(4), f(5, true), f(6)], agora)).toBe(false);
    expect(bloqueado([f(20), f(21), f(22), f(23), f(24)], agora)).toBe(false);
  });
  it("senha mínima de 12 caracteres", () => {
    expect(senhaValida("12345678901")).toBe(false);
    expect(senhaValida("123456789012")).toBe(true);
  });
});
