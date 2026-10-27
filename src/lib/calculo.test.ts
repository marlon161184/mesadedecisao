import { describe, expect, it } from "vitest";
import {
  PREMISSAS_PADRAO as P,
  coberturaModulo,
  coberturaRfp,
  compromissoContrato,
  custoAjustado,
  custoRecorrenteMensal,
  custoUnitarioNormalizado,
  eficiencia,
  essenciaisNaoCobertos,
  lerPremissas,
  totalPorModulo,
  totalProposta,
  valorItemNaJanela,
  type ItemCalculo,
} from "./calculo";

const rec = (o: Partial<ItemCalculo> = {}): ItemCalculo => ({
  tipo_preco: "recorrente",
  unidade: "mes",
  valor_lista: 10000,
  valor_negociado: null,
  ...o,
});

describe("R1 · valor do item na janela", () => {
  it("recorrente usa negociado × multiplicador × 6 meses", () => {
    expect(valorItemNaJanela(rec({ valor_negociado: 8000, multiplicador: 2 }), P).central).toBe(96000);
  });
  it("recorrente usa lista quando aplicar_desconto_negociado é falso", () => {
    const p = { ...P, aplicar_desconto_negociado: false };
    expect(valorItemNaJanela(rec({ valor_negociado: 8000 }), p).central).toBe(60000);
  });
  it("pontual vale o próprio valor", () => {
    expect(valorItemNaJanela(rec({ tipo_preco: "pontual", unidade: "projeto", valor_lista: 30000 }), P).central).toBe(30000);
  });
  it("variável: 12% × 50.000 × 6 = 36.000 para a Folhetim", () => {
    const i = rec({ tipo_preco: "variavel", unidade: "percentual_verba", valor_lista: null });
    expect(valorItemNaJanela(i, P, { nome: "Folhetim" }).central).toBe(36000);
  });
  it("variável: 20% × 50.000 × 6 = 60.000 para a F&MD", () => {
    const i = rec({ tipo_preco: "variavel", unidade: "percentual_verba", valor_lista: null });
    expect(valorItemNaJanela(i, P, { nome: "F&MD" }).central).toBe(60000);
  });
  it("por produto/mês: valor × 3 produtos × 6 meses", () => {
    expect(valorItemNaJanela(rec({ unidade: "produto_mes", valor_lista: 1000 }), P).central).toBe(18000);
  });
  it("faixa min/max devolve média, mínimo e máximo", () => {
    const f = valorItemNaJanela(rec({ valor_min: 1000, valor_max: 3000 }), P);
    expect(f).toEqual({ central: 12000, min: 6000, max: 18000, eFaixa: true });
  });
  it("XCV: desconto de 50% só em recorrente de lista", () => {
    expect(valorItemNaJanela(rec(), P, { nome: "XCV/WiVO" }).central).toBe(30000);
    expect(valorItemNaJanela(rec({ tipo_preco: "pontual", unidade: "projeto" }), P, { nome: "XCV/WiVO" }).central).toBe(10000);
  });
});

describe("R2 · compromisso do contrato", () => {
  it("contrato de 12 meses mostra o compromisso total", () => {
    expect(compromissoContrato([rec()], 12, P)?.central).toBe(120000);
  });
  it("contrato igual à janela não gera compromisso extra", () => {
    expect(compromissoContrato([rec()], 6, P)).toBeNull();
  });
});

describe("R3 · totais", () => {
  it("soma itens da proposta e agrupa por módulo", () => {
    const itens = [rec({ modulo_id: "a" }), rec({ tipo_preco: "pontual", unidade: "projeto", valor_lista: 5000, modulo_id: "b" })];
    expect(totalProposta(itens, P).central).toBe(65000);
    const m = totalPorModulo(itens, P);
    expect(m.a.central).toBe(60000);
    expect(m.b.central).toBe(5000);
  });
});

describe("R4 · custo unitário normalizado", () => {
  it("divide o custo mensal pelas peças-base equivalentes e rotula teto", () => {
    const custo = custoRecorrenteMensal([rec({ valor_lista: 15000 })], P);
    const r = custoUnitarioNormalizado(
      custo,
      [
        { categoria: "posts_instagram", quantidade_mes: 12, e_teto: true },
        { categoria: "videos_sociais", quantidade_mes: 2, e_teto: false },
      ],
      P,
    );
    expect(r.volumeBase).toBe(37);
    expect(r.volumeEntregue).toBe(14);
    expect(r.pecasEquivalentes).toBe(10); // 8 (limitado à base) + 2
    expect(r.custoPorPeca).toBe(1500);
    expect(r.rotuloTeto).toBe(true);
  });
});

describe("R5 · cobertura", () => {
  const reqs = [
    { id: "r1", peso: 5, criticidade: "essencial" as const },
    { id: "r2", peso: 3, criticidade: "desejavel" as const },
    { id: "r3", peso: 2, criticidade: "desejavel" as const },
  ];
  const cobs = [
    { requisito_id: "r1", nivel: 1, evidencia: "comprovado" as const },
    { requisito_id: "r2", nivel: 0.5, evidencia: "declarado" as const },
    { requisito_id: "r3", nivel: null, evidencia: "nao_informado" as const },
  ];
  it("conservadora conta não informado como 0; otimista exclui do denominador", () => {
    const c = coberturaModulo(reqs, cobs, P);
    expect(c.conservadora).toBeCloseTo(6.5 / 10);
    expect(c.otimista).toBeCloseTo(6.5 / 8);
  });
  it("fator de evidência 70% reduz requisitos declarados", () => {
    const c = coberturaModulo(reqs, cobs, { ...P, fator_evidencia_declarado: 0.7 });
    expect(c.conservadora).toBeCloseTo((5 + 3 * 0.5 * 0.7) / 10);
  });
  it("cobertura do RFP pondera por peso_no_rfp", () => {
    const r = coberturaRfp([
      { peso_no_rfp: 3, cobertura: { conservadora: 1, otimista: 1 } },
      { peso_no_rfp: 1, cobertura: { conservadora: 0, otimista: null } },
    ]);
    expect(r.conservadora).toBe(0.75);
    expect(r.otimista).toBe(1);
  });
});

describe("R6 · essenciais não cobertos", () => {
  it("lista essenciais com nível 0, nulo ou sem registro", () => {
    const reqs = [
      { id: "a", peso: 5, criticidade: "essencial" as const },
      { id: "b", peso: 5, criticidade: "essencial" as const },
      { id: "c", peso: 5, criticidade: "essencial" as const },
      { id: "d", peso: 5, criticidade: "desejavel" as const },
    ];
    const r = essenciaisNaoCobertos(reqs, [
      { requisito_id: "a", nivel: 0, evidencia: "declarado" },
      { requisito_id: "b", nivel: 0.5, evidencia: "declarado" },
    ]);
    expect(r.map((x) => x.requisito.id)).toEqual(["a", "c"]);
  });
});

describe("R7 · custo ajustado ao escopo", () => {
  it("soma o custo estimado para cobrir essenciais, separado do preço", () => {
    const r = custoAjustado(100000, [
      { cobertura: { requisito_id: "a", nivel: 0, evidencia: "declarado", custo_estimado_para_cobrir: 20000 } },
      { cobertura: null },
    ]);
    expect(r).toEqual({ precoProposta: 100000, acrescimo: 20000, ajustado: 120000, semEstimativa: 1 });
  });
});

describe("R8 · eficiência", () => {
  it("80% de cobertura por R$ 200 mil = 40 pontos por R$ 100 mil", () => {
    expect(eficiencia(0.8, 200000)).toBe(40);
  });
  it("custo zero não gera eficiência", () => {
    expect(eficiencia(0.8, 0)).toBeNull();
  });
});

describe("premissas", () => {
  it("lê valores do banco com padrão para os ausentes", () => {
    const p = lerPremissas([
      { chave: "janela_meses", valor: 12 },
      { chave: "aplicar_desconto_negociado", valor: false },
    ]);
    expect(p.janela_meses).toBe(12);
    expect(p.aplicar_desconto_negociado).toBe(false);
    expect(p.verba_midia_mensal).toBe(50000);
  });
});
