import { describe, expect, it } from "vitest";
import { base } from "@/test/fixtura";
import { premissasEfetivas } from "./equalizacao";
import { analisarComposicao, enumerarComposicoes, cenariosNomeados, type Composicao, type Opcao } from "./composicao";

const p = premissasEfetivas(base, {});
const prop = (pl: string): Opcao => ({ tipo: "player", propostaId: `p-${pl}` });
const cotar: Opcao = { tipo: "a_cotar" };
const comp = (e: Record<string, Opcao>): Composicao => ({ escolhas: e, contarApenas: {}, incluirFase2: false, incluirNaoValidadas: true });
const opts = { pontosPropostas: new Map() };

const A = comp({ C3: prop("Rebu"), C4: prop("Rebu"), P1: prop("Folhetim"), P4: prop("Folhetim"), P2: prop("F&MD"), P3: cotar });
const B = comp({ C3: prop("Rebu"), C4: prop("Rebu"), P1: prop("XCV/WiVO"), P2: prop("XCV/WiVO"), P3: prop("XCV/WiVO"), P4: prop("XCV/WiVO") });
const C = comp({ C3: prop("Rebu"), C4: prop("XCV/WiVO"), P1: prop("XCV/WiVO"), P2: prop("XCV/WiVO"), P3: prop("XCV/WiVO"), P4: prop("XCV/WiVO") });
const D = comp({ C3: prop("Rebu"), C4: prop("Rebu"), P1: prop("F&MD"), P2: prop("F&MD"), P4: prop("F&MD"), P3: cotar });

describe("cenários iniciais: totais na janela de 6 meses", () => {
  it("A = 950.300,00", () => expect(analisarComposicao(base, A, p, opts).total.central).toBeCloseTo(950300, 2));
  it("B = 731.209,17", () => expect(analisarComposicao(base, B, p, opts).total.central).toBeCloseTo(731209.17, 2));
  it("C = 624.275,84", () => expect(analisarComposicao(base, C, p, opts).total.central).toBeCloseTo(624275.84, 2));
  it("D = 753.650,02", () => expect(analisarComposicao(base, D, p, opts).total.central).toBeCloseTo(753650.02, 2));
});

describe("pontos da composição", () => {
  it("B não tem sobreposição", () => {
    const r = analisarComposicao(base, B, p, opts);
    expect(r.sobreposicoes).toHaveLength(0);
    expect(r.pontos.some((x) => x.codigo === "C-01")).toBe(false);
  });
  it("C acusa concentração e risco de dependência na XCV", () => {
    const r = analisarComposicao(base, C, p, opts);
    const c03 = r.pontos.find((x) => x.codigo === "C-03");
    expect(c03?.severidade).toBe("alto");
    expect(c03?.texto).toContain("XCV/WiVO");
    expect(r.concentracao).toBeGreaterThan(0.6);
  });
  it("A e D acusam P3 sem cobertura (C-02)", () => {
    for (const x of [A, D]) expect(analisarComposicao(base, x, p, opts).pontos.some((pt) => pt.codigo === "C-02" && pt.texto.startsWith("P3"))).toBe(true);
  });
  it("sobreposição entre Rebu e XCV em C4 e P1 soma os dois até escolher; ao escolher, exclui o outro", () => {
    const base2 = { ...base, itens: [...base.itens, { ...base.itens[0]!, id: "dup", proposta_id: "p-XCV/WiVO", modulo_id: "P1", entrega_chave: "ativos_foto_video", valor_lista: 1000, tipo_preco: "pontual", unidade: "projeto" }].map((i) => i.id === base.itens[0]!.id ? { ...i, entrega_chave: "ativos_foto_video" } : i) };
    const sem = analisarComposicao(base2, B, p, opts);
    expect(sem.pontos.some((x) => x.codigo === "C-01" && x.severidade === "critico")).toBe(true);
    expect(sem.total.min).toBeLessThan(sem.total.central);
    const com = analisarComposicao(base2, { ...B, contarApenas: { ativos_foto_video: "Rebu" } }, p, opts);
    expect(com.total.central).toBeCloseTo(sem.total.central - 1000, 2);
  });
  it("C-05 mostra compromisso adicional do contrato de 12 meses da Rebu", () => {
    const r = analisarComposicao(base, B, p, opts);
    expect(r.compromisso?.adicional).toBeCloseTo(100000, 2);
  });
  it("cronograma: pontual sem cronograma cai 100% no mês 1; recorrente em parcelas mensais", () => {
    const r = analisarComposicao(base, comp({ P1: prop("Folhetim") }), p, opts);
    expect(r.desembolso).toHaveLength(6);
    expect(r.desembolso[0]!.total).toBeCloseTo(55000, 2);
  });
});

describe("mesa de cenários", () => {
  it("enumera todas as combinações e nomeia cinco cenários", () => {
    const cands = enumerarComposicoes(base, p, { incluirNaoValidadas: true });
    // C3 (Rebu|cotar) × C4 (Rebu|XCV|cotar) × P1 (3+1) × P2 (3+1) × P3 (XCV|cotar) × P4 (3+1)
    expect(cands).toHaveLength(2 * 3 * 4 * 4 * 2 * 4);
    expect(cenariosNomeados(cands).nomeados).toHaveLength(5);
  });
});
