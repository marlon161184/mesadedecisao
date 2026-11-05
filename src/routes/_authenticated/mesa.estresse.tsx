import { LeituraGuiada } from "@/components/mesa/LeituraGuiada";
import { calcularEstresse, leituraEstresse } from "@/lib/leitura";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMesa } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarBRL, formatarPct } from "@/lib/formato";
import { resultadoDoCenario } from "@/lib/cenarios";
import type { Estresse } from "@/lib/composicao";
import type { Filtros } from "@/lib/filtros";

export const Route = createFileRoute("/_authenticated/mesa/estresse")({
  head: () => ({
    meta: [
      { title: "Teste de estresse · NEWE Mesa de Decisão" },
      { name: "description", content: "Como cada cenário salvo reage a premissas piores." },
      { property: "og:title", content: "Teste de estresse · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Como cada cenário salvo reage a premissas piores." },
    ],
  }),
  component: Estresse,
});

function Estresse() {
  const { base } = useMesa();
  const [c, setC] = useState({ volume: true, verba: true, janela: false, xcv: true, maximo: true, crm: 0 });
  const linhas = useMemo(() => {
    const sobre: Partial<Filtros> = { ...(c.verba ? { verba: 100000 } : {}), ...(c.janela ? { janela: 12 } : {}) };
    const est: Estresse = { ...(c.volume ? { volume: 0.2 } : {}), ...(c.xcv ? { xcvSemDesconto: true } : {}), ...(c.maximo ? { precoMaximo: true } : {}), ...(c.crm > 0 ? { crmACotar: c.crm } : {}) };
    const ls = base.cenarios.map((cen) => {
      const b = resultadoDoCenario(base, cen);
      const s = resultadoDoCenario(base, cen, { sobre, estresse: est });
      return { cen, base: b.total.central, estressado: s.total.central, cob: s.cobertura.conservadora };
    });
    const ordemB = [...ls].sort((a, b) => a.base - b.base).map((l) => l.cen.id);
    const ordemS = [...ls].sort((a, b) => a.estressado - b.estressado).map((l) => l.cen.id);
    return ls.map((l) => ({ ...l, posB: ordemB.indexOf(l.cen.id) + 1, posS: ordemS.indexOf(l.cen.id) + 1 }));
  }, [base, c]);
  const leituraEst = useMemo(() => { const e = calcularEstresse(base); return leituraEstresse(base, e.linhas, e.rs); }, [base]);
  const mudou = linhas.some((l) => l.posB !== l.posS);

  const chave = (k: keyof typeof c, rotulo: string) => (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" checked={!!c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} /> {rotulo}
    </label>
  );

  return (
    <>
      <AberturaTela numero="Teste de estresse" titulo="E se der errado">
        Uma escolha que só se sustenta no melhor caso não é uma escolha segura.
      </AberturaTela>
      <Conteudo>
        <LeituraGuiada leitura={leituraEst} />
        <div className="mb-8 grid grid-cols-1 gap-3 border border-line p-4 sm:p-5 md:grid-cols-3">
          {chave("volume", "Volume de produção +20%")}
          {chave("verba", "Verba de mídia de R$ 100.000 por mês")}
          {chave("janela", "Janela de 12 meses")}
          {chave("xcv", "Desconto da XCV não confirmado (0%)")}
          {chave("maximo", "Preço máximo das faixas")}
          <label className="text-sm"><span className="label-mono mb-1.5 block text-ink-muted">CRM a cotar (R$ na janela)</span>
            <input type="number" min={0} step={10000} className="campo num" value={c.crm} onChange={(e) => setC({ ...c, crm: Math.max(0, Number(e.target.value)) })} /></label>
        </div>
        <p className="mb-4 border-l-2 border-terracota pl-4 text-sm">{mudou ? "A ordem entre os cenários muda sob estresse." : "A ordem entre os cenários se mantém sob estresse."}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cenário</TableHead>
              <TableHead className="text-right">Total base</TableHead>
              <TableHead className="text-right">Total estressado</TableHead>
              <TableHead className="text-right">Variação</TableHead>
              <TableHead className="text-right">Posição (base → estresse)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.cen.id}>
                <TableCell>{l.cen.nome}</TableCell>
                <TableCell className="num text-right">{formatarBRL(l.base)}</TableCell>
                <TableCell className="num text-right">{formatarBRL(l.estressado)}</TableCell>
                <TableCell className="num text-right">+{formatarBRL(l.estressado - l.base)} ({formatarPct(l.base ? (l.estressado - l.base) / l.base : 0)})</TableCell>
                <TableCell className="num text-right">{l.posB}º → {l.posS}º{l.posB !== l.posS && <span className="label-mono ml-2">Mudou</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-ink-muted">Posição por menor total. O volume +20% aumenta a produção recorrente do criativo (P1).</p>
      </Conteudo>
    </>
  );
}
