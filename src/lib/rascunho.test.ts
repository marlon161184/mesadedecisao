import { describe, expect, it } from "vitest";
import {
  caminhoArquivo, conteudoSchema, linhasAprovacao, montarRascunho, pontosCandidatos, proximaCor, rascunhoManual,
  sanearNome, validarArquivo, versaoSugerida, TAMANHO_MAX,
} from "./rascunho";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctx = {
  modulos: [{ id: U(1), codigo: "P1" }, { id: U(2), codigo: "P2" }, { id: U(3), codigo: "P3" }, { id: U(4), codigo: "P4" }],
  requisitos: [
    { id: U(11), codigo: "Q1.1", descricao: "Gestão de redes", modulo_id: U(1) },
    { id: U(12), codigo: "Q1.2", descricao: "Vídeos", modulo_id: U(1) },
    { id: U(41), codigo: "Q4.4", descricao: "CRM", modulo_id: U(4) },
  ],
  janelaMeses: 6,
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

describe("arquivo", () => {
  it("aceita PDF e Office até 20 MB, recusa o resto", () => {
    expect(validarArquivo("p.pdf", 100, PDF)).toEqual({ ok: true, tipo: "pdf" });
    expect(validarArquivo("p.docx", 100, ZIP)).toEqual({ ok: true, tipo: "docx" });
    expect(validarArquivo("p.pdf", TAMANHO_MAX + 1, PDF).ok).toBe(false);
    expect(validarArquivo("p.exe", 100, PDF).ok).toBe(false);
    expect(validarArquivo("falso.pdf", 100, ZIP).ok).toBe(false);
  });
  it("saneia nome e monta caminho propostas/{id}/v{versao}/{uuid}", () => {
    expect(sanearNome("../../x/Proposta <Rebu>.pdf")).toBe("Proposta Rebu.pdf");
    expect(caminhoArquivo("abc", 5, "u1", "pdf")).toBe("abc/v5/u1.pdf");
  });
  it("versão sugerida = última + 1; agência nova = 1", () => {
    const ps = [{ player_id: "rebu", versao: 4 }, { player_id: "rebu", versao: 5 }];
    expect(versaoSugerida(ps, "rebu")).toBe(6);
    expect(versaoSugerida(ps, null)).toBe(1);
  });
  it("cor da agência nova: terra-vermelha, depois cinzas quentes", () => {
    expect(proximaCor([{ cor_token: "flamboyant" }])).toBe("terra-vermelha");
    expect(proximaCor([{ cor_token: "terra-vermelha" }])).toBe("cinza-quente-1");
  });
});

describe("montagem do rascunho", () => {
  const bruto = {
    cabecalho: { data_proposta: "2026-11-03", validade_dias: "30", contrato_meses_proposto: 12, tributos: "não informado" },
    itens: [
      { descricao: "Gestão de redes", modulo: "p1", tipo_preco: "recorrente", unidade: "mes", valor_lista: "R$ 12.500,00", fonte_pagina: "p. 4" },
      { descricao: "Produção extra", modulo: "X9", tipo_preco: "??", unidade: "mes", incluido_no_subtotal: false },
      { descricao: "" },
    ],
    entregas: [{ categoria: "posts_instagram", quantidade_mes: 12, e_teto: true, fonte_pagina: "p. 5" }, { categoria: "podcast", quantidade_mes: 2 }],
    coberturas: [
      { codigo: "Q1.1", nivel: 1, trecho: "gestão completa", fonte_pagina: "p. 4", evidencia: "comprovado" },
      { codigo: "Q1.2", nivel: 0.7 },
    ],
  };
  const r = montarRascunho(bruto, ctx);

  it("mapeia módulos P1–P4 e requisitos Q pelo código", () => {
    expect(r.itens[0]!.modulo_id).toBe(U(1));
    expect(r.itens[0]!.valor_lista).toBe(12500);
    expect(r.itens[1]!.modulo_id).toBeNull();
    expect(r.itens[1]!.confianca).toBe("baixa");
    expect(r.coberturas.map((c) => c.requisito_id)).toEqual([U(11), U(12), U(41)]);
  });
  it("dado ausente vira não informado (null)", () => {
    expect(r.cabecalho.tributos).toBeNull();
    expect(r.cabecalho.validade_dias).toBe(30);
    expect(r.itens[1]!.valor_lista).toBeNull();
    expect(r.coberturas[1]!.nivel).toBeNull(); // 0,7 não é nível válido
    expect(r.coberturas[2]).toMatchObject({ nivel: null, evidencia: "nao_informado" });
    expect(r.itens).toHaveLength(2);
    expect(r.entregas).toHaveLength(1);
    expect(r.descartados.length).toBe(2);
  });
  it("nunca marca comprovado", () => {
    expect(r.coberturas[0]!.evidencia).toBe("declarado");
    const sujo = { ...r, coberturas: r.coberturas.map((c) => ({ ...c, evidencia: "comprovado" })) };
    expect(conteudoSchema.safeParse(sujo).success).toBe(false);
    const linhas = linhasAprovacao(r, U(99));
    expect(linhas.coberturas.every((c) => c.evidencia !== "comprovado")).toBe(true);
  });
  it("gera pontos candidatos por regra", () => {
    const textos = r.pontos.map((p) => p.texto).join(" ");
    expect(textos).toContain("12 meses, diferente da janela de 6 meses");
    expect(textos).toContain("fora do subtotal");
    const vazio = pontosCandidatos(rascunhoManual(ctx), 6).map((p) => p.texto);
    expect(vazio).toEqual(["Proposta sem data.", "Proposta sem validade."]);
  });
  it("fluxo manual: todos os requisitos como não informado", () => {
    const m = rascunhoManual(ctx);
    expect(m.origem).toBe("manual");
    expect(m.itens).toEqual([]);
    expect(m.coberturas.every((c) => c.nivel === null && c.evidencia === "nao_informado")).toBe(true);
  });
});
