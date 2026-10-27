import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  JANELA_TENTATIVAS_MS, RESPOSTA_RECUSA, decidirEntrada, gerarToken, hashToken, reuniaoValida, validadeHoras,
} from "@/lib/reuniao";

function ipDaRequisicao(): string {
  const h = getRequest().headers;
  return ((h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64)) || "desconhecido";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function exigirAdmin(supabase: { rpc: (f: "has_role", a: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Somente o Admin gerencia reuniões.");
}

/** Conta as tentativas do IP no último minuto e registra a atual. */
async function tentativasRecentes(ip: string): Promise<number> {
  const sb = await admin();
  const desde = new Date(Date.now() - JANELA_TENTATIVAS_MS).toISOString();
  const { count } = await sb.from("reuniao_tentativa").select("id", { count: "exact", head: true }).eq("ip", ip).gte("quando", desde);
  await sb.from("reuniao_tentativa").insert({ ip });
  if (Math.random() < 0.05) await sb.from("reuniao_tentativa").delete().lt("quando", new Date(Date.now() - 86_400_000).toISOString());
  return count ?? 0;
}

async function negar(ip: string, motivo: string) {
  const sb = await admin();
  await sb.from("log_auditoria").insert({ tabela: "reuniao_acesso", operacao: "NEGADO", registro: motivo, depois: { ip } });
  return RESPOSTA_RECUSA;
}

/** Valida o token (sempre no servidor). */
async function reuniaoDoToken(token: unknown, ip: string) {
  const sb = await admin();
  return decidirEntrada(token, await tentativasRecentes(ip), async (hash) => {
    const { data } = await sb.from("reuniao").select("id, nome, expira_em, encerrada_em").eq("token_hash", hash).maybeSingle();
    return data;
  });
}

export const infoReuniao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const ip = ipDaRequisicao();
    const { r, motivo } = await reuniaoDoToken(data.token, ip);
    if (!r) return negar(ip, motivo);
    return { ok: true as const, nome: r.nome, expira_em: r.expira_em };
  });

export const entrarReuniao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200), nome: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const ip = ipDaRequisicao();
    const { r, motivo } = await reuniaoDoToken(data.token, ip);
    if (!r) return negar(ip, motivo);
    const sb = await admin();
    const email = `r-${crypto.randomUUID()}@reuniao.newe.invalid`;
    const senha = gerarToken() + gerarToken();
    const { data: criado, error } = await sb.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      app_metadata: { reuniao: true, reuniao_id: r.id },
      user_metadata: { nome: data.nome },
    });
    if (error || !criado.user) { console.error("reuniao: criar sessao", error?.message); return RESPOSTA_RECUSA; }
    const { error: e2 } = await sb.from("reuniao_participante").insert({ user_id: criado.user.id, reuniao_id: r.id, nome: data.nome, ip });
    if (e2) { await sb.auth.admin.deleteUser(criado.user.id); console.error("reuniao: participante", e2.message); return RESPOSTA_RECUSA; }
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: s, error: e3 } = await pub.auth.signInWithPassword({ email, password: senha });
    if (e3 || !s.session) { console.error("reuniao: login", e3?.message); return RESPOSTA_RECUSA; }
    return { ok: true as const, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

/** Apaga as contas de reunião encerradas ou expiradas: o login delas deixa de valer. */
async function derrubarSessoes(reuniaoIds: string[]) {
  if (reuniaoIds.length === 0) return;
  const sb = await admin();
  const { data } = await sb.from("reuniao_participante").select("user_id").in("reuniao_id", reuniaoIds);
  await Promise.all((data ?? []).map((p) => sb.auth.admin.deleteUser(p.user_id).catch(() => undefined)));
}

export const criarReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    nome: z.string().trim().min(2).max(120),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    horas: z.number().int().min(1).max(12),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase as never, context.userId);
    const token = gerarToken();
    const expira = new Date(Date.now() + validadeHoras(data.horas) * 3_600_000).toISOString();
    const { data: r, error } = await context.supabase.from("reuniao")
      .insert({ nome: data.nome, data: data.data, token_hash: await hashToken(token), criada_por: context.userId, expira_em: expira })
      .select("id, expira_em").single();
    if (error || !r) throw new Error("Não foi possível abrir a reunião.");
    return { id: r.id, expira_em: r.expira_em, token };
  });

export const encerrarReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase as never, context.userId);
    const { error } = await context.supabase.from("reuniao")
      .update({ encerrada_em: new Date().toISOString(), encerrada_por: context.userId }).eq("id", data.id).is("encerrada_em", null);
    if (error) throw new Error("Não foi possível encerrar a reunião.");
    await derrubarSessoes([data.id]);
    return { ok: true };
  });

export const listarReunioes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase as never, context.userId);
    const [{ data: rs }, { data: ps }] = await Promise.all([
      context.supabase.from("reuniao").select("id, nome, data, criada_em, expira_em, encerrada_em").order("criada_em", { ascending: false }).limit(30),
      context.supabase.from("reuniao_participante").select("reuniao_id, nome, entrou_em, ultimo_acesso"),
    ]);
    const agora = Date.now();
    const lista = (rs ?? []).map((r) => {
      const parts = (ps ?? []).filter((p) => p.reuniao_id === r.id);
      return {
        ...r, ativa: reuniaoValida(r, agora), acessos: parts.length,
        conectados: parts.filter((p) => new Date(p.ultimo_acesso).getTime() > agora - 180_000).map((p) => p.nome),
      };
    });
    // Expiradas sem encerramento manual: derruba as contas que ainda existirem.
    const expiradas = lista.filter((r) => !r.ativa && !r.encerrada_em).map((r) => r.id);
    await derrubarSessoes(expiradas);
    return lista;
  });
