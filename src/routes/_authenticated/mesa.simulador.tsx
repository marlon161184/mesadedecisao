import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMesa } from "@/components/mesa/useMesa";
import { useSessao } from "@/components/newe/Moldura";
import { AberturaTela } from "@/components/mesa/partes";
import { BarraExpectativa, CartaoNumero, Contagem, GraficoDesembolso, ListaPontos, TabelaSimples } from "@/components/mesa/simulacao";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarBRL, formatarPct } from "@/lib/formato";
import {
  analisarComposicao, composicaoDoCenario, modulosDaComposicao, opcoesDoModulo,
  type Composicao, type Opcao,
} from "@/lib/composicao";
import { parecerAutomatico, dadosParaIA } from "@/lib/parecer";
import { dataDecisao } from "@/lib/composicao";
import { redigirParecer } from "@/lib/parecer.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/simulador")({
  validateSearch: (s: Record<string, unknown>): { cenario?: string | undefined; comp?: string | undefined } => ({
    cenario: typeof s["cenario"] === "string" ? s["cenario"] : undefined,
    comp: typeof s["comp"] === "string" ? s["comp"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Simulador · NEWE Mesa de Decisão" },
      { name: "description", content: "Monte composições de players por módulo e veja custo, cobertura e riscos." },
      { property: "og:title", content: "Simulador · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Monte composições de players por módulo e veja custo, cobertura e riscos." },
    ],
  }),
  component: Simulador,
});

const VAZIA: Composicao = { escolhas: {}, contarApenas: {}, incluirFase2: false, incluirNaoValidadas: true };
const ROT_TIPO: Record<string, string> = { recorrente: "Recorrente", pontual: "Pontual", variavel: "Variável" };

function Simulador() {
  const { set, base, premissas } = useMesa();
  const { cenario: cenarioId, comp: compParam } = Route.useSearch();
  const { data: sessao } = useSessao();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const redigir = useServerFn(redigirParecer);
  const cenario = base.cenarios.find((c) => c.id === cenarioId);

  const [comp, setComp] = useState<Composicao>(VAZIA);
  const [parecer, setParecer] = useState<{ texto: string; ia: boolean; revisado: boolean } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [salvar, setSalvar] = useState(false);
  const [zona, setZona] = useState<"composicao" | "resultado" | "parecer">("composicao");
  const [form, setForm] = useState({ nome: "", descricao: "" });

  useEffect(() => {
    if (cenario) {
      setComp(composicaoDoCenario(base.cenarioModulos.filter((m) => m.cenario_id === cenario.id), cenario.config as Record<string, unknown>));
      setParecer(cenario.parecer ? { texto: cenario.parecer, ia: false, revisado: cenario.parecer_revisado } : null);
      setForm({ nome: cenario.nome, descricao: cenario.descricao ?? "" });
    } else if (compParam) {
      try { setComp({ ...VAZIA, ...(JSON.parse(compParam) as Partial<Composicao>) }); } catch { /* ignora */ }
    }
  }, [cenarioId, compParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => analisarComposicao(base, comp, premissas, { dataDecisao: dataDecisao(base) }), [base, comp, premissas]);
  const grupos = useMemo(() => {
    const lista = modulosDaComposicao(base, true);
    return [1, 2, 3].map((n) => ({ rfp: base.rfps.find((x) => x.numero === n)!, mods: lista.filter((x) => x.rfp.numero === n).map((x) => x.m) }));
  }, [base]);

  const escolher = (moduloId: string, o: Opcao) => setComp((c) => ({ ...c, escolhas: { ...c.escolhas, [moduloId]: o } }));
  const aplicarATodos = (propostaId: string) => {
    const mods = new Set(base.itens.filter((i) => i.proposta_id === propostaId).map((i) => i.modulo_id));
    setComp((c) => ({ ...c, escolhas: { ...c.escolhas, ...Object.fromEntries([...mods].filter(Boolean).map((m) => [m!, { tipo: "player", propostaId } as Opcao])) } }));
  };
  const internoSemComentario = Object.values(comp.escolhas).some((o) => o.tipo === "interno" && !o.comentario.trim());

  async function gerarIA() {
    setGerando(true);
    try {
      const res = await redigir({ data: { dados: dadosParaIA(base, r) } });
      if (res.ok) setParecer({ texto: res.texto, ia: true, revisado: false });
      else toast.error(res.erro);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao redigir.");
    } finally {
      setGerando(false);
    }
  }

  async function gravar(novo: boolean) {
    if (internoSemComentario) { toast.error("Comente cada módulo marcado como Time interno NEWE."); return; }
    if (!form.nome.trim()) { toast.error("Dê um nome ao cenário."); return; }
    const parecerOk = parecer && (!parecer.ia || parecer.revisado);
    if (parecer?.ia && !parecer.revisado) toast("O rascunho de IA não revisado não foi salvo no cenário.");
    const config = { contarApenas: comp.contarApenas, incluirFase2: comp.incluirFase2, incluirNaoValidadas: comp.incluirNaoValidadas, premissas: { janela: premissas.janela_meses, preco: premissas.aplicar_desconto_negociado ? "negociado" : "lista", verba: premissas.verba_midia_mensal, produtos: premissas.produtos_performance, rigor: premissas.fator_evidencia_declarado } };
    const dados = {
      nome: form.nome.trim().slice(0, 120), descricao: form.descricao.trim().slice(0, 1000) || null, config: config as never,
      parecer: parecerOk ? parecer!.texto : (cenario?.parecer ?? null), parecer_revisado: parecerOk ? true : (cenario?.parecer_revisado ?? false),
    };
    let id = cenario?.id;
    let versao = 1;
    if (novo || !cenario) {
      const { data, error } = await supabase.from("cenario").insert(dados).select("id").single();
      if (error) { toast.error(error.message); return; }
      id = data.id;
    } else {
      versao = cenario.versao + 1;
      const { error } = await supabase.from("cenario").update({ ...dados, versao, atualizado_em: new Date().toISOString() }).eq("id", cenario.id);
      if (error) { toast.error("Só o autor ou o Admin altera este cenário. Use Salvar como novo."); return; }
      await supabase.from("cenario_modulo").delete().eq("cenario_id", cenario.id);
    }
    const linhas = Object.entries(comp.escolhas).map(([modulo_id, o]) => ({
      cenario_id: id!, modulo_id, opcao: o.tipo, proposta_id: o.tipo === "player" ? o.propostaId : null, comentario: o.tipo === "interno" ? o.comentario : null,
    }));
    if (linhas.length) {
      const { error } = await supabase.from("cenario_modulo").insert(linhas);
      if (error) { toast.error(error.message); return; }
    }
    await supabase.from("cenario_versao").insert({ cenario_id: id!, versao, snapshot: { ...dados, composicao: linhas, total: r.total, cobertura: r.cobertura } as never });
    toast.success(`Cenário salvo (versão ${versao}).`);
    setSalvar(false);
    await qc.invalidateQueries({ queryKey: ["base"] });
    navigate({ to: "/mesa/simulador", search: ((p: Record<string, unknown>) => ({ ...p, cenario: id, comp: undefined })) as never });
  }

  const podeSimular = sessao?.papeis.some((x) => x === "socio" || x === "admin");

  return (
    <>
      <AberturaTela numero="Simulador" titulo={cenario ? cenario.nome : "Composição de players"}>
        Escolha um player por módulo. Tudo recalcula a cada troca.
      </AberturaTela>

      {/* Controles de simulação */}
      <div className="grid grid-cols-2 gap-4 border-b border-line px-4 py-5 md:grid-cols-4 md:px-8 lg:px-12 xl:grid-cols-7">
        <label><span className="label-mono mb-1.5 block text-ink-muted">Janela</span>
          <select className="campo" value={premissas.janela_meses} onChange={(e) => set({ janela: Number(e.target.value) })}>
            {[6, 9, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}
          </select></label>
        <label><span className="label-mono mb-1.5 block text-ink-muted">Preço</span>
          <select className="campo" value={premissas.aplicar_desconto_negociado ? "negociado" : "lista"} onChange={(e) => set({ preco: e.target.value as "lista" | "negociado" })}>
            <option value="negociado">Negociado</option><option value="lista">Lista</option>
          </select></label>
        <label><span className="label-mono mb-1.5 block text-ink-muted">Verba mensal</span>
          <input type="number" min={0} step={5000} className="campo num" value={premissas.verba_midia_mensal} onChange={(e) => set({ verba: Number(e.target.value) })} /></label>
        <label><span className="label-mono mb-1.5 block text-ink-muted">Produtos</span>
          <input type="number" min={1} max={10} className="campo num" value={premissas.produtos_performance} onChange={(e) => set({ produtos: Math.max(1, Number(e.target.value)) })} /></label>
        <label><span className="label-mono mb-1.5 block text-ink-muted">Rigor da evidência</span>
          <select className="campo" value={premissas.fator_evidencia_declarado} onChange={(e) => set({ rigor: Number(e.target.value) })}>
            {[1, 0.7, 0].map((v) => <option key={v} value={v}>Declarado {Math.round(v * 100)}%</option>)}
          </select></label>
        <label className="flex min-h-11 items-end gap-2 pb-2 text-sm"><input type="checkbox" className="size-4" checked={comp.incluirFase2} onChange={(e) => setComp({ ...comp, incluirFase2: e.target.checked })} /> Incluir fase 2</label>
        <label className="flex min-h-11 items-end gap-2 pb-2 text-sm"><input type="checkbox" className="size-4" checked={comp.incluirNaoValidadas} onChange={(e) => setComp({ ...comp, incluirNaoValidadas: e.target.checked })} /> Incluir não validadas</label>
      </div>

      <div className="grid grid-cols-12 gap-8 px-4 pb-28 pt-8 md:px-8 lg:px-12 xl:py-10">
        {/* COMPOSIÇÃO */}
        <section id="zona-composicao" className={cn("col-span-12 min-w-0 xl:col-span-3 xl:block", zona !== "composicao" && "hidden")} aria-label="Composição">
          <RotuloMono as="p">Composição</RotuloMono>
          <div className="mt-4 space-y-8">
            {grupos.map(({ rfp, mods }) => {
              const fase2 = rfp.fase === 2;
              const conteudo = (
                <div className="space-y-4">
                  {mods.map((m) => {
                    const ops = opcoesDoModulo(base, m.id);
                    const atual = comp.escolhas[m.id] ?? { tipo: "a_cotar" };
                    const valor = atual.tipo === "player" ? atual.propostaId : atual.tipo;
                    return (
                      <div key={m.id}>
                        <label htmlFor={`m-${m.id}`} className="block text-sm"><span className="label-mono mr-2 text-ink-muted">{m.codigo}</span>{m.nome}</label>
                        <select id={`m-${m.id}`} className="campo mt-1" value={valor} disabled={fase2 && !comp.incluirFase2}
                          onChange={(e) => {
                            const v = e.target.value;
                            escolher(m.id, v === "a_cotar" ? { tipo: "a_cotar" } : v === "interno" ? { tipo: "interno", comentario: "" } : { tipo: "player", propostaId: v });
                          }}>
                          <option value="a_cotar">A cotar (sem cobertura)</option>
                          <option value="interno">Time interno NEWE</option>
                          {ops.map(({ proposta, player }) => {
                            const bloqueado = proposta.status !== "validada" && !comp.incluirNaoValidadas;
                            return <option key={proposta.id} value={proposta.id} disabled={bloqueado}>{player.nome}{proposta.status !== "validada" ? " · EM EQUALIZAÇÃO" : ""}</option>;
                          })}
                        </select>
                        {atual.tipo === "interno" && (
                          <textarea aria-label={`Comentário do time interno em ${m.codigo}`} required maxLength={500} rows={2}
                            placeholder="Comentário obrigatório: quem faz e como"
                            className={cn("campo mt-1 h-auto py-1.5", !atual.comentario.trim() && "border-flamboyant")}
                            value={atual.comentario} onChange={(e) => escolher(m.id, { tipo: "interno", comentario: e.target.value })} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
              return (
                <div key={rfp.id} className="border-t border-line-strong pt-4">
                  {fase2 ? (
                    <details>
                      <summary className="flex cursor-pointer items-center justify-between">
                        <span className="label-mono">RFP 3 · Comercial</span><Badge variant="outline">Fase 2</Badge>
                      </summary>
                      <p className="mt-2 text-xs text-ink-muted">Fora dos totais da fase 1, salvo com a chave "Incluir fase 2".</p>
                      <div className="mt-4">{conteudo}</div>
                    </details>
                  ) : (
                    <><p className="label-mono mb-3">RFP {rfp.numero} · {rfp.numero === 1 ? "Custódia" : "Criativo, dados, performance e CRM"}</p>{conteudo}</>
                  )}
                </div>
              );
            })}
            <div className="border-t border-line pt-4">
              <RotuloMono as="p">Aplicar player a todos os módulos que ele cobre</RotuloMono>
              <div className="mt-2 flex flex-wrap gap-2">
                {base.propostas.map((p) => (
                  <Button key={p.id} size="sm" variant="secondary" disabled={p.status !== "validada" && !comp.incluirNaoValidadas} onClick={() => aplicarATodos(p.id)}>
                    {base.players.find((x) => x.id === p.player_id)?.nome}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RESULTADO */}
        <section id="zona-resultado" className={cn("col-span-12 min-w-0 space-y-10 xl:col-span-6 xl:block", zona !== "resultado" && "hidden")} aria-label="Resultado" aria-live="polite">
          <div className="sticky top-[var(--altura-cabecalho,0px)] z-20 -mx-4 grid grid-cols-2 gap-px border-y border-line bg-line md:-mx-8 lg:top-0 xl:hidden" aria-label="Resumo">
            {[
              ["Total", formatarBRL(r.total.central)],
              ["Faixa", r.total.eFaixa ? `${formatarBRL(r.total.min)} a ${formatarBRL(r.total.max)}` : "Sem faixa"],
              ["Cobertura", `${formatarPct(r.cobertura.conservadora)} a ${formatarPct(r.cobertura.otimista)}`],
              ["Pontos críticos", String(r.contagem.critico)],
            ].map(([k, v]) => (
              <div key={k} className={cn("min-w-0 bg-background px-4 py-2", k === "Pontos críticos" && r.contagem.critico > 0 && "bg-flamboyant text-luz")}>
                <p className="label-mono text-[0.6875rem] opacity-80">{k}</p>
                <p className="num truncate text-sm">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RotuloMono as="p">Resultado · {r.pontos.length} ponto(s) de atenção</RotuloMono>
            <Contagem r={r} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CartaoNumero rotulo="Total na janela" valor={formatarBRL(r.total.central)} sub={r.total.eFaixa ? `Faixa ${formatarBRL(r.total.min)} a ${formatarBRL(r.total.max)}` : undefined} />
            <CartaoNumero rotulo="Custo ajustado ao escopo" valor={formatarBRL(r.ajustado.ajustado)} sub={`+ ${formatarBRL(r.ajustado.acrescimo)} para cobrir essenciais · ${r.ajustado.semEstimativa} sem estimativa`} />
            <CartaoNumero rotulo="Média mensal na janela" valor={formatarBRL(r.mediaMensal)} sub={`${premissas.janela_meses} meses`} />
            {r.compromisso ? (
              <CartaoNumero destaque rotulo="Compromisso total dos contratos" valor={formatarBRL(r.compromisso.total)}
                sub={r.compromisso.porPlayer.map((x) => `${x.nome}: ${x.meses} meses`).join(" · ")} />
            ) : <CartaoNumero rotulo="Compromisso dos contratos" valor="Igual à janela" />}
          </div>
          <p className="text-xs text-ink-muted">Nenhum total inclui honorários de consultoria do facilitador do processo.</p>

          {r.sobreposicoes.length > 0 && (
            <div className="space-y-3">
              {r.sobreposicoes.map((s) => (
                <div key={s.entregaChave} className={cn("border p-4", s.escolhido ? "border-line" : "border-flamboyant bg-flamboyant text-luz")}>
                  <p className="label-mono">{s.escolhido ? "Sobreposição resolvida" : "Crítico · sobreposição"}</p>
                  <p className="mt-1">{s.entregaChave}: {s.players.map((x) => `${x.nome} (${formatarBRL(x.valor)})`).join(" e ")}.</p>
                  <label className="mt-2 flex items-center gap-2 text-sm">Contar apenas:
                    <select className="campo w-48 text-foreground" value={s.escolhido ?? ""} onChange={(e) => setComp({ ...comp, contarApenas: { ...comp.contarApenas, [s.entregaChave]: e.target.value } })}>
                      <option value="">Ainda não escolhido (soma os dois)</option>
                      {s.players.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}

          <div>
            <RotuloMono as="p">Expectativa x realidade</RotuloMono>
            <p className="mt-1 text-xs text-ink-muted">Contorno = 100% do que os RFPs pedem. Preenchido = conservador. Hachurado = até o otimista.</p>
            <div className="mt-4 space-y-2">
              <BarraExpectativa rotulo={comp.incluirFase2 ? "Fases 1 e 2" : "Fase 1 (RFPs 1 e 2)"} c={r.cobertura} />
              {r.porRfp.map((x) => <BarraExpectativa key={x.numero} rotulo={`RFP ${x.numero}`} c={x.cobertura} />)}
            </div>
            <div className="mt-4 space-y-1.5">
              {r.modulos.map((m) => <BarraExpectativa key={m.modulo.id} rotulo={`${m.modulo.codigo} ${m.modulo.nome}`} c={m.cobertura} semPlayer={m.semCobertura} />)}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <CartaoNumero rotulo="Eficiência (R8)" valor={r.eficiencia == null ? "—" : `${r.eficiencia.toFixed(1).replace(".", ",")} pts`} sub="por R$ 100 mil" />
              <div className="border border-line-strong p-4 sm:p-5 md:col-span-2"><p className="label-mono text-ink-muted">Veredito</p><p className="mt-2">{r.veredito}</p></div>
            </div>
          </div>

          <div>
            <RotuloMono as="p">Lacunas · {r.lacunas.length} requisito(s) essencial(is)</RotuloMono>
            <div className="mt-3 space-y-4">
              {[...new Set(r.lacunas.map((l) => l.modulo.id))].map((mid) => {
                const ls = r.lacunas.filter((l) => l.modulo.id === mid);
                return (
                  <div key={mid}>
                    <p className="text-sm">{ls[0]!.modulo.codigo} {ls[0]!.modulo.nome}</p>
                    <ul className="mt-1 divide-y divide-line border-y border-line text-sm">
                      {ls.map((l) => (
                        <li key={l.requisito.id} className="grid grid-cols-12 gap-x-2 gap-y-1 py-2">
                          <span className="col-span-12 sm:col-span-5">{l.requisito.codigo} {l.requisito.descricao}{l.requisito.eliminatorio && <Badge variant="flamboyant" className="ml-2">Eliminatório</Badge>}</span>
                          <span className="col-span-12 text-ink-muted sm:col-span-2">{l.player} · {l.naoInformado ? "não informado" : "não cobre"}</span>
                          <span className="col-span-8 text-xs text-ink-muted sm:col-span-3">{l.nota ?? "Sem nota técnica."}</span>
                          <span className="num col-span-4 text-right sm:col-span-2">{l.custo == null ? "sem estimativa" : formatarBRL(l.custo)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <TabelaSimples titulo="Por player" linhas={r.porPlayer.map((p) => ({ rotulo: p.nome, valor: p.valor, pct: p.pct }))} />
            <TabelaSimples titulo="Por tipo" linhas={r.porTipo.map((t) => ({ rotulo: ROT_TIPO[t.tipo] ?? t.tipo, valor: t.valor }))} />
            <TabelaSimples titulo="Por RFP" linhas={r.porRfp.map((x) => ({ rotulo: `RFP ${x.numero}`, valor: x.valor }))} />
            <TabelaSimples titulo="Por módulo" linhas={r.modulos.map((m) => ({ rotulo: `${m.modulo.codigo} · ${m.player?.nome ?? (m.opcao.tipo === "interno" ? "Interno" : "a cotar")}`, valor: m.total }))} />
          </div>

          <div>
            <RotuloMono as="p">Desembolso mês a mês</RotuloMono>
            <GraficoDesembolso r={r} />
          </div>

          <div>
            <RotuloMono as="p">Pontos de atenção da composição</RotuloMono>
            <div className="mt-3"><ListaPontos pontos={r.pontos} /></div>
          </div>
        </section>

        {/* PARECER */}
        <section id="zona-parecer" className={cn("col-span-12 min-w-0 space-y-4 xl:col-span-3 xl:block", zona !== "parecer" && "hidden")} aria-label="Parecer técnico">
          <RotuloMono as="p">Parecer técnico</RotuloMono>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setParecer({ texto: parecerAutomatico(base, r), ia: false, revisado: true })}>
              <Wand2 strokeWidth={1.5} /> Montar por regra
            </Button>
            <Button size="sm" onClick={gerarIA} disabled={gerando}>
              <Sparkles strokeWidth={1.5} /> {gerando ? "Redigindo" : "Redigir parecer com IA"}
            </Button>
          </div>
          {parecer?.ia && <Badge variant="terracota">Rascunho gerado por IA</Badge>}
          <textarea aria-label="Parecer" rows={22} className="campo h-auto py-2 text-sm leading-relaxed"
            value={parecer?.texto ?? parecerAutomatico(base, r)}
            onChange={(e) => setParecer({ texto: e.target.value, ia: parecer?.ia ?? false, revisado: parecer?.ia ? parecer.revisado : true })} />
          {parecer?.ia && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={parecer.revisado} onChange={(e) => setParecer({ ...parecer, revisado: e.target.checked })} />
              Revisei o texto e confirmo os fatos
            </label>
          )}
          <p className="text-xs text-ink-muted">O rascunho de IA só entra no cenário salvo depois de revisado por uma pessoa.</p>
          {podeSimular && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button onClick={() => setSalvar(true)}>Salvar cenário</Button>
            </div>
          )}
        </section>
      </div>

      {/* Abas fixas na base (celular e tablet) */}
      <nav aria-label="Zonas do simulador" className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-background pb-[env(safe-area-inset-bottom)] lg:left-60 xl:hidden">
        <div role="tablist" className="grid grid-cols-3">
          {([["composicao", "Composição"], ["resultado", "Resultado"], ["parecer", "Parecer"]] as const).map(([k, rot]) => (
            <button key={k} role="tab" aria-selected={zona === k} aria-controls={`zona-${k}`}
              onClick={() => { setZona(k); window.scrollTo({ top: 0 }); }}
              className={cn("label-mono min-h-14 border-r border-line px-2 last:border-r-0", zona === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {rot}{k === "resultado" && r.contagem.critico > 0 && <span className="ml-1">· {r.contagem.critico}</span>}
            </button>
          ))}
        </div>
      </nav>

      <Dialog open={salvar} onOpenChange={setSalvar}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Salvar cenário</DialogTitle></DialogHeader>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Nome</span>
            <input className="campo" maxLength={120} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Descrição</span>
            <textarea className="campo h-auto py-2" rows={3} maxLength={1000} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
          <p className="text-sm text-ink-muted">Total {formatarBRL(r.total.central)} · cobertura {formatarPct(r.cobertura.conservadora)}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {cenario && <Button variant="secondary" onClick={() => gravar(false)}>Salvar nova versão</Button>}
            <Button onClick={() => gravar(true)}>{cenario ? "Salvar como novo" : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
