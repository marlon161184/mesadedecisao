import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Conteudo } from "@/components/mesa/partes";
import { CorpoRfp } from "@/components/conteudo/DocumentoRfp";
import { BotaoCopiar, BotaoImprimir } from "@/components/conteudo/Acoes";
import { ROTULO_RFP, rfps } from "@/lib/conteudo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/rfps/$numero")({
  loader: ({ params }) => { const r = rfps.find((x) => String(x.numero) === params.numero); if (!r) throw notFound(); return { titulo: r.titulo, resumo: r.resumo }; },
  head: ({ loaderData }) => {
    const t = `${loaderData?.titulo ?? "RFP"} · NEWE Mesa de Decisão`;
    const d = (loaderData?.resumo ?? "Documento de requisitos do RFP.").slice(0, 155);
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: RfpTela,
  notFoundComponent: () => <p className="px-4 py-10 md:p-16">RFP não encontrado.</p>,
});

function RfpTela() {
  const { numero } = Route.useParams();
  const r = rfps.find((x) => String(x.numero) === numero)!;
  const ir = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <Conteudo>
      <nav aria-label="RFPs" className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
        {rfps.map((x) => (
          <Link key={x.numero} to="/mesa/rfps/$numero" params={{ numero: String(x.numero) }} search={true as never}
            className={cn("min-h-11 border border-line px-3 py-2 text-sm", x.numero === r.numero ? "border-line-strong bg-amarelo text-preto" : "hover:bg-muted")}>{ROTULO_RFP[x.numero]}</Link>
        ))}
      </nav>
      <div className="mt-4 flex flex-wrap gap-2">
        <BotaoImprimir to="/imprimir-rfp/$numero" numero={numero} rotulo="Imprimir / salvar em PDF" />
        <BotaoCopiar r={r} />
      </div>
      <label className="mt-6 block lg:hidden">
        <span className="label-mono">Ir para a seção</span>
        <select className="mt-1 min-h-11 w-full border border-line-strong bg-background px-3 text-base" defaultValue="" onChange={(e) => e.target.value && ir(e.target.value)}>
          <option value="" disabled>Escolha uma seção</option>
          {r.secoes.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
        </select>
      </label>
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="Índice" className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto border-l border-line pl-3">
            <p className="label-mono mb-2">Índice</p>
            <ul className="space-y-1 text-sm">{r.secoes.map((s) => <li key={s.id}><a href={`#sec-${s.id}`} onClick={(e) => { e.preventDefault(); ir(s.id); }} className="block py-1 hover:underline">{s.titulo}</a></li>)}</ul>
          </nav>
        </aside>
        <CorpoRfp r={r} />
      </div>
    </Conteudo>
  );
}
