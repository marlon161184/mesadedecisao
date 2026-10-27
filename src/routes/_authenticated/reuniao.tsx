import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { baseQuery } from "@/lib/base";
import { decisaoQuery } from "@/lib/decisao-dados";
import { resultadoDoCenario, linhaComposicao } from "@/lib/cenarios";
import { formatarBRL, formatarPct } from "@/lib/formato";
import { ROTULO_SEV } from "@/lib/pontos";
import { useDecisao, nomePessoa, nomeProposta } from "@/components/decisao/useDecisao";
import { BarraExpectativa } from "@/components/mesa/simulacao";
import { RotuloMono, SeloFase } from "@/components/newe/brand";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { Button } from "@/components/ui/button";
import { useInatividade } from "@/hooks/use-inatividade";

export const Route = createFileRoute("/_authenticated/reuniao")({
  validateSearch: (s: Record<string, unknown>) => ({ rfp: [1, 2, 3].includes(Number(s["rfp"])) ? Number(s["rfp"]) : 2 }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(baseQuery); await context.queryClient.ensureQueryData(decisaoQuery); },
  head: () => ({
    meta: [
      { title: "Modo reunião · NEWE Mesa de Decisão" },
      { name: "description", content: "Sequência fixa para a reunião dos sócios." },
      { property: "og:title", content: "Modo reunião · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Sequência fixa para a reunião dos sócios." },
    ],
  }),
  component: Reuniao,
});

const TOPICOS = ["Resumo do RFP", "Expectativa x realidade", "Cenários lado a lado", "Pontos de atenção críticos", "Divergências", "Votação"];

function Reuniao() {
  useInatividade();
  const { rfp } = Route.useSearch();
  const { base, m } = useDecisao(rfp);
  const [i, setI] = useState(0);
  const [cron, setCron] = useState<{ ligado: boolean; seg: number }>({ ligado: false, seg: 0 });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(TOPICOS.length - 1, x + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setCron((c) => ({ ...c, seg: 0 })), [i]);
  useEffect(() => {
    if (!cron.ligado) return;
    const t = setInterval(() => setCron((c) => ({ ...c, seg: c.seg + 1 })), 1000);
    return () => clearInterval(t);
  }, [cron.ligado]);
  useEffect(() => { document.documentElement.requestFullscreen?.().catch(() => {}); }, []);

  const cenario = m.candidato ?? base.cenarios.find((c) => c.recomendado) ?? base.cenarios[0] ?? null;
  const r = cenario ? resultadoDoCenario(base, cenario) : null;
  const cenarios = base.cenarios.slice(0, 4).map((c) => ({ c, r: resultadoDoCenario(base, c) }));
  const modsRfp = r ? r.modulos.filter((x) => x.modulo.rfp_id === m.rfp.id) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line px-10 py-4">
        <div className="flex items-center gap-6"><LogoNewe height={30} comMargem={false} /><span className="label-mono">RFP {m.rfp.numero} · {i + 1} de {TOPICOS.length}</span>{m.rfp.fase === 2 && <SeloFase fase={2} />}</div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCron((c) => ({ ...c, ligado: !c.ligado }))} aria-pressed={cron.ligado}>
            {cron.ligado ? `Cronômetro ${String(Math.floor(cron.seg / 60)).padStart(2, "0")}:${String(cron.seg % 60).padStart(2, "0")}` : "Cronômetro"}
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Sair do modo reunião"><Link to="/mesa/decisao" search={{ rfp } as never}><X strokeWidth={1.5} /></Link></Button>
        </div>
      </header>
      <main className="flex-1 px-16 py-12 text-xl">
        <RotuloMono as="p">{TOPICOS[i]}</RotuloMono>
        {i === 0 && (
          <div className="mt-4">
            <h1 className="chamada text-5xl">{m.rfp.nome}</h1>
            <p className="mt-3 text-ink-muted">Fase {m.rfp.fase} · {m.rfp.periodo}</p>
            {m.propostas.length === 0 ? <p className="label-mono mt-8">Aguardando propostas · Fase 2</p> : (
              <ul className="mt-8 grid grid-cols-2 gap-6 xl:grid-cols-4">
                {m.propostas.map((p) => <li key={p.id} className="border border-line p-5"><p className="chamada text-2xl">{nomeProposta(base, p.id)}</p><p className="label-mono mt-2">{p.status === "validada" ? "Validada" : "Em equalização"}{m.reprovadas.has(p.id) ? " · reprovada em portão" : ""}</p></li>)}
              </ul>
            )}
            {r && <p className="mt-8">Cenário em discussão: <b>{cenario!.nome}</b> · <span className="num">{formatarBRL(r.total.central)}</span></p>}
          </div>
        )}
        {i === 1 && r && (
          <div className="mt-6 max-w-5xl space-y-4">
            <BarraExpectativa rotulo={`RFP ${m.rfp.numero}`} c={r.cobertura} />
            {modsRfp.map((x) => <BarraExpectativa key={x.modulo.id} rotulo={`${x.modulo.codigo} ${x.modulo.nome}`} c={x.cobertura} semPlayer={!x.player} />)}
          </div>
        )}
        {i === 2 && (
          <table className="mt-6 w-full">
            <thead><tr className="border-b border-line-strong"><th className="label-mono py-2 text-left font-normal">Cenário</th><th className="label-mono text-right font-normal">Total</th><th className="label-mono text-right font-normal">Cobertura</th><th className="label-mono text-right font-normal">Críticos</th></tr></thead>
            <tbody>{cenarios.map(({ c, r: rr }) => (
              <tr key={c.id} className="border-b border-line"><td className="py-3">{c.nome}<span className="block text-sm text-ink-muted">{linhaComposicao(rr)}</span></td><td className="num text-right">{formatarBRL(rr.total.central)}</td><td className="num text-right">{formatarPct(rr.cobertura.conservadora)}–{formatarPct(rr.cobertura.otimista)}</td><td className="num text-right">{rr.pontos.filter((p) => p.severidade === "critico").length}</td></tr>
            ))}</tbody>
          </table>
        )}
        {i === 3 && r && <ul className="mt-6 space-y-3">{r.pontos.filter((p) => p.severidade === "critico").map((p) => <li key={p.id} className="border-l-2 border-terracota pl-4"><span className="label-mono mr-3">{ROTULO_SEV[p.severidade]}</span>{p.texto}</li>)}</ul>}
        {i === 4 && (m.revelado ? (
          <ul className="mt-6 space-y-5">{m.divs.map((dv) => (
            <li key={dv.criterio_id + dv.proposta_id}><p>{m.criterios.find((c) => c.id === dv.criterio_id)?.nome} · {nomeProposta(base, dv.proposta_id)} <span className="label-mono">DP {dv.desvio.toFixed(2).replace(".", ",")}</span></p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-base">{dv.notas.map((n) => <p key={n.socio_id} className="border-l border-line-strong pl-3"><span className="label-mono block">{nomePessoa(base, n.socio_id)} · {n.nota}</span>{n.justificativa}</p>)}</div></li>
          ))}{m.divs.length === 0 && <li>Nenhuma divergência.</li>}</ul>
        ) : <p className="mt-6">Notas ainda não reveladas.</p>)}
        {i === 5 && (
          <div className="mt-6">
            <p>{m.candidato ? m.candidato.nome : "Nenhum cenário candidato."}</p>
            <p className="mt-3 num">{m.votos.length} de {m.votos.length + m.votacao.faltam} votos · {m.votacao.aprovacoes} aprovar · {m.votacao.ressalvas} com ressalvas · {m.votacao.rejeicoes} rejeitar</p>
          </div>
        )}
      </main>
      <footer className="flex items-center justify-between border-t border-line px-10 py-4">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</Button>
        <span className="label-mono">Use as setas do teclado</span>
        <Button disabled={i === TOPICOS.length - 1} onClick={() => setI(i + 1)}>Próximo</Button>
      </footer>
    </div>
  );
}
