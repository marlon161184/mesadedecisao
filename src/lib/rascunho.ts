/**
 * Regras da entrada de propostas novas: validação do arquivo, versão sugerida, cor da agência
 * e montagem do rascunho a partir da leitura (IA ou manual). Puras e testadas.
 * Nada aqui calcula totais: os números saem de calculo.ts/equalizacao.ts depois da gravação.
 */
import { z } from "zod";

export const TAMANHO_MAX = 20 * 1024 * 1024;
export type TipoArquivo = "pdf" | "docx" | "pptx" | "xlsx";
export const MIME: Record<TipoArquivo, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const ACEITE = ".pdf,.docx,.pptx,.xlsx," + Object.values(MIME).join(",");

/** Confere extensão e assinatura do conteúdo (PDF começa com %PDF; DOCX/PPTX/XLSX são ZIP: PK). */
export function validarArquivo(nome: string, tamanho: number, inicio: Uint8Array): { ok: true; tipo: TipoArquivo } | { ok: false; erro: string } {
  if (!tamanho) return { ok: false, erro: "Arquivo vazio." };
  if (tamanho > TAMANHO_MAX) return { ok: false, erro: "O arquivo passa de 20 MB." };
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (!(ext in MIME)) return { ok: false, erro: "Envie PDF, DOCX, PPTX ou XLSX." };
  const tipo = ext as TipoArquivo;
  const b = Array.from(inicio.slice(0, 4));
  const pdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  const zip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  if (tipo === "pdf" ? !pdf : !zip) return { ok: false, erro: "O conteúdo do arquivo não corresponde à extensão." };
  return { ok: true, tipo };
}

/** Nome exibido: sem caminho, sem caracteres de controle, até 120 caracteres. */
export function sanearNome(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "arquivo";
  const limpo = base.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  return (limpo || "arquivo").slice(0, 120);
}

export function caminhoArquivo(propostaId: string, versao: number, uuid: string, tipo: TipoArquivo) {
  return `${propostaId}/v${versao}/${uuid}.${tipo}`;
}

export function versaoSugerida(propostas: { player_id: string; versao: number }[], playerId: string | null): number {
  if (!playerId) return 1;
  return Math.max(0, ...propostas.filter((p) => p.player_id === playerId).map((p) => p.versao)) + 1;
}

/** Cores fixas das agências atuais; novas recebem terra-vermelha e depois os cinzas quentes. */
export const CORES_NOVAS = ["terra-vermelha", "cinza-quente-1", "cinza-quente-2", "cinza-quente-3"] as const;
export function proximaCor(players: { cor_token: string | null }[]): string {
  const usadas = new Set(players.map((p) => p.cor_token));
  return CORES_NOVAS.find((c) => !usadas.has(c)) ?? "cinza-quente-3";
}

// ===== Rascunho =====
export const TIPOS_PRECO = ["recorrente", "pontual", "variavel", "por_credito"] as const;
export const UNIDADES = ["mes", "projeto", "produto_mes", "percentual_verba"] as const;
export const CATEGORIAS = ["posts_instagram", "videos_sociais", "posts_linkedin", "posts_corretores", "pecas_endomarketing", "placas_ooh", "videos_painel"] as const;
export const NAO_INFORMADO = "não informado";

const num = z.number().finite().nullable();
const txt = z.string().max(4000).nullable();
export const cabecalhoSchema = z.object({
  data_proposta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  validade_dias: z.number().int().min(0).max(3650).nullable(),
  contrato_meses_proposto: z.number().int().min(0).max(120).nullable(),
  tributos: txt, reajuste: txt, desconto_explicito: txt, exclusoes: txt, observacoes: txt,
});
export const itemSchema = z.object({
  descricao: z.string().min(1).max(500),
  modulo_id: z.string().uuid().nullable(),
  tipo_preco: z.enum(TIPOS_PRECO),
  unidade: z.enum(UNIDADES),
  valor_lista: num, valor_negociado: num, valor_min: num, valor_max: num,
  multiplicador: z.number().finite(),
  incluido_no_subtotal_da_proposta: z.boolean(),
  sujeito_desconto_lista: z.boolean(),
  teto_verba_mensal: num,
  incerteza: txt, fonte_pagina: txt,
  confianca: z.enum(["alta", "baixa"]), avisos: z.array(z.string()),
});
export const entregaSchema = z.object({
  categoria: z.enum(CATEGORIAS), quantidade_mes: z.number().finite().min(0), e_teto: z.boolean(),
  observacao: txt, fonte_pagina: txt, confianca: z.enum(["alta", "baixa"]), avisos: z.array(z.string()),
});
export const coberturaSchema = z.object({
  requisito_id: z.string().uuid(), codigo: z.string().nullable(), descricao: z.string(),
  nivel: z.union([z.literal(1), z.literal(0.5), z.literal(0)]).nullable(),
  // A leitura nunca grava "comprovado": só o Admin, depois, pelo editor de cobertura.
  evidencia: z.enum(["declarado", "nao_informado"]),
  trecho: txt, fonte_pagina: txt, confianca: z.enum(["alta", "baixa"]), avisos: z.array(z.string()),
});
export const pontoSchema = z.object({
  severidade: z.enum(["critico", "alto", "medio", "info"]), texto: z.string().min(1).max(2000),
  acao_sugerida: txt, fonte_pagina: txt, codigo: z.string().max(20),
});
export const conteudoSchema = z.object({
  origem: z.enum(["ia", "manual"]),
  cabecalho: cabecalhoSchema,
  itens: z.array(itemSchema).max(200),
  entregas: z.array(entregaSchema).max(100),
  coberturas: z.array(coberturaSchema).max(200),
  pontos: z.array(pontoSchema).max(100),
  descartados: z.array(z.string()).max(200),
});
export type Cabecalho = z.infer<typeof cabecalhoSchema>;
export type ItemRascunho = z.infer<typeof itemSchema>;
export type EntregaRascunho = z.infer<typeof entregaSchema>;
export type CoberturaRascunho = z.infer<typeof coberturaSchema>;
export type PontoRascunho = z.infer<typeof pontoSchema>;
export type ConteudoRascunho = z.infer<typeof conteudoSchema>;

export interface Contexto {
  modulos: { id: string; codigo: string }[];
  requisitos: { id: string; codigo: string | null; descricao: string; modulo_id: string }[];
  janelaMeses: number;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function texto(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== NAO_INFORMADO && t.toLowerCase() !== "nao informado" ? t.slice(0, max) : null;
}
function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const s = v.replace(/[R$\s]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return s && Number.isFinite(n) ? n : null;
}
const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);
const normCodigo = (s: unknown) => (typeof s === "string" ? s.trim().toUpperCase().replace(/\s+/g, "") : "");

export function cabecalhoVazio(): Cabecalho {
  return { data_proposta: null, validade_dias: null, contrato_meses_proposto: null, tributos: null, reajuste: null, desconto_explicito: null, exclusoes: null, observacoes: null };
}

/** Converte a resposta da leitura em rascunho válido. Dado ausente vira null ("não informado"). */
export function montarRascunho(bruto: unknown, ctx: Contexto, origem: "ia" | "manual" = "ia"): ConteudoRascunho {
  const b = obj(bruto);
  const descartados: string[] = [];
  const c = obj(b["cabecalho"]);
  const data = texto(c["data_proposta"]);
  const inteiro = (v: unknown) => { const n = numero(v); return n == null ? null : Math.round(n); };
  const cabecalho: Cabecalho = {
    data_proposta: data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
    validade_dias: inteiro(c["validade_dias"]),
    contrato_meses_proposto: inteiro(c["contrato_meses_proposto"]),
    tributos: texto(c["tributos"]), reajuste: texto(c["reajuste"]), desconto_explicito: texto(c["desconto_explicito"]),
    exclusoes: texto(c["exclusoes"]), observacoes: texto(c["observacoes"]),
  };
  const modPorCodigo = new Map(ctx.modulos.map((m) => [normCodigo(m.codigo), m.id]));

  const itens: ItemRascunho[] = [];
  for (const raw of arr(b["itens"])) {
    const i = obj(raw);
    const descricao = texto(i["descricao"], 500);
    if (!descricao) { descartados.push("Item sem descrição ignorado."); continue; }
    const avisos: string[] = [];
    const cod = normCodigo(i["modulo"] ?? i["modulo_codigo"]);
    const modulo_id = modPorCodigo.get(cod) ?? null;
    if (!modulo_id) avisos.push("Módulo não identificado");
    const tp = TIPOS_PRECO.find((x) => x === i["tipo_preco"]);
    if (!tp) avisos.push("Tipo de preço não informado");
    const un = UNIDADES.find((x) => x === i["unidade"]);
    if (!un) avisos.push("Unidade não informada");
    const valor_lista = numero(i["valor_lista"]);
    const valor_negociado = numero(i["valor_negociado"]);
    const valor_min = numero(i["valor_min"]);
    const valor_max = numero(i["valor_max"]);
    if (valor_lista == null && valor_negociado == null && valor_min == null && valor_max == null) avisos.push("Sem valor no documento");
    const fonte_pagina = texto(i["fonte_pagina"], 200);
    if (!fonte_pagina) avisos.push("Fonte/página não informada");
    const mult = numero(i["multiplicador"]);
    itens.push({
      descricao, modulo_id, tipo_preco: tp ?? "recorrente", unidade: un ?? "mes",
      valor_lista, valor_negociado, valor_min, valor_max,
      multiplicador: mult != null && mult > 0 ? mult : 1,
      incluido_no_subtotal_da_proposta: bool(i["incluido_no_subtotal"] ?? i["incluido_no_subtotal_da_proposta"], true),
      sujeito_desconto_lista: bool(i["sujeito_desconto_lista"], false),
      teto_verba_mensal: numero(i["teto_verba_mensal"]),
      incerteza: texto(i["incerteza"]), fonte_pagina,
      confianca: avisos.length || i["confianca"] === "baixa" ? "baixa" : "alta", avisos,
    });
  }

  const entregas: EntregaRascunho[] = [];
  for (const raw of arr(b["entregas"])) {
    const e = obj(raw);
    const cat = CATEGORIAS.find((x) => x === e["categoria"]);
    const q = numero(e["quantidade_mes"]);
    if (!cat || q == null || q < 0) { descartados.push(`Entrega sem categoria ou quantidade reconhecida: ${texto(e["observacao"], 120) ?? String(e["categoria"] ?? "?")}`); continue; }
    const fonte_pagina = texto(e["fonte_pagina"], 200);
    const avisos = fonte_pagina ? [] : ["Fonte/página não informada"];
    entregas.push({ categoria: cat, quantidade_mes: q, e_teto: bool(e["e_teto"], false), observacao: texto(e["observacao"], 500), fonte_pagina,
      confianca: avisos.length || e["confianca"] === "baixa" ? "baixa" : "alta", avisos });
  }

  const brutoCob = new Map(arr(b["coberturas"]).map((x) => [normCodigo(obj(x)["codigo"]), obj(x)]));
  const modulosCtx = new Set(ctx.modulos.map((m) => m.id));
  const coberturas: CoberturaRascunho[] = ctx.requisitos.filter((r) => modulosCtx.has(r.modulo_id)).map((r) => {
    const x = brutoCob.get(normCodigo(r.codigo)) ?? {};
    const n = numero(x["nivel"]);
    const nivel = n === 1 || n === 0.5 || n === 0 ? n : null;
    const trecho = texto(x["trecho"], 1000);
    const fonte_pagina = texto(x["fonte_pagina"], 200);
    const avisos: string[] = [];
    if (nivel != null && !trecho) avisos.push("Sem trecho-fonte");
    if (nivel != null && !fonte_pagina) avisos.push("Fonte/página não informada");
    if (n != null && nivel == null) avisos.push("Nível fora de 1 / 0,5 / 0");
    return {
      requisito_id: r.id, codigo: r.codigo, descricao: r.descricao, nivel,
      evidencia: nivel == null ? "nao_informado" : "declarado",
      trecho, fonte_pagina, confianca: avisos.length || x["confianca"] === "baixa" ? "baixa" : "alta", avisos,
    };
  });

  const pontos: PontoRascunho[] = [];
  for (const raw of arr(b["pontos"])) {
    const p = obj(raw);
    const t = texto(p["texto"], 2000);
    if (!t) continue;
    const sev = (["critico", "alto", "medio", "info"] as const).find((s) => s === p["severidade"]) ?? "medio";
    pontos.push({ severidade: sev, texto: t, acao_sugerida: texto(p["acao_sugerida"], 1000), fonte_pagina: texto(p["fonte_pagina"], 200), codigo: "LEITURA" });
  }
  const conteudo: ConteudoRascunho = { origem, cabecalho, itens, entregas, coberturas, pontos, descartados };
  conteudo.pontos = [...pontos, ...pontosCandidatos(conteudo, ctx.janelaMeses).filter((p) => !pontos.some((x) => x.texto === p.texto))];
  return conteudo;
}

/** Pontos candidatos por regra (verificáveis nos próprios campos do rascunho). */
export function pontosCandidatos(c: Pick<ConteudoRascunho, "cabecalho" | "itens">, janelaMeses: number): PontoRascunho[] {
  const r: PontoRascunho[] = [];
  const add = (severidade: PontoRascunho["severidade"], texto: string, acao: string) => r.push({ severidade, texto, acao_sugerida: acao, fonte_pagina: null, codigo: "REGRA" });
  const h = c.cabecalho;
  if (!h.data_proposta) add("medio", "Proposta sem data.", "Pedir a data por escrito.");
  if (h.validade_dias == null) add("medio", "Proposta sem validade.", "Pedir a validade por escrito.");
  if (h.contrato_meses_proposto != null && h.contrato_meses_proposto !== janelaMeses)
    add("alto", `Contrato de ${h.contrato_meses_proposto} meses, diferente da janela de ${janelaMeses} meses.`, "Confirmar o prazo ou o valor proporcional à janela.");
  const fora = c.itens.filter((i) => !i.incluido_no_subtotal_da_proposta);
  if (fora.length) add("alto", `Itens fora do subtotal da proposta: ${fora.map((i) => i.descricao).join("; ")}.`, "Confirmar se entram no preço final.");
  const semFinal = c.itens.filter((i) => i.valor_lista != null && i.valor_negociado == null);
  if (h.desconto_explicito && semFinal.length) add("alto", "Desconto declarado sem preço final por escrito em todos os itens.", "Pedir o preço final de cada item.");
  const porProduto = c.itens.filter((i) => i.unidade === "produto_mes" && i.multiplicador > 1);
  if (porProduto.length) add("medio", `Custo por produto que multiplica: ${porProduto.map((i) => i.descricao).join("; ")}.`, "Conferir o multiplicador com o número de produtos.");
  return r;
}

/** Rascunho para o fluxo manual (leitura desligada, arquivo não PDF ou falha). */
export function rascunhoManual(ctx: Contexto): ConteudoRascunho {
  return montarRascunho({}, ctx, "manual");
}

/** Linhas para as tabelas oficiais. Repete as travas: nunca "comprovado", dado ausente = não informado. */
export function linhasAprovacao(c: ConteudoRascunho, propostaId: string) {
  return {
    itens: c.itens.map(({ confianca: _c, avisos: _a, ...i }) => ({ ...i, proposta_id: propostaId })),
    entregas: c.entregas.map((e) => ({ proposta_id: propostaId, categoria: e.categoria, quantidade_mes: e.quantidade_mes, e_teto: e.e_teto,
      observacao: [e.observacao, e.fonte_pagina ? `Fonte: ${e.fonte_pagina}` : null].filter(Boolean).join(" · ") || null })),
    coberturas: c.coberturas.map((x) => ({
      proposta_id: propostaId, requisito_id: x.requisito_id, nivel: x.nivel,
      evidencia: x.nivel == null ? "nao_informado" : "declarado",
      fonte_pagina: x.fonte_pagina, nota_tecnica: x.trecho ? `Trecho: ${x.trecho}` : null,
    })),
    pontos: c.pontos.map((p) => ({ escopo: "proposta", referencia_id: propostaId, severidade: p.severidade, texto: p.texto,
      acao_sugerida: p.acao_sugerida, origem: "manual", regra_codigo: p.codigo })),
  };
}
