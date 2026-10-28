export type PermissaoConteudo = { leitura: boolean; impressao: boolean };

/** Inputs must come exclusively from verified server-side identity and database rows. */
export function permissaoConteudo(p: { admin: boolean; reuniao: boolean; grupo?: string | null; revogado?: boolean }): PermissaoConteudo {
  if (p.reuniao) return { leitura: true, impressao: false };
  const permitido = p.admin || (p.grupo === "Sócios" && !p.revogado);
  return { leitura: permitido, impressao: permitido };
}