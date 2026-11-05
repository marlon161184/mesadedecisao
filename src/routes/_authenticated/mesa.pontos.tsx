import { LeituraMesa } from "@/components/mesa/LeituraGuiada";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { useMesa } from "@/components/mesa/useMesa";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { RotuloMono } from "@/components/newe/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROTULO_SEV, type Severidade } from "@/lib/pontos";

export const Route = createFileRoute("/_authenticated/mesa/pontos")({
  head: () => ({
    meta: [
      { title: "Pontos de atenção · NEWE Mesa de Decisão" },
      { name: "description", content: "Central de pontos de atenção por regra e manuais." },
      { property: "og:title", content: "Pontos de atenção · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Central de pontos de atenção por regra e manuais." },
    ],
  }),
  component: Pontos,
});

const VAR_SEV: Record<Severidade, "flamboyant" | "terracota" | "outline" | "secondary"> = {
  critico: "flamboyant", alto: "terracota", medio: "outline", info: "secondary",
};

function Pontos() {
  const { f, set, rfp, pontos, modulos, analises } = useMesa();
  const regras = [...new Set(pontos.map((p) => p.codigo).filter(Boolean))].sort() as string[];
  const lista = pontos
    .filter((p) => !f.severidade || p.severidade === f.severidade)
    .filter((p) => !f.player || analises.find((a) => a.player.id === f.player)?.proposta.id === p.propostaId)
    .filter((p) => !f.modulo || p.moduloId === f.modulo)
    .filter((p) => !f.regra || p.codigo === f.regra)
    .filter((p) => !f.origem || p.origem === f.origem);

  return (
    <>
      <AberturaTela numero={`RFP ${rfp.numero} · Pontos de atenção`} titulo="Pontos de atenção">
        Regras automáticas (P-01 a P-09) e pontos cadastrados pelo Admin, em um só lugar.
      </AberturaTela>
      <Conteudo>
        <LeituraMesa tela="pontos" />
        <div className="mb-8 grid grid-cols-1 gap-4 border border-line p-4 sm:grid-cols-2 sm:p-5 md:grid-cols-5">
          <label><span className="label-mono mb-1.5 block text-ink-muted">Severidade</span>
            <select className="campo" value={f.severidade ?? ""} onChange={(e) => set({ severidade: e.target.value || undefined })}>
              <option value="">Todas</option>{Object.entries(ROTULO_SEV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Player</span>
            <select className="campo" value={f.player ?? ""} onChange={(e) => set({ player: e.target.value || undefined })}>
              <option value="">Todos</option>{analises.map((a) => <option key={a.player.id} value={a.player.id}>{a.player.nome}</option>)}
            </select></label>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Módulo</span>
            <select className="campo" value={f.modulo ?? ""} onChange={(e) => set({ modulo: e.target.value || undefined })}>
              <option value="">Todos</option>{modulos.map((m) => <option key={m.id} value={m.id}>{m.codigo} {m.nome}</option>)}
            </select></label>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Regra</span>
            <select className="campo" value={f.regra ?? ""} onChange={(e) => set({ regra: e.target.value || undefined })}>
              <option value="">Todas</option>{regras.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></label>
          <label><span className="label-mono mb-1.5 block text-ink-muted">Origem</span>
            <select className="campo" value={f.origem ?? ""} onChange={(e) => set({ origem: e.target.value || undefined })}>
              <option value="">Todas</option><option value="regra">Regra</option><option value="manual">Manual</option>
            </select></label>
        </div>

        <RotuloMono as="p">{lista.length} ponto(s)</RotuloMono>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {lista.map((p) => (
            <li key={p.id} className="grid grid-cols-12 gap-4 py-5">
              <div className="col-span-12 flex flex-wrap gap-2 md:col-span-2 md:flex-col md:items-start">
                <Badge variant={VAR_SEV[p.severidade]}>{ROTULO_SEV[p.severidade]}</Badge>
                {p.codigo && <Badge variant="outline">{p.codigo}</Badge>}
                <Badge variant="secondary">{p.origem === "regra" ? "Regra" : "Manual"}</Badge>
              </div>
              <div className="col-span-12 min-w-0 md:col-span-7">
                {p.playerNome && <RotuloMono as="p">{p.playerNome}</RotuloMono>}
                <p className="mt-1">{p.texto}</p>
                <p className="mt-2 text-sm text-ink-muted"><span className="label-mono">Ação sugerida</span> {p.acao}</p>
              </div>
              <div className="col-span-12 md:col-span-3 md:text-right">
                <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(p.pergunta); toast.success("Pergunta copiada para enviar ao proponente."); }}>
                  <MessageSquareQuote strokeWidth={1.5} /> Virar pergunta
                </Button>
                <p className="mt-2 text-xs text-ink-muted">{p.pergunta}</p>
              </div>
            </li>
          ))}
        </ul>
      </Conteudo>
    </>
  );
}
