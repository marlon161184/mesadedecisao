import { describe, expect, it, vi, beforeEach } from "vitest";
import { permissaoConteudo } from "./conteudo-permissao";

const estado = vi.hoisted(() => ({ grupo: "Colaboradores", admin: false, reuniao: false, ativa: true, revogado: false, vinculado: true, leituras: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ select: () => ({ eq: (coluna: string, valor: string) => {
    expect(["user_id", "email"]).toContain(coluna);
    expect(valor).toBe(coluna === "user_id" ? "usuario-verificado" : "socio@example.test");
    return { maybeSingle: async () => ({ data: coluna === "user_id" && !estado.vinculado ? null : { grupo: estado.grupo, revogado_em: estado.revogado ? "2026-10-28" : null }, error: null }) };
  } }) }),
} }));
vi.mock("./conteudo-dados.server", () => ({ lerDocumentos: () => { estado.leituras++; return { autorizado: true }; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
import { verificarConteudo } from "./conteudo-permissao.server";
import { carregarDocumentos } from "./conteudo.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const cliente = {
  auth: { getUser: async () => ({ data: { user: { id: "usuario-verificado", email: "socio@example.test", app_metadata: { reuniao: estado.reuniao } } }, error: null }) },
  rpc: async (nome: string) => ({ data: nome === "has_role" ? estado.admin : estado.ativa, error: null }),
} as unknown as SupabaseClient<Database>;
const solicitar = carregarDocumentos as unknown as (args: { context: { supabase: SupabaseClient<Database>; userId: string }; data: { impressao: boolean } }) => Promise<unknown>;

beforeEach(() => Object.assign(estado, { grupo: "Colaboradores", admin: false, reuniao: false, ativa: true, revogado: false, vinculado: true, leituras: 0 }));
describe("documentos protegidos no servidor", () => {
  for (const grupo of ["Colaboradores", "Conselheiros"]) {
    it(`${grupo} não recebe conteúdo nem impressão`, async () => {
      estado.grupo = grupo;
      for (const impressao of [false, true]) expect(await solicitar({ context: { supabase: cliente, userId: "usuario-verificado" }, data: { impressao } })).toBeNull();
      expect(estado.leituras).toBe(0);
    });
  }
  it("Sócios recebe leitura e impressão por vínculo", async () => {
    estado.grupo = "Sócios";
    expect(await verificarConteudo(cliente, "usuario-verificado")).toEqual({ leitura: true, impressao: true });
    expect(await solicitar({ context: { supabase: cliente, userId: "usuario-verificado" }, data: { impressao: true } })).toEqual({ autorizado: true });
  });
  it("Sócios recebe permissão pelo próprio e-mail", async () => {
    estado.grupo = "Sócios"; estado.vinculado = false;
    expect(await verificarConteudo(cliente, "usuario-verificado")).toEqual({ leitura: true, impressao: true });
  });
  it("Admin acessa independentemente do grupo", async () => {
    estado.admin = true;
    expect(await solicitar({ context: { supabase: cliente, userId: "usuario-verificado" }, data: { impressao: true } })).toEqual({ autorizado: true });
  });
  it("Sócios revogado não acessa", () => expect(permissaoConteudo({ admin: false, reuniao: false, grupo: "Sócios", revogado: true }).leitura).toBe(false));
  it("Reunião ativa continua lendo sem imprimir", async () => {
    estado.reuniao = true;
    expect(await verificarConteudo(cliente, "usuario-verificado")).toEqual({ leitura: true, impressao: false });
    expect(await solicitar({ context: { supabase: cliente, userId: "usuario-verificado" }, data: { impressao: true } })).toBeNull();
    expect(estado.leituras).toBe(0);
  });
  it("Reunião encerrada não recebe dados", async () => {
    estado.reuniao = true; estado.ativa = false;
    expect(await solicitar({ context: { supabase: cliente, userId: "usuario-verificado" }, data: { impressao: false } })).toBeNull();
  });
});