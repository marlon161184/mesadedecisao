import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { papeisDoUsuario } from "@/lib/papel";
import { Cabecalho } from "./Cabecalho";

export function useSessao() {
  return useQuery({
    queryKey: ["sessao"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      return { email: user?.email ?? "", id: user?.id ?? "", papeis: user ? await papeisDoUsuario(user.id) : [] };
    },
  });
}

export function Moldura({ children }: { children: ReactNode }) {
  const { data } = useSessao();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Cabecalho email={data?.email ?? ""} papeis={data?.papeis ?? []} />
      <main>{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 px-4 py-6 md:px-8 lg:px-12">
          <span className="label-mono text-ink-muted">NEWE · Grupo Hyndra</span>
          <span className="label-mono text-ink-muted">São José do Rio Preto · SP</span>
        </div>
      </footer>
    </div>
  );
}
