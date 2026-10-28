import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { bloqueado, normalizarEmail, podeEntrar, senhaValida, statusAcesso, SENHA_MINIMA, type StatusAcesso } from "./acesso";

const RECUSA = "E-mail ou senha não conferem, ou o acesso está bloqueado. Aguarde 15 minutos e tente de novo.";

function ip(): string {
  const h = getRequest().headers;
  return ((h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64)) || "desconhecido";
}

function clientePublico() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function autorizado(email: string): Promise<boolean> {
  const sb = await admin();
  const { data: lista } = await sb.from("acesso_autorizado").select("revogado_em").eq("email", email).maybeSingle();
  let temPapel = false;
  if (!lista) {
    const { data: perfil } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (perfil) {
      const { count } = await sb.from("user_roles").select("id", { count: "exact", head: true }).eq("user_id", perfil.id);
      temPapel = (count ?? 0) > 0;
    }
  }
  return podeEntrar(lista, temPapel);
}

/** Login com lista autorizada e bloqueio após 5 falhas em 15 minutos. */
export const entrarComSenha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(255), senha: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const email = normalizarEmail(data.email);
    const origem = ip();
    const sb = await admin();
    const desde = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: tent } = await sb.from("tentativa_login").select("sucesso, quando").eq("email", email).gte("quando", desde);
    if (bloqueado(tent ?? [])) return { ok: false as const, erro: RECUSA };

    if (!(await autorizado(email))) {
      await sb.from("tentativa_login").insert({ email, ip: origem, sucesso: false });
      return { ok: false as const, erro: RECUSA };
    }
    const { data: s, error } = await clientePublico().auth.signInWithPassword({ email, password: data.senha });
    await sb.from("tentativa_login").insert({ email, ip: origem, sucesso: !error && !!s.session });
    if (error || !s.session) return { ok: false as const, erro: RECUSA };
    await sb.from("log_entrada").insert({ user_id: s.session.user.id, email, ip: origem });
    return { ok: true as const, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

/** "Esqueci minha senha": só envia para quem pode entrar; resposta sempre igual. */
export const pedirRedefinicao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(255), redirectTo: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const email = normalizarEmail(data.email);
    if (await autorizado(email)) {
      await clientePublico().auth.resetPasswordForEmail(email, { redirectTo: data.redirectTo });
    }
    return { ok: true };
  });

/** Define a senha da própria conta (convite ou redefinição), com mínimo de 12 caracteres. */
export const definirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ senha: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!senhaValida(data.senha)) throw new Error(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
    const sb = await admin();
    const { data: u } = await sb.auth.admin.getUserById(context.userId);
    const email = normalizarEmail(u.user?.email ?? "");
    if (!email || !(await autorizado(email))) throw new Error("Este acesso não está liberado.");
    const { error } = await sb.auth.admin.updateUserById(context.userId, { password: data.senha });
    if (error) throw new Error("Não foi possível definir a senha. Tente uma senha diferente.");
    await sb.from("log_entrada").insert({ user_id: context.userId, email, ip: ip() });
    return { ok: true };
  });

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Somente o facilitador gerencia os acessos.");
}

async function contasPorEmail() {
  const sb = await admin();
  const mapa = new Map<string, { id: string; confirmada: boolean }>();
  for (let page = 1; page < 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) {
      if (u.email) mapa.set(normalizarEmail(u.email), { id: u.id, confirmada: !!u.email_confirmed_at && !!u.last_sign_in_at });
    }
    if ((data?.users.length ?? 0) < 200) break;
  }
  return mapa;
}

export type LinhaAcesso = { email: string; grupo: string; status: StatusAcesso; convidado_em: string | null };

export const listarAcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { data: lista } = await context.supabase.from("acesso_autorizado").select("*").order("grupo").order("email");
    const contas = await contasPorEmail();
    const { data: entradas } = await context.supabase
      .from("log_entrada").select("email, quando").order("quando", { ascending: false }).limit(200);
    const linhas: LinhaAcesso[] = (lista ?? []).map((a) => ({
      email: a.email,
      grupo: a.grupo,
      convidado_em: a.convidado_em,
      status: statusAcesso(a, contas.get(a.email) ?? null),
    }));
    return { linhas, entradas: entradas ?? [] };
  });

async function convidar(email: string, redirectTo: string) {
  const sb = await admin();
  const { data: a } = await sb.from("acesso_autorizado").select("*").eq("email", email).maybeSingle();
  if (!a) throw new Error("E-mail fora da lista autorizada.");
  const conta = (await contasPorEmail()).get(email);
  if (conta?.confirmada && !a.revogado_em) throw new Error("Esta pessoa já está ativa.");
  // Convite anterior não usado (ou acesso revogado): a conta antiga sai para o novo link valer sozinho.
  if (conta) await sb.auth.admin.deleteUser(conta.id);
  await sb.from("acesso_autorizado").update({ revogado_em: null, user_id: null }).eq("email", email);
  const { error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) throw new Error("Não foi possível enviar o convite.");
  await sb.from("acesso_autorizado").update({ convidado_em: new Date().toISOString() }).eq("email", email);
}

const alvo = z.object({ email: z.string().max(255), redirectTo: z.string().url().max(500) });

export const enviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alvo.parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    await convidar(normalizarEmail(data.email), data.redirectTo);
    return { ok: true };
  });

export const enviarPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ redirectTo: z.string().url().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { data: lista } = await context.supabase.from("acesso_autorizado").select("*");
    const contas = await contasPorEmail();
    let enviados = 0;
    for (const a of lista ?? []) {
      if (statusAcesso(a, contas.get(a.email) ?? null) !== "pendente") continue;
      await convidar(a.email, data.redirectTo);
      enviados++;
    }
    return { enviados };
  });

export const revogarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const email = normalizarEmail(data.email);
    const sb = await admin();
    const { error } = await sb.from("acesso_autorizado").update({ revogado_em: new Date().toISOString() }).eq("email", email);
    if (error) throw new Error("Não foi possível revogar.");
    const conta = (await contasPorEmail()).get(email);
    if (conta) {
      await sb.from("user_roles").delete().eq("user_id", conta.id);
      await sb.auth.admin.updateUserById(conta.id, { ban_duration: "876000h" });
    }
    return { ok: true };
  });
