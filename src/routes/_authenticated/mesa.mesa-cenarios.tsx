import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Scatter, Symbols, Tooltip, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMesa } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { Contagem } from "@/components/mesa/simulacao";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { formatarBRL, formatarPct } from "@/lib/formato";
import { cenariosNomeados, dataDecisao, enumerarComposicoes, fronteira, type Candidato } from "@/lib/composicao";
import { linhaComposicao } from "@/lib/cenarios";

export const Route = createFileRoute("/_authenticated/mesa/mesa-cenarios")({
  head: () => ({
    meta: [
      { title: "Mesa de cenários · NEWE Mesa de Decisão" },
      { name: "description", content: "Todas as composições da fase 1, com cinco cenários conclusivos e a fronteira de eficiência." },
      { property: "og:title", content: "Mesa de cenários · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Todas as composições da fase 1, com cinco cenários conclusivos e a fronteira de eficiência." },
    ],
  }),
  component: MesaCenarios,
});

const FORMAS = ["circle", "square", "triangle", "diamond", "cross", "star", "wye"] as const;
/** Ponto com área de toque de 24 px (círculo transparente) e símbolo visível no centro. */
function pontoTocavel(tipo: (typeof FORMAS)[number]) {
  return function Ponto(props: unknown) {
    const { cx, cy, fill } = props as { cx: number; cy: number; fill: string };
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <Symbols cx={cx} cy={cy} type={tipo} size={64} fill={fill} />
      </g>
    );
  };
}

const CORES = ["var(--flamboyant)", "var(--verde-cerrado)", "var(--ipe-do-cerrado)", "var(--terracota)", "var(--terra-vermelha)", "var(--cinza-quente)", "var(--preto)"];

function MesaCenarios() {
  const { base, premissas } = useMesa();
  const navigate = useNavigate();
  const movel = useIsMobile();
  const [naoValidadas, setNaoValidadas] = useState(true);
  const cands = useMemo(() => enumerarComposicoes(base, premissas, { incluirNaoValidadas: naoValidadas, dataDecisao: dataDecisao(base) }), [base, premissas, naoValidadas]);
  const { viaveis, pool, nomeados } = useMemo(() => cenariosNomeados(cands), [cands]);
  const front = useMemo(() => fronteira(cands.filter((c) => c.r.nPlayers > 0)), [cands]);
  const abrir = (c: Candidato) => navigate({ to: "/mesa/simulador", search: ((p: Record<string, unknown>) => ({ ...p, cenario: undefined, comp: JSON.stringify(c.comp) })) as never });

  const porN = new Map<number, { x: number; y: number; c: Candidato }[]>();
  for (const c of cands) {
    const arr = porN.get(c.r.nPlayers) ?? [];
    arr.push({ x: Math.round(c.r.total.central), y: Math.round(c.r.cobertura.conservadora * 1000) / 10, c });
    porN.set(c.r.nPlayers, arr);
  }
  const linhaFront = front.map((c) => ({ x: Math.round(c.r.total.central), y: Math.round(c.r.cobertura.conservadora * 1000) / 10 }));

  return (
    <>
      <AberturaTela numero="Mesa de cenários" titulo="Cenários conclusivos">
        {cands.length.toLocaleString("pt-BR")} composições da fase 1 calculadas com as premissas atuais.
      </AberturaTela>
      <Conteudo>
        <label className="mb-6 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={naoValidadas} onChange={(e) => setNaoValidadas(e.target.checked)} />
          Incluir propostas não validadas
        </label>
        <div className={viaveis ? "border border-line p-4" : "border border-flamboyant bg-flamboyant p-4 text-luz"}>
          {viaveis
            ? `${pool.length} composição(ões) viável(is): sem portão reprovado, sem ponto crítico e com os módulos essenciais cobertos.`
            : `Nenhuma composição é viável. Mostramos as ${pool.length} menos inválidas. Motivo: ${[...new Set(pool.flatMap((c) => c.r.motivosInviavel))].join("; ")}.`}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {nomeados.map((n) => (
            <article key={n.titulo} className="flex min-w-0 flex-col border border-line p-4 sm:p-6">
              <RotuloMono>{n.titulo}</RotuloMono>
              <p className="num mt-3 text-2xl">{formatarBRL(n.c.r.total.central)}</p>
              <p className="mt-1 text-sm">Cobertura {formatarPct(n.c.r.cobertura.conservadora)} a {formatarPct(n.c.r.cobertura.otimista)} · {n.c.r.nPlayers} player(s) · eficiência {n.c.r.eficiencia?.toFixed(1).replace(".", ",") ?? "—"}</p>
              <div className="mt-3"><Contagem r={n.c.r} /></div>
              <p className="mt-3 text-xs text-ink-muted">{linhaComposicao(n.c.r)}</p>
              <p className="mt-3 text-sm">{n.motivo}</p>
              <div className="mt-auto pt-4"><Button size="sm" onClick={() => abrir(n.c)}>Abrir no simulador</Button></div>
            </article>
          ))}
        </div>

        <RotuloMono as="p" className="mt-16">Custo x cobertura conservadora · fronteira de eficiência</RotuloMono>
        <p className="mt-1 text-xs text-ink-muted">Cada ponto é uma composição. Forma e cor indicam o número de players. A linha liga as composições sem alternativa mais barata e mais completa. Clique em um ponto para abrir no simulador.</p>
        <div className="mt-4 h-[380px] w-full min-w-0 sm:h-[460px]" role="img" aria-label="Gráfico de dispersão custo por cobertura">
          <ResponsiveContainer>
            <ComposedChart margin={movel ? { left: 0, right: 8, bottom: 8 } : { left: 20, right: 20, bottom: 20 }}>
              <CartesianGrid stroke="var(--line)" />
              <XAxis type="number" dataKey="x" name="Custo" tickFormatter={(v) => `${Math.round(Number(v) / 1000)} mil`} tick={{ fontFamily: "DM Mono", fontSize: 11, fill: "var(--ink-muted)" }} stroke="var(--line)" tickCount={movel ? 4 : 6} minTickGap={16} />
              <YAxis width={movel ? 40 : 60} type="number" dataKey="y" name="Cobertura" unit="%" tick={{ fontFamily: "DM Mono", fontSize: 11, fill: "var(--ink-muted)" }} stroke="var(--line)" />
              <Tooltip formatter={(v, n) => (n === "Custo" ? formatarBRL(Number(v)) : `${v}%`)} contentStyle={{ background: "var(--background)", border: "1px solid var(--line-strong)", borderRadius: 0 }} />
              <Legend verticalAlign="bottom" align="left" wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, textTransform: "uppercase", paddingTop: 12 }} />
              {[...porN.entries()].sort((a, b) => a[0] - b[0]).map(([n, pts], i) => (
                <Scatter key={n} name={`${n} player(s)`} data={pts} fill={CORES[i % CORES.length]} shape={pontoTocavel(FORMAS[i % FORMAS.length]!)} legendType={FORMAS[i % FORMAS.length]}
                  onClick={(d) => abrir((d as unknown as { c: Candidato }).c)} cursor="pointer" />
              ))}
              <Line name="Fronteira de eficiência" data={linhaFront} dataKey="y" type="stepAfter" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Conteudo>
    </>
  );
}
