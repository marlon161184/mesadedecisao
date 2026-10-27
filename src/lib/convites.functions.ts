import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const entrada = z.object({
  email: z.string().trim().email().max(255),
  nome: z.string().trim().min(1).max(120),
  papel: z.enum(["admin", "socio", "observador"]),
  redirectTo: z.string().url().max(500),
});

/** Admin convida uma pessoa por e-mail e define o papel. */
export const convidarPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ehAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ehAdmin) throw new Error("Somente o Admin pode convidar.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nome: data.nome },
      redirectTo: data.redirectTo,
    });
    if (error || !conv.user) throw new Error(error?.message ?? "Não foi possível enviar o convite.");

    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: conv.user.id, role: data.papel }, { onConflict: "user_id,role" });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Lista membros e papéis (somente Admin). */
export const listarMembros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ehAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ehAdmin) throw new Error("Somente o Admin pode ver os acessos.");
    const { data: perfis } = await context.supabase.from("profiles").select("id, nome, email").order("nome");
    const { data: papeis } = await context.supabase.from("user_roles").select("user_id, role");
    return (perfis ?? []).map((p) => ({
      ...p,
      papeis: (papeis ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });
