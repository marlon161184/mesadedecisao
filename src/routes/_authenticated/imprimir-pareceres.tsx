import { AcessoConteudo, useConteudo } from "@/components/conteudo/AcessoConteudo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { RotuloMono } from "@/components/newe/brand";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { useSessao } from "@/components/newe/Moldura";
import { AvisoScore, Comparativo, MetodoConteudo, Relatorio } from "@/components/conteudo/Pareceres";
import { PareceresNovos, RotuloPosicaoAntiga } from "@/components/propostas/PareceresNovos";
import { type ModoParecer } from "@/lib/conteudo";

export const Route = createFileRoute("/_authenticated/imprimir-pareceres")({
  validateSearch: (s: Record<string, unknown>) => ({ slug: typeof s["slug"] === "string" ? s["slug"] : undefined, modo: (s["modo"] === "pragmatica" ? "pragmatica" : "objetivo") as ModoParecer }),
  head: () => ({ meta: [{ title: "Pareceres para impressão · NEWE Mesa de Decisão" }, { name: "description", content: "Versão limpa dos pareceres dos fornecedores para impressão." }, { property: "og:title", content: "Pareceres para impressão · NEWE Mesa de Decisão" }, { property: "og:description", content: "Versão limpa dos pareceres dos fornecedores para impressão." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <AcessoConteudo impressao><ImprimirPareceres /></AcessoConteudo>,
});

function ImprimirPareceres() {
  const { fornecedores, pareceres } = useConteudo();
  const { slug, modo } = Route.useSearch();
  const { data: s, isLoading } = useSessao();
  const lista = slug ? fornecedores.filter((f) => f.slug === slug) : fornecedores;
  useEffect(() => { if (isLoading || s?.reuniao) return; const timer = setTimeout(() => window.print(), 600); return () => clearTimeout(timer); }, [isLoading, s?.reuniao]);
  if (s?.reuniao) return <p className="p-10">O acesso de reunião é somente leitura e não exporta documentos.</p>;
  return (
    <div className="mx-auto max-w-[190mm] bg-luz p-8 text-sm leading-snug text-preto print:p-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: var(--luz) !important; color: var(--preto) !important; } }`}</style>
      <header className="flex items-center justify-between border-b border-line-strong pb-3">
        <LogoNewe variante="preto" height={28} comMargem={false} />
        <RotuloMono>Pareceres dos fornecedores</RotuloMono>
      </header>
      <h1 className="chamada mt-4 text-2xl">Pareceres dos fornecedores</h1>
      {!slug && <PareceresNovos impressao />}
      {!slug && <div className="mt-6 break-before-page"><RotuloPosicaoAntiga /></div>}
      <p className="mt-1">{pareceres.referencia}</p>
      <AvisoScore />
      {!slug && <div className="mt-4"><Comparativo link={false} /></div>}
      {lista.map((f) => <div key={f.slug} className="mt-8 break-before-page"><Relatorio f={f} modo={modo} /></div>)}
      {!slug && <div className="mt-8 break-before-page"><h2 className="chamada text-xl">Como o score é calculado</h2><div className="mt-2"><MetodoConteudo /></div></div>}
    </div>
  );
}
