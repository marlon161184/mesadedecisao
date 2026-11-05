import { LeituraMesa } from "@/components/mesa/LeituraGuiada";
import { createFileRoute } from "@tanstack/react-router";
import { useMesa, fundoPlayer, padraoPlayer } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarBRL } from "@/lib/formato";
import { ROTULO_CATEGORIA } from "@/lib/equalizacao";
import type { Categoria } from "@/lib/calculo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas normalizadas · NEWE Mesa de Decisão" },
      { name: "description", content: "Volume declarado contra o volume-base e custo unitário normalizado." },
      { property: "og:title", content: "Entregas normalizadas · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Volume declarado contra o volume-base e custo unitário normalizado." },
    ],
  }),
  component: Entregas,
});

function Entregas() {
  const { rfp, analises, premissas } = useMesa();
  return <EntregasConteudo rfp={rfp} analises={analises} premissas={premissas} />;
}

type Mesa = ReturnType<typeof useMesa>;

export function EntregasConteudo({ rfp, analises, premissas }: Pick<Mesa, "rfp" | "analises" | "premissas">) {
  const com = analises.filter((a) => a.entregas.length > 0);
  const comCusto = com.flatMap((a) => (a.custoUnitario != null ? [{ ...a, u: a.custoUnitario }] : []));
  const cats = Object.keys(premissas.volume_base_mensal) as Categoria[];
  const maxCusto = Math.max(1, ...comCusto.map((a) => a.u.custoMensal));
  const maxVol = Math.max(1, ...comCusto.map((a) => a.u.volumeEntregue));

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Entregas`} titulo="Entregas normalizadas">
        Um preço menor com volume menor não é preço menor.
      </AberturaTela>
      <Conteudo>
        <LeituraMesa tela="entregas" />
        {com.length === 0 ? (
          <p className="text-ink-muted">Este RFP não tem entregas declaradas por mês.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria (por mês)</TableHead>
                  <TableHead className="text-right">Volume-base</TableHead>
                  {com.map((a) => <TableHead key={a.proposta.id} className="text-right">{a.player.nome}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c}>
                    <TableCell>{ROTULO_CATEGORIA[c]}</TableCell>
                    <TableCell className="num text-right">{premissas.volume_base_mensal[c]}</TableCell>
                    {com.map((a) => {
                      const e = a.entregas.filter((x) => x.categoria === c);
                      const qtd = e.reduce((s, x) => s + Number(x.quantidade_mes), 0);
                      const abaixo = qtd < premissas.volume_base_mensal[c];
                      return (
                        <TableCell key={a.proposta.id} className={cn("num text-right", abaixo && "text-flamboyant dark:text-terracota")}>
                          {e.length === 0 ? <span className="text-ink-muted">— não declarado</span> : (
                            <>
                              {qtd}
                              {e.some((x) => x.e_teto) && <Badge variant="outline" className="ml-2">Teto</Badge>}
                              {abaixo && <span className="sr-only"> abaixo do volume-base</span>}
                            </>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {comCusto.length === 0 ? (
              <p className="mt-16 text-ink-muted">
                O custo unitário normalizado só se aplica ao módulo de criativo (RFP 2). Este RFP não tem esse módulo.
              </p>
            ) : (
            <>
            <RotuloMono as="p" className="mt-16">Custo unitário normalizado (R4)</RotuloMono>
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Custo mensal de criação</TableHead>
                  <TableHead className="text-right">Volume entregue vs. base</TableHead>
                  <TableHead className="text-right">Peças-base equivalentes</TableHead>
                  <TableHead className="text-right">Custo por peça-base</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comCusto.map((a) => {
                  const u = a.u;
                  return (
                    <TableRow key={a.proposta.id}>
                      <TableCell>{a.player.nome} {u.rotuloTeto && <Badge variant="outline" className="ml-2">Teto</Badge>}</TableCell>
                      <TableCell className="num text-right">{formatarBRL(u.custoMensal)}</TableCell>
                      <TableCell className="num text-right">{u.volumeEntregue} / {u.volumeBase}</TableCell>
                      <TableCell className="num text-right">{u.pecasEquivalentes}</TableCell>
                      <TableCell className="num text-right">{formatarBRL(u.custoPorPeca)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-sm text-ink-muted">
              Peças-base equivalentes contam o volume entregue até o volume-base de cada categoria. Volume com marca Teto é o máximo prometido, não o garantido.
            </p>

            <RotuloMono as="p" className="mt-16">Custo mensal e volume entregue</RotuloMono>
            <div className="mt-4 space-y-6" role="list">
              {comCusto.map((a) => {
                const u = a.u;
                return (
                  <div key={a.proposta.id} role="listitem" className="grid grid-cols-12 items-center gap-4">
                    <p className="col-span-12 font-display text-lg md:col-span-2">{a.player.nome}</p>
                    <div className="col-span-12 space-y-2 md:col-span-10">
                      <div className="flex items-center gap-3">
                        <span className="label-mono w-14 shrink-0 text-ink-muted sm:w-20">Custo</span>
                        <div className="h-5 min-w-0 flex-1">
                          <div className={cn("h-full", fundoPlayer(a.player.cor_token), padraoPlayer(a.player.cor_token))} style={{ width: `${(u.custoMensal / maxCusto) * 100}%` }} />
                        </div>
                        <span className="num w-28 shrink-0 text-right text-xs sm:w-32 sm:text-sm">{formatarBRL(u.custoMensal)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="label-mono w-14 shrink-0 text-ink-muted sm:w-20">Volume</span>
                        <div className="h-5 min-w-0 flex-1">
                          <div className="hachura h-full border border-line-strong" style={{ width: `${(u.volumeEntregue / maxVol) * 100}%` }} />
                        </div>
                        <span className="num w-28 shrink-0 text-right text-xs sm:w-32 sm:text-sm">{u.volumeEntregue} peças{u.rotuloTeto ? " (teto)" : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
            )}
          </>
        )}
      </Conteudo>
    </>
  );
}
