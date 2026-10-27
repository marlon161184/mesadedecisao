import type { Base, Item } from "@/lib/base";

// Espelho dos dados iniciais carregados no banco (itens de preço).
const rfps = [1, 2].map((n) => ({ id: `r${n}`, numero: n, nome: "", fase: 1, periodo: "", status: "", descricao: null, janela_meses: 6 }));
const mod = (codigo: string, rfp: string) => ({ id: codigo, rfp_id: rfp, codigo, nome: codigo, descricao: null, peso_no_rfp: 25, essencial: false, entrega_chave: null });
const modulos = [{ ...mod("C3", "r1"), essencial: true }, mod("C4", "r1"), mod("P1", "r2"), mod("P2", "r2"), mod("P3", "r2"), mod("P4", "r2")];
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
  sujeito_desconto_lista: false, premissa_imputacao: null, cronograma_pagamento: null, teto_verba_mensal: null, ...o,
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
  novo("F&MD", "P4", "Site", "pontual", 15000),
  novo("F&MD", "P4", "Landing page", "pontual", 6000),
  novo("F&MD", "P4", "3 landing pages de pesquisa", "pontual", 18000),
];

export const base = {
  rfps, modulos, players, propostas, itens, requisitos: [
    { id: "q31", modulo_id: "P3", codigo: "Q3.1", descricao: "Portabilidade", peso: 5, criticidade: "essencial", eliminatorio: true, fonte: null },
  ], entregas: [], coberturas: [], pontos: [], comentarios: [], perguntas: [],
  respostas: [], criterios: [], portoes: [], portaoResultados: [], checklist: [], perfis: [], cenarios: [], cenarioModulos: [], cenarioVersoes: [], cenarioComentarios: [],
  premissas: [{ chave: "imputacao_rebu_c3", valor: 0.5, descricao: null }],
} as unknown as Base;

