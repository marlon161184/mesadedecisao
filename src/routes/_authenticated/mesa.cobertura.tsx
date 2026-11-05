import { LeituraMesa } from "@/components/mesa/LeituraGuiada";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useMesa } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo, FaixaCob, SemPropostas } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarBRL, formatarData } from "@/lib/formato";
import type { Cobertura, Requisito } from "@/lib/base";
import { TabelaAdaptavel } from "@/components/newe/TabelaAdaptavel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/cobertura")({
  head: () => ({
    meta: [
      { title: "Cobertura · NEWE Mesa de Decisão" },
      { name: "description", content: "Expectativa e realidade por proposta: requisitos por player." },
      { property: "og:title", content: "Cobertura · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Expectativa e realidade por proposta: requisitos por player." },
    ],
  }),
  component: CoberturaTela,
});

const NIVEL = (n: number | null | undefined) =>
  n == null ? { simbolo: "?", rotulo: "Não informado", classe: "hachura" }
  : n >= 1 ? { simbolo: "●", rotulo: "Cobre", classe: "bg-primary text-primary-foreground" }
  : n > 0 ? { simbolo: "◐", rotulo: "Parcial", classe: "bg-secondary text-secondary-foreground" }
  : { simbolo: "○", rotulo: "Não cobre", classe: "bg-flamboyant text-luz" };

function Celula({ c, onClick, rotulo }: { c: Cobertura | undefined; onClick: () => void; rotulo: string }) {
  const n = NIVEL(c?.nivel);
  return (
    <button onClick={onClick} aria-label={`${rotulo}: ${n.rotulo}`} className={cn("flex h-full w-full items-center gap-2 border border-line px-2 py-2 text-left text-xs hover:outline-2 hover:outline-focus", n.classe)}>
      <span aria-hidden className="text-base leading-none">{n.simbolo}</span>
      <span className="flex-1">{n.rotulo}</span>
      {c && c.evidencia !== "nao_informado" && (
        <span className="label-mono border border-current px-1 text-[0.55rem]">{c.evidencia === "comprovado" ? "Comprovado" : "Declarado"}</span>
      )}
    </button>
  );
}

function CoberturaTela() {
  const { f, set, rfp, analises, modulos, base, premissas } = useMesa();
  const [sel, setSel] = useState<{ req: Requisito; playerNome: string; c: Cobertura | undefined } | null>(null);
  const [perguntas, setPerguntas] = useState(false);
  const mods = modulos.filter((m) => !f.modulo || m.id === f.modulo);
  const reqsDe = (mid: string) => base.requisitos.filter((r) => r.modulo_id === mid && (!f.essenciais || r.criticidade === "essencial"));
  const cob = (pid: string, rid: string) => base.coberturas.find((c) => c.proposta_id === pid && c.requisito_id === rid);
  const avaliador = (id: string | null | undefined) => (id ? base.perfis.find((p) => p.id === id)?.nome ?? "Admin" : "Carga inicial dos dados");

  const pendentes = analises.map((a) => ({
    player: a.player.nome,
    itens: mods.flatMap((m) => base.requisitos.filter((r) => r.modulo_id === m.id))
      .filter((r) => cob(a.proposta.id, r.id)?.nivel == null)
      .map((r) => `${r.codigo}. Como a proposta atende a "${r.descricao}"? Por favor, enviem a evidência.`),
  }));

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Cobertura`} titulo="Expectativa x realidade">
        Cada célula mostra símbolo, nível e evidência. Clique para ver a nota técnica.
      </AberturaTela>
      <Conteudo>
        <LeituraMesa tela="cobertura" />
        <div className="mb-8 flex flex-wrap items-end gap-4 border border-line p-4 sm:gap-6 sm:p-5">
          <div>
            <RotuloMono as="p" className="mb-1.5">Rigor da evidência</RotuloMono>
            <div role="radiogroup" aria-label="Rigor da evidência" className="flex flex-wrap border border-line-strong">
              {[1, 0.7, 0].map((v) => (
                <button key={v} role="radio" aria-checked={premissas.fator_evidencia_declarado === v}
                  onClick={() => set({ rigor: v })}
                  className={cn("min-h-11 border-r border-line-strong px-3 py-1.5 text-sm last:border-r-0 lg:min-h-0", premissas.fator_evidencia_declarado === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  Declarado vale {Math.round(v * 100)}%
                </button>
              ))}
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={f.essenciais} onChange={(e) => set({ essenciais: e.target.checked || undefined })} />
            Somente essenciais
          </label>
          {analises.length > 0 && (
            <Button variant="secondary" className="sm:ml-auto" onClick={() => setPerguntas(true)}>Gerar perguntas pendentes</Button>
          )}
        </div>

        {analises.length === 0 ? (
          <SemPropostas base={base} modulos={modulos} />
        ) : (
          <TabelaAdaptavel modo="rolagem" rotulo="Cobertura por requisito">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="label-mono w-48 min-w-48 px-3 sm:w-96 py-3 text-left font-normal text-ink-muted">Requisito</th>
                  {analises.map((a) => <th key={a.proposta.id} className="px-2 py-3 text-left font-display text-lg font-normal">{a.player.nome}</th>)}
                </tr>
              </thead>
              <tbody>
                {mods.map((m) => (
                  <Fragment key={m.id}>
                    <tr><th colSpan={analises.length + 1} className="label-mono bg-secondary px-3 py-2 text-left font-normal">{m.codigo} · {m.nome}</th></tr>
                    {reqsDe(m.id).map((r) => (
                      <tr key={r.id} className="border-b border-line">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <span className="label-mono mr-2 text-ink-muted">{r.codigo}</span>{r.descricao}
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">Peso {r.peso}</Badge>
                            {r.criticidade === "essencial" && <Badge variant="outline">Essencial</Badge>}
                            {r.eliminatorio && <Badge variant="flamboyant">Eliminatório</Badge>}
                          </span>
                        </th>
                        {analises.map((a) => {
                          const c = cob(a.proposta.id, r.id);
                          return (
                            <td key={a.proposta.id} className="w-44 min-w-36 p-1">
                              <Celula c={c} rotulo={`${r.codigo} ${a.player.nome}`} onClick={() => setSel({ req: r, playerNome: a.player.nome, c })} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                {mods.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <th scope="row" className="label-mono px-3 py-2 text-left font-normal text-ink-muted">Cobertura {m.codigo} (conservadora–otimista)</th>
                    {analises.map((a) => <td key={a.proposta.id} className="px-3 py-2"><FaixaCob c={a.modulos.find((x) => x.modulo.id === m.id)!.cobertura} /></td>)}
                  </tr>
                ))}
                <tr className="border-t border-line-strong">
                  <th scope="row" className="label-mono px-3 py-3 text-left font-normal">Cobertura do RFP {rfp.numero}</th>
                  {analises.map((a) => <td key={a.proposta.id} className="px-3 py-3 text-base"><FaixaCob c={a.cobertura} /></td>)}
                </tr>
              </tfoot>
            </table>
          </TabelaAdaptavel>
        )}
      </Conteudo>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full rounded-none sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <RotuloMono>{sel.req.codigo} · {sel.playerNome}</RotuloMono>
                <SheetTitle className="font-display text-2xl font-normal">{sel.req.descricao}</SheetTitle>
                <SheetDescription>{NIVEL(sel.c?.nivel).rotulo} · evidência {sel.c?.evidencia === "comprovado" ? "comprovada" : sel.c?.evidencia === "declarado" ? "declarada" : "não informada"}</SheetDescription>
              </SheetHeader>
              <dl className="mt-6 space-y-5 px-4 text-sm">
                <div><RotuloMono as="dt">Nota técnica</RotuloMono><dd className="mt-1">{sel.c?.nota_tecnica ?? "Sem nota."}</dd></div>
                <div><RotuloMono as="dt">Fonte</RotuloMono><dd className="mt-1">{sel.req.fonte ?? "—"}{sel.c?.fonte_pagina ? ` · ${sel.c.fonte_pagina}` : ""}</dd></div>
                <div><RotuloMono as="dt">Custo estimado para cobrir</RotuloMono><dd className="num mt-1">{formatarBRL(sel.c?.custo_estimado_para_cobrir)}</dd></div>
                <div><RotuloMono as="dt">Avaliado por</RotuloMono><dd className="mt-1">{sel.c ? `${avaliador(sel.c.avaliado_por)} · ${formatarData(sel.c.avaliado_em)}` : "Ainda não avaliado"}</dd></div>
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={perguntas} onOpenChange={setPerguntas}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Perguntas pendentes</DialogTitle>
            <DialogDescription>Requisitos não informados, por player, prontos para enviar.</DialogDescription>
          </DialogHeader>
          {pendentes.map((p) => (
            <section key={p.player} className="border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl">{p.player}</h3>
                <Button size="sm" variant="secondary" disabled={!p.itens.length}
                  onClick={() => { navigator.clipboard.writeText(p.itens.join("\n")); toast.success(`Perguntas para ${p.player} copiadas.`); }}>
                  <Copy strokeWidth={1.5} /> Copiar
                </Button>
              </div>
              {p.itens.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nada pendente.</p> : (
                <ol className="mt-3 space-y-2 text-sm">{p.itens.map((t) => <li key={t}>{t}</li>)}</ol>
              )}
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
