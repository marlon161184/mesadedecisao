import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarPermissaoConteudo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { verificarConteudo } = await import("./conteudo-permissao.server");
    return verificarConteudo(context.supabase, context.userId);
  });

export const carregarDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ impressao: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { verificarConteudo } = await import("./conteudo-permissao.server");
    const p = await verificarConteudo(context.supabase, context.userId);
    if (!p.leitura || (data.impressao && !p.impressao)) return null;
    const { lerDocumentos } = await import("./conteudo-dados.server");
    return lerDocumentos();
  });