import { AcessoConteudo, useConteudo } from "@/components/conteudo/AcessoConteudo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { useSessao } from "@/components/newe/Moldura";
import { CorpoRfp } from "@/components/conteudo/DocumentoRfp";

export const Route = createFileRoute("/_authenticated/imprimir-rfp/$numero")({
  head: () => ({ meta: [{ title: "RFP para impressão · NEWE Mesa de Decisão" }, { name: "description", content: "Documento de requisitos do RFP em versão limpa para impressão." }, { property: "og:title", content: "RFP para impressão · NEWE Mesa de Decisão" }, { property: "og:description", content: "Documento de requisitos do RFP em versão limpa para impressão." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <AcessoConteudo impressao><ImprimirRfp /></AcessoConteudo>,
  notFoundComponent: () => <p className="p-10">RFP não encontrado.</p>,
});

function ImprimirRfp() {
  const { numero } = Route.useParams();
  const { rfps } = useConteudo();
  const r = rfps.find((x) => String(x.numero) === numero);
  const { data: s, isLoading } = useSessao();
  useEffect(() => { if (isLoading || s?.reuniao || !r) return; const timer = setTimeout(() => window.print(), 600); return () => clearTimeout(timer); }, [isLoading, s?.reuniao, r]);
  if (!r) return <p className="p-10">RFP não encontrado.</p>;
  if (s?.reuniao) return <p className="p-10">O acesso de reunião é somente leitura e não exporta documentos.</p>;
  return (
    <div className="mx-auto max-w-[190mm] bg-luz p-8 text-preto print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { html, body { background: var(--luz) !important; color: var(--preto) !important; } }`}</style>
      <header className="mb-6 border-b border-line-strong pb-3"><LogoNewe variante="preto" height={28} comMargem={false} /></header>
      <CorpoRfp r={r} />
    </div>
  );
}
