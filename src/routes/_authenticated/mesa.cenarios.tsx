import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMesa } from "@/components/mesa/useMesa";
import { useSessao } from "@/components/newe/Moldura";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarBRL, formatarData, formatarPct } from "@/lib/formato";
import { resultadoDoCenario } from "@/lib/cenarios";
import { baixar, paraCsv } from "@/lib/csv";
import type { ResultadoComposicao } from "@/lib/composicao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/cenarios")({
  head: () => ({
    meta: [
      { title: "Cenários · NEWE Mesa de Decisão" },
      { name: "description", content: "Cenários salvos, versões, comentários e comparação lado a lado." },
      { property: "og:title", content: "Cenários · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Cenários salvos, versões, comentários e comparação lado a lado." },
    ],
  }),
  component: Cenarios,
});

type Linha = { rotulo: string; valor: (r: ResultadoComposicao) => number | null; fmt: (v: number) => string; melhor?: "min" | "max" };
const LINHAS: Linha[] = [
  { rotulo: "Total na janela", valor: (r) => r.total.central, fmt: formatarBRL, melhor: "min" },
  { rotulo: "Faixa (máx. − mín.)", valor: (r) => r.total.max - r.total.min, fmt: formatarBRL, melhor: "min" },
  { rotulo: "Média mensal", valor: (r) => r.mediaMensal, fmt: formatarBRL, melhor: "min" },
  { rotulo: "Compromisso dos contratos", valor: (r) => r.compromisso?.total ?? r.total.central, fmt: formatarBRL, melhor: "min" },
  { rotulo: "Custo ajustado ao escopo", valor: (r) => r.ajustado.ajustado, fmt: formatarBRL, melhor: "min" },
  { rotulo: "Cobertura conservadora", valor: (r) => r.cobertura.conservadora, fmt: formatarPct, melhor: "max" },
  { rotulo: "Cobertura otimista", valor: (r) => r.cobertura.otimista, fmt: formatarPct, melhor: "max" },
  { rotulo: "Bloqueios essenciais", valor: (r) => r.lacunas.length, fmt: (v) => String(v), melhor: "min" },
  { rotulo: "Pontos críticos", valor: (r) => r.contagem.critico, fmt: (v) => String(v), melhor: "min" },
  { rotulo: "Pontos altos", valor: (r) => r.contagem.alto, fmt: (v) => String(v), melhor: "min" },
  { rotulo: "Pontos médios", valor: (r) => r.contagem.medio, fmt: (v) => String(v), melhor: "min" },
  { rotulo: "Eficiência (pts / R$ 100 mil)", valor: (r) => r.eficiencia, fmt: (v) => v.toFixed(1).replace(".", ","), melhor: "max" },
];

function Cenarios() {
  const { base } = useMesa();
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const [sel, setSel] = useState<string[]>(() => base.cenarios.slice(0, 4).map((c) => c.id));
  const [aberto, setAberto] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const resultados = useMemo(() => new Map(base.cenarios.map((c) => [c.id, resultadoDoCenario(base, c)])), [base]);
  const nome = (id: string | null) => base.perfis.find((p) => p.id === id)?.nome ?? "Carga inicial";
  const recarregar = () => qc.invalidateQueries({ queryKey: ["base"] });
  const ehSocio = sessao?.papeis.includes("socio");
  const podeEditar = sessao?.papeis.some((p) => p === "socio" || p === "admin");

  async function duplicar(id: string) {
    const c = base.cenarios.find((x) => x.id === id)!;
    const { data, error } = await supabase.from("cenario").insert({ nome: `${c.nome} (cópia)`.slice(0, 120), descricao: c.descricao, config: c.config, parecer: c.parecer, parecer_revisado: c.parecer_revisado }).select("id").single();
    if (error) { toast.error(error.message); return; }
    const linhas = base.cenarioModulos.filter((m) => m.cenario_id === id).map((m) => ({ cenario_id: data.id, modulo_id: m.modulo_id, proposta_id: m.proposta_id, opcao: m.opcao, comentario: m.comentario }));
    if (linhas.length) await supabase.from("cenario_modulo").insert(linhas);
    toast.success("Cenário duplicado.");
    recarregar();
  }
  async function recomendar(id: string) {
    const { error } = await supabase.rpc("recomendar_cenario", { _cenario: id });
    if (error) toast.error(error.message); else { toast.success("Cenário marcado como recomendado."); recarregar(); }
  }
  async function comentar(id: string) {
    if (!comentario.trim()) return;
    const { error } = await supabase.from("cenario_comentario").insert({ cenario_id: id, texto: comentario.trim().slice(0, 4000) });
    if (error) toast.error("Só sócios comentam cenários."); else { setComentario(""); recarregar(); }
  }
  function exportarCsv(id: string) {
    const c = base.cenarios.find((x) => x.id === id)!;
    const r = resultados.get(id)!;
    const linhas = [
      ...r.modulos.map((m) => ({ secao: "modulo", chave: `${m.modulo.codigo} ${m.modulo.nome}`, player: m.player?.nome ?? m.opcao.tipo, valor: m.total.toFixed(2), cobertura: `${(m.cobertura.conservadora * 100).toFixed(1)}–${((m.cobertura.otimista ?? 0) * 100).toFixed(1)}` })),
      { secao: "total", chave: "Total na janela", player: "", valor: r.total.central.toFixed(2), cobertura: `${(r.cobertura.conservadora * 100).toFixed(1)}–${((r.cobertura.otimista ?? 0) * 100).toFixed(1)}` },
      { secao: "total", chave: "Custo ajustado", player: "", valor: r.ajustado.ajustado.toFixed(2), cobertura: "" },
      ...r.pontos.map((p) => ({ secao: "ponto", chave: p.codigo ?? "", player: p.severidade, valor: "", cobertura: p.texto })),
    ];
    baixar(`cenario-${c.nome.replace(/[^\w]+/g, "-").toLowerCase()}.csv`, paraCsv(linhas, ["secao", "chave", "player", "valor", "cobertura"]));
  }

  const comparar = sel.map((id) => base.cenarios.find((c) => c.id === id)).filter(Boolean).map((c) => ({ c: c!, r: resultados.get(c!.id)! }));

  return (
    <>
      <AberturaTela numero="Cenários" titulo="Cenários salvos">
        Compare até quatro lado a lado. Diferenças contadas sempre em relação ao primeiro.
      </AberturaTela>
      <Conteudo>
        <ul className="divide-y divide-line border-y border-line">
          {base.cenarios.map((c) => {
            const r = resultados.get(c.id)!;
            const marcado = sel.includes(c.id);
            const versoes = base.cenarioVersoes.filter((v) => v.cenario_id === c.id);
            const coments = base.cenarioComentarios.filter((v) => v.cenario_id === c.id);
            return (
              <li key={c.id} className="py-5">
                <div className="grid grid-cols-12 items-start gap-4">
                  <label className="col-span-12 flex items-start gap-3 md:col-span-5">
                    <input type="checkbox" className="mt-1.5 size-4" checked={marcado} disabled={!marcado && sel.length >= 4}
                      onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} aria-label={`Comparar ${c.nome}`} />
                    <span>
                      <span className="font-display text-xl">{c.nome}</span>
                      {c.recomendado && <Badge variant="default" className="ml-2">Recomendado</Badge>}
                      <span className="mt-1 block text-sm text-ink-muted">{c.descricao}</span>
                      <span className="label-mono mt-1 block text-ink-muted">V{c.versao} · {nome(c.autor)} · {formatarData(c.criado_em)}</span>
                    </span>
                  </label>
                  <div className="num col-span-6 text-sm md:col-span-3">
                    {formatarBRL(r.total.central)}<span className="block text-xs text-ink-muted">Cobertura {formatarPct(r.cobertura.conservadora)}–{formatarPct(r.cobertura.otimista)}</span>
                  </div>
                  <div className="col-span-12 flex flex-wrap justify-end gap-1 md:col-span-4">
                    <Button asChild size="sm" variant="secondary"><Link to="/mesa/simulador" search={((p: Record<string, unknown>) => ({ ...p, cenario: c.id })) as never}>Abrir</Link></Button>
                    {podeEditar && <Button size="sm" variant="ghost" onClick={() => duplicar(c.id)} aria-label="Duplicar"><Copy strokeWidth={1.5} /></Button>}
                    {podeEditar && <Button size="sm" variant="ghost" onClick={() => recomendar(c.id)} aria-label="Marcar como recomendado"><Star strokeWidth={1.5} /></Button>}
                    <Button size="sm" variant="ghost" onClick={() => exportarCsv(c.id)} aria-label="Exportar CSV"><Download strokeWidth={1.5} /></Button>
                    <Button asChild size="sm" variant="ghost"><a href={`/imprimir/${c.id}`} target="_blank" rel="noreferrer" aria-label="Exportar PDF"><FileText strokeWidth={1.5} /></a></Button>
                    <Button size="sm" variant="ghost" onClick={() => setAberto(aberto === c.id ? null : c.id)}>{aberto === c.id ? "Fechar" : `Histórico (${versoes.length}) · Comentários (${coments.length})`}</Button>
                  </div>
                </div>
                {aberto === c.id && (
                  <div className="mt-4 grid grid-cols-1 gap-8 border-t border-line pt-4 md:grid-cols-2">
                    <div>
                      <RotuloMono as="p">Versões</RotuloMono>
                      <ul className="mt-2 space-y-1 text-sm">
                        {versoes.length === 0 && <li className="text-ink-muted">Versão inicial, sem histórico.</li>}
                        {versoes.map((v) => {
                          const s = v.snapshot as { total?: { central: number }; cobertura?: { conservadora: number } };
                          return <li key={v.id} className="flex justify-between"><span>V{v.versao} · {nome(v.autor)} · {formatarData(v.criado_em)}</span><span className="num">{formatarBRL(s.total?.central)} · {formatarPct(s.cobertura?.conservadora)}</span></li>;
                        })}
                      </ul>
                    </div>
                    <div>
                      <RotuloMono as="p">Comentários dos sócios</RotuloMono>
                      <ul className="mt-2 space-y-2 text-sm">
                        {coments.map((k) => <li key={k.id}><span className="label-mono text-ink-muted">{nome(k.autor)} · {formatarData(k.criado_em)}</span><p>{k.texto}</p></li>)}
                      </ul>
                      {ehSocio && (
                        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); comentar(c.id); }}>
                          <input aria-label="Comentário" maxLength={4000} className="campo" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                          <Button size="sm" type="submit">Comentar</Button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {comparar.length > 0 && (
          <div className="mt-16 overflow-x-auto">
            <RotuloMono as="p">Comparação lado a lado</RotuloMono>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="label-mono w-56 px-3 py-3 text-left font-normal text-ink-muted">Indicador</th>
                  {comparar.map(({ c }) => <th key={c.id} className="px-3 py-3 text-left font-display text-lg font-normal">{c.nome}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <th scope="row" className="label-mono px-3 py-3 text-left align-top font-normal text-ink-muted">Composição</th>
                  {comparar.map(({ c, r }) => (
                    <td key={c.id} className="px-3 py-3 align-top text-xs">
                      {r.modulos.map((m) => <span key={m.modulo.id} className="block">{m.modulo.codigo}: {m.player?.nome ?? (m.opcao.tipo === "interno" ? "Interno" : "a cotar")}</span>)}
                    </td>
                  ))}
                </tr>
                {LINHAS.map((l) => {
                  const vals = comparar.map(({ r }) => l.valor(r));
                  const validos = vals.filter((v): v is number => v != null);
                  const alvo = l.melhor === "min" ? Math.min(...validos) : Math.max(...validos);
                  const base0 = vals[0];
                  return (
                    <tr key={l.rotulo} className="border-b border-line">
                      <th scope="row" className="px-3 py-2.5 text-left font-normal">{l.rotulo}</th>
                      {vals.map((v, i) => {
                        const melhor = v != null && validos.length > 1 && v === alvo;
                        return (
                          <td key={comparar[i]!.c.id} className={cn("num px-3 py-2.5", melhor && "bg-primary text-primary-foreground")}>
                            {v == null ? "—" : l.fmt(v)}
                            {melhor && <span className="label-mono ml-2 text-[0.6rem]">Melhor</span>}
                            {i > 0 && v != null && base0 != null && (
                              <span className="block text-xs opacity-75">{v - base0 >= 0 ? "+" : "−"}{l.fmt(Math.abs(v - base0))} vs. 1º</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Conteudo>
    </>
  );
}
