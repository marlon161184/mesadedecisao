import { describe, expect, it } from "vitest";
import { base } from "@/test/fixtura";
import { premissasEfetivas } from "@/lib/equalizacao";
import { analisarComposicao, modulosDaComposicao, opcoesDoModulo, type Composicao, type Opcao } from "@/lib/composicao";
import type { Base } from "@/lib/base";

// Critérios de aceite do Prompt 4 que dependem só de cálculo.
const prop = (pl: string): Opcao => ({ tipo: "player", propostaId: `p-${pl}` });
const comp = (e: Record<string, Opcao>): Composicao => ({ escolhas: e, contarApenas: {}, incluirFase2: false, incluirNaoValidadas: true });
const opts = { pontosPropostas: new Map() };
const B = comp({ C3: prop("Rebu"), C4: prop("Rebu"), P1: prop("XCV/WiVO"), P2: prop("XCV/WiVO"), P3: prop("XCV/WiVO"), P4: prop("XCV/WiVO") });
const D = comp({ C3: prop("Rebu"), C4: prop("Rebu"), P1: prop("F&MD"), P2: prop("F&MD"), P4: prop("F&MD"), P3: { tipo: "a_cotar" } });
const porModulo = (r: ReturnType<typeof analisarComposicao>) => Object.fromEntries(r.modulos.map((m) => [m.modulo.codigo, m.total]));

describe("aceite 2: lista x negociado", () => {
  it("altera só os itens da XCV marcados como lista (P1 dobra) e o negociado pontual", () => {
    const neg = porModulo(analisarComposicao(base, B, premissasEfetivas(base, {}), opts));
    const lis = porModulo(analisarComposicao(base, B, premissasEfetivas(base, { preco: "lista" }), opts));
    expect(lis["C3"]).toBeCloseTo(neg["C3"]!, 2);
    expect(lis["C4"]).toBeCloseTo(neg["C4"]!, 2);
    expect(lis["P1"]).toBeCloseTo(349418.34, 2);
    expect(neg["P1"]).toBeCloseTo(174709.17, 2);
    expect(lis["P4"]).toBeCloseTo(85000, 2);
    expect(neg["P4"]).toBeCloseTo(51000, 2);
  });
});

describe("aceite 3: janela de 12 meses", () => {
  it("na janela de 6 acusa o compromisso da F&MD; na de 12 escala os recorrentes", () => {
    const r6 = analisarComposicao(base, D, premissasEfetivas(base, {}), opts);
    expect(r6.compromisso!.total).toBeGreaterThan(r6.total.central);
    expect(r6.pontos.some((p) => p.codigo === "C-05")).toBe(true);
    const r12 = porModulo(analisarComposicao(base, D, premissasEfetivas(base, { janela: 12 }), opts));
    expect(r12["P1"]).toBeCloseTo(298700.04, 1);
  });
});

describe("aceite 6: player só onde tem item de preço", () => {
  it("cada módulo oferece apenas players com item", () => {
    for (const m of base.modulos) {
      for (const o of opcoesDoModulo(base, m.id)) {
        expect(base.itens.some((i) => i.modulo_id === m.id && i.proposta_id === o.proposta.id)).toBe(true);
      }
    }
    expect(opcoesDoModulo(base, "P3").map((o) => o.player.nome)).toEqual(["XCV/WiVO"]);
    expect(opcoesDoModulo(base, "C3").map((o) => o.player.nome)).toEqual(["Rebu"]);
  });
});

describe("aceite 7: RFP 3 fora da fase 1 por padrão", () => {
  it("módulo da fase 2 não entra na composição padrão nem no total", () => {
    const b3 = { ...base, rfps: [...base.rfps, { ...base.rfps[0]!, id: "r3", numero: 3, fase: 2 }], modulos: [...base.modulos, { ...base.modulos[0]!, id: "V1", codigo: "V1", rfp_id: "r3", essencial: true }] } as Base;
    expect(modulosDaComposicao(b3, false).some(({ m }) => m.id === "V1")).toBe(false);
    expect(modulosDaComposicao(b3, true).some(({ m }) => m.id === "V1")).toBe(true);
    const a = analisarComposicao(b3, D, premissasEfetivas(b3, {}), opts);
    expect(a.total.central).toBeCloseTo(753650.02, 2);
    expect(a.modulos.some((x) => x.modulo.id === "V1")).toBe(false);
  });
});

describe("aceite 8: sem honorários do facilitador", () => {
  it("nenhum item, player ou premissa de consultoria do facilitador", () => {
    const textos = [...base.itens.map((i) => i.descricao), ...base.players.map((p) => p.nome), ...base.premissas.map((p) => p.chave)].join(" ");
    expect(/facilitador|honor[aá]rio/i.test(textos)).toBe(false);
  });
});
