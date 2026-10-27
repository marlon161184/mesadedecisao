import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, BarChart3, Gauge, Layers, ScatterChart, Grid3x3, LayoutDashboard, Lock, Package, Settings, Users, Vote, Workflow,
} from "lucide-react";
import type { ComponentType } from "react";

type Destino = "/mesa/visao" | "/mesa/matriz" | "/mesa/entregas" | "/mesa/cobertura" | "/mesa/players" | "/mesa/pontos" | "/mesa/simulador" | "/mesa/cenarios" | "/mesa/mesa-cenarios" | "/mesa/estresse" | "/mesa/admin";
const ITENS: { rotulo: string; to?: Destino; icone: ComponentType<{ strokeWidth?: number; className?: string }>; nota?: string }[] = [
  { rotulo: "Visão geral", to: "/mesa/visao", icone: LayoutDashboard },
  { rotulo: "Matriz por módulo", to: "/mesa/matriz", icone: Grid3x3 },
  { rotulo: "Entregas normalizadas", to: "/mesa/entregas", icone: Package },
  { rotulo: "Cobertura", to: "/mesa/cobertura", icone: BarChart3 },
  { rotulo: "Players", to: "/mesa/players", icone: Users },
  { rotulo: "Pontos de atenção", to: "/mesa/pontos", icone: AlertTriangle },
  { rotulo: "Simulador", to: "/mesa/simulador", icone: Workflow },
  { rotulo: "Cenários", to: "/mesa/cenarios", icone: Layers },
  { rotulo: "Mesa de cenários", to: "/mesa/mesa-cenarios", icone: ScatterChart },
  { rotulo: "Teste de estresse", to: "/mesa/estresse", icone: Gauge },
  { rotulo: "Decisão", icone: Vote, nota: "Etapa final" },
  { rotulo: "Admin", to: "/mesa/admin", icone: Settings },
];

export function BarraLateral() {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-6">
        <Link to="/mesa/visao" search={true as never} className="font-display text-2xl tracking-[0.08em] text-sidebar-foreground" aria-label="NEWE, início">
          NEWE
        </Link>
        <p className="label-mono mt-1 text-sidebar-foreground/70">Mesa de Decisão</p>
      </div>
      <nav aria-label="Seções" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {ITENS.map(({ rotulo, to, icone: Icone, nota }) => (
            <li key={rotulo}>
              {to ? (
                <Link
                  to={to}
                  search={true as never}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring"
                  activeProps={{ className: "!text-sidebar-primary border-l-2 border-sidebar-primary" }}
                >
                  <Icone strokeWidth={1.5} className="size-4" />
                  {rotulo}
                </Link>
              ) : (
                <span aria-disabled="true" className="flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/45" title={`Bloqueado: ${nota}`}>
                  <Lock strokeWidth={1.5} className="size-4" />
                  <span className="flex-1">{rotulo}</span>
                  <span className="label-mono text-[0.6rem]">{nota}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <p className="label-mono px-6 py-5 text-sidebar-foreground/60">Grupo Hyndra</p>
    </aside>
  );
}
