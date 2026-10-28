import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { permissaoConteudo } from "@/lib/conteudo-permissao";

const estado = vi.hoisted(() => ({ permitido: false, reuniao: false }));
vi.mock("@/components/newe/Moldura", () => ({ useSessao: () => ({ data: { id: "usuario", reuniao: estado.reuniao } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/conteudo.functions", () => ({ carregarDocumentos: vi.fn(), consultarPermissaoConteudo: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: estado.permitido ? { pareceres: {}, fornecedores: [], rfps: [] } : null, isPending: false, isError: false, isFetching: false }) }));
vi.mock("@/components/mesa/SemAcesso", () => ({ SemAcesso: () => <p role="alert">Sem acesso aos dados desta sessão</p> }));
import { AcessoConteudo } from "@/components/conteudo/AcessoConteudo";

describe("URLs de documentos", () => {
  for (const impressao of [false, true]) {
    for (const grupo of ["Colaboradores", "Conselheiros", "Sócios", "Admin"]) {
      it(`${grupo} ${impressao ? "imprime" : "lê"} somente se autorizado`, () => {
        estado.reuniao = false;
        const p = permissaoConteudo({ admin: grupo === "Admin", grupo, reuniao: false });
        estado.permitido = impressao ? p.impressao : p.leitura;
        const revelar = vi.fn(() => <p>DOCUMENTO CONFIDENCIAL</p>);
        function Documento() { return revelar(); }
        render(<AcessoConteudo impressao={impressao}><Documento /></AcessoConteudo>);
        expect(revelar).toHaveBeenCalledTimes(estado.permitido ? 1 : 0);
        expect(!!screen.queryByRole("alert")).toBe(!estado.permitido);
      });
    }
  }
  it("reunião mantém o bloqueio de impressão sem encerrar a sessão", () => {
    estado.reuniao = true; estado.permitido = false;
    render(<AcessoConteudo impressao><p>DOCUMENTO CONFIDENCIAL</p></AcessoConteudo>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("DOCUMENTO CONFIDENCIAL")).toBeNull();
  });
});