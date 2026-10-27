import { createFileRoute } from "@tanstack/react-router";
import { useMesa, fundoPlayer, padraoPlayer } from "@/components/mesa/useMesa";
import { AberturaTela, BarraCobertura, Conteudo, Indicador, SeloStatus, SemPropostas, Valor } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { formatarData } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/visao")({
  head: () => ({
    meta: [
      { title: "Visão geral · NEWE Mesa de Decisão" },
      { name: "description", content: "Resumo equalizado das propostas por RFP." },
      { property: "og:title", content: "Visão geral · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Resumo equalizado das propostas por RFP." },
    ],
  }),
  component: Visao,
});

function Visao() {
  const { f, set, base, rfp, analises, modulos, pontos, premissas } = useMesa();
  const comValidade = analises.filter((a) => a.validadeDias != null).sort((a, b) => a.validadeDias! - b.validadeDias!);
  const proxima = comValidade[0];
  const ordenadas = [...analises].sort((a, b) => {
    if (f.ordem === "cobertura") return b.cobertura.conservadora - a.cobertura.conservadora;
    if (f.ordem === "eficiencia") return (b.eficiencia ?? -1) - (a.eficiencia ?? -1);
    if (f.ordem === "nome") return a.player.nome.localeCompare(b.player.nome);
    return a.total.central - b.total.central;
  });

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Visão geral`} titulo={rfp.nome}>
        <span className="label-mono">Fase {rfp.fase} · {rfp.periodo} · janela de {premissas.janela_meses} meses</span>
      </AberturaTela>
      <Conteudo>
        {rfp.numero === 3 || analises.length === 0 ? (
          <SemPropostas base={base} modulos={modulos} />
        ) : (
          <>
            {proxima && (
              <div className={cn("mb-8 border p-4", proxima.validadeDias! <= 10 ? "border-flamboyant bg-flamboyant text-luz" : "border-line")}>
                <span className="label-mono">Validade</span>{" "}
                {proxima.validadeDias! < 0
                  ? `A proposta de ${proxima.player.nome} venceu em ${formatarData(proxima.proposta.validade_ate)}.`
                  : `A proposta de ${proxima.player.nome} vence em ${proxima.validadeDias} dias (${formatarData(proxima.proposta.validade_ate)}).`}
                {comValidade.length < analises.length && (
                  <span className="ml-2 text-sm opacity-80">{analises.length - comValidade.length} proposta(s) sem validade informada.</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 border border-line md:grid-cols-4">
              <Indicador rotulo="Propostas recebidas" valor={analises.length} />
              <Indicador rotulo="Validadas" valor={analises.filter((a) => a.proposta.status === "validada").length} />
              <Indicador rotulo="Pontos críticos" valor={pontos.filter((p) => p.severidade === "critico").length} alerta={pontos.some((p) => p.severidade === "critico")} />
              <Indicador rotulo="Portões reprovados" valor={analises.reduce((s, a) => s + a.portoes.reprova, 0)} />
            </div>

            <div className="mt-12 flex items-end justify-between">
              <RotuloMono as="p">Propostas</RotuloMono>
              <label className="flex items-center gap-2 text-sm">
                <span className="label-mono text-ink-muted">Ordenar por</span>
                <select className="campo w-44" value={f.ordem} onChange={(e) => set({ ordem: e.target.value })}>
                  <option value="total">Menor total</option>
                  <option value="cobertura">Maior cobertura</option>
                  <option value="eficiencia">Maior eficiência</option>
                  <option value="nome">Nome</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {ordenadas.map((a) => (
                <article key={a.proposta.id} className="border border-line">
                  <div className={cn("h-2", fundoPlayer(a.player.cor_token), padraoPlayer(a.player.cor_token))} aria-hidden />
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-2xl">{a.player.nome}</h2>
                      <SeloStatus status={a.proposta.status} />
                    </div>
                    <dl className="mt-6 space-y-5">
                      <div>
                        <RotuloMono as="dt">Total na janela</RotuloMono>
                        <dd className="mt-1 text-2xl"><Valor faixa={a.total} incerteza={f.incerteza} /></dd>
                        {a.compromisso && (
                          <dd className="mt-1 text-sm text-ink-muted">
                            Compromisso do contrato de {a.proposta.contrato_meses_proposto} meses: <Valor faixa={a.compromisso} incerteza={false} />
                          </dd>
                        )}
                      </div>
                      <div>
                        <RotuloMono as="dt">Cobertura</RotuloMono>
                        <dd className="mt-2"><BarraCobertura c={a.cobertura} /></dd>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <RotuloMono as="dt">Eficiência</RotuloMono>
                          <dd className="num mt-1">{a.eficiencia == null ? "—" : `${a.eficiencia.toFixed(1).replace(".", ",")} pts / R$ 100 mil`}</dd>
                        </div>
                        <div>
                          <RotuloMono as="dt">Essenciais não cobertos</RotuloMono>
                          <dd className="num mt-1">{a.bloqueios.length}</dd>
                        </div>
                      </div>
                      <div>
                        <RotuloMono as="dt">Portões</RotuloMono>
                        <dd className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">Passa {a.portoes.passa}</Badge>
                          <Badge variant={a.portoes.reprova ? "flamboyant" : "outline"}>Reprova {a.portoes.reprova}</Badge>
                          <Badge variant="secondary">Pendente {a.portoes.pendente}</Badge>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <p className="mt-12 border-l-2 border-terracota pl-4 text-sm">
          Escopos não são totalmente equivalentes. Veja Entregas normalizadas antes de concluir por preço.
        </p>
      </Conteudo>
    </>
  );
}
