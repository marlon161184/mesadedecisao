import { describe, expect, it } from "vitest";
import type { Base, Item } from "./base";
import { analisarRfp, premissasEfetivas } from "./equalizacao";
import { pontosAutomaticos } from "./pontos";

// Espelho dos dados iniciais carregados no banco (itens de preço).
const rfps = [1, 2].map((n) => ({ id: `r${n}`, numero: n, nome: "", fase: 1, periodo: "", status: "", descricao: null, janela_meses: 6 }));
const mod = (codigo: string, rfp: string) => ({ id: codigo, rfp_id: rfp, codigo, nome: codigo, descricao: null, peso_no_rfp: 25, essencial: false, entrega_chave: null });
const modulos = [mod("C3", "r1"), mod("C4", "r1"), mod("P1", "r2"), mod("P2", "r2"), mod("P3", "r2"), mod("P4", "r2")];
const player = (nome: string, rfps: number[]) => ({ id: nome, nome, tipo: "agencia", cidade: null, cor_token: null, observacoes: null, status: "proponente", rfp_numeros: rfps });
const players = [player("Rebu", [1]), player("Folhetim", [2]), player("XCV/WiVO", [1, 2]), player("F&MD", [2])];
const proposta = (pl: string, contrato: number) => ({
  id: `p-${pl}`, player_id: pl, versao: 1, data_proposta: null, validade_dias: null, validade_ate: null, contrato_meses_proposto: contrato,
  fonte_arquivo: null, status: "recebida", observacoes: null, tributos: null, desconto_explicito: null, reajuste: null, exclusoes: null,
});
const propostas = [proposta("Rebu", 12), proposta("Folhetim", 6), proposta("XCV/WiVO", 6), proposta("F&MD", 12)];

let n = 0;
const novo = (pl: string, m: string, descricao: string, tipo: string, lista: number | null, o: Partial<Item> = {}): Item => ({
  id: `i${n++}`, proposta_id: `p-${pl}`, modulo_id: m, descricao, tipo_preco: tipo, valor_lista: lista, valor_negociado: null,
  valor_min: null, valor_max: null, unidade: tipo === "recorrente" ? "mes" : tipo === "variavel" ? "percentual_verba" : "projeto",
  multiplicador: 1, incluido_no_subtotal_da_proposta: true, incerteza: null, fonte_pagina: null, entrega_chave: null,
  sujeito_desconto_lista: false, premissa_imputacao: null, ...o,
});
const xcv = { sujeito_desconto_lista: true };
const itens: Item[] = [
  novo("Rebu", "C4", "Fotos e vídeos", "pontual", 300000),
  novo("Rebu", "C4", "Manifesto", "pontual", 45000),
  novo("Rebu", "C3", "Consultoria 12 meses", "pontual", 200000, { premissa_imputacao: "imputacao_rebu_c3" }),
  novo("Folhetim", "P1", "Fee", "recorrente", 55000),
  novo("Folhetim", "P2", "Gestão de mídia", "variavel", 0.12),
  novo("Folhetim", "P4", "Site", "pontual", null, { valor_min: 40000, valor_max: 70000 }),
  novo("XCV/WiVO", "P1", "Estratégia", "recorrente", 15256.39, xcv),
  novo("XCV/WiVO", "P1", "Gestão", "recorrente", 11500, xcv),
  novo("XCV/WiVO", "P1", "Social", "recorrente", 9980, xcv),
  novo("XCV/WiVO", "P1", "Sales", "recorrente", 6500, xcv),
  novo("XCV/WiVO", "P1", "Offline", "recorrente", 15000, xcv),
  novo("XCV/WiVO", "P2", "Tráfego", "recorrente", 6000, xcv),
  novo("XCV/WiVO", "P3", "MarTech", "recorrente", 10000, xcv),
  novo("XCV/WiVO", "P3", "CS setup", "pontual", 3500, { incluido_no_subtotal_da_proposta: false }),
  novo("XCV/WiVO", "P3", "CS mensalidade a partir de", "recorrente", 1500, { incluido_no_subtotal_da_proposta: false }),
  novo("XCV/WiVO", "C4", "Hero", "pontual", 144285.71, { valor_negociado: 129066.67 }),
  novo("XCV/WiVO", "C4", "Manifesto 180 s", "pontual", 125000, { valor_negociado: 109000 }),
  novo("XCV/WiVO", "P4", "Site e agente", "pontual", 85000, { valor_negociado: 51000 }),
  novo("F&MD", "P1", "Day by day", "recorrente", 14331.67),
  novo("F&MD", "P1", "Social Meta", "recorrente", 8320),
  novo("F&MD", "P1", "LinkedIn", "recorrente", 2240),
  novo("F&MD", "P2", "Squad", "recorrente", 3350, { unidade: "produto_mes" }),
  novo("F&MD", "P2", "Comissão", "variavel", 0.2),
];

const base = {
  rfps, modulos, players, propostas, itens, requisitos: [], entregas: [], coberturas: [], pontos: [], comentarios: [], perguntas: [],
  respostas: [], criterios: [], portoes: [], portaoResultados: [], checklist: [], perfis: [],
  premissas: [{ chave: "imputacao_rebu_c3", valor: 0.5, descricao: null }],
} as unknown as Base;

const premissas = premissasEfetivas(base, {});
const modTotal = (rfp: number, player: string, m: string) =>
  analisarRfp(base, rfp, { filtros: {}, premissas }).find((a) => a.player.nome === player)!.modulos.find((x) => x.modulo.codigo === m)!.total!.central;

describe("totais conferidos: janela 6, negociado, verba 50 mil, 3 produtos", () => {
  it("Folhetim P1 = 330.000", () => expect(modTotal(2, "Folhetim", "P1")).toBeCloseTo(330000, 2));
  it("XCV P1 = 174.709,17", () => expect(modTotal(2, "XCV/WiVO", "P1")).toBeCloseTo(174709.17, 2));
  it("F&MD P1 = 149.350,02", () => expect(modTotal(2, "F&MD", "P1")).toBeCloseTo(149350.02, 2));
  it("XCV P2 = 18.000", () => expect(modTotal(2, "XCV/WiVO", "P2")).toBeCloseTo(18000, 2));
  it("F&MD P2 = 120.300 (60.300 squad + 60.000 comissão)", () => expect(modTotal(2, "F&MD", "P2")).toBeCloseTo(120300, 2));
  it("XCV P3 = 30.000 + Customer Services 12.500", () => expect(modTotal(2, "XCV/WiVO", "P3")).toBeCloseTo(42500, 2));
  it("Rebu C3 = 100.000", () => expect(modTotal(1, "Rebu", "C3")).toBeCloseTo(100000, 2));
  it("Rebu C4 = 345.000", () => expect(modTotal(1, "Rebu", "C4")).toBeCloseTo(345000, 2));
  it("XCV C4 = 238.066,67", () => expect(modTotal(1, "XCV/WiVO", "C4")).toBeCloseTo(238066.67, 2));
  it("Rebu: compromisso do contrato de 12 meses conta a consultoria inteira (545.000)", () => {
    const a = analisarRfp(base, 1, { filtros: {}, premissas }).find((x) => x.player.nome === "Rebu")!;
    expect(a.compromisso?.central).toBeCloseTo(545000, 2);
  });
  it("ocultar variáveis tira a comissão da F&MD do P2", () => {
    const a = analisarRfp(base, 2, { filtros: { semVariaveis: true }, premissas }).find((x) => x.player.nome === "F&MD")!;
    expect(a.modulos.find((m) => m.modulo.codigo === "P2")!.total!.central).toBeCloseTo(60300, 2);
  });
  it("preço de lista sem desconto: XCV P1 = 349.418,34", () => {
    const p = premissasEfetivas(base, { preco: "lista" });
    const a = analisarRfp(base, 2, { filtros: {}, premissas: p }).find((x) => x.player.nome === "XCV/WiVO")!;
    expect(a.modulos.find((m) => m.modulo.codigo === "P1")!.total!.central).toBeCloseTo(349418.34, 2);
  });
});

describe("pontos de atenção automáticos", () => {
  it("P-01 para contrato de 12 meses e P-09 para item fora do subtotal", () => {
    const as = analisarRfp(base, 2, { filtros: {}, premissas });
    const fmd = pontosAutomaticos(as.find((a) => a.player.nome === "F&MD")!, premissas);
    expect(fmd.some((p) => p.codigo === "P-01" && p.severidade === "alto")).toBe(true);
    const x = pontosAutomaticos(as.find((a) => a.player.nome === "XCV/WiVO")!, premissas);
    expect(x.filter((p) => p.codigo === "P-09")).toHaveLength(2);
    expect(x.some((p) => p.codigo === "P-03")).toBe(true);
    expect(x.some((p) => p.codigo === "P-02")).toBe(true);
  });
});
