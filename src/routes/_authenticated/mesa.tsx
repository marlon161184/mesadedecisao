import { createFileRoute, Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { baseQuery } from "@/lib/base";
import { validarFiltros } from "@/lib/filtros";
import { BarraLateral, ITENS, ListaSecoes } from "@/components/mesa/BarraLateral";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
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
      <div role="alert" className="px-4 py-10 md:p-16">
        <h1 className="chamada text-2xl">Não conseguimos carregar os dados</h1>
        <p className="mt-3 text-ink-muted">{error instanceof Error ? error.message : String(error)}</p>
        <Button className="mt-6" onClick={() => router.invalidate()}>Tentar de novo</Button>
      </div>
    );
  },
  notFoundComponent: () => <p className="px-4 py-10 md:p-16">Página não encontrada.</p>,
});

function SeletorRfp() {
  const { f, set, base } = useMesa();
  const rfps = base.rfps.filter((r) => !f.fase || r.fase === f.fase);
  return (
    <div role="radiogroup" aria-label="RFP" className="flex min-w-0 overflow-x-auto border border-line-strong">
      {rfps.map((r) => (
        <button
          key={r.id}
          role="radio"
          aria-checked={f.rfp === r.numero}
          onClick={() => set({ rfp: r.numero, modulo: undefined, player: undefined })}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 border-r border-line-strong px-3 py-2 text-left text-sm last:border-r-0 sm:px-4",
            f.rfp === r.numero ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          <span className="label-mono whitespace-nowrap">RFP {r.numero}</span>
          <span className="hidden xl:inline">{r.numero === 2 ? "Criativo, dados, performance e CRM" : r.nome}</span>
          {r.fase === 2 && (
            <span className="label-mono whitespace-nowrap border border-current px-1.5 py-0.5 text-[0.6875rem]">
              Fase 2<span className="hidden md:inline"> · a partir de mai/2027</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function MenuMovel() {
  const [aberto, setAberto] = useState(false);
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setAberto(false), [caminho]);
  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <Button variant="ghost" size="icon" aria-label="Menu" aria-expanded={aberto} onClick={() => setAberto(true)}>
        <Menu strokeWidth={1.5} />
      </Button>
      <SheetContent side="left" className="flex w-full max-w-none flex-col border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-none [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent">
        <div className="px-6 pb-4 pt-6">
          <LogoNewe height={28} comMargem={false} variante="luz" />
          <SheetTitle className="label-mono mt-1 font-mono text-sidebar-foreground/70">Mesa de Decisão · Seções</SheetTitle>
          <SheetDescription className="sr-only">Escolha uma seção da Mesa.</SheetDescription>
        </div>
        <nav aria-label="Seções" className="flex-1 overflow-y-auto px-3 pb-8">
          <ListaSecoes grande aoNavegar={() => setAberto(false)} />
        </nav>
      </SheetContent>
    </Sheet>
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
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const h = document.getElementById("cabecalho-mesa");
    if (!h) return;
    const ro = new ResizeObserver(() => {
      const fixo = getComputedStyle(h).position === "sticky";
      document.documentElement.style.setProperty("--altura-cabecalho", fixo ? `${h.offsetHeight}px` : "0px");
    });
    ro.observe(h);
    return () => ro.disconnect();
  }, []);
  const atual = ITENS.find((i) => i.to && caminho.startsWith(i.to))?.rotulo ?? "Mesa";
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <BarraLateral />
      <div className="min-w-0 flex-1">
        <header id="cabecalho-mesa" className="sticky top-0 z-40 border-b border-line bg-background lg:static">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-1.5 md:px-8 lg:hidden">
            <Link to="/mesa/visao" search={true as never} aria-label="NEWE, início" className="inline-flex shrink-0">
              <LogoNewe height={24} comMargem={false} />
            </Link>
            <p className="label-mono truncate" aria-live="polite">{atual}</p>
            <div className="flex items-center">
              <AlternarTema />
              <Button variant="ghost" size="icon" aria-label="Sair" onClick={sair}><LogOut strokeWidth={1.5} /></Button>
              <MenuMovel />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2 md:px-8 lg:border-t-0 lg:px-12 lg:py-3">
            <SeletorRfp />
            <div className="hidden items-center gap-1 lg:flex">
              <AlternarTema />
              <Button variant="ghost" size="icon" aria-label="Sair" onClick={sair}><LogOut strokeWidth={1.5} /></Button>
            </div>
          </div>
        </header>
        <BarraFiltros />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
