import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Papel } from "@/lib/papel";

export type Trilha = Tables<"trilha_decisao">;
export type Nota = Tables<"nota_socio">;
export type Premorte = Tables<"premorte">;
export type Voto = Tables<"voto">;
export type Ata = Tables<"ata">;
export type Aceite = Tables<"ata_aceite">;
export type Arquivo = Tables<"proposta_arquivo">;
export type Revelacao = Tables<"revelacao">;

export interface DadosDecisao {
  eu: { id: string; papeis: Papel[]; reuniao: boolean };
  socios: string[];
  trilhas: Trilha[];
  notas: Nota[]; // RLS: só as minhas antes da revelação
  envios: Record<string, { socio_id: string; notas: number }[]>;
  revelacoes: Revelacao[];
  premortes: Premorte[];
  votos: Voto[];
  atas: Ata[];
  aceites: Aceite[];
  arquivos: Arquivo[];
}

async function lista<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function carregarDecisao(): Promise<DadosDecisao> {
  const { data: u } = await supabase.auth.getUser();
  const id = u.user?.id ?? "";
  const [papeis, trilhas, notas, revelacoes, premortes, votos, atas, aceites, arquivos, sociosRpc] = await Promise.all([
    lista(supabase.from("user_roles").select("role").eq("user_id", id)),
    lista(supabase.from("trilha_decisao").select("*")),
    lista(supabase.from("nota_socio").select("*")),
    lista(supabase.from("revelacao").select("*")),
    lista(supabase.from("premorte").select("*")),
    lista(supabase.from("voto").select("*")),
    lista(supabase.from("ata").select("*").order("versao")),
    lista(supabase.from("ata_aceite").select("*")),
    lista(supabase.from("proposta_arquivo").select("*").order("versao")),
    supabase.rpc("socios_ativos"),
  ]);
  const envios: DadosDecisao["envios"] = {};
  await Promise.all(trilhas.map(async (t) => {
    const { data } = await supabase.rpc("envios_pontuacao", { _rfp: t.rfp_id });
    envios[t.rfp_id] = (data ?? []).map((e) => ({ socio_id: e.socio_id, notas: Number(e.notas) }));
  }));
  return {
    eu: { id, papeis: papeis.map((p) => p.role as Papel), reuniao: u.user?.app_metadata?.["reuniao"] === true },
    socios: ((sociosRpc.data as string[] | null) ?? []),
    trilhas, notas, envios, revelacoes, premortes, votos, atas, aceites, arquivos,
  };
}

export const decisaoQuery = queryOptions({ queryKey: ["decisao"], queryFn: carregarDecisao });
