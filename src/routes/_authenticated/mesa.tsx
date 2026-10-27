import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { baseQuery } from "@/lib/base";
import { validarFiltros } from "@/lib/filtros";
import { BarraLateral } from "@/components/mesa/BarraLateral";
import { BarraFiltros } from "@/components/mesa/BarraFiltros";
import { useMesa } from "@/components/mesa/useMesa";
import { AlternarTema } from "@/components/newe/AlternarTema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInatividade } from "@/hooks/use-inatividade";

export const Route = createFileRoute("/_authenticated/mesa")({
  validateSearch: (s: Record<string, unknown>) => validarFiltros(s),
  loader: ({ context }) => context.queryClient.ensureQueryData(baseQuery),
  component: LayoutMesa,
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div role="alert" className="p-16">
        <h1 className="chamada text-2xl">Não conseguimos carregar os dados</h1>
        <p className="mt-3 text-ink-muted">{error instanceof Error ? error.message : String(error)}</p>
        <Button className="mt-6" onClick={() => router.invalidate()}>Tentar de novo</Button>
      </div>
    );
  },
  notFoundComponent: () => <p className="p-16">Página não encontrada.</p>,
});

function SeletorRfp() {
  const { f, set, base } = useMesa();
  const rfps = base.rfps.filter((r) => !f.fase || r.fase === f.fase);
  return (
    <div role="radiogroup" aria-label="RFP" className="flex flex-wrap border border-line-strong">
      {rfps.map((r) => (
        <button
          key={r.id}
          role="radio"
          aria-checked={f.rfp === r.numero}
          onClick={() => set({ rfp: r.numero, modulo: undefined, player: undefined })}
          className={cn(
            "flex items-center gap-2 border-r border-line-strong px-4 py-2 text-left text-sm last:border-r-0",
            f.rfp === r.numero ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          <span className="label-mono">RFP {r.numero}</span>
          <span className="hidden lg:inline">{r.numero === 2 ? "Criativo, dados, performance e CRM" : r.nome}</span>
          {r.fase === 2 && <span className="label-mono border border-current px-1.5 py-0.5 text-[0.6rem]">Fase 2 · a partir de mai/2027</span>}
        </button>
      ))}
    </div>
  );
}

function LayoutMesa() {
  useInatividade();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <BarraLateral />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-line px-8 py-3 md:px-12">
          <SeletorRfp />
          <div className="flex items-center gap-1">
            <AlternarTema />
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={sair}><LogOut strokeWidth={1.5} /></Button>
          </div>
        </header>
        <BarraFiltros />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
