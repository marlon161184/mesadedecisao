import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { baseQuery } from "@/lib/base";
import { RotuloMono } from "@/components/newe/brand";
import { POSICAO_ATUAL } from "@/lib/apresentacao";

/** Pareceres publicados em parecer_proposta (RLS limita a Admin, Sócios e reunião). Cache por identidade, sem persistir. */
export const pareceresPublicadosQuery = (uid: string | undefined) => queryOptions({
  queryKey: ["pareceres-novos", uid ?? "anon"],
  queryFn: async () => (await supabase.from("parecer_proposta").select("id, proposta_id, texto, publicado_em").eq("publicado", true).order("publicado_em", { ascending: false })).data ?? [],
  enabled: !!uid, staleTime: 0, gcTime: 0,
});

function useUid() {
  return useQuery({ queryKey: ["uid-atual"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null, staleTime: 0, gcTime: 0 }).data ?? undefined;
}

export function usePareceresPublicados() {
  return useQuery(pareceresPublicadosQuery(useUid()));
}

/** Posição atual (06/11/2026): pareceres publicados das versões vigentes, em ordem de agência. */
export function PareceresNovos({ impressao = false }: { impressao?: boolean }) {
  const { data: base } = useSuspenseQuery(baseQuery);
  const { data } = usePareceresPublicados();
  if (!data?.length) return null;
  const info = (id: string) => {
    const p = base.propostas.find((x) => x.id === id);
    return { nome: base.players.find((pl) => pl.id === p?.player_id)?.nome ?? "Proposta", versao: p?.versao ?? "" };
  };
  const lista = data.map((p) => ({ ...p, ...info(p.proposta_id) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <section className={impressao ? "mt-4" : "mb-10"} aria-label={`Posição de ${POSICAO_ATUAL}`}>
      <h2 className="chamada text-2xl sm:text-3xl">Posição de {POSICAO_ATUAL}</h2>
      <RotuloMono as="p">Pareceres das versões atuais das propostas · revisados e publicados pelo Admin</RotuloMono>
      <div className="mt-4 space-y-6">
        {lista.map((p) => (
          <article key={p.id} className={impressao ? "break-inside-avoid border border-line p-4" : "border border-line p-4 sm:p-6"}>
            <h3 className="text-2xl">{p.nome} · V{p.versao}</h3>
            <p className="label-mono mt-1 text-ink-muted">Publicado em {p.publicado_em ? new Date(p.publicado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</p>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed">{p.texto}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

export const ROTULO_POSICAO_ANTIGA = `Posição de 28/10/2026, versões anteriores das propostas, substituída pela posição de ${POSICAO_ATUAL}`;
