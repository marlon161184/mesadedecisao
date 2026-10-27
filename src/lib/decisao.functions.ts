import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Aceite eletrônico simples da ata aprovada; o IP fica registrado no log. */
export const aceitarAta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ataId: z.string().uuid(), nome: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const h = getRequest().headers;
    const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64) || null;
    const { error } = await context.supabase.from("ata_aceite").insert({ ata_id: data.ataId, socio_id: context.userId, nome: data.nome, ip });
    if (error) throw new Error(error.code === "23505" ? "Você já deu o aceite nesta ata." : "Não foi possível registrar o aceite.");
    return { ok: true };
  });
