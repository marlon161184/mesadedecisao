import { describe, expect, it } from "vitest";
import { base } from "@/test/fixtura";
import { analisarRfp, premissasEfetivas } from "./equalizacao";
import { pontosAutomaticos } from "./pontos";

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
