import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { base } from "@/test/fixtura";
import { analisarRfp, premissasEfetivas } from "@/lib/equalizacao";
import type { Base } from "@/lib/base";

vi.mock("@/components/mesa/useMesa", () => ({
  useMesa: () => ({}),
  fundoPlayer: () => "",
  padraoPlayer: () => "",
}));
vi.mock("@/components/mesa/partes", () => ({
  AberturaTela: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Conteudo: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { EntregasConteudo } from "@/routes/_authenticated/mesa.entregas";

// Cada proposta recebe uma entrega declarada, para que todas as tabelas sejam montadas.
const comEntregas = {
  ...base,
  entregas: base.propostas.map((p, i) => ({
    id: `e${i}`, proposta_id: p.id, categoria: "posts_instagram", quantidade_mes: 8, e_teto: false, observacao: null,
  })),
} as unknown as Base;
const premissas = premissasEfetivas(comEntregas, {});

describe("Entregas normalizadas com custoUnitario nulo", () => {
  for (const numero of [1, 2, 3]) {
    it(`RFP ${numero} renderiza sem erro`, () => {
      const analises = analisarRfp(comEntregas, numero, { filtros: {}, premissas });
      const rfp = comEntregas.rfps.find((r) => r.numero === numero)!;
      expect(() =>
        render(<EntregasConteudo rfp={rfp} analises={analises} premissas={premissas} />),
      ).not.toThrow();
      const semCusto = analises.filter((a) => a.entregas.length > 0).every((a) => a.custoUnitario == null);
      if (semCusto && analises.some((a) => a.entregas.length > 0)) {
        expect(screen.getByText(/só se aplica ao módulo de criativo/)).toBeTruthy();
      }
    });
  }
});
