// Conteúdo estático redigido (pareceres e RFPs). Os JSON em src/data são copiados sem alteração.
import type pareceresJson from "@/data/pareceres.json";
import { useSyncExternalStore } from "react";

export type Bloco =
  | { tipo: "p" | "destaque"; texto: string }
  | { tipo: "ul" | "ol"; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };
export type Secao = { id: string; titulo: string; blocos: Bloco[] };
export type Rfp = { numero: number; slug: string; titulo: string; subtitulo: string; versao: string; resumo: string; secoes: Secao[] };

export type Fornecedor = (typeof pareceresJson)["fornecedores"][number];
export type Pareceres = typeof pareceresJson;
export type ConteudoDocumentos = { pareceres: Pareceres; fornecedores: Fornecedor[]; rfps: Rfp[] };

export const ROTULO_RFP: Record<number, string> = {
  1: "RFP 1 · Custódia",
  2: "RFP 2 · Criativo, dados, performance e CRM",
  3: "RFP 3 · Comercial",
};

/** Classe de cor do token do fornecedor (flamboyant, verde-cerrado, ipe-do-cerrado, terracota). */
export const COR: Record<string, { bg: string; border: string }> = {
  flamboyant: { bg: "bg-flamboyant", border: "border-flamboyant" },
  "verde-cerrado": { bg: "bg-verde-cerrado", border: "border-verde-cerrado" },
  "ipe-do-cerrado": { bg: "bg-ipe", border: "border-ipe" },
  terracota: { bg: "bg-terracota", border: "border-terracota" },
};

export const pesoDe = (pareceres: Pareceres, nome: string) => pareceres.metodo.componentes.find((c) => c.nome === nome)?.peso;
export const umaCasa = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Colunas de selo nas tabelas de requisitos. */
export function seloCelula(coluna: string, valor: string): "Eliminatório" | "Essencial" | null {
  const c = coluna.trim().toLowerCase();
  if ((c === "elim." || c === "eliminatório") && valor.trim() === "Sim") return "Eliminatório";
  if (c === "criticidade" && valor.trim() === "Essencial") return "Essencial";
  return null;
}
export const ehCodigo = (coluna: string) => coluna.trim().toLowerCase() === "código";

/** RFP inteiro em texto simples; tabelas com colunas separadas por " | ". */
export function rfpEmTexto(r: Rfp): string {
  const out: string[] = [r.titulo, r.subtitulo, r.versao, "", r.resumo];
  for (const s of r.secoes) {
    out.push("", s.titulo);
    for (const b of s.blocos) {
      if (b.tipo === "p" || b.tipo === "destaque") out.push(b.texto);
      else if (b.tipo === "ul") b.itens.forEach((i) => out.push(`- ${i}`));
      else if (b.tipo === "ol") b.itens.forEach((i, k) => out.push(`${k + 1}. ${i}`));
      else if (b.tipo === "tabela") { out.push(b.cabecalho.join(" | ")); b.linhas.forEach((l) => out.push(l.join(" | "))); }
    }
  }
  return out.join("\n");
}

// Estado do alternador, compartilhado por todas as cartas e mantido ao trocar de fornecedor.
export type ModoParecer = "objetivo" | "pragmatica";
let modo: ModoParecer = "objetivo";
const ouvintes = new Set<() => void>();
export function definirModo(m: ModoParecer) { modo = m; ouvintes.forEach((o) => o()); }
export function useModoParecer() {
  const m = useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => modo, () => "objetivo" as ModoParecer);
  return [m, definirModo] as const;
}
