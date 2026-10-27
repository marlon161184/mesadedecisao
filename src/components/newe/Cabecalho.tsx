import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogoNewe } from "./LogoNewe";
import { AlternarTema } from "./AlternarTema";
import { NOME_PAPEL, type Papel } from "@/lib/papel";

export function Cabecalho({ email, papeis }: { email: string; papeis: Papel[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-8 py-4 md:px-16">
        <Link to="/inicio" className="flex items-center gap-4" aria-label="Início">
          <LogoNewe height={30} />
          <span className="label-mono hidden text-ink-muted sm:inline">Mesa de Decisão</span>
        </Link>
        <nav className="flex items-center gap-2">
          {papeis.includes("admin") && (
            <Link
              to="/acessos"
              className="label-mono px-3 py-2 text-foreground hover:bg-accent"
              activeProps={{ className: "underline underline-offset-4" }}
            >
              Acessos
            </Link>
          )}
          <span className="label-mono hidden px-3 text-ink-muted md:inline">
            {email} · {papeis.map((p) => NOME_PAPEL[p]).join(", ") || "Sem papel"}
          </span>
          <AlternarTema />
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={sair}>
            <LogOut strokeWidth={1.5} />
          </Button>
        </nav>
      </div>
    </header>
  );
}
