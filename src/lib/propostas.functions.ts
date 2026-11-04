import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  CATEGORIAS, MIME, TIPOS_PRECO, UNIDADES, cabecalhoSchema, caminhoArquivo, conteudoSchema, linhasAprovacao,
  montarRascunho, rascunhoManual, sanearNome, validarArquivo, type Contexto, type TipoArquivo,
} from "@/lib/rascunho";

type Sb = { rpc: (f: "has_role", a: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> };
async function exigirAdmin(sb: Sb, userId: string) {
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Somente o Admin envia e grava propostas.");
}

function lerForm(d: unknown) {
  if (!(d instanceof FormData)) throw new Error("Envio inválido.");
  const arquivo = d.get("arquivo");
  if (!(arquivo instanceof File)) throw new Error("Escolha um arquivo.");
  const propostaId = d.get("propostaId");
  return { arquivo, propostaId: typeof propostaId === "string" && propostaId ? z.string().uuid().parse(propostaId) : null };
}

async function conferirArquivo(arquivo: File) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const v = validarArquivo(arquivo.name, bytes.byteLength, bytes);
  if (!v.ok) throw new Error(v.erro);
  return { bytes, tipo: v.tipo };
}

/** Passo 1: guarda o arquivo numa área de rascunho (só Admin). */
export const enviarArquivoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(lerForm)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { bytes, tipo } = await conferirArquivo(data.arquivo);
    const id = crypto.randomUUID();
    const caminho = `rascunho/${id}/${crypto.randomUUID()}.${tipo}`;
    const up = await context.supabase.storage.from("propostas").upload(caminho, bytes, { contentType: MIME[tipo] });
    if (up.error) throw new Error("Não foi possível guardar o arquivo.");
    const { error } = await context.supabase.from("proposta_rascunho").insert({
      id, arquivo_caminho: caminho, arquivo_nome: sanearNome(data.arquivo.name), arquivo_tipo: tipo, arquivo_tamanho: bytes.byteLength, criado_por: context.userId,
    });
    if (error) { await context.supabase.storage.from("propostas").remove([caminho]); throw new Error(error.message); }
    return { id, tipo, caminho };
  });

/** Anexa um documento a uma proposta existente (mesma versão da proposta). */
export const anexarDocumentoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(lerForm)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    if (!data.propostaId) throw new Error("Proposta não indicada.");
    const { data: p } = await context.supabase.from("proposta").select("id, versao").eq("id", data.propostaId).maybeSingle();
    if (!p) throw new Error("Proposta não encontrada.");
    const { bytes, tipo } = await conferirArquivo(data.arquivo);
    const caminho = caminhoArquivo(p.id, p.versao, crypto.randomUUID(), tipo);
    const up = await context.supabase.storage.from("propostas").upload(caminho, bytes, { contentType: MIME[tipo] });
    if (up.error) throw new Error("Não foi possível guardar o arquivo.");
    const { error } = await context.supabase.from("proposta_arquivo").insert({ proposta_id: p.id, versao: p.versao, caminho, nome: sanearNome(data.arquivo.name) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function contexto(sb: SupabaseClient<Database>, rfpNumero: number): Promise<Contexto & { modulos: { id: string; codigo: string; nome: string }[] }> {
  const { data: rfp } = await sb.from("rfp").select("id, janela_meses").eq("numero", rfpNumero).maybeSingle();
  if (!rfp) throw new Error("RFP não encontrado.");
  const { data: modulos } = await sb.from("modulo").select("id, codigo, nome").eq("rfp_id", rfp.id).order("codigo");
  const ids = (modulos ?? []).map((m: { id: string }) => m.id);
  const { data: requisitos } = ids.length ? await sb.from("requisito").select("id, codigo, descricao, modulo_id").in("modulo_id", ids).order("codigo") : { data: [] };
  return { modulos: modulos ?? [], requisitos: requisitos ?? [], janelaMeses: rfp.janela_meses };
}

function instrucoesLeitura(ctx: Contexto & { modulos: { codigo: string; nome?: string }[] }) {
  return `Você lê propostas comerciais de agências para a NEWE e devolve SOMENTE um objeto JSON, sem comentários.
Regra editorial: só fatos presentes no documento. Dado ausente é null. Não invente número, nome, entrega ou página.
Honorários do facilitador (Arquê) nunca entram como item.
Formato:
{"cabecalho":{"data_proposta":"AAAA-MM-DD"|null,"validade_dias":int|null,"contrato_meses_proposto":int|null,"tributos":str|null,"reajuste":str|null,"desconto_explicito":str|null,"exclusoes":str|null,"observacoes":str|null},
"itens":[{"descricao":str,"modulo":"${ctx.modulos.map((m) => m.codigo).join("|")}"|null,"tipo_preco":"${TIPOS_PRECO.join("|")}","unidade":"${UNIDADES.join("|")}","valor_lista":num|null,"valor_negociado":num|null,"valor_min":num|null,"valor_max":num|null,"multiplicador":num,"incluido_no_subtotal":bool,"sujeito_desconto_lista":bool,"teto_verba_mensal":num|null,"incerteza":str|null,"fonte_pagina":"p. N"|null,"confianca":"alta|baixa"}],
"entregas":[{"categoria":"${CATEGORIAS.join("|")}","quantidade_mes":num,"e_teto":bool,"observacao":str|null,"fonte_pagina":str|null,"confianca":"alta|baixa"}],
"coberturas":[{"codigo":"Q1.1","nivel":1|0.5|0|null,"trecho":"citação literal curta"|null,"fonte_pagina":str|null,"confianca":"alta|baixa"}],
"pontos":[{"severidade":"critico|alto|medio|info","texto":str,"acao_sugerida":str|null,"fonte_pagina":str|null}]}
Módulos do RFP: ${ctx.modulos.map((m) => `${m.codigo} ${m.nome ?? ""}`).join("; ")}.
Requisitos (avalie todos; nível 1 atende, 0,5 parcial, 0 não atende, null não informado): ${ctx.requisitos.map((r) => `${r.codigo} ${r.descricao}`).join("; ")}.
Pontos a procurar: contradições entre exclusões e escopo; itens fora do subtotal; desconto sem preço final por escrito; contrato diferente da janela de ${ctx.janelaMeses} meses; proposta sem data ou validade; sobreposição de fotos e vídeos com o RFP 1; limites de usuários e contatos do CRM; custo por produto que multiplica.
Valores em reais como número (1234.56). Marque "confianca":"baixa" quando o texto for ambíguo.`;
}

/** Passo 3: leitura assistida. Só monta o rascunho; não grava nas tabelas oficiais. */
export const lerRascunhoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d?.id) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await exigirAdmin(sb, context.userId);
    const { data: r } = await sb.from("proposta_rascunho").select("*").eq("id", data.id).maybeSingle();
    if (!r || r.status === "aprovado" || r.status === "descartado") throw new Error("Rascunho indisponível.");
    const ctx = await contexto(sb, r.rfp_numero);
    const manual = async (erro: string) => {
      const conteudo = rascunhoManual(ctx);
      await sb.from("proposta_rascunho").update({ status: "manual", erro, conteudo, lido_em: new Date().toISOString() }).eq("id", r.id);
      return { status: "manual" as const, erro, conteudo };
    };
    const { data: flag } = await sb.from("premissa").select("valor").eq("chave", "ia_leitura_habilitada").maybeSingle();
    if (flag?.valor !== true) return manual("A leitura automática está desligada. Preencha os dados à mão.");
    if (r.arquivo_tipo !== "pdf") return manual("A leitura automática só lê PDF. Preencha os dados à mão.");
    const dl = await sb.storage.from("propostas").download(r.arquivo_caminho);
    if (dl.error || !dl.data) return manual("Não foi possível abrir o arquivo guardado.");
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const { chamarModelo, extrairJson } = await import("./ai/modelo.server");
    const resp = await chamarModelo(instrucoesLeitura(ctx), [
      { type: "file", data: bytes, mediaType: "application/pdf", filename: r.arquivo_nome },
      { type: "text", text: "Leia a proposta anexada e devolva o JSON." },
    ]);
    if (!resp.ok) return manual(`${resp.erro} O arquivo ficou guardado; preencha os dados à mão.`);
    let bruto: unknown;
    try { bruto = extrairJson(resp.texto); } catch { return manual("A leitura não devolveu dados reconhecíveis. Preencha os dados à mão."); }
    const conteudo = montarRascunho(bruto, ctx, "ia");
    await sb.from("proposta_rascunho").update({ status: "lido", erro: null, conteudo, lido_em: new Date().toISOString() }).eq("id", r.id);
    return { status: "lido" as const, erro: null, conteudo };
  });

const aprovarSchema = z.object({
  id: z.string().uuid(),
  player: z.union([
    z.object({ id: z.string().uuid() }),
    z.object({ novo: z.object({ nome: z.string().trim().min(1).max(80), tipo: z.enum(["agencia", "plataforma", "consultoria", "referencia"]), cor_token: z.string().max(40), cidade: z.string().max(80).nullable() }) }),
  ]),
  versao: z.number().int().min(1).max(99),
  cabecalho: cabecalhoSchema,
  conteudo: conteudoSchema,
});

/** Passo 4: "Aprovar e gravar". Cria a proposta como Recebida e grava o rascunho conferido. */
export const aprovarRascunhoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => aprovarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await exigirAdmin(sb, context.userId);
    const { data: r } = await sb.from("proposta_rascunho").select("*").eq("id", data.id).maybeSingle();
    if (!r || r.status === "aprovado" || r.status === "descartado") throw new Error("Rascunho indisponível.");
    // Requisitos precisam ser do RFP do rascunho; módulos idem.
    const ctx = await contexto(sb, r.rfp_numero);
    const modIds = new Set(ctx.modulos.map((m) => m.id));
    const reqIds = new Set(ctx.requisitos.map((q) => q.id));
    if (data.conteudo.itens.some((i) => i.modulo_id && !modIds.has(i.modulo_id))) throw new Error("Item com módulo de outro RFP.");
    if (data.conteudo.coberturas.some((c) => !reqIds.has(c.requisito_id))) throw new Error("Cobertura de requisito de outro RFP.");

    let playerId: string;
    if ("id" in data.player) playerId = data.player.id;
    else {
      const { data: pl, error } = await sb.from("player").insert({ ...data.player.novo, status: "proponente", rfp_numeros: [r.rfp_numero] }).select("id").single();
      if (error || !pl) throw new Error(error?.message ?? "Não foi possível criar a agência.");
      playerId = pl.id;
    }
    const { data: existe } = await sb.from("proposta").select("id").eq("player_id", playerId).eq("versao", data.versao).maybeSingle();
    if (existe) throw new Error(`Essa agência já tem a versão ${data.versao}. Use outra versão.`);
    const { data: prop, error: ep } = await sb.from("proposta").insert({
      player_id: playerId, versao: data.versao, status: "recebida", fonte_arquivo: r.arquivo_nome, ...data.cabecalho,
    }).select("id").single();
    if (ep || !prop) throw new Error(ep?.message ?? "Não foi possível criar a proposta.");

    // Move o arquivo para propostas/{proposta_id}/v{versao}/{uuid}.
    const tipo = r.arquivo_tipo as TipoArquivo;
    const destino = caminhoArquivo(prop.id, data.versao, crypto.randomUUID(), tipo);
    const dl = await sb.storage.from("propostas").download(r.arquivo_caminho);
    let caminho = r.arquivo_caminho;
    if (dl.data) {
      const up = await sb.storage.from("propostas").upload(destino, dl.data, { contentType: MIME[tipo] });
      if (!up.error) { caminho = destino; await sb.storage.from("propostas").remove([r.arquivo_caminho]); }
    }
    await sb.from("proposta_arquivo").insert({ proposta_id: prop.id, versao: data.versao, caminho, nome: r.arquivo_nome });

    const l = linhasAprovacao(data.conteudo, prop.id);
    const erros: string[] = [];
    if (l.itens.length) { const { error } = await sb.from("item_proposta").insert(l.itens); if (error) erros.push(`itens: ${error.message}`); }
    if (l.entregas.length) { const { error } = await sb.from("entrega_declarada").insert(l.entregas); if (error) erros.push(`entregas: ${error.message}`); }
    if (l.coberturas.length) { const { error } = await sb.from("cobertura").insert(l.coberturas.map((c) => ({ ...c, avaliado_por: context.userId }))); if (error) erros.push(`cobertura: ${error.message}`); }
    if (l.pontos.length) { const { error } = await sb.from("ponto_atencao").insert(l.pontos); if (error) erros.push(`pontos: ${error.message}`); }
    await sb.from("proposta_rascunho").update({
      status: "aprovado", proposta_id: prop.id, aprovado_por: context.userId, aprovado_em: new Date().toISOString(), arquivo_caminho: caminho, conteudo: data.conteudo,
    }).eq("id", r.id);
    return { propostaId: prop.id, erros };
  });

export const descartarRascunhoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d?.id) }))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { data: r } = await context.supabase.from("proposta_rascunho").select("arquivo_caminho, status").eq("id", data.id).maybeSingle();
    if (!r || r.status === "aprovado") throw new Error("Rascunho indisponível.");
    await context.supabase.storage.from("propostas").remove([r.arquivo_caminho]);
    await context.supabase.from("proposta_rascunho").update({ status: "descartado" }).eq("id", data.id);
    return { ok: true };
  });

const INSTRUCOES_PARECER = `Você redige o parecer técnico de UMA proposta para os sócios da NEWE, em português do Brasil.
No máximo uma página. Tom direto, frases curtas, sem adjetivos, sem exclamações, sem jargão.
Use somente os fatos do JSON recebido. Não invente números, nomes ou entregas. Dado ausente: "não informado".
Estrutura: o que a proposta entrega por módulo, o que não entrega, pontos de atenção e um resumo com total na janela, cobertura e bloqueios.
Valores em reais no formato brasileiro (R$ 1.234,56). Não inclua honorários do facilitador.`;

/** Rascunho de parecer com IA para uma proposta nova (só Admin; revisão humana antes de publicar). */
export const redigirParecerProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dados: unknown }) => {
    const json = JSON.stringify(d?.dados ?? null);
    if (json.length > 60000) throw new Error("Dados grandes demais.");
    return { json };
  })
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { data: flag } = await context.supabase.from("premissa").select("valor").eq("chave", "ia_parecer_habilitada").maybeSingle();
    if (flag?.valor !== true) return { ok: false as const, erro: "A redação com IA está desligada. Ligue em Decisão → Configurações." };
    const { chamarModelo } = await import("./ai/modelo.server");
    return chamarModelo(INSTRUCOES_PARECER, [{ type: "text", text: `Dados da proposta (JSON):\n${data.json}` }]);
  });
