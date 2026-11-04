import { getRequest } from "@tanstack/react-start/server";

type Parte = { type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string; filename?: string };

/** Chamada única ao Lovable AI (chave só no servidor). Devolve texto ou erro amigável. */
export async function chamarModelo(instrucoes: string, partes: Parte[]): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, erro: "Lovable AI não está configurado." };
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } = await import("./run-id.server");
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
      instructions: instrucoes,
      messages: [{ role: "user", content: partes }],
      abortSignal: request.signal,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
    });
    const texto = (await result.text).trim();
    if (!texto) return { ok: false, erro: "O modelo não devolveu texto." };
    return { ok: true, texto };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    console.error("IA", status, e);
    return {
      ok: false,
      erro: status === 402 ? "Créditos de Lovable AI esgotados. Recarregue em Settings → Plans & credits."
        : status === 429 ? "Muitas solicitações agora. Aguarde um minuto e tente de novo."
        : status === 403 ? "O uso de Lovable AI está bloqueado neste workspace."
        : "Não foi possível concluir a leitura com IA agora.",
    };
  }
}

/** Extrai o primeiro objeto JSON de uma resposta de texto. */
export function extrairJson(texto: string): unknown {
  const sem = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = sem.indexOf("{"), f = sem.lastIndexOf("}");
  if (i < 0 || f <= i) throw new Error("Resposta sem JSON.");
  return JSON.parse(sem.slice(i, f + 1));
}
