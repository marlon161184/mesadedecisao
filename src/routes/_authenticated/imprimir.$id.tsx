import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { baseQuery } from "@/lib/base";
import { resultadoDoCenario } from "@/lib/cenarios";
import { Logo, RotuloMono } from "@/components/newe/brand";
import { formatarBRL, formatarData, formatarPct } from "@/lib/formato";
import { ROTULO_SEV } from "@/lib/pontos";

export const Route = createFileRoute("/_authenticated/imprimir/$id")({
  loader: ({ context }) => context.queryClient.ensureQueryData(baseQuery),
  head: () => ({
    meta: [
      { title: "Cenário para impressão · NEWE Mesa de Decisão" },
      { name: "description", content: "Resumo de uma página do cenário." },
      { property: "og:title", content: "Cenário para impressão · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Resumo de uma página do cenário." },
    ],
  }),
  component: Imprimir,
  errorComponent: ({ error }) => <p className="p-10">{error instanceof Error ? error.message : String(error)}</p>,
  notFoundComponent: () => <p className="p-10">Cenário não encontrado.</p>,
});

function Imprimir() {
  const { id } = Route.useParams();
  const { data: base } = useSuspenseQuery(baseQuery);
  const c = base.cenarios.find((x) => x.id === id);
  useEffect(() => { if (c) setTimeout(() => window.print(), 600); }, [c]);
  if (!c) return <p className="p-10">Cenário não encontrado.</p>;
  const r = resultadoDoCenario(base, c);
  return (
    <div className="mx-auto max-w-[190mm] bg-background p-8 text-[11px] leading-snug text-foreground print:p-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: var(--luz) !important; color: var(--preto) !important; } }`}</style>
      <header className="flex items-center justify-between border-b border-line-strong pb-3">
        <Logo height={28} />
        <RotuloMono>Mesa de Decisão · {formatarData(new Date())}</RotuloMono>
      </header>
      <h1 className="chamada mt-4 text-xl">{c.nome}</h1>
      {c.descricao && <p className="mt-1 text-ink-muted">{c.descricao}</p>}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["Total na janela", formatarBRL(r.total.central) + (r.total.eFaixa ? ` (${formatarBRL(r.total.min)} a ${formatarBRL(r.total.max)})` : "")],
          ["Custo ajustado", formatarBRL(r.ajustado.ajustado)],
          ["Compromisso dos contratos", formatarBRL(r.compromisso?.total ?? r.total.central)],
          ["Cobertura", `${formatarPct(r.cobertura.conservadora)} a ${formatarPct(r.cobertura.otimista)}`],
        ].map(([k, v]) => <div key={k} className="border border-line p-2"><RotuloMono as="p">{k}</RotuloMono><p className="num mt-1 text-sm">{v}</p></div>)}
      </div>
      <p className="mt-3">{r.veredito}</p>
      <table className="mt-3 w-full">
        <thead><tr className="border-b border-line-strong"><th className="label-mono py-1 text-left font-normal">Módulo</th><th className="label-mono text-left font-normal">Player</th><th className="label-mono text-right font-normal">Valor</th><th className="label-mono text-right font-normal">Cobertura</th></tr></thead>
        <tbody>
          {r.modulos.map((m) => (
            <tr key={m.modulo.id} className="border-b border-line">
              <td className="py-0.5">{m.modulo.codigo} {m.modulo.nome}</td>
              <td>{m.player?.nome ?? (m.opcao.tipo === "interno" ? "Time interno" : "A cotar")}</td>
              <td className="num text-right">{formatarBRL(m.total)}</td>
              <td className="num text-right">{formatarPct(m.cobertura.conservadora)}–{formatarPct(m.cobertura.otimista)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <RotuloMono as="p" className="mt-3">Pontos de atenção ({r.pontos.length})</RotuloMono>
      <ul className="mt-1 columns-2 gap-4">
        {r.pontos.slice(0, 14).map((p) => <li key={p.id} className="mb-0.5 break-inside-avoid">[{ROTULO_SEV[p.severidade]}] {p.texto}</li>)}
        {r.pontos.length > 14 && <li>e mais {r.pontos.length - 14}.</li>}
      </ul>
      <RotuloMono as="p" className="mt-3">Parecer</RotuloMono>
      <p className="mt-1 line-clamp-[12] whitespace-pre-line">{c.parecer ?? "Parecer ainda não revisado."}</p>
      <p className="mt-3 text-ink-muted">Totais calculados pela Mesa de Decisão. Não incluem honorários de consultoria do facilitador.</p>
    </div>
  );
}
