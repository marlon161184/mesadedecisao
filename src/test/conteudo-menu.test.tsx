import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { permissaoConteudo } from "@/lib/conteudo-permissao";

const estado = vi.hoisted(() => ({ leitura: false, reuniao: false }));
vi.mock("@/components/newe/Moldura", () => ({ useSessao: () => ({ data: { reuniao: estado.reuniao } }) }));
vi.mock("@/components/conteudo/AcessoConteudo", () => ({ usePermissaoConteudo: () => ({ data: { leitura: estado.leitura } }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
import { ListaSecoes } from "@/components/mesa/BarraLateral";

describe("menus de documentos", () => {
  for (const grande of [false, true]) {
    for (const grupo of ["Colaboradores", "Conselheiros", "Sócios", "Admin"]) {
      it(`${grupo}, menu ${grande ? "celular" : "lateral"}`, () => {
        estado.reuniao = false;
        estado.leitura = permissaoConteudo({ admin: grupo === "Admin", grupo, reuniao: false }).leitura;
        render(<ListaSecoes grande={grande} />);
        expect(!!screen.queryByText("Pareceres")).toBe(estado.leitura);
        expect(!!screen.queryByText("RFPs")).toBe(estado.leitura);
      });
    }
  }
});