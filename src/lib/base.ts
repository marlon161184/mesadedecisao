import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Rfp = Tables<"rfp">;
export type Modulo = Tables<"modulo">;
export type Requisito = Tables<"requisito">;
export type Player = Tables<"player">;
export type Proposta = Tables<"proposta">;
export type Item = Tables<"item_proposta">;
export type Entrega = Tables<"entrega_declarada">;
export type Cobertura = Tables<"cobertura">;
export type PontoManual = Tables<"ponto_atencao">;
export type Comentario = Tables<"comentario_tecnico">;
export type Pergunta = Tables<"pergunta_filtro">;
export type Resposta = Tables<"resposta_filtro">;
export type PremissaLinha = Tables<"premissa">;
export type Criterio = Tables<"criterio">;
export type Portao = Tables<"portao">;
export type PortaoResultado = Tables<"portao_resultado">;
export type Checklist = Tables<"checklist_equalizacao">;
export type Cenario = Tables<"cenario">;
export type CenarioModulo = Tables<"cenario_modulo">;
export type CenarioVersao = Tables<"cenario_versao">;
export type CenarioComentario = Tables<"cenario_comentario">;
export type Perfil = Pick<Tables<"profiles">, "id" | "nome" | "email">;

export interface Base {
  rfps: Rfp[];
  modulos: Modulo[];
  requisitos: Requisito[];
  players: Player[];
  propostas: Proposta[];
  itens: Item[];
  entregas: Entrega[];
  coberturas: Cobertura[];
  pontos: PontoManual[];
  comentarios: Comentario[];
  perguntas: Pergunta[];
  respostas: Resposta[];
  premissas: PremissaLinha[];
  criterios: Criterio[];
  portoes: Portao[];
  portaoResultados: PortaoResultado[];
  checklist: Checklist[];
  perfis: Perfil[];
  cenarios: Cenario[];
  cenarioModulos: CenarioModulo[];
  cenarioVersoes: CenarioVersao[];
  cenarioComentarios: CenarioComentario[];
}

async function tudo<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function carregarBase(): Promise<Base> {
  const [
    rfps, modulos, requisitos, players, propostas, itens, entregas, coberturas, pontos,
    comentarios, perguntas, respostas, premissas, criterios, portoes, portaoResultados, checklist, perfis, cenarios, cenarioModulos, cenarioVersoes, cenarioComentarios,
  ] = await Promise.all([
    tudo(supabase.from("rfp").select("*").order("numero")),
    tudo(supabase.from("modulo").select("*").order("codigo")),
    tudo(supabase.from("requisito").select("*").order("codigo")),
    tudo(supabase.from("player").select("*").order("nome")),
    tudo(supabase.from("proposta").select("*").order("versao")),
    tudo(supabase.from("item_proposta").select("*").order("descricao")),
    tudo(supabase.from("entrega_declarada").select("*")),
    tudo(supabase.from("cobertura").select("*")),
    tudo(supabase.from("ponto_atencao").select("*")),
    tudo(supabase.from("comentario_tecnico").select("*").order("criado_em")),
    tudo(supabase.from("pergunta_filtro").select("*")),
    tudo(supabase.from("resposta_filtro").select("*")),
    tudo(supabase.from("premissa").select("*").order("chave")),
    tudo(supabase.from("criterio").select("*")),
    tudo(supabase.from("portao").select("*")),
    tudo(supabase.from("portao_resultado").select("*")),
    tudo(supabase.from("checklist_equalizacao").select("*")),
    tudo(supabase.from("profiles").select("id, nome, email")),
    tudo(supabase.from("cenario").select("*").order("nome")),
    tudo(supabase.from("cenario_modulo").select("*")),
    tudo(supabase.from("cenario_versao").select("*").order("versao", { ascending: false })),
    tudo(supabase.from("cenario_comentario").select("*").order("criado_em")),
  ]);
  return {
    rfps, modulos, requisitos, players, propostas, itens, entregas, coberturas, pontos,
    comentarios, perguntas, respostas, premissas, criterios, portoes, portaoResultados, checklist, perfis, cenarios, cenarioModulos, cenarioVersoes, cenarioComentarios,
  };
}

export const baseQuery = queryOptions({ queryKey: ["base"], queryFn: carregarBase });

/** Base sem nenhum RFP: a sessão atual não tem papel que leia os dados (reunião encerrada ou conta sem papel). */
export const baseVazia = (b: Pick<Base, "rfps">) => b.rfps.length === 0;

export class SemDadosError extends Error {
  constructor() { super("Sem acesso aos dados desta sessão"); this.name = "SemDadosError"; }
}

/** RFP pedido, ou o primeiro disponível; lança SemDadosError quando a base veio vazia. */
export function rfpOuPrimeiro(b: Pick<Base, "rfps">, numero: number | undefined): Rfp {
  const rfp = b.rfps.find((r) => r.numero === numero) ?? b.rfps[0];
  if (!rfp) throw new SemDadosError();
  return rfp;
}
