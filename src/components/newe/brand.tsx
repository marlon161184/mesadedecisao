import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { LogoNewe } from "./LogoNewe";

/**
 * Logo NEWE. Alias fino de <LogoNewe/> para as telas que já a usam.
 * A marca é trocada somente em src/components/newe/LogoNewe.tsx.
 */
export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  return <LogoNewe height={height} className={className} />;
}

/** Rótulo mono em caixa alta (legendas, seções, números de página). */
export function RotuloMono({
  children,
  className,
  as: As = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "p" | "div" | "dt";
}) {
  return <As className={cn("label-mono text-ink-muted", className)}>{children}</As>;
}

/** Cartão com fio de 1px, sem sombra. */
export function CartaoFio({
  className,
  rotulo,
  titulo,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { rotulo?: string; titulo?: string }) {
  return (
    <div className={cn("min-w-0 border border-line bg-card p-4 text-card-foreground sm:p-6", className)} {...props}>
      {rotulo && <RotuloMono as="p">{rotulo}</RotuloMono>}
      {titulo && <h3 className="mt-2 text-2xl">{titulo}</h3>}
      <div className={cn((rotulo || titulo) && "mt-4")}>{children}</div>
    </div>
  );
}

/** Faixa de abertura de seção em terracota. Texto sempre preto. */
export function FaixaSecao({
  numero,
  titulo,
  children,
  className,
}: {
  numero?: string;
  titulo: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-terracota text-preto", className)}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-4 px-4 py-8 md:gap-6 md:px-8 md:py-12 lg:px-12 lg:py-14">
        {numero && <p className="label-mono col-span-12 md:col-span-2">{numero}</p>}
        <div className="col-span-12 md:col-span-8">
          <h2 className="chamada break-words text-2xl sm:text-3xl md:text-4xl">{titulo}</h2>
          {children && <div className="mt-4 max-w-2xl text-base">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/** Selo de fase obrigatório para o RFP 3. */
export function SeloFase({ fase }: { fase: number }) {
  return fase === 2 ? (
    <span className="inline-flex items-center border border-line-strong px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em]">
      Fase 2
    </span>
  ) : null;
}
