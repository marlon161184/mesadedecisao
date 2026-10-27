const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const formatarBRL = (v: number | null | undefined) => (v == null ? "—" : brl.format(v));
export const formatarPct = (v: number | null | undefined) => (v == null ? "—" : pct.format(v));
export function formatarData(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d;
  return dt.toLocaleDateString("pt-BR");
}

/** Cores fixas por player nos gráficos. Novos players: terra-vermelha, depois cinzas quentes. */
const CORES_FIXAS: Record<string, string> = {
  Rebu: "flamboyant",
  Folhetim: "verde-cerrado",
  "XCV/WiVO": "ipe-do-cerrado",
  "F&MD": "terracota",
};
const CORES_EXTRAS = ["terra-vermelha", "cinza-quente-1", "cinza-quente-2", "cinza-quente-3"];
export function corDoPlayer(nome: string, indiceNovo = 0) {
  return CORES_FIXAS[nome] ?? CORES_EXTRAS[Math.min(indiceNovo, CORES_EXTRAS.length - 1)];
}
