import type { Base, Cenario } from "./base";
import { analisarComposicao, composicaoDoCenario, dataDecisao, type Estresse, type ResultadoComposicao } from "./composicao";
import { premissasEfetivas } from "./equalizacao";
import type { Premissas } from "./calculo";
import type { Filtros } from "./filtros";

export function premissasDoCenario(base: Base, c: Cenario, sobre: Partial<Filtros> = {}): Premissas {
  const cfg = (c.config ?? {}) as { premissas?: Partial<Filtros> };
  return premissasEfetivas(base, { ...(cfg.premissas ?? {}), ...sobre });
}

export function resultadoDoCenario(base: Base, c: Cenario, op: { sobre?: Partial<Filtros>; estresse?: Estresse } = {}): ResultadoComposicao {
  const comp = composicaoDoCenario(base.cenarioModulos.filter((m) => m.cenario_id === c.id), c.config as Record<string, unknown>);
  return analisarComposicao(base, comp, premissasDoCenario(base, c, op.sobre), { dataDecisao: dataDecisao(base), ...(op.estresse ? { estresse: op.estresse } : {}) });
}

export function linhaComposicao(r: ResultadoComposicao) {
  return r.modulos.map((m) => `${m.modulo.codigo}: ${m.player?.nome ?? (m.opcao.tipo === "interno" ? "Interno" : "a cotar")}`).join(" · ");
}
