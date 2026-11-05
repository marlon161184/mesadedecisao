import { LeituraMesa } from "@/components/mesa/LeituraGuiada";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMesa } from "@/components/mesa/useMesa";
import { TabelaAdaptavel } from "@/components/newe/TabelaAdaptavel";
import { AberturaTela, Conteudo, IconeIncerteza, SeloStatus, SemPropostas, Valor } from "@/components/mesa/partes";
import { Badge } from "@/components/ui/badge";
import { formatarBRL } from "@/lib/formato";
import { ROTULO_TIPO, temIncerteza } from "@/lib/equalizacao";

export const Route = createFileRoute("/_authenticated/mesa/matriz")({
  head: () => ({
    meta: [
      { title: "Matriz por módulo · NEWE Mesa de Decisão" },
      { name: "description", content: "Valores na janela por módulo e por player." },
      { property: "og:title", content: "Matriz por módulo · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Valores na janela por módulo e por player." },
    ],
  }),
  component: Matriz,
});

function Controles() {
  const { f, set, premissas } = useMesa();
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 border border-line p-4 sm:p-5 md:grid-cols-3 xl:grid-cols-6">
      <label className="text-sm">
        <span className="label-mono mb-1.5 block text-ink-muted">Janela</span>
        <select className="campo" value={premissas.janela_meses} onChange={(e) => set({ janela: Number(e.target.value) })}>
          {[6, 9, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="label-mono mb-1.5 block text-ink-muted">Preço</span>
        <select className="campo" value={premissas.aplicar_desconto_negociado ? "negociado" : "lista"} onChange={(e) => set({ preco: e.target.value as "lista" | "negociado" })}>
          <option value="negociado">Negociado</option><option value="lista">Lista</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="label-mono mb-1.5 block text-ink-muted">Verba mensal de mídia</span>
        <input type="number" min={0} step={5000} className="campo num" value={premissas.verba_midia_mensal} onChange={(e) => set({ verba: Number(e.target.value) })} />
      </label>
      <label className="text-sm">
        <span className="label-mono mb-1.5 block text-ink-muted">Produtos</span>
        <input type="number" min={1} max={10} className="campo num" value={premissas.produtos_performance} onChange={(e) => set({ produtos: Math.max(1, Number(e.target.value)) })} />
      </label>
      <label className="flex min-h-11 items-end gap-2 pb-2 text-sm">
        <input type="checkbox" className="size-4" checked={!f.semVariaveis} onChange={(e) => set({ semVariaveis: e.target.checked ? undefined : true })} />
        Incluir itens variáveis
      </label>
      <label className="flex min-h-11 items-end gap-2 pb-2 text-sm">
        <input type="checkbox" className="size-4" checked={f.validadas} onChange={(e) => set({ validadas: e.target.checked || undefined })} />
        Somente validadas
      </label>
    </div>
  );
}

function Matriz() {
  const { f, rfp, analises, modulos, base } = useMesa();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const mods = modulos.filter((m) => !f.modulo || m.id === f.modulo);

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Matriz`} titulo="Matriz por módulo">
        Valor de cada módulo na janela, por player. "Não oferece" é diferente de zero.
      </AberturaTela>
      <Conteudo>
        <LeituraMesa tela="matriz" />
        <Controles />
        {rfp.numero === 3 ? (
          <SemPropostas base={base} modulos={modulos} />
        ) : analises.length === 0 ? (
          <p className="text-ink-muted">Nenhuma proposta com estes filtros.</p>
        ) : (
          <TabelaAdaptavel modo="rolagem" rotulo="Matriz por módulo">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="label-mono w-36 min-w-36 px-3 py-3 sm:w-72 text-left font-normal text-ink-muted">Módulo</th>
                  {analises.map((a) => (
                    <th key={a.proposta.id} className="min-w-44 px-3 py-3 text-left font-normal">
                      <span className="block font-display text-lg">{a.player.nome}</span>
                      <SeloStatus status={a.proposta.status} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mods.map((m) => {
                  const aberto = abertos.has(m.id);
                  return (
                    <Fragment key={m.id}>
                      <tr className="border-b border-line">
                        <th scope="row" className="px-3 py-4 text-left font-normal">
                          <button onClick={() => alternar(m.id)} aria-expanded={aberto} className="flex min-h-11 items-start gap-2 text-left">
                            {aberto ? <ChevronDown strokeWidth={1.5} className="mt-0.5 size-4" /> : <ChevronRight strokeWidth={1.5} className="mt-0.5 size-4" />}
                            <span>
                              <span className="label-mono block text-ink-muted">{m.codigo} · peso {Number(m.peso_no_rfp)}</span>
                              {m.nome}
                            </span>
                          </button>
                        </th>
                        {analises.map((a) => {
                          const ma = a.modulos.find((x) => x.modulo.id === m.id)!;
                          if (!ma.total) {
                            return (
                              <td key={a.proposta.id} className="hachura bg-muted px-3 py-4 text-ink-muted">
                                <span aria-hidden>— </span>Não oferece
                              </td>
                            );
                          }
                          const tipos = [...new Set(ma.itens.map((x) => x.item.tipo_preco))];
                          const incertos = ma.itens.filter((x) => temIncerteza(x.item));
                          return (
                            <td key={a.proposta.id} className="px-3 py-4 align-top">
                              <div className="flex items-start gap-1.5">
                                <Valor faixa={ma.total} incerteza={f.incerteza} className="text-base" />
                                {f.incerteza && incertos.length > 0 && <IconeIncerteza texto={incertos.map((x) => x.item.incerteza ?? "Faixa de valor").join(" · ")} />}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {tipos.map((t) => <Badge key={t} variant="outline">{ROTULO_TIPO[t]}</Badge>)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {aberto && (
                        <tr className="border-b border-line bg-secondary/40">
                          <td className="label-mono px-3 py-3 align-top text-ink-muted">Itens</td>
                          {analises.map((a) => {
                            const ma = a.modulos.find((x) => x.modulo.id === m.id)!;
                            return (
                              <td key={a.proposta.id} className="px-3 py-3 align-top">
                                {ma.itens.length === 0 ? <span className="text-ink-muted">—</span> : (
                                  <ul className="space-y-3">
                                    {ma.itens.map(({ item, valor }) => (
                                      <li key={item.id}>
                                        <p>{item.descricao}</p>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-2">
                                          <Valor faixa={valor} incerteza={f.incerteza} />
                                          <Badge variant="secondary">{ROTULO_TIPO[item.tipo_preco]}</Badge>
                                          {!item.incluido_no_subtotal_da_proposta && <Badge variant="outline">Fora do subtotal</Badge>}
                                          {f.incerteza && temIncerteza(item) && <IconeIncerteza texto={item.incerteza ?? "Faixa de valor"} />}
                                        </p>
                                        {item.fonte_pagina && <p className="label-mono mt-0.5 text-ink-muted">{item.fonte_pagina}</p>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <th scope="row" className="label-mono px-3 py-4 text-left font-normal">Total na janela</th>
                  {analises.map((a) => (
                    <td key={a.proposta.id} className="px-3 py-4 text-lg">
                      <Valor faixa={a.total} incerteza={f.incerteza} />
                      {a.compromisso && (
                        <p className="mt-1 text-xs text-ink-muted">Contrato de {a.proposta.contrato_meses_proposto} meses: {formatarBRL(a.compromisso.central)}</p>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-line">
                  <th scope="row" className="label-mono px-3 py-4 text-left font-normal">Total ajustado ao escopo</th>
                  {analises.map((a) => (
                    <td key={a.proposta.id} className="px-3 py-4">
                      <span className="num text-lg">{formatarBRL(a.ajustado.ajustado)}</span>
                      <p className="mt-1 text-xs text-ink-muted">
                        + {formatarBRL(a.ajustado.acrescimo)} para cobrir essenciais
                        {a.ajustado.semEstimativa > 0 && ` · ${a.ajustado.semEstimativa} essencial(is) sem custo estimado`}
                      </p>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </TabelaAdaptavel>
        )}
      </Conteudo>
    </>
  );
}
