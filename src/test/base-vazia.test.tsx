import { describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { baseVazia, rfpOuPrimeiro, SemDadosError, type Base } from "@/lib/base";
import { base as cheia } from "@/test/fixtura";

const vazia = new Proxy({} as Base, { get: () => [] });

vi.mock("@tanstack/react-query", async (orig) => {
  const real = await orig<typeof import("@tanstack/react-query")>();
  return {
    ...real,
    useSuspenseQuery: () => ({ data: vazia }),
    useQuery: () => ({ data: undefined }),
    useQueryClient: () => ({ cancelQueries: async () => {}, clear: () => {}, invalidateQueries: async () => {} }),
    useMutation: () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false }),
  };
});
vi.mock("@tanstack/react-router", async (orig) => {
  const real = await orig<typeof import("@tanstack/react-router")>();
  return {
    ...real,
    useSearch: () => ({}),
    useNavigate: () => () => {},
    useRouter: () => ({ invalidate: () => {} }),
    useRouterState: () => "/mesa/visao",
    Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => ({}) },
}));

class Barreira extends Component<{ children: ReactNode; aoErro: (e: unknown) => void }, { erro: boolean }> {
  override state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  override componentDidCatch(e: unknown) { this.props.aoErro(e); }
  override render() { return this.state.erro ? null : this.props.children; }
}

describe("regras da base vazia", () => {
  it("base sem RFP é vazia; com RFP não", () => {
    expect(baseVazia({ rfps: [] })).toBe(true);
    expect(baseVazia(cheia)).toBe(false);
  });
  it("rfpOuPrimeiro lança SemDadosError na base vazia e cai no primeiro RFP quando o número não existe", () => {
    expect(() => rfpOuPrimeiro({ rfps: [] }, 1)).toThrow(SemDadosError);
    expect(rfpOuPrimeiro(cheia, 99).id).toBe(cheia.rfps[0]!.id);
  });
});

const TELAS = ["visao", "matriz", "entregas", "cobertura", "players", "pontos", "simulador", "cenarios", "mesa-cenarios", "estresse", "decisao", "admin"];

describe("cada tela da Mesa com base vazia", () => {
  it("o layout /mesa mostra 'Sem acesso aos dados desta sessão'", async () => {
    const { Route } = await import("@/routes/_authenticated/mesa");
    const C = Route.options.component as () => ReactNode;
    render(<C />);
    expect(screen.getByText("Sem acesso aos dados desta sessão")).toBeTruthy();
  });
  for (const t of TELAS) {
    it(`${t}: nunca quebra com erro de propriedade indefinida`, async () => {
      const mod = await import(`@/routes/_authenticated/mesa.${t}.tsx`);
      const C = mod.Route.options.component as () => ReactNode;
      const erros: unknown[] = [];
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<Barreira aoErro={(e) => erros.push(e)}><C /></Barreira>);
      err.mockRestore();
      for (const e of erros) expect(e).toBeInstanceOf(SemDadosError);
    });
  }
});
