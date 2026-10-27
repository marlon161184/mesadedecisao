/** Regras automáticas de pontos de atenção (nível proposta): P-01 a P-09. */
import type { AnaliseProposta } from "./equalizacao";
import type { Base } from "./base";
import type { Premissas } from "./calculo";

export type Severidade = "critico" | "alto" | "medio" | "info";

export interface Ponto {
  id: string;
  codigo: string | null;
  origem: "regra" | "manual";
  severidade: Severidade;
  texto: string;
  acao: string;
  pergunta: string;
  propostaId: string | null;
  playerNome: string | null;
  moduloId: string | null;
}

export const ORDEM_SEV: Record<Severidade, number> = { critico: 0, alto: 1, medio: 2, info: 3 };
export const ROTULO_SEV: Record<Severidade, string> = { critico: "Crítico", alto: "Alto", medio: "Médio", info: "Info" };

export function pontosAutomaticos(a: AnaliseProposta, p: Premissas): Ponto[] {
  const out: Ponto[] = [];
  const nome = a.player.nome;
  const add = (codigo: string, severidade: Severidade, texto: string, acao: string, pergunta: string, moduloId: string | null = null, sufixo = "") =>
    out.push({ id: `${codigo}-${a.proposta.id}${sufixo}`, codigo, origem: "regra", severidade, texto, acao, pergunta, propostaId: a.proposta.id, playerNome: nome, moduloId });

  const c = a.proposta.contrato_meses_proposto;
  if (c && c > p.janela_meses)
    add("P-01", "alto", `${nome} propõe contrato de ${c} meses, maior que a janela de ${p.janela_meses}.`,
      "Comparar pelo compromisso total e negociar saída ao fim da janela.",
      `É possível contratar por ${p.janela_meses} meses, com as mesmas condições?`);

  const temDesconto = !!a.proposta.desconto_explicito ||
    a.itens.some(({ item }) => item.valor_negociado != null && item.valor_lista != null && item.valor_negociado < item.valor_lista) ||
    a.itens.some(({ item }) => item.sujeito_desconto_lista);
  if (temDesconto)
    add("P-02", "medio", `${nome} aplica desconto explícito sobre a lista. O preço real depende de confirmação por escrito.`,
      "Pedir confirmação por escrito do preço final com desconto.",
      "Vocês confirmam por escrito o preço final com desconto e o prazo em que ele vale?");

  for (const { item } of a.itens) {
    if ((item.valor_min != null && item.valor_max != null) || /a partir de/i.test(item.incerteza ?? "") || /a partir de/i.test(item.descricao))
      add("P-03", "medio", `${nome} · ${item.descricao}: valor em faixa ou "a partir de".`,
        "Pedir valor fechado para o escopo-base.",
        `Qual o valor fechado de "${item.descricao}" para o nosso escopo-base?`, item.modulo_id, `-${item.id}`);
    if (!item.incluido_no_subtotal_da_proposta)
      add("P-09", "medio", `${nome} · ${item.descricao}: item fora do subtotal da proposta.`,
        "Somar ao total equalizado e confirmar se é obrigatório.",
        `O item "${item.descricao}" é obrigatório? Por que está fora do subtotal?`, item.modulo_id, `-${item.id}`);
  }

  if (a.validadeDias != null && a.validadeDias <= 10)
    add("P-04", "critico", a.validadeDias < 0 ? `A proposta de ${nome} está vencida.` : `A proposta de ${nome} vence em ${a.validadeDias} dias.`,
      "Pedir prorrogação da validade por escrito.",
      "Vocês podem prorrogar a validade da proposta por mais 30 dias?");

  for (const { requisito, cobertura } of a.bloqueios) {
    const naoInformado = !cobertura || cobertura.nivel == null;
    if (requisito.eliminatorio && naoInformado) {
      add("P-07", "critico", `${nome} · ${requisito.codigo} ${requisito.descricao}: requisito eliminatório não informado.`,
        "Exigir resposta antes de qualquer pontuação.",
        `Como a proposta atende a "${requisito.descricao}"? Peço evidência.`, requisito.modulo_id, `-${requisito.id}`);
    } else {
      add("P-06", requisito.eliminatorio ? "critico" : "alto", `${nome} · ${requisito.codigo} ${requisito.descricao}: essencial não coberto.`,
        "Estimar custo para cobrir ou buscar outro player para o módulo.",
        `Vocês conseguem cobrir "${requisito.descricao}"? Com qual custo adicional?`, requisito.modulo_id, `-${requisito.id}`);
    }
  }

  if (a.custoUnitario && a.custoUnitario.porCategoria.some((c) => c.entregue < c.base))
    add("P-08", "medio", `${nome} entrega volume abaixo do volume-base em ${a.custoUnitario.porCategoria.filter((c) => c.entregue < c.base).length} categoria(s).`,
      "Comparar pelo custo unitário normalizado, não pelo preço.",
      "Qual o custo para atingir o nosso volume-base mensal em todas as categorias?");

  return out;
}

export function pontosManuais(base: Base, analises: AnaliseProposta[]): Ponto[] {
  const porId = new Map(analises.map((a) => [a.proposta.id, a]));
  const modIds = new Set(analises.flatMap((a) => a.modulos.map((m) => m.modulo.id)));
  return base.pontos
    .filter((p) => (p.escopo === "proposta" ? porId.has(p.referencia_id ?? "") : p.escopo === "modulo" ? modIds.has(p.referencia_id ?? "") : true))
    .map((p) => {
      const a = p.escopo === "proposta" ? porId.get(p.referencia_id ?? "") : undefined;
      return {
        id: p.id,
        codigo: p.regra_codigo,
        origem: "manual" as const,
        severidade: p.severidade as Severidade,
        texto: p.texto,
        acao: p.acao_sugerida ?? "Discutir com o proponente.",
        pergunta: p.texto,
        propostaId: a?.proposta.id ?? null,
        playerNome: a?.player.nome ?? null,
        moduloId: p.escopo === "modulo" ? p.referencia_id : null,
      };
    });
}
