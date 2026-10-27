import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "socio" | "observador";

export const NOME_PAPEL: Record<Papel, string> = {
  admin: "Admin",
  socio: "Sócio",
  observador: "Observador",
};

export async function papeisDoUsuario(userId: string): Promise<Papel[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Papel);
}
