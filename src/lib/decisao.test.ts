import { describe, expect, it } from "vitest";
import {
  avaliarVotacao, desvioPadrao, divergencias, exigeJustificativa, hashSnapshot, mediasPorCriterio, pesosSemCusto,
  premorteValido, ranking, sensibilidade, transferir,
} from "./decisao";

const crit = [
  { id: "a", nome: "Arquitetura", peso: 50 },
  { id: "b", nome: "Estratégia", peso: 40 },
  { id: "c", nome: "Custo e modelo de contratação", peso: 10 },
];

describe("divergências", () => {
  it("acusa desvio-padrão maior ou igual a 1,2", () => {
    expect(desvioPadrao([2, 5])).toBeCloseTo(1.5);
    const d = divergencias([
      { criterio_id: "a", proposta_id: "p", socio_id: "s1", nota: 2 },
      { criterio_id: "a", proposta_id: "p", socio_id: "s2", nota: 5 },
      { criterio_id: "b", proposta_id: "p", socio_id: "s1", nota: 3 },
      { criterio_id: "b", proposta_id: "p", socio_id: "s2", nota: 4 },
    ]);
    expect(d.map((x) => x.criterio_id)).toEqual(["a"]);
  });
  it("desvio de 1,0 não é divergência", () => {
    expect(divergencias([
      { criterio_id: "a", proposta_id: "p", socio_id: "s1", nota: 3 },
      { criterio_id: "a", proposta_id: "p", socio_id: "s2", nota: 5 },
    ])).toHaveLength(0);
  });
});

describe("ranking e sensibilidade", () => {
  const medias = mediasPorCriterio([
    { criterio_id: "a", proposta_id: "X", socio_id: "s", nota: 5 },
    { criterio_id: "b", proposta_id: "X", socio_id: "s", nota: 2 },
    { criterio_id: "c", proposta_id: "X", socio_id: "s", nota: 1 },
    { criterio_id: "a", proposta_id: "Y", socio_id: "s", nota: 3 },
    { criterio_id: "b", proposta_id: "Y", socio_id: "s", nota: 5 },
    { criterio_id: "c", proposta_id: "Y", socio_id: "s", nota: 5 },
  ]);
  it("pondera pelos pesos do RFP", () => {
    const r = ranking(medias, { a: 50, b: 40, c: 10 });
    expect(r[0]!.proposta).toBe("Y");
    expect(r[0]!.nota).toBeCloseTo(4);
    expect(r[1]!.nota).toBeCloseTo(3.4);
  });
  it("transferência mantém soma 100", () => {
    const p = transferir({ a: 50, b: 40, c: 10 }, "a", "c", 10)!;
    expect(p['a']! + p['b']! + p['c']!).toBe(100);
    expect(transferir({ a: 50, b: 40, c: 10 }, "a", "c", 11)).toBeNull();
  });
  it("varia até 10 pontos e acha a menor virada", () => {
    const s = sensibilidade(medias, crit);
    expect(s.lider).toBe("Y");
    expect(s.testadas).toBeGreaterThan(0);
    // Y lidera 4,0 x 3,4; com 10 pontos de custo para arquitetura empata, mas não vira
    expect(s.menorVirada).toBeNull();
    expect(s.tornado).toHaveLength(3);
  });
  it("ranking sem custo renormaliza para 100", () => {
    const p = pesosSemCusto(crit);
    expect(p["c"]).toBeUndefined();
    expect(p["a"]! + p["b"]!).toBeCloseTo(100);
  });
});

describe("regras de entrada", () => {
  it("justificativa obrigatória para 1, 2 e 5", () => {
    expect([1, 2, 3, 4, 5].map(exigeJustificativa)).toEqual([true, true, false, false, true]);
  });
  it("pré-mortem tem no máximo 5 linhas", () => {
    expect(premorteValido("a\nb\nc\nd\ne")).toBe(true);
    expect(premorteValido("a\nb\nc\nd\ne\nf")).toBe(false);
  });
});

describe("votação", () => {
  it("padrão: todos aprovam; ressalvas viram condições", () => {
    const r = avaliarVotacao("unanimidade", [
      { decisao: "aprovar", justificativa: "ok" },
      { decisao: "aprovar_com_ressalvas", justificativa: "confirmar desconto por escrito" },
    ], 2);
    expect(r.aprovado).toBe(true);
    expect(r.condicoes).toEqual(["confirmar desconto por escrito"]);
  });
  it("uma rejeição reprova na unanimidade e lista o motivo", () => {
    const r = avaliarVotacao("unanimidade", [
      { decisao: "aprovar", justificativa: "ok" },
      { decisao: "rejeitar", justificativa: "CRM sem portabilidade" },
    ], 2);
    expect(r.aprovado).toBe(false);
    expect(r.motivosRejeicao).toEqual(["CRM sem portabilidade"]);
  });
  it("votação incompleta não aprova", () => {
    expect(avaliarVotacao("unanimidade", [{ decisao: "aprovar", justificativa: "ok" }], 2).aprovado).toBe(false);
  });
});

describe("snapshot", () => {
  it("hash não depende da ordem das chaves", async () => {
    expect(await hashSnapshot({ a: 1, b: [1, 2] })).toBe(await hashSnapshot({ b: [1, 2], a: 1 }));
    expect(await hashSnapshot({ a: 1 })).not.toBe(await hashSnapshot({ a: 2 }));
  });
});
