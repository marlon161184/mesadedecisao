import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { Alternador, AvisoScore, Relatorio } from "@/components/conteudo/Pareceres";
import { BotaoImprimir } from "@/components/conteudo/Acoes";
import { fornecedores, pareceres, useModoParecer } from "@/lib/conteudo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/pareceres/$slug")({
  loader: ({ params }) => { const f = fornecedores.find((x) => x.slug === params.slug); if (!f) throw notFound(); return { nome: f.nome }; },
  head: ({ loaderData }) => {
    const t = `Parecer ${loaderData?.nome ?? "do fornecedor"} · NEWE Mesa de Decisão`;
    const d = "Relatório do fornecedor: componentes do score, forças, fraquezas e parecer.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: RelatorioTela,
  notFoundComponent: () => <p className="px-4 py-10 md:p-16">Fornecedor não encontrado.</p>,
});

function RelatorioTela() {
  const { slug } = Route.useParams();
  const f = fornecedores.find((x) => x.slug === slug)!;
  const [modo] = useModoParecer();
  return (
    <>
      <AberturaTela numero="Pareceres" titulo="Pareceres dos fornecedores">{pareceres.referencia}</AberturaTela>
      <Conteudo>
        <Link to="/mesa/pareceres" search={true as never} className="label-mono inline-flex min-h-11 items-center gap-2 hover:underline"><ArrowLeft className="size-4" strokeWidth={1.5} />Comparativo</Link>
        <nav aria-label="Fornecedores" className="mt-2 flex flex-wrap gap-1">
          {fornecedores.map((x) => (
            <Link key={x.slug} to="/mesa/pareceres/$slug" params={{ slug: x.slug }} search={true as never}
              className={cn("min-h-11 border border-line px-3 py-2 text-sm", x.slug === slug ? "border-line-strong bg-amarelo text-preto" : "hover:bg-muted")}>{x.nome}</Link>
          ))}
        </nav>
        <AvisoScore />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Alternador />
          <BotaoImprimir to="/imprimir-pareceres" slug={slug} />
        </div>
        <div className="mt-8"><Relatorio f={f} modo={modo} /></div>
      </Conteudo>
    </>
  );
}
