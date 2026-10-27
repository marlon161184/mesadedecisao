import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { FaixaSecao, RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { formatarBRL, formatarPct } from "@/lib/formato";
import type { Faixa, FaixaCobertura } from "@/lib/calculo";
import type { Base, Modulo } from "@/lib/base";
import { cn } from "@/lib/utils";

export function AberturaTela({ numero, titulo, children }: { numero: string; titulo: string; children?: ReactNode }) {
  return <FaixaSecao numero={numero} titulo={titulo}>{children}</FaixaSecao>;
}

export function Conteudo({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 px-4 py-8 md:px-8 md:py-10 lg:px-12 lg:py-12", className)}>{children}</div>;
}

export function Valor({ faixa, incerteza = true, className }: { faixa: Faixa | null; incerteza?: boolean; className?: string }) {
  if (!faixa) return <span className="text-ink-muted">—</span>;
  return (
    <span className={cn("num", className)}>
      {formatarBRL(faixa.central)}
      {incerteza && faixa.eFaixa && (
        <span className="block text-xs text-ink-muted">
          {formatarBRL(faixa.min)} a {formatarBRL(faixa.max)}
        </span>
      )}
    </span>
  );
}

export function FaixaCob({ c }: { c: FaixaCobertura }) {
  return (
    <span className="num">
      {formatarPct(c.conservadora)}–{c.otimista == null ? "—" : formatarPct(c.otimista)}
    </span>
  );
}

/** Barra horizontal: trecho sólido = conservadora; hachurado = até a otimista. */
export function BarraCobertura({ c }: { c: FaixaCobertura }) {
  const cons = Math.round(c.conservadora * 100);
  const ot = Math.round((c.otimista ?? c.conservadora) * 100);
  return (
    <div>
      <div
        className="relative h-3 w-full border border-line-strong"
        role="img"
        aria-label={`Cobertura conservadora ${cons}%, otimista ${c.otimista == null ? "não calculável" : `${ot}%`}`}
      >
        <div className="hachura absolute inset-y-0 left-0" style={{ width: `${ot}%` }} />
        <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${cons}%` }} />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="label-mono text-ink-muted">Conservadora {cons}%</span>
        <span className="label-mono text-ink-muted">Otimista {c.otimista == null ? "—" : `${ot}%`}</span>
      </div>
    </div>
  );
}

export function SeloStatus({ status }: { status: string }) {
  if (status === "validada") return <Badge variant="default">Validada</Badge>;
  return <Badge variant="outline">Em equalização</Badge>;
}

export function IconeIncerteza({ texto }: { texto: string }) {
  return (
    <span title={texto} aria-label={`Incerteza: ${texto}`} className="inline-flex align-middle text-terra-vermelha">
      <AlertTriangle strokeWidth={1.5} className="size-3.5" />
    </span>
  );
}

export function Indicador({ rotulo, valor, alerta }: { rotulo: string; valor: ReactNode; alerta?: boolean }) {
  return (
    <div className={cn("min-w-0 border-b border-r border-line px-4 py-4 sm:px-6 sm:py-5", alerta && "bg-flamboyant text-luz")}>
      <p className={cn("label-mono", alerta ? "text-luz" : "text-ink-muted")}>{rotulo}</p>
      <p className="num mt-2 break-words text-2xl sm:text-3xl">{valor}</p>
    </div>
  );
}

/** RFP sem propostas: mostra módulos e requisitos cadastrados. */
export function SemPropostas({ base, modulos }: { base: Base; modulos: Modulo[] }) {
  return (
    <div>
      <div className="border border-line-strong p-6">
        <RotuloMono as="p">Fase 2 · a partir de mai/2027</RotuloMono>
        <p className="mt-2 text-xl">Sem propostas ainda.</p>
        <p className="mt-1 text-sm text-ink-muted">Já deixamos o escopo pronto para receber as propostas.</p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {modulos.map((m) => (
          <div key={m.id} className="border border-line p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <RotuloMono>{m.codigo} · peso {Number(m.peso_no_rfp)}</RotuloMono>
              {m.descricao && <RotuloMono>{m.descricao}</RotuloMono>}
            </div>
            <h3 className="mt-2 text-xl">{m.nome}</h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              {base.requisitos.filter((r) => r.modulo_id === m.id).map((r) => (
                <li key={r.id} className="flex gap-3 border-t border-line pt-1.5">
                  <span className="label-mono w-10 shrink-0 pt-0.5 text-ink-muted">{r.codigo}</span>
                  {r.descricao}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
