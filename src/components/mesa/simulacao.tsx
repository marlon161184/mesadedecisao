import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { RotuloMono } from "@/components/newe/brand";
import { formatarBRL } from "@/lib/formato";
import type { FaixaCobertura } from "@/lib/calculo";
import type { ResultadoComposicao } from "@/lib/composicao";
import { ROTULO_SEV, type Ponto, type Severidade } from "@/lib/pontos";
import { cn } from "@/lib/utils";

export const VAR_SEV: Record<Severidade, "flamboyant" | "terracota" | "outline" | "secondary"> = {
  critico: "flamboyant", alto: "terracota", medio: "outline", info: "secondary",
};

export function corVar(token: string | null | undefined) {
  switch (token) {
    case "flamboyant": return "var(--flamboyant)";
    case "verde-cerrado": return "var(--verde-cerrado)";
    case "ipe-do-cerrado": return "var(--ipe-do-cerrado)";
    case "terracota": return "var(--terracota)";
    case "terra-vermelha": return "var(--terra-vermelha)";
    default: return "var(--cinza-quente)";
  }
}

export function CartaoNumero({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: string | undefined; destaque?: boolean }) {
  return (
    <div className={cn("border p-5", destaque ? "border-primary bg-primary text-primary-foreground" : "border-line")}>
      <p className={cn("label-mono", destaque ? "" : "text-ink-muted")}>{rotulo}</p>
      <p className="num mt-2 text-2xl">{valor}</p>
      {sub && <p className={cn("num mt-1 text-xs", destaque ? "" : "text-ink-muted")}>{sub}</p>}
    </div>
  );
}

/** Expectativa = 100% (contorno). Realidade: conservadora sólida, otimista hachurada. */
export function BarraExpectativa({ rotulo, c, semPlayer }: { rotulo: string; c: FaixaCobertura; semPlayer?: boolean }) {
  const cons = Math.round(c.conservadora * 100);
  const ot = Math.round((c.otimista ?? c.conservadora) * 100);
  return (
    <div className="grid grid-cols-12 items-center gap-3">
      <p className="col-span-4 text-sm">{rotulo}</p>
      <div className="relative col-span-6 h-4 border border-line-strong" role="img"
        aria-label={`${rotulo}: expectativa 100%, realidade ${cons}% a ${ot}%${semPlayer ? ", sem player" : ""}`}>
        <div className="hachura absolute inset-y-0 left-0" style={{ width: `${ot}%` }} />
        <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${cons}%` }} />
      </div>
      <p className="num col-span-2 text-right text-xs">{semPlayer ? "0% · sem player" : `${cons}–${ot}%`}</p>
    </div>
  );
}

export function GraficoDesembolso({ r }: { r: ResultadoComposicao }) {
  const players = [...new Set(r.desembolso.flatMap((d) => Object.keys(d.porPlayer)))];
  const cor = (nome: string) => corVar(r.porPlayer.find((p) => p.nome === nome)?.cor);
  const dados = r.desembolso.map((d) => ({ mes: `Mês ${d.mes}`, ...d.porPlayer }));
  return (
    <div className="h-72" role="img" aria-label="Desembolso mês a mês por player">
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ left: 10 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontFamily: "DM Mono", fontSize: 11, fill: "var(--ink-muted)" }} stroke="var(--line)" />
          <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)} mil`} tick={{ fontFamily: "DM Mono", fontSize: 11, fill: "var(--ink-muted)" }} stroke="var(--line)" />
          <Tooltip formatter={(v) => formatarBRL(Number(v))} contentStyle={{ background: "var(--background)", border: "1px solid var(--line-strong)", borderRadius: 0 }} />
          <Legend wrapperStyle={{ fontFamily: "DM Mono", fontSize: 11, textTransform: "uppercase" }} />
          {players.map((p) => <Bar key={p} dataKey={p} stackId="a" fill={cor(p)} stroke="var(--background)" />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ListaPontos({ pontos }: { pontos: Ponto[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {pontos.map((p) => (
        <li key={p.id} className="grid grid-cols-12 gap-3 py-3 text-sm">
          <div className="col-span-3 flex flex-col items-start gap-1">
            <Badge variant={VAR_SEV[p.severidade]}>{ROTULO_SEV[p.severidade]}</Badge>
            {p.codigo && <span className="label-mono text-ink-muted">{p.codigo}</span>}
          </div>
          <div className="col-span-9">
            <p>{p.texto}</p>
            <p className="mt-1 text-xs text-ink-muted"><span className="label-mono">Ação</span> {p.acao}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Contagem({ r }: { r: ResultadoComposicao }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Pontos de atenção por severidade">
      {(["critico", "alto", "medio", "info"] as Severidade[]).map((s) => (
        <Badge key={s} variant={VAR_SEV[s]}>{ROTULO_SEV[s]} {r.contagem[s]}</Badge>
      ))}
    </div>
  );
}

export function TabelaSimples({ titulo, linhas }: { titulo: string; linhas: { rotulo: string; valor: number; pct?: number }[] }) {
  return (
    <div>
      <RotuloMono as="p">{titulo}</RotuloMono>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-line">
              <td className="py-1.5">{l.rotulo}</td>
              <td className="num py-1.5 text-right">{formatarBRL(l.valor)}</td>
              {l.pct != null && <td className="num w-16 py-1.5 text-right text-ink-muted">{Math.round(l.pct * 100)}%</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
