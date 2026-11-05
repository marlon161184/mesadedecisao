import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMesa } from "@/components/mesa/useMesa";
import {
  leituraCobertura, leituraEntregas, leituraMatriz, leituraPlayers, leituraPontos, leituraVisao,
  temRessalvas, type Leitura, type Ressalvas,
} from "@/lib/leitura";
import { cn } from "@/lib/utils";

/** Bloco de ressalvas (estimativas, avisos, cobertura só declarada) com contagem e lista curta. */
export function BlocoRessalvas({ r, grande = false, max = 4 }: { r: Ressalvas; grande?: boolean; max?: number }) {
  if (!temRessalvas(r)) return null;
  return (
    <div className={cn("border-2 border-flamboyant p-4", grande && "p-6")} role="note">
      <p className={cn("label-mono text-flamboyant", grande && "text-[22px]")}>O que ainda é provisório</p>
      <ul className={cn("mt-2 space-y-1", grande ? "text-[24px] leading-snug" : "text-sm")}>
        {r.estimativas.map((e) => (
          <li key={e.player}><strong>{e.player} V{e.versao}:</strong> ESTIMADO, aguardando proposta oficial.</li>
        ))}
        {r.avisos.length > 0 && (
          <li>
            <strong>{r.avisos.length} {r.avisos.length === 1 ? "item com aviso" : "itens com aviso"}</strong> (máximo da faixa, preço de lista ou sem preço, contando R$ 0 até a cotação)
            {": "}
            {r.avisos.slice(0, max).map((a) => `${a.player} · ${a.descricao}`).join("; ")}
            {r.avisos.length > max && `; e mais ${r.avisos.length - max}`}.
          </li>
        )}
        {r.soDeclarada.length > 0 && (
          <li><strong>Cobertura só declarada</strong>, nada comprovado: {r.soDeclarada.join(", ")}.</li>
        )}
      </ul>
    </div>
  );
}

export function LeituraGuiada({ leitura, className }: { leitura: Leitura; className?: string }) {
  const [aberto, setAberto] = useState(true);
  return (
    <section aria-label="Leitura guiada" className={cn("mb-8 border border-line-strong bg-card", className)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-line px-4 py-2 text-left sm:px-6"
      >
        <span className="label-mono">Leitura guiada</span>
        <span className="flex items-center gap-1 text-sm text-ink-muted">
          {aberto ? "Recolher" : "Mostrar"}
          {aberto ? <ChevronUp className="size-4" strokeWidth={1.5} /> : <ChevronDown className="size-4" strokeWidth={1.5} />}
        </span>
      </button>
      {aberto && (
        <div className="space-y-4 p-4 sm:p-6">
          <div className="max-w-3xl space-y-2 text-base leading-relaxed">
            {leitura.frases.map((f, i) => <p key={i}>{f}</p>)}
          </div>
          {leitura.topicos.length > 0 && (
            <div>
              <p className="label-mono text-ink-muted">O que isso significa</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
                {leitura.topicos.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          <BlocoRessalvas r={leitura.ressalvas} />
        </div>
      )}
    </section>
  );
}

export type TelaMesa = "visao" | "matriz" | "entregas" | "cobertura" | "players" | "pontos";

/** Leitura das telas por RFP, com os mesmos filtros e premissas da URL. */
export function LeituraMesa({ tela }: { tela: TelaMesa }) {
  const { base, rfp, analises, modulos, pontos, premissas } = useMesa();
  const leitura = useMemo(() => {
    const nome = `RFP ${rfp.numero} (${rfp.nome})`;
    switch (tela) {
      case "visao": return leituraVisao(base, nome, analises, pontos, premissas);
      case "matriz": return leituraMatriz(base, nome, analises, modulos);
      case "entregas": return leituraEntregas(base, analises, premissas);
      case "cobertura": return leituraCobertura(base, analises);
      case "players": return leituraPlayers(base, { id: rfp.id, nome }, analises);
      case "pontos": return leituraPontos(base, pontos, analises);
    }
  }, [tela, base, rfp, analises, modulos, pontos, premissas]);
  return <LeituraGuiada leitura={leitura} />;
}
