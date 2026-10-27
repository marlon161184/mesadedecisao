import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Lock, Minus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Base } from "@/lib/base";
import type { DadosDecisao } from "@/lib/decisao-dados";
import {
  NOME_REGRA, VARIACAO_MAX, exigeJustificativa, hashSnapshot, pesosDe, pesosSemCusto, premorteValido, ranking, sensibilidade,
  type Regra,
} from "@/lib/decisao";
import { resultadoDoCenario, linhaComposicao } from "@/lib/cenarios";
import { aceitarAta } from "@/lib/decisao.functions";
import { formatarBRL, formatarData, formatarPct } from "@/lib/formato";
import { ROTULO_SEV } from "@/lib/pontos";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TabelaAdaptavel } from "@/components/newe/TabelaAdaptavel";
import { ROTULO_STATUS, nomePessoa, nomeProposta, type ModeloDecisao } from "./useDecisao";

type P = { base: Base; d: DadosDecisao; m: ModeloDecisao };

function useAtualizar() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["decisao"] }), qc.invalidateQueries({ queryKey: ["base"] })]);
}
const falha = (e: { message: string } | null) => { if (e) { toast.error(e.message); return true; } return false; };

export function Etapa({ n, titulo, status, children }: { n: number; titulo: string; status: ModeloDecisao["etapas"][number]; children: ReactNode }) {
  return (
    <section aria-labelledby={`etapa-${n}`} className={cn("border-t border-line-strong py-10", status === "bloqueada" && "opacity-70")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`etapa-${n}`} className="chamada text-2xl"><span className="label-mono mr-3 align-middle">Etapa {n}</span>{titulo}</h2>
        <Badge variant={status === "concluida" ? "default" : status === "bloqueada" ? "secondary" : "outline"}>
          {status === "bloqueada" && <Lock strokeWidth={1.5} className="mr-1 size-3" />}{ROTULO_STATUS[status]}
        </Badge>
      </div>
      <div className="mt-6">{status === "bloqueada" ? <p className="text-ink-muted">Conclua a etapa anterior para avançar.</p> : children}</div>
    </section>
  );
}

const SIMBOLO = { passa: <Check strokeWidth={1.5} className="size-4" />, reprova: <X strokeWidth={1.5} className="size-4" />, pendente: <Minus strokeWidth={1.5} className="size-4" /> };
const ROT_PORTAO = { passa: "Passa", reprova: "Reprova", pendente: "Pendente" } as const;

export function Preparar({ base, m }: P) {
  const atualizar = useAtualizar();
  if (m.propostas.length === 0) return <p className="label-mono">Aguardando propostas · Fase 2</p>;
  async function semResposta(perguntaId: string, propostaId: string) {
    const ex = base.respostas.find((r) => r.pergunta_id === perguntaId && r.proposta_id === propostaId);
    const { error } = ex
      ? await supabase.from("resposta_filtro").update({ sem_resposta: true }).eq("id", ex.id)
      : await supabase.from("resposta_filtro").insert({ pergunta_id: perguntaId, proposta_id: propostaId, sem_resposta: true });
    if (!falha(error)) atualizar();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <RotuloMono as="p">Checklist de equalização</RotuloMono>
        <ul className="mt-2 space-y-1">
          {m.propostas.map((p) => (
            <li key={p.id} className="flex justify-between border-b border-line py-1.5">
              <span>{nomeProposta(base, p.id)}</span>
              <span className="label-mono">{p.status === "validada" ? "Validada" : "Em equalização"}</span>
            </li>
          ))}
        </ul>
        {m.naoValidadas.length > 0 && <p className="mt-2 text-sm text-ink-muted">Valide as propostas em Admin para avançar.</p>}
      </div>
      <div>
        <RotuloMono as="p">Perguntas pendentes ({m.pendentesPerguntas.length})</RotuloMono>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {m.pendentesPerguntas.map(({ q, p }) => (
            <li key={q.id + p.id} className="flex items-start justify-between gap-3 border-b border-line py-1.5 text-sm">
              <span><span className="label-mono mr-2">{nomeProposta(base, p.id)}</span>{q.texto}</span>
              {m.admin && <Button size="sm" variant="outline" onClick={() => semResposta(q.id, p.id)}>Sem resposta</Button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Portoes({ base, m }: P) {
  const atualizar = useAtualizar();
  const [ed, setEd] = useState<Record<string, { resultado: string; justificativa: string; evidencia: string }>>({});
  async function salvar(portaoId: string, propostaId: string) {
    const k = portaoId + propostaId;
    const v = ed[k];
    if (!v) return;
    if (!v.justificativa.trim()) { toast.error("Justificativa obrigatória."); return; }
    const { error } = await supabase.from("portao_resultado").upsert({ portao_id: portaoId, proposta_id: propostaId, ...v }, { onConflict: "portao_id,proposta_id" });
    if (!falha(error)) { toast.success("Registrado no log."); setEd((s) => { const n = { ...s }; delete n[k]; return n; }); atualizar(); }
  }
  return (
    <div className="space-y-6">
      {m.portoes.map((g) => (
        <div key={g.id}>
          <p className="font-medium">{g.descricao}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {m.propostas.map((p) => {
              const r = m.resultado(g.id, p.id);
              const atual = (r?.resultado ?? "pendente") as keyof typeof SIMBOLO;
              const k = g.id + p.id;
              const e = ed[k];
              return (
                <div key={p.id} className={cn("border border-line p-3", atual === "reprova" && "opacity-60")}>
                  <div className="flex items-center justify-between"><span>{nomeProposta(base, p.id)}</span><span className="label-mono flex items-center gap-1">{SIMBOLO[atual]}{ROT_PORTAO[atual]}</span></div>
                  {r?.justificativa && <p className="mt-1 text-sm text-ink-muted">{r.justificativa}</p>}
                  {r?.evidencia && <p className="mt-1 text-xs text-ink-muted">Evidência: {r.evidencia}</p>}
                  {m.admin && (e ? (
                    <div className="mt-2 space-y-2">
                      <select aria-label="Resultado" className="campo w-full" value={e.resultado} onChange={(x) => setEd({ ...ed, [k]: { ...e, resultado: x.target.value } })}>
                        <option value="passa">Passa</option><option value="reprova">Reprova</option><option value="pendente">Pendente</option>
                      </select>
                      <textarea aria-label="Justificativa" placeholder={atual === "reprova" ? "Justificativa da reabilitação" : "Justificativa"} className="campo w-full" rows={2} value={e.justificativa} onChange={(x) => setEd({ ...ed, [k]: { ...e, justificativa: x.target.value } })} />
                      <input aria-label="Evidência" placeholder="Evidência (documento, página)" className="campo w-full" value={e.evidencia} onChange={(x) => setEd({ ...ed, [k]: { ...e, evidencia: x.target.value } })} />
                      <div className="flex gap-2"><Button size="sm" onClick={() => salvar(g.id, p.id)}>Registrar</Button><Button size="sm" variant="ghost" onClick={() => setEd((s) => { const n = { ...s }; delete n[k]; return n; })}>Cancelar</Button></div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setEd({ ...ed, [k]: { resultado: atual, justificativa: "", evidencia: r?.evidencia ?? "" } })}>
                      {atual === "reprova" ? "Reabilitar ou alterar" : "Registrar resultado"}
                    </Button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {m.reprovadas.size > 0 && <p className="text-sm">Fora da pontuação e dos cenários automáticos: {[...m.reprovadas].map((id) => nomeProposta(base, id)).join(", ")}.</p>}
    </div>
  );
}

export function Pontuacao({ base, d, m }: P) {
  const atualizar = useAtualizar();
  const [rasc, setRasc] = useState<Record<string, { nota: number; justificativa: string }>>({});
  const enviado = m.minhasNotas.length > 0;
  async function abrir() {
    const { error } = await supabase.from("trilha_decisao").update({ pontuacao_aberta: true, pontuacao_aberta_em: new Date().toISOString() }).eq("rfp_id", m.rfp.id);
    if (!falha(error)) { toast.success("Pontuação aberta."); atualizar(); }
  }
  async function enviar() {
    const linhas = m.elegiveis.flatMap((p) => m.criterios.map((c) => ({ c, p, v: rasc[c.id + p.id] })));
    if (linhas.some((l) => !l.v)) { toast.error("Dê nota a todos os critérios de todas as propostas."); return; }
    if (linhas.some((l) => exigeJustificativa(l.v!.nota) && !l.v!.justificativa.trim())) { toast.error("Notas 1, 2 e 5 exigem justificativa."); return; }
    const { error } = await supabase.from("nota_socio").insert(linhas.map((l) => ({ criterio_id: l.c.id, proposta_id: l.p.id, socio_id: d.eu.id, nota: l.v!.nota, justificativa: l.v!.justificativa || null })));
    if (!falha(error)) { toast.success("Notas enviadas e travadas."); atualizar(); }
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">Pontuação cega: ninguém vê as notas dos outros, nem o Admin, até a revelação. Depois de enviadas, as notas ficam travadas.</p>
      {!m.trilha?.pontuacao_aberta && (m.admin ? <Button onClick={abrir}>Abrir pontuação</Button> : <p>A pontuação ainda não foi aberta pelo Admin.</p>)}
      {m.trilha?.pontuacao_aberta && (
        <div>
          <RotuloMono as="p">Envios ({m.enviaram.length} de {d.socios.length} sócios)</RotuloMono>
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.socios.map((s) => <li key={s}><Badge variant={m.enviaram.includes(s) ? "default" : "outline"}>{nomePessoa(base, s)} · {m.enviaram.includes(s) ? "enviou" : "pendente"}</Badge></li>)}
          </ul>
        </div>
      )}
      {m.socio && m.trilha?.pontuacao_aberta && !m.revelado && (enviado ? (
        <p className="label-mono">Suas notas foram enviadas em {formatarData(m.minhasNotas[0]!.enviado_em)} e estão travadas.</p>
      ) : (
        <div>
          <PontuacaoCartoes base={base} m={m} rasc={rasc} setRasc={setRasc} />
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line-strong"><th className="label-mono py-2 text-left font-normal">Critério (peso)</th>{m.elegiveis.map((p) => <th key={p.id} className="label-mono px-2 text-left font-normal">{nomeProposta(base, p.id)}</th>)}</tr></thead>
            <tbody>
              {m.criterios.map((c) => (
                <tr key={c.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3">{c.nome} <span className="num text-ink-muted">({c.peso})</span></td>
                  {m.elegiveis.map((p) => {
                    const k = c.id + p.id;
                    const v = rasc[k];
                    return (
                      <td key={p.id} className="px-2 py-2">
                        <select aria-label={`Nota ${c.nome} ${nomeProposta(base, p.id)}`} className="campo w-20" value={v?.nota ?? ""} onChange={(e) => setRasc({ ...rasc, [k]: { nota: Number(e.target.value), justificativa: v?.justificativa ?? "" } })}>
                          <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        {v && exigeJustificativa(v.nota) && (
                          <textarea aria-label="Justificativa obrigatória" required placeholder="Justificativa obrigatória" rows={2} className="campo mt-1 w-full min-w-40" value={v.justificativa} onChange={(e) => setRasc({ ...rasc, [k]: { ...v, justificativa: e.target.value } })} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Button className="mt-4 w-full sm:w-auto" onClick={enviar}>Enviar notas</Button>
        </div>
      ))}
    </div>
  );
}

/** Celular: um critério por vez, em cartão, com botões de nota de 44 px e justificativa abaixo. */
function PontuacaoCartoes({ base, m, rasc, setRasc }: {
  base: Base; m: ModeloDecisao;
  rasc: Record<string, { nota: number; justificativa: string }>;
  setRasc: (r: Record<string, { nota: number; justificativa: string }>) => void;
}) {
  const [i, setI] = useState(0);
  const c = m.criterios[i];
  if (!c) return null;
  const feitos = m.criterios.filter((cc) => m.elegiveis.every((p) => rasc[cc.id + p.id])).length;
  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between gap-3">
        <RotuloMono>Critério {i + 1} de {m.criterios.length}</RotuloMono>
        <RotuloMono>{feitos} completo(s)</RotuloMono>
      </div>
      <article className="mt-3 border border-line-strong p-4" aria-label={`Critério ${c.nome}`}>
        <h3 className="text-xl">{c.nome} <span className="num text-sm text-ink-muted">peso {c.peso}</span></h3>
        <div className="mt-4 space-y-6">
          {m.elegiveis.map((p) => {
            const k = c.id + p.id;
            const v = rasc[k];
            const nome = nomeProposta(base, p.id);
            return (
              <fieldset key={p.id} className="border-t border-line pt-4">
                <legend className="label-mono float-left mb-2 w-full">{nome}</legend>
                <div role="radiogroup" aria-label={`Nota ${c.nome} ${nome}`} className="clear-both grid grid-cols-5 border border-line-strong">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={v?.nota === n}
                      onClick={() => setRasc({ ...rasc, [k]: { nota: n, justificativa: v?.justificativa ?? "" } })}
                      className={cn("num min-h-11 border-r border-line-strong text-lg last:border-r-0", v?.nota === n ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                      {n}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="label-mono text-ink-muted">{v && exigeJustificativa(v.nota) ? "Justificativa obrigatória" : "Justificativa (opcional)"}</span>
                  <textarea rows={2} className="campo mt-1 h-auto w-full py-2" required={!!v && exigeJustificativa(v.nota)}
                    value={v?.justificativa ?? ""} disabled={!v}
                    placeholder={v ? "" : "Escolha a nota primeiro"}
                    onChange={(e) => v && setRasc({ ...rasc, [k]: { ...v, justificativa: e.target.value } })} />
                </label>
              </fieldset>
            );
          })}
        </div>
      </article>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</Button>
        <Button variant="outline" disabled={i === m.criterios.length - 1} onClick={() => setI(i + 1)}>Próximo</Button>
      </div>
    </div>
  );
}

export function Revelacao({ base, d, m }: P) {
  const atualizar = useAtualizar();
  const [aberta, setAberta] = useState<string | null>(null);
  const todos = d.socios.length > 0 && m.enviaram.length === d.socios.length;
  const quorum = m.enviaram.length > d.socios.length / 2;
  async function revelar(porQuorum: boolean) {
    const { error } = await supabase.from("revelacao").insert({ rfp_id: m.rfp.id });
    if (falha(error)) return;
    if (porQuorum) await supabase.from("trilha_decisao").update({ encerrada_quorum: true }).eq("rfp_id", m.rfp.id);
    toast.success("Notas reveladas."); atualizar();
  }
  if (!m.revelado) return (
    <div className="space-y-3">
      <p>{todos ? "Todos os sócios enviaram." : `${m.enviaram.length} de ${d.socios.length} sócios enviaram.`}</p>
      {m.admin && <div className="flex flex-wrap gap-2">
        <Button disabled={!todos} onClick={() => revelar(false)}>Revelar notas</Button>
        <Button variant="outline" disabled={todos || !quorum} onClick={() => revelar(true)}>Encerrar com quórum</Button>
      </div>}
    </div>
  );
  const pesos = pesosDe(m.criterios);
  const rk = ranking(m.medias, pesos);
  const socios = [...new Set(m.notasRfp.map((n) => n.socio_id))];
  return (
    <div className="space-y-6">
      {m.trilha?.encerrada_quorum && <p className="label-mono">Encerrada pelo Admin com quórum</p>}
      <TabelaAdaptavel modo="rolagem" rotulo="Notas reveladas">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line-strong"><th className="label-mono min-w-32 py-2 pr-2 text-left font-normal">Critério</th>{m.elegiveis.map((p) => <th key={p.id} className="label-mono px-2 text-left font-normal">{nomeProposta(base, p.id)}</th>)}</tr></thead>
          <tbody>
            {m.criterios.map((c) => (
              <tr key={c.id} className="border-b border-line align-top">
                <td className="py-2">{c.nome} <span className="num text-ink-muted">({c.peso})</span></td>
                {m.elegiveis.map((p) => {
                  const dv = m.divs.find((x) => x.criterio_id === c.id && x.proposta_id === p.id);
                  const ns = m.notasRfp.filter((n) => n.criterio_id === c.id && n.proposta_id === p.id);
                  return (
                    <td key={p.id} className={cn("min-w-36 px-2 py-2", dv && "border border-terracota")}>
                      <span className="num text-base">{m.medias[p.id]?.[c.id]?.toFixed(2).replace(".", ",") ?? "—"}</span>
                      <span className="block text-xs text-ink-muted">{socios.map((s) => `${nomePessoa(base, s).split(" ")[0]} ${ns.find((n) => n.socio_id === s)?.nota ?? "—"}`).join(" · ")}</span>
                      {dv && <button className="label-mono mt-1 underline" onClick={() => setAberta(aberta === c.id + p.id ? null : c.id + p.id)}>Divergência · DP {dv.desvio.toFixed(2).replace(".", ",")}</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-line-strong"><td className="label-mono py-2">Nota ponderada</td>{m.elegiveis.map((p) => <td key={p.id} className="num px-2 text-lg">{rk.find((r) => r.proposta === p.id)?.nota.toFixed(2).replace(".", ",") ?? "—"}</td>)}</tr>
          </tbody>
        </table>
      </TabelaAdaptavel>
      {m.divs.filter((dv) => aberta === dv.criterio_id + dv.proposta_id).map((dv) => (
        <div key={aberta} className="border border-line p-4" role="region" aria-label="Discussão da divergência">
          <RotuloMono as="p">{m.criterios.find((c) => c.id === dv.criterio_id)?.nome} · {nomeProposta(base, dv.proposta_id)}</RotuloMono>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {dv.notas.map((n) => <div key={n.socio_id} className="border-l border-line-strong pl-3"><p className="label-mono">{nomePessoa(base, n.socio_id)} · nota {n.nota}</p><p className="mt-1">{n.justificativa ?? "Sem justificativa."}</p></div>)}
          </div>
        </div>
      ))}
      <p className="text-sm text-ink-muted">Divergência: desvio-padrão das notas de um critério maior ou igual a 1,2.</p>
    </div>
  );
}

export function Sensibilidade({ base, m }: P) {
  const [delta, setDelta] = useState<Record<string, number>>({});
  const pesos = useMemo(() => {
    const p0 = pesosDe(m.criterios);
    const somaDelta = Object.values(delta).reduce((a, b) => a + b, 0);
    const livres = m.criterios.filter((c) => !delta[c.id]);
    const somaLivres = livres.reduce((a, c) => a + c.peso, 0);
    const p: Record<string, number> = {};
    for (const c of m.criterios) p[c.id] = delta[c.id] ? c.peso + delta[c.id]! : somaLivres ? p0[c.id]! - (somaDelta * c.peso) / somaLivres : p0[c.id]!;
    return p;
  }, [delta, m.criterios]);
  const rk = ranking(m.medias, pesos);
  const rk0 = ranking(m.medias, pesosDe(m.criterios));
  const sem = ranking(m.medias, pesosSemCusto(m.criterios));
  const s = useMemo(() => sensibilidade(m.medias, m.criterios), [m.medias, m.criterios]);
  const maxAmp = Math.max(...s.tornado.map((t) => Math.abs(t.margemMin), 0), ...s.tornado.map((t) => Math.abs(t.margemMax)), 0.01);
  const nomeC = (id: string) => m.criterios.find((c) => c.id === id)?.nome ?? "";
  const Lista = ({ r }: { r: typeof rk }) => <ol className="mt-2 space-y-1">{r.map((x, i) => <li key={x.proposta} className="flex justify-between border-b border-line py-1"><span><span className="label-mono mr-2">{i + 1}º</span>{nomeProposta(base, x.proposta)}</span><span className="num">{x.nota.toFixed(2).replace(".", ",")}</span></li>)}</ol>;
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <RotuloMono as="p">Pesos (variação de até ±{VARIACAO_MAX} pontos; soma mantida em 100)</RotuloMono>
        {m.criterios.map((c) => (
          <label key={c.id} className="block">
            <span className="flex justify-between text-sm"><span>{c.nome}</span><span className="num">{pesos[c.id]!.toFixed(1).replace(".", ",")}</span></span>
            <input type="range" className="h-11 w-full accent-primary lg:h-auto" min={-VARIACAO_MAX} max={VARIACAO_MAX} step={1} value={delta[c.id] ?? 0} aria-label={`Variação do peso de ${c.nome}`}
              onChange={(e) => setDelta({ ...delta, [c.id]: Number(e.target.value) })} />
          </label>
        ))}
        <Button size="sm" variant="outline" onClick={() => setDelta({})}>Voltar aos pesos do RFP</Button>
      </div>
      <div className="space-y-6">
        <div><RotuloMono as="p">Ranking com os pesos ajustados</RotuloMono><Lista r={rk} /></div>
        <p>{s.testadas} variações testadas; {s.alteram} alteram a ordem.</p>
        <p>{s.menorVirada
          ? `O que precisa mudar para o ranking virar: mover ${s.menorVirada.pontos} ponto(s) de "${nomeC(s.menorVirada.de)}" para "${nomeC(s.menorVirada.para)}" leva ${nomeProposta(base, s.menorVirada.novoLider)} ao primeiro lugar.`
          : `Nenhuma variação de até ${VARIACAO_MAX} pontos tira ${s.lider ? nomeProposta(base, s.lider) : "o primeiro colocado"} do primeiro lugar.`}</p>
        <div>
          <RotuloMono as="p">Tornado: margem do 1º colocado com cada peso a −10 e +10</RotuloMono>
          <ul className="mt-2 space-y-1.5">
            {s.tornado.map((t) => (
              <li key={t.criterio_id} className="grid grid-cols-[minmax(0,6rem)_1fr_4.75rem] items-center gap-2 text-xs sm:grid-cols-[10rem_1fr_6rem]">
                <span className="truncate">{nomeC(t.criterio_id)}</span>
                <span className="relative h-4 border-x border-line"><span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                  <span className="absolute inset-y-0 bg-primary" style={{ left: `${50 + (t.margemMin / maxAmp) * 50}%`, width: `${((t.margemMax - t.margemMin) / maxAmp) * 50}%` }} />
                </span>
                <span className="num text-right">{t.margemMin.toFixed(2).replace(".", ",")} a {t.margemMax.toFixed(2).replace(".", ",")}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><RotuloMono as="p">Com o critério de custo</RotuloMono><Lista r={rk0} /></div>
          <div><RotuloMono as="p">Sem o critério de custo</RotuloMono><Lista r={sem} /></div>
        </div>
      </div>
    </div>
  );
}

export function Escolha({ base, d, m }: P) {
  const atualizar = useAtualizar();
  const [pm, setPm] = useState("");
  const [voto, setVoto] = useState<{ decisao: string; justificativa: string }>({ decisao: "aprovar", justificativa: "" });
  const meuPm = m.premortes.find((p) => p.socio_id === d.eu.id);
  const meuVoto = m.votos.find((v) => v.socio_id === d.eu.id);
  const upd = async (patch: import("@/integrations/supabase/types").TablesUpdate<"trilha_decisao">, ok: string) => {
    const { error } = await supabase.from("trilha_decisao").update(patch).eq("rfp_id", m.rfp.id);
    if (!falha(error)) { toast.success(ok); atualizar(); }
  };
  const r = m.candidato ? resultadoDoCenario(base, m.candidato) : null;
  return (
    <div className="space-y-6">
      {m.admin && !m.trilha?.votacao_aberta && (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block"><RotuloMono as="p">Cenário candidato</RotuloMono>
            <select className="campo mt-1 w-full" value={m.trilha?.cenario_candidato ?? ""} onChange={(e) => upd({ cenario_candidato: e.target.value || null }, "Candidato marcado.")}>
              <option value="">Escolha</option>{base.cenarios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></label>
          <label className="block"><RotuloMono as="p">Regra de decisão</RotuloMono>
            <select className="campo mt-1 w-full" value={m.trilha?.regra_decisao ?? "unanimidade"} onChange={(e) => upd({ regra_decisao: e.target.value }, "Regra definida.")}>
              {(Object.keys(NOME_REGRA) as Regra[]).map((k) => <option key={k} value={k}>{NOME_REGRA[k]}</option>)}
            </select></label>
          <div className="flex items-end"><Button disabled={!m.candidato} onClick={() => upd({ votacao_aberta: true }, "Votação aberta.")}>Abrir votação</Button></div>
        </div>
      )}
      {m.candidato && r && (
        <div className="border border-line p-4">
          <RotuloMono as="p">Candidato</RotuloMono>
          <p className="chamada mt-1 text-xl">{m.candidato.nome}</p>
          <p className="mt-1 text-sm">{linhaComposicao(r)}</p>
          <p className="num mt-2">{formatarBRL(r.total.central)} · cobertura {formatarPct(r.cobertura.conservadora)} a {formatarPct(r.cobertura.otimista)}</p>
          <p className="mt-1 text-sm text-ink-muted">Regra: {NOME_REGRA[(m.trilha?.regra_decisao ?? "unanimidade") as Regra]}</p>
        </div>
      )}
      {m.trilha?.votacao_aberta && m.candidato && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <RotuloMono as="p">Pré-mortem ({m.premortes.length} de {d.socios.length})</RotuloMono>
            <p className="mt-1 text-sm">Daqui a seis meses isto deu errado. O que aconteceu?</p>
            {m.socio && !meuPm && (
              <div className="mt-2">
                <textarea aria-label="Pré-mortem, até 5 linhas" rows={5} className="campo w-full" value={pm} onChange={(e) => setPm(e.target.value)} />
                <p className="label-mono mt-1">{pm.split("\n").length} de 5 linhas</p>
                <Button className="mt-2" disabled={!premorteValido(pm)} onClick={async () => {
                  const { error } = await supabase.from("premorte").insert({ cenario_id: m.candidato!.id, socio_id: d.eu.id, texto: pm.trim() });
                  if (!falha(error)) { toast.success("Pré-mortem enviado."); atualizar(); }
                }}>Enviar pré-mortem</Button>
              </div>
            )}
            <ul className="mt-3 space-y-3">
              {m.premortes.map((p) => <li key={p.socio_id} className="border-l border-line-strong pl-3"><p className="label-mono">{nomePessoa(base, p.socio_id)}</p><p className="whitespace-pre-line">{p.texto}</p></li>)}
            </ul>
            {meuPm && m.premortes.length < d.socios.length && <p className="mt-2 text-sm text-ink-muted">Os pré-mortens dos outros aparecem quando todos tiverem enviado.</p>}
          </div>
          <div>
            <RotuloMono as="p">Votos ({m.votos.length} de {d.socios.length})</RotuloMono>
            {m.socio && meuPm && !meuVoto && !m.trilha.votacao_encerrada && (
              <div className="mt-2 space-y-2">
                <div role="radiogroup" aria-label="Decisão" className="flex flex-wrap gap-2">
                  {[["aprovar", "Aprovar"], ["aprovar_com_ressalvas", "Aprovar com ressalvas"], ["rejeitar", "Rejeitar"]].map(([k, l]) => (
                    <Button key={k} role="radio" aria-checked={voto.decisao === k} size="sm" variant={voto.decisao === k ? "default" : "outline"} onClick={() => setVoto({ ...voto, decisao: k! })}>{l}</Button>
                  ))}
                </div>
                <textarea aria-label="Justificativa do voto" placeholder={voto.decisao === "aprovar_com_ressalvas" ? "Ressalvas (viram condições acompanhadas)" : "Justificativa"} rows={3} className="campo w-full" value={voto.justificativa} onChange={(e) => setVoto({ ...voto, justificativa: e.target.value })} />
                <Button disabled={!voto.justificativa.trim()} onClick={async () => {
                  const { error } = await supabase.from("voto").insert({ cenario_id: m.candidato!.id, socio_id: d.eu.id, decisao: voto.decisao, justificativa: voto.justificativa.trim() });
                  if (!falha(error)) { toast.success("Voto registrado."); atualizar(); }
                }}>Votar</Button>
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {m.votos.map((v) => <li key={v.socio_id} className="border-b border-line py-1"><span className="label-mono mr-2">{nomePessoa(base, v.socio_id)} · {v.decisao === "aprovar" ? "Aprova" : v.decisao === "rejeitar" ? "Rejeita" : "Aprova com ressalvas"}</span>{v.justificativa}</li>)}
            </ul>
            <p className="mt-3 font-medium">{m.votacao.completa ? (m.votacao.aprovado ? "Aprovado pela regra definida." : "Não aprovado pela regra definida.") : `Faltam ${m.votacao.faltam} voto(s).`}</p>
            {m.votacao.condicoes.length > 0 && <div className="mt-2"><RotuloMono as="p">Condições acompanhadas</RotuloMono><ul className="list-inside list-disc">{m.votacao.condicoes.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
            {m.votacao.rejeicoes > 0 && (
              <div className="mt-3 border border-terracota p-3">
                <p>Houve rejeição. Sugerimos voltar ao simulador. Motivos:</p>
                <ul className="list-inside list-disc">{m.votacao.motivosRejeicao.map((c, i) => <li key={i}>{c}</li>)}</ul>
                <Button asChild size="sm" variant="outline" className="mt-2"><Link to="/mesa/simulador" search={true as never}>Voltar ao simulador</Link></Button>
              </div>
            )}
            {m.admin && !m.trilha.votacao_encerrada && m.votacao.completa && <Button className="mt-3" onClick={() => upd({ votacao_encerrada: true }, "Votação encerrada.")}>Encerrar votação</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

interface PontoAberto { texto: string; severidade: string; responsavel: string; prazo: string }

export async function montarSnapshot(base: Base, cenarioId: string) {
  const mods = base.cenarioModulos.filter((x) => x.cenario_id === cenarioId);
  const propIds = new Set(mods.map((x) => x.proposta_id).filter(Boolean) as string[]);
  return {
    congelado_em: new Date().toISOString(),
    premissas: base.premissas.map((p) => ({ chave: p.chave, valor: p.valor })),
    propostas: base.propostas.filter((p) => propIds.has(p.id)).map((p) => ({ id: p.id, player_id: p.player_id, versao: p.versao, status: p.status, validade_ate: p.validade_ate })),
    itens: base.itens.filter((i) => propIds.has(i.proposta_id)),
    coberturas: base.coberturas.filter((c) => propIds.has(c.proposta_id)),
    composicao: mods.map((x) => ({ modulo_id: x.modulo_id, proposta_id: x.proposta_id, opcao: x.opcao })),
  };
}

export function AtaEtapa({ base, d, m }: P) {
  const atualizar = useAtualizar();
  const aceitar = useServerFn(aceitarAta);
  const ata = m.ataAtual;
  const [txt, setTxt] = useState({ ressalvas: "", proximos: "" });
  const [pontos, setPontos] = useState<PontoAberto[] | null>(null);
  const [just, setJust] = useState("");
  const editavel = ata && ata.status !== "aprovada" && m.admin;
  const pts: PontoAberto[] = pontos ?? ((ata?.pontos_abertos as unknown as PontoAberto[]) ?? []);

  async function gerar(anterior?: typeof ata) {
    if (!m.candidato) return;
    const r = resultadoDoCenario(base, m.candidato);
    const abertos: PontoAberto[] = r.pontos.filter((p) => p.severidade === "critico" || p.severidade === "alto").map((p) => ({ texto: p.texto, severidade: ROTULO_SEV[p.severidade], responsavel: "", prazo: "" }));
    const { error } = await supabase.from("ata").insert({
      rfp_id: m.rfp.id, cenario_id: m.candidato.id, versao: (anterior?.versao ?? 0) + 1,
      ressalvas: anterior?.ressalvas ?? m.votacao.condicoes.join("\n"), proximos_passos: anterior?.proximos_passos ?? "",
      pontos_abertos: (anterior?.pontos_abertos ?? abertos) as never,
      ...(anterior ? { versao_anterior: anterior.id, justificativa_revisao: just.trim() } : {}),
    });
    if (!falha(error)) { toast.success(anterior ? "Nova versão criada." : "Ata gerada."); setJust(""); atualizar(); }
  }
  async function salvar() {
    if (!ata) return;
    const { error } = await supabase.from("ata").update({ ressalvas: txt.ressalvas || ata.ressalvas, proximos_passos: txt.proximos || ata.proximos_passos, pontos_abertos: pts as never }).eq("id", ata.id);
    if (!falha(error)) { toast.success("Ata salva."); setPontos(null); atualizar(); }
  }
  async function aprovar() {
    if (!ata || !m.candidato) return;
    const snapshot = await montarSnapshot(base, m.candidato.id);
    const snapshot_hash = await hashSnapshot(snapshot);
    const { error } = await supabase.from("ata").update({ status: "aprovada", snapshot: snapshot as never, snapshot_hash, aprovada_em: new Date().toISOString(), aprovada_por: d.eu.id }).eq("id", ata.id);
    if (!falha(error)) { toast.success("Ata aprovada e congelada."); atualizar(); }
  }
  if (!ata) return m.admin ? <Button onClick={() => gerar()}>Gerar ata</Button> : <p>A ata ainda não foi gerada.</p>;
  const aceites = d.aceites.filter((a) => a.ata_id === ata.id);
  const meuAceite = aceites.find((a) => a.socio_id === d.eu.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={ata.status === "aprovada" ? "default" : "outline"}>Versão {ata.versao} · {ata.status === "aprovada" ? "Aprovada e imutável" : "Rascunho"}</Badge>
        {ata.snapshot_hash && <span className="label-mono">Snapshot SHA-256 {ata.snapshot_hash.slice(0, 16)}…</span>}
        {!m.observador && <Button asChild size="sm" variant="outline"><a href={`/imprimir-ata/${ata.id}`} target="_blank" rel="noreferrer">Exportar PDF</a></Button>}
      </div>
      {ata.justificativa_revisao && <p className="text-sm">Revisão: {ata.justificativa_revisao}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><RotuloMono as="p">Ressalvas e condições</RotuloMono>
          <textarea className="campo mt-1 w-full" rows={4} disabled={!editavel} defaultValue={ata.ressalvas ?? ""} onChange={(e) => setTxt({ ...txt, ressalvas: e.target.value })} /></label>
        <label className="block"><RotuloMono as="p">Próximos passos</RotuloMono>
          <textarea className="campo mt-1 w-full" rows={4} disabled={!editavel} defaultValue={ata.proximos_passos ?? ""} onChange={(e) => setTxt({ ...txt, proximos: e.target.value })} /></label>
      </div>
      <div>
        <RotuloMono as="p">Pontos de atenção abertos</RotuloMono>
        <TabelaAdaptavel modo="cartoes" className="mt-2">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line-strong"><th className="label-mono py-1 text-left font-normal">Ponto</th><th className="label-mono text-left font-normal">Responsável</th><th className="label-mono text-left font-normal">Prazo</th></tr></thead>
          <tbody>{pts.map((p, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-1 pr-2">[{p.severidade}] {p.texto}</td>
              <td><input aria-label="Responsável" className="campo w-full" disabled={!editavel} value={p.responsavel} onChange={(e) => setPontos(pts.map((x, j) => j === i ? { ...x, responsavel: e.target.value } : x))} /></td>
              <td><input aria-label="Prazo" type="date" className="campo" disabled={!editavel} value={p.prazo} onChange={(e) => setPontos(pts.map((x, j) => j === i ? { ...x, prazo: e.target.value } : x))} /></td>
            </tr>
          ))}</tbody>
        </table>
        </TabelaAdaptavel>
      </div>
      {editavel && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={salvar}>Salvar rascunho</Button><Button onClick={aprovar}>Congelar snapshot e aprovar</Button></div>}
      {ata.status === "aprovada" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <RotuloMono as="p">Aceites ({aceites.length} de {d.socios.length})</RotuloMono>
            <ul className="mt-1">{aceites.map((a) => <li key={a.socio_id} className="text-sm">{a.nome} · {new Date(a.aceito_em).toLocaleString("pt-BR")}</li>)}</ul>
            {m.socio && !meuAceite && <Button className="mt-2" onClick={async () => {
              try { await aceitar({ data: { ataId: ata.id, nome: base.perfis.find((p) => p.id === d.eu.id)?.nome ?? "Sócio" } }); toast.success("Aceite registrado."); atualizar(); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Falha no aceite."); }
            }}>Dar aceite eletrônico</Button>}
          </div>
          {m.admin && <div>
            <RotuloMono as="p">Revisar (cria nova versão)</RotuloMono>
            <textarea aria-label="Justificativa da revisão" className="campo mt-1 w-full" rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa obrigatória" />
            <Button className="mt-2" variant="outline" disabled={!just.trim()} onClick={() => gerar(ata)}>Criar nova versão</Button>
          </div>}
        </div>
      )}
    </div>
  );
}
