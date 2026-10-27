import { describe, expect, it } from "vitest";
import {
  RESPOSTA_RECUSA, decidirEntrada, excedeuLimite, gerarToken, hashToken, tokenDoEndereco, validadeHoras, validarEncerramento, criarReuniaoSchema, dataHoraBrasilia, encerramentoBrasilia, atalhoEncerramento, type ReuniaoToken,
} from "./reuniao";

const AGORA = Date.parse("2026-10-30T13:00:00Z");
const reuniao = (extra: Partial<ReuniaoToken> = {}): ReuniaoToken => ({
  id: "r1", nome: "Decisão RFP 2", expira_em: "2026-10-30T17:00:00Z", encerrada_em: null, ...extra,
});

async function cenario(token: string, r: ReuniaoToken | null, tentativas = 0) {
  const valido = gerarToken();
  const hashValido = await hashToken(valido);
  const t = token === "VALIDO" ? valido : token;
  return decidirEntrada(t, tentativas, async (h) => (h === hashValido ? r : null), AGORA);
}

describe("link de reunião", () => {
  it("gera token com pelo menos 32 caracteres e guarda só o hash SHA-256", async () => {
    const t = gerarToken();
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(await hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("validade padrão de 4 h", () => {
    expect(validadeHoras(undefined)).toBe(4);
  });

  it("aceita até 96 h, incluindo durações fracionárias sem arredondar", () => {
    expect(validadeHoras(96)).toBe(96);
    expect(validadeHoras(71.25)).toBe(71.25);
    const expira_em = new Date(AGORA + 96 * 3_600_000).toISOString();
    expect(validarEncerramento(expira_em, AGORA)).toBe(96);
    expect(criarReuniaoSchema(AGORA).safeParse({ nome: "Decisão", data: "2026-10-30", expira_em }).success).toBe(true);
  });

  it("recusa acima de 96 h na duração e no contrato do servidor", () => {
    expect(() => validadeHoras(96 + 1 / 3600)).toThrow();
    const expira_em = new Date(AGORA + 96 * 3_600_000 + 1).toISOString();
    expect(() => validarEncerramento(expira_em, AGORA)).toThrow();
    expect(criarReuniaoSchema(AGORA).safeParse({ nome: "Decisão", data: "2026-10-30", expira_em }).success).toBe(false);
  });

  it("recusa encerramento presente, passado ou inválido", () => {
    for (const expira_em of [new Date(AGORA).toISOString(), new Date(AGORA - 1).toISOString(), "inválido"]) {
      expect(criarReuniaoSchema(AGORA).safeParse({ nome: "Decisão", data: "2026-10-30", expira_em }).success).toBe(false);
    }
  });

  it("30/10/2026 às 19 h em Brasília equivale a 22 h UTC", () => {
    expect(encerramentoBrasilia("2026-10-30T19:00")).toBe("2026-10-30T22:00:00.000Z");
    expect(dataHoraBrasilia("2026-10-30T22:00:00Z")).toBe("2026-10-30T19:00");
    const inicio = Date.parse("2026-10-27T23:15:00Z");
    expect(validarEncerramento(encerramentoBrasilia("2026-10-30T19:00"), inicio)).toBe(70.75);
  });

  it("atalhos somam 4, 12 e 24 h e mostram Brasília", () => {
    for (const h of [4, 12, 24]) {
      expect(Date.parse(encerramentoBrasilia(atalhoEncerramento(h, AGORA))) - AGORA).toBe(h * 3_600_000);
    }
  });

  it("token válido entra", async () => {
    const r = await cenario("VALIDO", reuniao());
    expect(r.r?.id).toBe("r1");
  });

  it("token expirado, encerrado e inválido são recusados (o navegador recebe a mesma resposta)", async () => {
    const exp = await cenario("VALIDO", reuniao({ expira_em: "2026-10-30T12:59:00Z" }));
    const enc = await cenario("VALIDO", reuniao({ encerrada_em: "2026-10-30T12:00:00Z" }));
    const inv = await cenario(gerarToken(), reuniao());
    const lixo = await cenario("curto", reuniao());
    expect([exp.r, enc.r, inv.r, lixo.r]).toEqual([null, null, null, null]);
    expect(RESPOSTA_RECUSA).toEqual({ ok: false, mensagem: "Reunião encerrada" });
  });

  it("limite de 10 tentativas por minuto por IP, mesmo com token válido", async () => {
    expect(excedeuLimite(9)).toBe(false);
    expect(excedeuLimite(10)).toBe(true);
    expect((await cenario("VALIDO", reuniao(), 10)).r).toBeNull();
  });

  it("lê o token do fragmento do link", () => {
    const t = gerarToken();
    expect(tokenDoEndereco(`#t=${t}`, "")).toBe(t);
    expect(tokenDoEndereco("", "")).toBeNull();
  });
});
