import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INSTRUCOES = `Você redige pareceres técnicos para os sócios da NEWE, em português do Brasil.
Escreva no máximo uma página. Tom direto, frases curtas, sem adjetivos, sem exclamações, sem jargão.
Use somente os fatos presentes nos dados JSON recebidos. Não invente números, nomes ou entregas.
Quando um dado estiver ausente, escreva "não informado".
Estrutura: um parágrafo por módulo (player, o que entrega, o que não entrega, observação técnica) e um resumo final com total, faixa, cobertura, bloqueios e concentração.
Valores em reais no formato brasileiro (R$ 1.234,56). Não inclua honorários de consultoria do facilitador.`;

/** Redige um rascunho de parecer com Lovable AI a partir de dados estruturados da composição. */
export const redigirParecer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dados: unknown }) => {
    const json = JSON.stringify(d?.dados ?? null);
    if (json.length > 60000) throw new Error("Dados da composição grandes demais.");
    return { json };
  })
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_member", { _user_id: context.userId });
    if (!ok) throw new Error("Acesso negado.");
    const { data: flag } = await context.supabase.from("premissa").select("valor").eq("chave", "ia_parecer_habilitada").maybeSingle();
    if (flag?.valor !== true) return { ok: false as const, erro: "A redação com IA está desligada. O Admin pode ligá-la em Decisão → Configurações." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Lovable AI não está configurado.");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } = await import("./ai/run-id.server");
    const request = getRequest();
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCOES,
        messages: [{ role: "user", content: `Dados da composição (JSON):\n${data.json}` }],
        abortSignal: request.signal,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const texto = (await result.text).trim();
      if (!texto) return { ok: false as const, erro: "O modelo não devolveu texto. Tente de novo mais tarde." };
      return { ok: true as const, texto };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("parecer IA", status, e);
      const erro =
        status === 402 ? "Créditos de Lovable AI esgotados. Recarregue em Settings → Plans & credits."
        : status === 429 ? "Muitas solicitações agora. Aguarde um minuto e tente de novo."
        : status === 403 ? "O uso de Lovable AI está bloqueado neste workspace."
        : "Não foi possível redigir o parecer agora.";
      return { ok: false as const, erro };
    }
  });
