import { useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { baseQuery } from "@/lib/base";
import { validarFiltros, type Filtros } from "@/lib/filtros";
import { analisarRfp, modulosDoRfp, premissasEfetivas } from "@/lib/equalizacao";
import { pontosAutomaticos, pontosManuais, ORDEM_SEV } from "@/lib/pontos";

export type PatchFiltros = { [K in keyof Filtros]?: Filtros[K] | undefined };

export function useFiltros() {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const f = useMemo(() => validarFiltros(raw), [raw]);
  const navigate = useNavigate();
  const set = (patch: PatchFiltros) =>
    navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => {
        const out: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === "") delete out[k];
        return out;
      }) as never,
      replace: true,
    } as never);
  return { f, set };
}

export function useMesa() {
  const { f, set } = useFiltros();
  const { data: base } = useSuspenseQuery(baseQuery);
  const premissas = useMemo(() => premissasEfetivas(base, f), [base, f]);
  const analises = useMemo(() => analisarRfp(base, f.rfp, { filtros: f, premissas }), [base, f, premissas]);
  const rfp = base.rfps.find((r) => r.numero === f.rfp)!;
  const modulos = useMemo(() => modulosDoRfp(base, f.rfp), [base, f.rfp]);
  const pontos = useMemo(
    () =>
      [...analises.flatMap((a) => pontosAutomaticos(a, premissas)), ...pontosManuais(base, analises)].sort(
        (a, b) => ORDEM_SEV[a.severidade] - ORDEM_SEV[b.severidade],
      ),
    [analises, premissas, base],
  );
  return { f, set, base, premissas, analises, rfp, modulos, pontos };
}

/** Classe de fundo fixa por token de cor do player (literal para o Tailwind). */
export function fundoPlayer(token: string | null | undefined) {
  switch (token) {
    case "flamboyant": return "bg-flamboyant";
    case "verde-cerrado": return "bg-verde-cerrado";
    case "ipe-do-cerrado": return "bg-ipe";
    case "terracota": return "bg-terracota";
    case "terra-vermelha": return "bg-terra-vermelha";
    default: return "bg-cinza-quente";
  }
}

/** Padrão por player, para não depender só da cor. */
export function padraoPlayer(token: string | null | undefined) {
  return token === "verde-cerrado" ? "padrao-listras" : token === "ipe-do-cerrado" ? "padrao-pontos" : "";
}
