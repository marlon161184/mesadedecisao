import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { permissaoConteudo } from "./conteudo-permissao";

export async function verificarConteudo(supabase: SupabaseClient<Database>, userId: string) {
  const { data: identidade, error: identidadeErro } = await supabase.auth.getUser();
  if (identidadeErro || identidade.user?.id !== userId) return { leitura: false, impressao: false };
  const { data: podeLer, error: leituraErro } = await supabase.rpc("pode_ler", { _user_id: userId });
  if (leituraErro || !podeLer) return { leitura: false, impressao: false };
  if (identidade.user.app_metadata?.["reuniao"] === true) {
    const { data: ativa, error } = await supabase.rpc("leitor_reuniao", { _user_id: userId });
    return error || !ativa ? { leitura: false, impressao: false } : permissaoConteudo({ admin: false, reuniao: true });
  }
  const { data: admin, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) return { leitura: false, impressao: false };
  if (admin) return permissaoConteudo({ admin: true, reuniao: false });
  // Privileged read is restricted to the verified caller's allowlist row.
  // The allowlist remains admin-only under RLS; never return its rows to the browser.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vinculada, error: vinculoErro } = await supabaseAdmin.from("acesso_autorizado")
    .select("grupo, revogado_em").eq("user_id", userId).maybeSingle();
  if (vinculoErro) return { leitura: false, impressao: false };
  let acesso = vinculada;
  if (!acesso && identidade.user.email) {
    const { data, error: emailErro } = await supabaseAdmin.from("acesso_autorizado")
      .select("grupo, revogado_em").eq("email", identidade.user.email.trim().toLowerCase()).maybeSingle();
    if (emailErro) return { leitura: false, impressao: false };
    acesso = data;
  }
  return permissaoConteudo({ admin: false, reuniao: false, grupo: acesso?.grupo ?? null, revogado: !!acesso?.revogado_em });
}