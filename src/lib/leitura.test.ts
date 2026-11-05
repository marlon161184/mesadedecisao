import { describe, expect, it } from "vitest";
import { base as fixtura } from "@/test/fixtura";
import type { Base } from "./base";
import { analisarRfp, premissasEfetivas } from "./equalizacao";
import { pontosAutomaticos } from "./pontos";
import { formatarBRL } from "./formato";
import { leituraDecisao, leituraVisao, ressalvas, textosRessalvas, RODAPE_ESTIMADO, type EstadoDecisao } from "./leitura";
import { montarApresentacao, paginar, LINHAS_POR_SLIDE, MAX_TOPICOS } from "./apresentacao";
import { validarFiltros } from "./filtros";

function baseProvisoria(): Base {
  const b = structuredClone(fixtura) as Base;
  b.propostas = b.propostas.map((p) => (p.player_id === "Rebu" ? { ...p, fonte_arquivo: "Estimativa interna" } : p));
  b.itens = b.itens.map((i) => (i.descricao === "Fee" ? { ...i, incerteza: "AVISO: valor adotado no máximo da faixa" } : i));
  b.coberturas = [{ id: "c1", proposta_id: "p-XCV/WiVO", requisito_id: "q31", nivel: 1, evidencia: "declarado", trecho_fonte: null, pagina: null, custo_estimado_para_cobrir: null } as never];
  return b;
}

describe("ressalvas", () => {
  it("marca estimativa interna, itens com AVISO e cobertura só declarada", () => {
    const b = baseProvisoria();
    const r = ressalvas(b, b.propostas.map((p) => p.id));
    expect(r.estimativas.map((e) => e.player)).toEqual(["Rebu"]);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]!.player).toBe("Folhetim");
    expect(r.soDeclarada).toEqual(["XCV/WiVO"]);
    expect(textosRessalvas(r)[0]).toContain(RODAPE_ESTIMADO);
  });
  it("só considera as propostas da tela", () => {
    const b = baseProvisoria();
    expect(ressalvas(b, ["p-F&MD"]).estimativas).toHaveLength(0);
  });
});

describe("leitura da Visão geral", () => {
  it("cita a mais barata com o valor calculado, não digitado", () => {
    const b = baseProvisoria();
    const f = validarFiltros({ rfp: 2 });
    const p = premissasEfetivas(b, f);
    const as = analisarRfp(b, 2, { filtros: f, premissas: p });
    const barata = [...as].sort((x, y) => x.total.central - y.total.central)[0]!;
    const l = leituraVisao(b, "RFP 2", as, as.flatMap((a) => pontosAutomaticos(a, p)), p);
    expect(l.frases.join(" ")).toContain(`${barata.player.nome}`);
    expect(l.frases.join(" ")).toContain(formatarBRL(barata.total.central));
    expect(l.frases.length).toBeLessThanOrEqual(6);
    expect(l.topicos.length).toBeLessThanOrEqual(4);
  });
  it("muda quando o preço muda", () => {
    const b = baseProvisoria();
    const f = validarFiltros({ rfp: 2 });
    const p = premissasEfetivas(b, f);
    const antes = leituraVisao(b, "RFP 2", analisarRfp(b, 2, { filtros: f, premissas: p }), [], p).frases.join(" ");
    b.itens = b.itens.map((i) => (i.descricao === "Fee" ? { ...i, valor_lista: 1 } : i));
    const depois = leituraVisao(b, "RFP 2", analisarRfp(b, 2, { filtros: f, premissas: p }), [], p).frases.join(" ");
    expect(depois).not.toBe(antes);
  });
});

describe("leitura da Decisão", () => {
  const e: EstadoDecisao = { rfpNome: "RFP 2", criterios: 5, portoes: 3, portoesPendentes: 1, perguntasPendentes: 2, naoValidadas: 0, pontuacaoAberta: true, revelado: false, votacaoAberta: false, votacaoEncerrada: false, enviaram: 1, socios: 2 };
  it("antes da revelação diz que as notas seguem ocultas e só mostra contagens", () => {
    const t = leituraDecisao(e).frases.join(" ");
    expect(t).toContain("pontuação cega aberta");
    expect(t).toContain("1 de 2 sócios");
    expect(t).toContain("ocultas");
  });
});

describe("apresentação", () => {
  it("pagina em blocos de 6", () => {
    expect(paginar(Array.from({ length: 13 }, (_, i) => i)).map((x) => x.length)).toEqual([6, 6, 1]);
  });
  it("monta slides com capa, resumo no início e limites por slide", () => {
    const b = baseProvisoria();
    const s = montarApresentacao({ base: b, filtros: validarFiltros({}) });
    expect(s[0]!.tipo).toBe("capa");
    expect(s.slice(0, 4).some((x) => x.id === "resumo")).toBe(true);
    for (const x of s) {
      expect(x.tabela?.linhas.length ?? 0).toBeLessThanOrEqual(LINHAS_POR_SLIDE);
      expect(x.topicos?.length ?? 0).toBeLessThanOrEqual(MAX_TOPICOS);
    }
    expect(s.some((x) => x.id.startsWith("admin"))).toBe(false);
  });
  it("mostra o rodapé de estimativa onde aparece o número da Rebu", () => {
    const s = montarApresentacao({ base: baseProvisoria(), filtros: validarFiltros({}) });
    const rebu = s.find((x) => x.id === "agencia-Rebu")!;
    expect(rebu.titulo).toContain("estimado");
    expect(rebu.rodape.join(" ")).toContain(RODAPE_ESTIMADO);
    const visao1 = s.find((x) => x.id === "visao-1-0")!;
    expect(visao1.rodape.join(" ")).toContain(RODAPE_ESTIMADO);
  });
});
