import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { baseQuery } from "@/lib/base";
import { decisaoQuery } from "@/lib/decisao-dados";
import { resultadoDoCenario } from "@/lib/cenarios";
import { NOME_REGRA, pesosDe, pesosSemCusto, ranking, sensibilidade, type Regra } from "@/lib/decisao";
import { modeloDecisao, nomePessoa, nomeProposta } from "@/components/decisao/useDecisao";
import { RotuloMono } from "@/components/newe/brand";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { formatarBRL, formatarData, formatarPct } from "@/lib/formato";
import { ROTULO_SEV } from "@/lib/pontos";

export const Route = createFileRoute("/_authenticated/imprimir-ata/$id")({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(baseQuery); await context.queryClient.ensureQueryData(decisaoQuery); },
  head: () => ({
    meta: [
      { title: "Ata de decisão · NEWE Mesa de Decisão" },
      { name: "description", content: "Ata de decisão para impressão." },
      { property: "og:title", content: "Ata de decisão · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Ata de decisão para impressão." },
    ],
  }),
  component: ImprimirAta,
});

const n2 = (x: number | undefined) => (x == null ? "—" : x.toFixed(2).replace(".", ","));

function ImprimirAta() {
  const { id } = Route.useParams();
  const { data: base } = useSuspenseQuery(baseQuery);
  const { data: d } = useSuspenseQuery(decisaoQuery);
  const ata = d.atas.find((a) => a.id === id);
  const m = ata ? modeloDecisao(base, d, base.rfps.find((r) => r.id === ata.rfp_id)?.numero ?? 1) : null;
  const pode = !!m && !m.observador;
  const registrado = useRef(false);
  useEffect(() => {
    if (!ata || !pode || registrado.current) return;
    registrado.current = true;
    supabase.from("exportacao").insert({ tipo: "ata_pdf", referencia: ata.id }).then(() => setTimeout(() => window.print(), 600));
  }, [ata, pode]);
  if (!ata || !m) return <p className="p-10">Ata não encontrada.</p>;
  if (!pode) return <p className="p-10">Observadores não exportam documentos.</p>;
  const c = base.cenarios.find((x) => x.id === ata.cenario_id);
  const r = c ? resultadoDoCenario(base, c) : null;
  const quem = nomePessoa(base, d.eu.id);
  const pesos = pesosDe(m.criterios);
  const rk = ranking(m.medias, pesos);
  const rkSem = ranking(m.medias, pesosSemCusto(m.criterios));
  const s = sensibilidade(m.medias, m.criterios);
  const pts = (ata.pontos_abertos as unknown as { texto: string; severidade: string; responsavel: string; prazo: string }[]) ?? [];
  const aceites = d.aceites.filter((a) => a.ata_id === ata.id);
  const H = ({ children }: { children: string }) => <h2 className="chamada mt-5 border-b border-line-strong pb-1 text-base">{children}</h2>;
  return (
    <div className="relative mx-auto max-w-[190mm] bg-luz p-8 text-[11px] leading-snug text-preto print:p-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: var(--luz) !important; color: var(--preto) !important; } }`}</style>
      <div aria-hidden className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <p className="label-mono -rotate-30 text-2xl opacity-15">Exportado por {quem} · {new Date().toLocaleString("pt-BR")}</p>
      </div>
      <header className="flex items-center justify-between border-b border-line-strong pb-3">
        <LogoNewe variante="preto" height={28} comMargem={false} />
        <RotuloMono>Ata de decisão · versão {ata.versao} · {ata.status === "aprovada" ? `aprovada em ${formatarData(ata.aprovada_em)}` : "rascunho"}</RotuloMono>
      </header>
      <h1 className="chamada mt-4 text-xl">RFP {m.rfp.numero} · {m.rfp.nome}</h1>
      <p className="text-ink-muted">Fase {m.rfp.fase} · {m.rfp.periodo}. {m.rfp.descricao}</p>
      {ata.justificativa_revisao && <p className="mt-1">Revisão: {ata.justificativa_revisao}</p>}

      <H>Cenário escolhido</H>
      {c && r && <>
        <p className="mt-1 font-medium">{c.nome}</p>
        <table className="mt-1 w-full"><tbody>{r.modulos.map((x) => (
          <tr key={x.modulo.id} className="border-b border-line"><td className="py-0.5">{x.modulo.codigo} {x.modulo.nome}</td><td>{x.player?.nome ?? (x.opcao.tipo === "interno" ? "Time interno" : "A cotar")}</td><td className="num text-right">{formatarBRL(x.total)}</td><td className="num text-right">{formatarPct(x.cobertura.conservadora)}–{formatarPct(x.cobertura.otimista)}</td></tr>
        ))}</tbody></table>
        <p className="num mt-1">Total {formatarBRL(r.total.central)}{r.total.eFaixa ? ` (${formatarBRL(r.total.min)} a ${formatarBRL(r.total.max)})` : ""} · ajustado ao escopo {formatarBRL(r.ajustado.ajustado)} · compromisso dos contratos {formatarBRL(r.compromisso?.total ?? r.total.central)}</p>
        <p>Expectativa 100% x realidade {formatarPct(r.cobertura.conservadora)} a {formatarPct(r.cobertura.otimista)}. {r.veredito}</p>
      </>}

      <H>Portões eliminatórios</H>
      <ul className="mt-1">{m.portoes.flatMap((g) => m.propostas.map((p) => {
        const x = m.resultado(g.id, p.id);
        return <li key={g.id + p.id}>{g.descricao} · {nomeProposta(base, p.id)}: {x?.resultado ?? "pendente"}{x?.justificativa ? ` (${x.justificativa})` : ""}</li>;
      }))}</ul>

      <H>Notas, divergências e sensibilidade</H>
      <p className="mt-1">{rk.map((x, i) => `${i + 1}º ${nomeProposta(base, x.proposta)} ${n2(x.nota)}`).join(" · ") || "Notas não reveladas."}</p>
      <p>Sem o critério de custo: {rkSem.map((x, i) => `${i + 1}º ${nomeProposta(base, x.proposta)} ${n2(x.nota)}`).join(" · ")}</p>
      <p>Divergências: {m.divs.map((x) => `${m.criterios.find((cc) => cc.id === x.criterio_id)?.nome} · ${nomeProposta(base, x.proposta_id)} (DP ${n2(x.desvio)})`).join("; ") || "nenhuma"}.</p>
      <p>Sensibilidade: {s.testadas} variações de até 10 pontos; {s.alteram} alteram a ordem. {s.menorVirada ? `Menor virada: ${s.menorVirada.pontos} ponto(s).` : "Nenhuma vira o primeiro colocado."}</p>

      <H>Pré-mortem consolidado</H>
      <ul className="mt-1">{m.premortes.map((p) => <li key={p.socio_id} className="whitespace-pre-line"><b>{nomePessoa(base, p.socio_id)}:</b> {p.texto}</li>)}</ul>

      <H>Votos, ressalvas e condições</H>
      <p className="mt-1">Regra: {NOME_REGRA[(m.trilha?.regra_decisao ?? "unanimidade") as Regra]}. Resultado: {m.votacao.aprovado ? "aprovado" : "não aprovado"}.</p>
      <ul>{m.votos.map((v) => <li key={v.socio_id}>{nomePessoa(base, v.socio_id)} · {v.decisao.replace(/_/g, " ")}: {v.justificativa}</li>)}</ul>
      {ata.ressalvas && <p className="mt-1 whitespace-pre-line">Condições: {ata.ressalvas}</p>}

      <H>Pontos de atenção abertos</H>
      <ul className="mt-1">{pts.map((p, i) => <li key={i}>[{p.severidade}] {p.texto} · responsável: {p.responsavel || "a definir"} · prazo: {p.prazo ? formatarData(p.prazo) : "a definir"}</li>)}</ul>
      {r && <p className="text-ink-muted">Total de pontos no cenário: {r.pontos.length} ({Object.entries(ROTULO_SEV).map(([k, l]) => `${l} ${r.pontos.filter((p) => p.severidade === k).length}`).join(", ")}).</p>}

      <H>Próximos passos</H>
      <p className="mt-1 whitespace-pre-line">{ata.proximos_passos || "Não informado."}</p>

      <H>Snapshot e aceites</H>
      <p className="mt-1 break-all">SHA-256: {ata.snapshot_hash ?? "não congelado (rascunho)"}</p>
      <ul>{aceites.map((a) => <li key={a.socio_id}>{a.nome} · {new Date(a.aceito_em).toLocaleString("pt-BR")}</li>)}</ul>
      <p className="mt-3 text-ink-muted">Documento confidencial, de uso restrito ao processo de seleção. Totais não incluem honorários de consultoria do facilitador.</p>
    </div>
  );
}
