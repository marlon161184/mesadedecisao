import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...p }: { children?: React.ReactNode }) => <a {...(p as object)}>{children}</a>,
}));

import { Alternador, Comparativo, Relatorio, BlocoFinal } from "@/components/conteudo/Pareceres";
import { CorpoRfp } from "@/components/conteudo/DocumentoRfp";
import { definirModo, fornecedores, rfps, rfpEmTexto, useModoParecer } from "@/lib/conteudo";

describe("conteúdo estático", () => {
  it("os JSON em src/data são idênticos aos enviados", () => {
    for (const n of ["pareceres", "rfp1", "rfp2", "rfp3"]) {
      const orig = `/mnt/user-uploads/${n}.json`;
      let a: string;
      try { a = readFileSync(orig, "utf8"); } catch { continue; }
      expect(readFileSync(`src/data/${n}.json`, "utf8")).toBe(a);
    }
  });
});

describe("Pareceres", () => {
  it("os 4 pareceres renderizam, em ordem de ranking", () => {
    render(<Comparativo />);
    expect(fornecedores).toHaveLength(4);
    for (const f of fornecedores) {
      expect(screen.getByText(f.nome)).toBeTruthy();
      render(<Relatorio f={f} modo="objetivo" />);
    }
    expect(fornecedores.map((f) => f.ranking)).toEqual([1, 2, 3, 4]);
  });

  it("o botão alterna entre parecer objetivo e conclusão pragmática", () => {
    act(() => definirModo("objetivo"));
    const f = fornecedores[0];
    function Tela() { const [m] = useModoParecer(); return <><Alternador /><BlocoFinal f={f} modo={m} /></>; }
    render(<Tela />);
    expect(screen.getByText(f.objetivo.resumo)).toBeTruthy();
    expect(screen.queryByText(f.pragmatica.recomendacao)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Conclusão pragmática" }));
    expect(screen.getByText(f.pragmatica.recomendacao)).toBeTruthy();
    expect(screen.getByText("Condições para avançar")).toBeTruthy();
    expect(screen.queryByText(f.objetivo.resumo)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Parecer objetivo" }));
    expect(screen.getByText(f.objetivo.resumo)).toBeTruthy();
  });
});

describe("RFPs", () => {
  for (const r of rfps) {
    it(`RFP ${r.numero} renderiza todas as seções`, () => {
      const { container } = render(<CorpoRfp r={r} />);
      expect(container.querySelectorAll("section")).toHaveLength(r.secoes.length);
      for (const s of r.secoes) expect(screen.getByRole("heading", { name: s.titulo })).toBeTruthy();
      expect(rfpEmTexto(r)).toContain(r.resumo);
    });
  }
});
