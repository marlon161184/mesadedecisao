import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { decisaoQuery } from "@/lib/decisao-dados";
import { formatarData } from "@/lib/formato";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { useFiltros } from "@/components/mesa/useMesa";
import { RotuloMono, SeloFase } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDecisao, nomePessoa, ROTULO_STATUS } from "@/components/decisao/useDecisao";
import { AtaEtapa, Escolha, Etapa, Pontuacao, Portoes, Preparar, Revelacao, Sensibilidade } from "@/components/decisao/Etapas";
import { Documentos } from "@/components/decisao/Documentos";

export const Route = createFileRoute("/_authenticated/mesa/decisao")({
  loader: ({ context }) => context.queryClient.ensureQueryData(decisaoQuery),
  head: () => ({
    meta: [
      { title: "Decisão · NEWE Mesa de Decisão" },
      { name: "description", content: "Trilha de decisão por RFP: portões, pontuação cega, revelação, sensibilidade, votação e ata." },
      { property: "og:title", content: "Decisão · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Trilha de decisão estruturada e registrada." },
    ],
  }),
  component: TelaDecisao,
});

const NOMES = ["Preparar", "Portões eliminatórios", "Pontuação cega", "Revelação", "Sensibilidade", "Escolha do cenário", "Ata"];

function TelaDecisao() {
  const { f } = useFiltros();
  const { base, d, m } = useDecisao(f.rfp);
  const qc = useQueryClient();
  const ia = base.premissas.find((p) => p.chave === "ia_parecer_habilitada")?.valor === true;
  const p = { base, d, m };
  const hoje = Date.now();
  const avisosValidade = base.propostas.filter((x) => x.validade_ate && (new Date(x.validade_ate).getTime() - hoje) / 864e5 <= 10);
  const log = useQuery({
    queryKey: ["auditoria"],
    enabled: m.admin || m.socio,
    queryFn: async () => (await supabase.from("log_auditoria").select("id, quem, quando, tabela, operacao, registro").order("quando", { ascending: false }).limit(60)).data ?? [],
  });

  async function alternarIa(v: boolean) {
    const { error } = await supabase.from("premissa").update({ valor: v }).eq("chave", "ia_parecer_habilitada");
    if (error) toast.error(error.message); else { toast.success(v ? "Redação com IA ligada." : "Redação com IA desligada."); qc.invalidateQueries({ queryKey: ["base"] }); }
  }

  return (
    <>
      <AberturaTela numero="11" titulo="Decisão">
        <p className="mt-2 max-w-2xl">A plataforma não decide. Ela organiza a conversa: independente no começo, justificada no fim.</p>
      </AberturaTela>
      <Conteudo>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="chamada min-w-0 break-words text-2xl sm:text-3xl">RFP {m.rfp.numero} · {m.rfp.nome}</h1>
            {m.rfp.fase === 2 && <SeloFase fase={2} />}
          </div>
          <Button asChild variant="outline"><Link to="/reuniao" search={{ rfp: m.rfp.numero }}><Presentation strokeWidth={1.5} />Modo reunião</Link></Button>
        </div>
        <ol aria-label="Trilha de decisão" className="mt-6 flex snap-x gap-px overflow-x-auto border border-line bg-line md:grid md:grid-cols-7 md:overflow-visible">
          {NOMES.map((n, i) => (
            <li key={n} className="w-32 shrink-0 snap-start bg-background md:w-auto">
              <a href={`#etapa-${i + 1}`} className="block min-h-11 p-2.5 focus-visible:outline-2 md:p-3"><span className="label-mono"><span className="md:hidden">{i + 1} · </span><span className="hidden md:inline">Etapa {i + 1}</span></span><span className="mt-1 block text-sm leading-tight">{n}</span><span className="label-mono mt-1 block text-ink-muted">{ROTULO_STATUS[m.etapas[i]!]}</span></a>
            </li>
          ))}
        </ol>
        {m.propostas.length === 0 && <p className="label-mono mt-6">Aguardando propostas · Fase 2</p>}
        {avisosValidade.length > 0 && (
          <div role="status" className="mt-6 border border-terracota p-4">
            <RotuloMono as="p">Aviso interno · validade</RotuloMono>
            <ul className="mt-1">{avisosValidade.map((x) => <li key={x.id}>{base.players.find((pl) => pl.id === x.player_id)?.nome}: validade até {formatarData(x.validade_ate)}.</li>)}</ul>
          </div>
        )}

        <Etapa n={1} titulo="Preparar" status={m.etapas[0]!}><Preparar {...p} /></Etapa>
        <Etapa n={2} titulo="Portões eliminatórios" status={m.etapas[1]!}><Portoes {...p} /></Etapa>
        <Etapa n={3} titulo="Pontuação cega" status={m.etapas[2]!}><Pontuacao {...p} /></Etapa>
        <Etapa n={4} titulo="Revelação" status={m.etapas[3]!}><Revelacao {...p} /></Etapa>
        <Etapa n={5} titulo="Sensibilidade" status={m.etapas[4]!}><Sensibilidade {...p} /></Etapa>
        <Etapa n={6} titulo="Escolha do cenário" status={m.etapas[5]!}><Escolha {...p} /></Etapa>
        <Etapa n={7} titulo="Ata de decisão" status={m.etapas[6]!}><AtaEtapa {...p} /></Etapa>

        <section aria-labelledby="config" className="border-t border-line-strong py-10">
          <h2 id="config" className="chamada text-2xl">Configurações e registros</h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <label className="flex items-center justify-between gap-4 border border-line p-4">
                <span><span className="block">Redação de parecer com IA</span><span className="text-sm text-ink-muted">Desligada por padrão. Quando ligada, só dados estruturados da composição são enviados ao modelo de IA do Lovable.</span></span>
                <Switch checked={ia} disabled={!m.admin} onCheckedChange={alternarIa} aria-label="Redação de parecer com IA" />
              </label>
              <Documentos base={base} admin={m.admin} />
              <p className="text-sm text-ink-muted">Notificações por e-mail aguardam um domínio de envio. Enquanto isso, os avisos aparecem nesta tela.</p>
            </div>
            {(m.admin || m.socio) && (
              <div>
                <RotuloMono as="p">Log de auditoria (somente leitura, últimos 60)</RotuloMono>
                <ul className="mt-2 max-h-96 overflow-y-auto text-sm">
                  {(log.data ?? []).map((l) => (
                    <li key={l.id} className="grid grid-cols-1 gap-x-2 border-b sm:grid-cols-[9rem_1fr] border-line py-1">
                      <span className="num text-xs">{new Date(l.quando).toLocaleString("pt-BR")}</span>
                      <span>{l.quem ? nomePessoa(base, l.quem) : "Sistema"} · {l.operacao.toLowerCase()} · {l.tabela}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </Conteudo>
    </>
  );
}
