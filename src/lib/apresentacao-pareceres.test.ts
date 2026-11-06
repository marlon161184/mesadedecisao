import { describe, expect, it } from "vitest";
import { linhasPareceresAtuais } from "./apresentacao";

const a = (id: string, nome: string, versao: number, total: number) => ({
  proposta: { id, versao, fonte_arquivo: "x" }, player: { nome }, total: { central: total }, cobertura: { conservadora: 0.5 },
}) as never;

describe("linhasPareceresAtuais", () => {
  it("ordena por agência e mostra versão, sem notas", () => {
    const l = linhasPareceresAtuais([{ proposta_id: "x" }, { proposta_id: "f" }, { proposta_id: "f" }], [{ analises: [a("x", "XCV/WiVO", 3, 100), a("f", "F&MD", 3, 0)] }]);
    expect(l.map((x) => x.nome)).toEqual(["F&MD", "XCV/WiVO"]);
    expect(l[0]!.celulas[1]).toBe("V3");
    expect(l[0]!.celulas[2]).toBe("sem preço");
  });
  it("ignora pareceres sem proposta na base", () => {
    expect(linhasPareceresAtuais([{ proposta_id: "z" }], [{ analises: [] }])).toEqual([]);
  });
});
