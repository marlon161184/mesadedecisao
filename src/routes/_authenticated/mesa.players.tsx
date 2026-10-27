import { LinkFonte } from "@/components/decisao/Documentos";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMesa, fundoPlayer, padraoPlayer } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo, SeloStatus, Valor } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarBRL, formatarData } from "@/lib/formato";
import { ROTULO_TIPO, analisarProposta, propostasDoRfp } from "@/lib/equalizacao";
import { pontosAutomaticos, ROTULO_SEV } from "@/lib/pontos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/players")({
  head: () => ({
    meta: [
      { title: "Players · NEWE Mesa de Decisão" },
      { name: "description", content: "Dossiê de cada player: condições, itens, comentários e portões." },
      { property: "og:title", content: "Players · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Dossiê de cada player: condições, itens, comentários e portões." },
    ],
  }),
  component: Players,
});

const ROTULO_TIPO_PLAYER: Record<string, string> = { agencia: "Agência", plataforma: "Plataforma", consultoria: "Consultoria", referencia: "Referência" };

function Players() {
  const { f, rfp, base, analises, premissas } = useMesa();
  const doRfp = base.players.filter((p) => p.rfp_numeros.includes(f.rfp));
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const player = doRfp.find((p) => p.id === (escolhido ?? f.player)) ?? doRfp[0];
  const a = analises.find((x) => x.player.id === player?.id);
  const versoes = player ? propostasDoRfp(base, f.rfp, true).filter((x) => x.player.id === player.id)
    .map((x) => analisarProposta(base, f.rfp, x.proposta, x.player, { filtros: f, premissas })) : [];

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Players`} titulo="Dossiê dos players" />
      <Conteudo>
        <div role="tablist" aria-label="Players" className="mb-10 flex flex-wrap border-b border-line">
          {doRfp.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === player?.id} onClick={() => setEscolhido(p.id)}
              className={cn("flex items-center gap-2 border-b-2 px-4 py-3 text-sm", p.id === player?.id ? "border-line-strong" : "border-transparent text-ink-muted hover:text-foreground")}>
              <span className={cn("size-3", fundoPlayer(p.cor_token), padraoPlayer(p.cor_token))} aria-hidden />
              {p.nome}
              {p.status !== "proponente" && <span className="label-mono text-[0.6rem]">Referência</span>}
            </button>
          ))}
        </div>

        {player && (
          <div className="grid grid-cols-12 gap-10">
            <section className="col-span-12 lg:col-span-4">
              <RotuloMono as="p">Resumo</RotuloMono>
              <h2 className="mt-2 text-3xl">{player.nome}</h2>
              <p className="mt-2 text-sm text-ink-muted">{ROTULO_TIPO_PLAYER[player.tipo]}{player.cidade ? ` · ${player.cidade}` : ""}</p>
              <p className="mt-4">{player.observacoes}</p>
              {!a && <p className="mt-6 border border-line p-4 text-sm">Sem proposta neste RFP. Usado como referência.</p>}
              {a && (
                <dl className="mt-8 space-y-4 border-t border-line pt-6 text-sm">
                  <div className="flex items-center justify-between"><RotuloMono as="dt">Status</RotuloMono><dd><SeloStatus status={a.proposta.status} /></dd></div>
                  <div><RotuloMono as="dt">Total na janela</RotuloMono><dd className="mt-1 text-xl"><Valor faixa={a.total} incerteza={f.incerteza} /></dd></div>
                  <div><RotuloMono as="dt">Validade</RotuloMono><dd className="mt-1">{a.proposta.validade_ate ? `${formatarData(a.proposta.validade_ate)} (${a.validadeDias} dias)` : "Não informada"}</dd></div>
                  <div><RotuloMono as="dt">Desconto explícito</RotuloMono><dd className="mt-1">{a.proposta.desconto_explicito ?? "Não informado"}</dd></div>
                  <div><RotuloMono as="dt">Contrato proposto</RotuloMono><dd className="mt-1">{a.proposta.contrato_meses_proposto ? `${a.proposta.contrato_meses_proposto} meses` : "—"}{a.compromisso && ` · compromisso ${formatarBRL(a.compromisso.central)}`}</dd></div>
                  <div><RotuloMono as="dt">Reajuste</RotuloMono><dd className="mt-1">{a.proposta.reajuste ?? "Não informado"}</dd></div>
                  <div><RotuloMono as="dt">Tributos</RotuloMono><dd className="mt-1">{a.proposta.tributos ?? "Não informado"}</dd></div>
                  <div><RotuloMono as="dt">Exclusões</RotuloMono><dd className="mt-1">{a.proposta.exclusoes ?? "Não informadas"}</dd></div>
                  <div><RotuloMono as="dt">Fora do subtotal</RotuloMono><dd className="mt-1">{a.itens.filter((x) => !x.item.incluido_no_subtotal_da_proposta).map((x) => x.item.descricao).join("; ") || "Nada"}</dd></div>
                  {a.proposta.observacoes && <div><RotuloMono as="dt">Observações</RotuloMono><dd className="mt-1">{a.proposta.observacoes}</dd></div>}
                </dl>
              )}
            </section>

            {a && (
              <div className="col-span-12 space-y-14 lg:col-span-8">
                <section>
                  <RotuloMono as="p">Itens</RotuloMono>
                  <Table className="mt-3">
                    <TableHeader><TableRow><TableHead>Módulo</TableHead><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Na janela</TableHead><TableHead>Fonte</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {a.itens.map(({ item, valor }) => (
                        <TableRow key={item.id}>
                          <TableCell className="label-mono">{base.modulos.find((m) => m.id === item.modulo_id)?.codigo}</TableCell>
                          <TableCell>{item.descricao}{item.incerteza && <p className="text-xs text-ink-muted">{item.incerteza}</p>}</TableCell>
                          <TableCell><Badge variant="outline">{ROTULO_TIPO[item.tipo_preco]}</Badge></TableCell>
                          <TableCell className="text-right"><Valor faixa={valor} incerteza={f.incerteza} /></TableCell>
                          <TableCell><LinkFonte propostaId={item.proposta_id} pagina={item.fonte_pagina} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>

                <section>
                  <RotuloMono as="p">Comentários técnicos</RotuloMono>
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {base.comentarios.filter((c) => c.proposta_id === a.proposta.id).map((c) => (
                      <li key={c.id} className="py-4">
                        <RotuloMono>{c.modulo_id ? base.modulos.find((m) => m.id === c.modulo_id)?.codigo : "Geral"}</RotuloMono>
                        <p className="mt-1">{c.texto}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <RotuloMono as="p">Pontos de atenção</RotuloMono>
                  <ul className="mt-3 space-y-2 text-sm">
                    {pontosAutomaticos(a, premissas).map((p) => (
                      <li key={p.id} className="flex gap-3"><Badge variant={p.severidade === "critico" ? "flamboyant" : "outline"}>{ROTULO_SEV[p.severidade]}</Badge>{p.texto}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <RotuloMono as="p">Perguntas-filtro</RotuloMono>
                  <ol className="mt-3 space-y-3 text-sm">
                    {base.perguntas.filter((q) => q.rfp_id === rfp.id).map((q) => {
                      const r = base.respostas.find((x) => x.pergunta_id === q.id && x.proposta_id === a.proposta.id);
                      return (
                        <li key={q.id} className="border-t border-line pt-3">
                          <p>{q.texto}</p>
                          <p className="mt-1 text-ink-muted">{r?.resposta ?? "Sem resposta registrada."}{r?.avaliacao && ` · ${r.avaliacao}`}</p>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                <section>
                  <RotuloMono as="p">Portões eliminatórios</RotuloMono>
                  <ul className="mt-3 space-y-2 text-sm">
                    {base.portoes.filter((p) => p.rfp_id === rfp.id).map((p) => {
                      const r = base.portaoResultados.find((x) => x.portao_id === p.id && x.proposta_id === a.proposta.id);
                      const res = r?.resultado ?? "pendente";
                      return (
                        <li key={p.id} className="flex items-center gap-3">
                          <Badge variant={res === "reprova" ? "flamboyant" : res === "passa" ? "default" : "secondary"}>{res === "passa" ? "Passa" : res === "reprova" ? "Reprova" : "Pendente"}</Badge>
                          {p.descricao}{r?.justificativa && <span className="text-ink-muted"> · {r.justificativa}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section>
                  <RotuloMono as="p">Histórico de versões</RotuloMono>
                  <Table className="mt-3">
                    <TableHeader><TableRow><TableHead>Versão</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total na janela</TableHead><TableHead className="text-right">Variação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {[...versoes].sort((x, y) => x.proposta.versao - y.proposta.versao).map((v, i, arr) => {
                        const ant = arr[i - 1];
                        const d = ant ? v.total.central - ant.total.central : null;
                        return (
                          <TableRow key={v.proposta.id}>
                            <TableCell className="label-mono">V{v.proposta.versao}</TableCell>
                            <TableCell>{formatarData(v.proposta.data_proposta)}</TableCell>
                            <TableCell><SeloStatus status={v.proposta.status} /></TableCell>
                            <TableCell className="num text-right">{formatarBRL(v.total.central)}</TableCell>
                            <TableCell className="num text-right">{d == null ? "—" : `${d >= 0 ? "+" : ""}${formatarBRL(d)}`}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {versoes.length < 2 && <p className="mt-2 text-sm text-ink-muted">Só uma versão cadastrada. A comparação aparece quando o Admin registrar outra.</p>}
                </section>
              </div>
            )}
          </div>
        )}
      </Conteudo>
    </>
  );
}
