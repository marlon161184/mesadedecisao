import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Moldura, useSessao } from "@/components/newe/Moldura";
import { CartaoFio, FaixaSecao, RotuloMono, SeloFase } from "@/components/newe/brand";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Visão geral · NEWE Mesa de Decisão" },
      { name: "description", content: "Ponto de partida da Mesa de Decisão NEWE para as três concorrências." },
      { property: "og:title", content: "Visão geral · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Ponto de partida da Mesa de Decisão NEWE para as três concorrências." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { data: sessao } = useSessao();
  const { data: rfps } = useQuery({
    queryKey: ["rfps"],
    queryFn: async () => (await supabase.from("rfp").select("*").order("numero")).data ?? [],
  });
  const semPapel = sessao && sessao.papeis.length === 0;

  return (
    <Moldura>
      <section className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6 px-8 pb-20 pt-24 md:px-16">
        <RotuloMono as="p" className="col-span-12 md:col-span-2">Visão geral</RotuloMono>
        <div className="col-span-12 md:col-span-8">
          <h1 className="chamada text-4xl leading-tight md:text-6xl">Mesa de Decisão</h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted">
            Aqui comparamos as propostas em base única, simulamos composições de parceiros e registramos
            cada decisão dos sócios.
          </p>
          {semPapel && (
            <p className="mt-6 border border-line-strong p-4 text-sm">
              Seu acesso ainda não tem papel definido. Peça ao Admin para liberar.
            </p>
          )}
        </div>
      </section>

      <FaixaSecao numero="01" titulo="Concorrências">
        Três RFPs. As duas primeiras na fase 1; a comercial começa na fase 2.
      </FaixaSecao>

      <section className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-8 py-20 md:grid-cols-3 md:px-16">
        {(rfps ?? []).map((r) => (
          <CartaoFio key={r.id}>
            <div className="flex items-center justify-between">
              <RotuloMono>RFP {r.numero}</RotuloMono>
              <SeloFase fase={r.fase} />
            </div>
            <h2 className="mt-4 text-2xl leading-snug">{r.nome}</h2>
            <p className="label-mono mt-6 text-ink-muted">{r.periodo}</p>
          </CartaoFio>
        ))}
      </section>
    </Moldura>
  );
}
