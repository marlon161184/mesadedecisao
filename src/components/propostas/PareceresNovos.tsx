import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { baseQuery } from "@/lib/base";
import { RotuloMono } from "@/components/newe/brand";

/** Pareceres publicados de propostas que entraram pelo upload (tabela própria; pareceres.json fica intocado). */
export function PareceresNovos() {
  const { data: base } = useSuspenseQuery(baseQuery);
  const { data } = useQuery({
    queryKey: ["pareceres-novos"],
    queryFn: async () => (await supabase.from("parecer_proposta").select("id, proposta_id, texto, publicado_em").eq("publicado", true).order("publicado_em", { ascending: false })).data ?? [],
  });
  if (!data?.length) return null;
  const nome = (id: string) => {
    const p = base.propostas.find((x) => x.id === id);
    return `${base.players.find((pl) => pl.id === p?.player_id)?.nome ?? "Proposta"} V${p?.versao ?? ""}`;
  };
  return (
    <section className="mt-12 border-t border-line pt-8" aria-label="Pareceres de propostas novas">
      <RotuloMono as="p">Propostas recebidas pela Mesa · parecer revisado pelo Admin, sem score de aderência</RotuloMono>
      <div className="mt-4 space-y-6">
        {data.map((p) => (
          <article key={p.id} className="border border-line p-4 sm:p-6">
            <h2 className="text-2xl">{nome(p.proposta_id)}</h2>
            <p className="label-mono mt-1 text-ink-muted">Publicado em {p.publicado_em ? new Date(p.publicado_em).toLocaleDateString("pt-BR") : "—"}</p>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed">{p.texto}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
