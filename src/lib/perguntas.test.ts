import { describe, expect, it } from "vitest";
import { agruparPorSecao, pendentesPerguntas, perguntasDoPlayer, textoParaEmail } from "./perguntas";

const qs = [
  { id: "g", rfp_id: "r2", texto: "Geral?", player_id: null },
  { id: "a2", rfp_id: "r2", texto: "Segunda", player_id: "A", secao: "Preço", ordem: 2, prazo_resposta: "2026-11-05T23:00:00Z" },
  { id: "a1", rfp_id: "r2", texto: "Primeira", player_id: "A", secao: "Preço", ordem: 1, prazo_resposta: "2026-11-05T23:00:00Z" },
  { id: "a3", rfp_id: "r2", texto: "Terceira", player_id: "A", secao: "Contrato", ordem: 3 },
  { id: "b1", rfp_id: "r2", texto: "Só B", player_id: "B", secao: "Preço", ordem: 1 },
];
const props = [{ id: "pa", player_id: "A" }, { id: "pb", player_id: "B" }];

describe("perguntas por player", () => {
  it("pergunta de um player só fica pendente para as propostas dele", () => {
    const p = pendentesPerguntas(qs, [], props).map(({ q, p }) => `${q.id}:${p.id}`);
    expect(p).toContain("b1:pb");
    expect(p).not.toContain("b1:pa");
    expect(p).not.toContain("a1:pb");
  });
  it("pergunta geral continua pendente para todos", () => {
    const p = pendentesPerguntas(qs, [], props).map(({ q, p }) => `${q.id}:${p.id}`);
    expect(p).toEqual(expect.arrayContaining(["g:pa", "g:pb"]));
  });
  it("resposta ou 'sem resposta' tira a pendência", () => {
    const p = pendentesPerguntas(qs, [{ pergunta_id: "b1", proposta_id: "pb", resposta: "ok" }, { pergunta_id: "g", proposta_id: "pa", sem_resposta: true }], props);
    expect(p.some(({ q, p }) => q.id === "b1" && p.id === "pb")).toBe(false);
    expect(p.some(({ q, p }) => q.id === "g" && p.id === "pa")).toBe(false);
  });
  it("lista do player inclui gerais e as dele, agrupadas e em ordem", () => {
    const g = agruparPorSecao(perguntasDoPlayer(qs, "r2", "A"));
    expect(g.map((x) => x.secao)).toEqual(["Geral", "Preço", "Contrato"]);
    expect(g[1].itens.map((q) => q.id)).toEqual(["a1", "a2"]);
  });
  it("texto para e-mail numera em sequência e mostra prazo em Brasília", () => {
    const t = textoParaEmail("A", perguntasDoPlayer(qs, "r2", "A"));
    expect(t).toContain("Prazo de resposta: 05/11/2026 às 20h");
    expect(t).toContain("1. Geral?");
    expect(t).toContain("Preço\n2. Primeira\n3. Segunda");
    expect(t).toContain("Contrato\n4. Terceira");
  });
});
