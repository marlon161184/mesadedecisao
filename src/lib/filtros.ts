/** Filtros da Mesa, guardados na URL. */
export interface Filtros {
  rfp: number;
  fase?: number | undefined;
  modulo?: string | undefined;
  player?: string | undefined;
  tipo?: string | undefined;
  status?: string | undefined;
  janela?: number | undefined;
  preco?: "negociado" | "lista" | undefined;
  verba?: number | undefined;
  produtos?: number | undefined;
  validadas: boolean;
  essenciais: boolean;
  severidade?: string | undefined;
  entrega?: string | undefined;
  vmin?: number | undefined;
  vmax?: number | undefined;
  incerteza: boolean;
  semVariaveis: boolean;
  rigor?: number | undefined;
  ordem: string;
  origem?: string | undefined;
  regra?: string | undefined;
  filtros: boolean;
}

const num = (v: unknown) => {
  const n = Number(v);
  return v === undefined || v === "" || v === null || !Number.isFinite(n) ? undefined : n;
};
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
const bool = (v: unknown, d: boolean) => (v === undefined ? d : v === true || v === "true" || v === 1);

export function validarFiltros(s: Record<string, unknown>): Filtros {
  const rfp = num(s["rfp"]);
  return {
    rfp: rfp && [1, 2, 3].includes(rfp) ? rfp : 2,
    fase: num(s["fase"]),
    modulo: str(s["modulo"]),
    player: str(s["player"]),
    tipo: str(s["tipo"]),
    status: str(s["status"]),
    janela: num(s["janela"]),
    preco: s["preco"] === "lista" ? "lista" : s["preco"] === "negociado" ? "negociado" : undefined,
    verba: num(s["verba"]),
    produtos: num(s["produtos"]),
    validadas: bool(s["validadas"], false),
    essenciais: bool(s["essenciais"], false),
    severidade: str(s["severidade"]),
    entrega: str(s["entrega"]),
    vmin: num(s["vmin"]),
    vmax: num(s["vmax"]),
    incerteza: bool(s["incerteza"], true),
    semVariaveis: bool(s["semVariaveis"], false),
    rigor: num(s["rigor"]),
    ordem: str(s["ordem"]) ?? "total",
    origem: str(s["origem"]),
    regra: str(s["regra"]),
    filtros: bool(s["filtros"], false),
  };
}
