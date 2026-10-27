import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { RotuloMono } from "@/components/newe/brand";
import { useMesa } from "./useMesa";
import { ROTULO_STATUS, ROTULO_TIPO, propostasDoRfp } from "@/lib/equalizacao";
import { ROTULO_SEV } from "@/lib/pontos";
import type { Filtros } from "@/lib/filtros";
import type { PatchFiltros } from "./useMesa";

function Campo({ rotulo, id, children }: { rotulo: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label-mono mb-1.5 block text-ink-muted">{rotulo}</label>
      {children}
    </div>
  );
}

function Alternar({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm lg:min-h-0">
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--preto)]" />
      {rotulo}
    </label>
  );
}

export function BarraFiltros() {
  const { f, set, base, modulos, premissas } = useMesa();
  const aberto = f.filtros;
  const players = propostasDoRfp(base, f.rfp).map((x) => x.player);
  const entregasChave = [...new Set(base.itens.map((i) => i.entrega_chave).filter(Boolean))] as string[];
  const qc = useQueryClient();
  const salvos = useQuery({
    queryKey: ["filtros-salvos"],
    queryFn: async () => (await supabase.from("filtro_salvo").select("*").order("nome")).data ?? [],
  });
  const [nome, setNome] = useState("");
  const salvar = useMutation({
    mutationFn: async () => {
      const { filtros: _f, ...parametros } = f;
      const { error } = await supabase.from("filtro_salvo").insert({ nome: nome.trim().slice(0, 80), parametros: parametros as never });
      if (error) throw error;
    },
    onSuccess: () => { setNome(""); toast.success("Filtro salvo."); qc.invalidateQueries({ queryKey: ["filtros-salvos"] }); },
    onError: () => toast.error("Não foi possível salvar o filtro."),
  });
  const excluir = useMutation({
    mutationFn: async (id: string) => { await supabase.from("filtro_salvo").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filtros-salvos"] }),
  });

  const sel = (k: keyof Filtros, v: string, numero = false) => set({ [k]: v === "" ? undefined : numero ? Number(v) : v } as PatchFiltros);

  const limpar = () => set({
    fase: undefined, modulo: undefined, player: undefined, tipo: undefined, status: undefined, janela: undefined, preco: undefined,
    verba: undefined, produtos: undefined, validadas: undefined, essenciais: undefined, severidade: undefined, entrega: undefined,
    vmin: undefined, vmax: undefined, incerteza: undefined, semVariaveis: undefined, rigor: undefined, origem: undefined, regra: undefined,
  });
  const ativos = [f.fase, f.modulo, f.player, f.tipo, f.status, f.janela, f.preco, f.severidade, f.entrega, f.vmin, f.vmax]
    .filter((v) => v !== undefined).length
    + [f.validadas, f.essenciais, f.semVariaveis, !f.incerteza].filter(Boolean).length;
  const [painel, setPainel] = useState(false);

  const campos = (coluna: boolean): ReactNode => (
        <div className={coluna ? "grid grid-cols-1 gap-4" : "grid grid-cols-4 gap-4 px-12 pb-6 xl:grid-cols-6"}>
          <Campo rotulo="Fase" id="f-fase">
            <select id="f-fase" className="campo" value={f.fase ?? ""} onChange={(e) => sel("fase", e.target.value, true)}>
              <option value="">Todas</option><option value="1">Fase 1</option><option value="2">Fase 2</option>
            </select>
          </Campo>
          <Campo rotulo="Módulo" id="f-mod">
            <select id="f-mod" className="campo" value={f.modulo ?? ""} onChange={(e) => sel("modulo", e.target.value)}>
              <option value="">Todos</option>
              {modulos.map((m) => <option key={m.id} value={m.id}>{m.codigo} {m.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Player" id="f-pl">
            <select id="f-pl" className="campo" value={f.player ?? ""} onChange={(e) => sel("player", e.target.value)}>
              <option value="">Todos</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo de preço" id="f-tipo">
            <select id="f-tipo" className="campo" value={f.tipo ?? ""} onChange={(e) => sel("tipo", e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ROTULO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Status da proposta" id="f-st">
            <select id="f-st" className="campo" value={f.status ?? ""} onChange={(e) => sel("status", e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ROTULO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Janela" id="f-jan">
            <select id="f-jan" className="campo" value={premissas.janela_meses} onChange={(e) => sel("janela", e.target.value, true)}>
              {[6, 9, 12].map((n) => <option key={n} value={n}>{n} meses</option>)}
            </select>
          </Campo>
          <Campo rotulo="Preço" id="f-preco">
            <select id="f-preco" className="campo" value={premissas.aplicar_desconto_negociado ? "negociado" : "lista"} onChange={(e) => sel("preco", e.target.value)}>
              <option value="negociado">Negociado</option><option value="lista">Lista</option>
            </select>
          </Campo>
          <Campo rotulo="Severidade" id="f-sev">
            <select id="f-sev" className="campo" value={f.severidade ?? ""} onChange={(e) => sel("severidade", e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ROTULO_SEV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Entrega-chave" id="f-ent">
            <select id="f-ent" className="campo" value={f.entrega ?? ""} onChange={(e) => sel("entrega", e.target.value)}>
              <option value="">Todas</option>
              {entregasChave.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor mínimo (R$)" id="f-vmin">
            <input id="f-vmin" type="number" min={0} className="campo num" value={f.vmin ?? ""} onChange={(e) => sel("vmin", e.target.value, true)} />
          </Campo>
          <Campo rotulo="Valor máximo (R$)" id="f-vmax">
            <input id="f-vmax" type="number" min={0} className="campo num" value={f.vmax ?? ""} onChange={(e) => sel("vmax", e.target.value, true)} />
          </Campo>
          <div className={coluna ? "flex flex-col gap-1" : "col-span-4 flex flex-col justify-end gap-2 xl:col-span-1"}>
            <Alternar rotulo="Somente validadas" valor={f.validadas} onChange={(v) => set({ validadas: v || undefined })} />
            <Alternar rotulo="Somente essenciais" valor={f.essenciais} onChange={(v) => set({ essenciais: v || undefined })} />
            <Alternar rotulo="Mostrar incerteza" valor={f.incerteza} onChange={(v) => set({ incerteza: v ? undefined : false })} />
            <Alternar rotulo="Ocultar itens variáveis" valor={f.semVariaveis} onChange={(v) => set({ semVariaveis: v || undefined })} />
          </div>
          <form
            className={coluna ? "flex flex-wrap items-end gap-2" : "col-span-4 flex items-end gap-2 xl:col-span-6"}
            onSubmit={(e) => { e.preventDefault(); if (nome.trim()) salvar.mutate(); }}
          >
            <div className={coluna ? "w-full" : "w-64"}>
              <RotuloMono as="p" className="mb-1.5">Salvar este filtro como</RotuloMono>
              <input aria-label="Nome do filtro" maxLength={80} className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="lg:h-9" disabled={!nome.trim()}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" className="lg:h-9" onClick={() => set({
              fase: undefined, modulo: undefined, player: undefined, tipo: undefined, status: undefined, janela: undefined, preco: undefined,
              verba: undefined, produtos: undefined, validadas: undefined, essenciais: undefined, severidade: undefined, entrega: undefined,
              vmin: undefined, vmax: undefined, incerteza: undefined, semVariaveis: undefined, rigor: undefined, origem: undefined, regra: undefined,
            })}>Limpar</Button>
          </form>
        </div>
  );

  const listaSalvos = (coluna: boolean) => (
    <ul className={coluna ? "divide-y divide-line border border-line" : "flex flex-wrap items-center gap-2"}>
      {(salvos.data ?? []).map((s) => (
        <li key={s.id} className={coluna ? "flex items-stretch" : "inline-flex items-center border border-line"}>
          <button
            className={coluna ? "min-h-11 flex-1 px-3 text-left text-base hover:bg-accent" : "label-mono px-2 py-1 hover:bg-accent"}
            onClick={() => set({ ...(s.parametros as PatchFiltros), filtros: aberto })}
          >
            {s.nome}
          </button>
          <button
            aria-label={`Excluir filtro ${s.nome}`}
            className={coluna ? "inline-flex size-11 items-center justify-center border-l border-line hover:bg-accent" : "border-l border-line px-1.5 py-1 hover:bg-accent"}
            onClick={() => excluir.mutate(s.id)}
          >
            <X strokeWidth={1.5} className={coluna ? "size-4" : "size-3"} />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="border-b border-line">
      {/* Celular e tablet: painel inferior */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 md:px-8 lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setPainel(true)} aria-haspopup="dialog">
          <SlidersHorizontal strokeWidth={1.5} /> Filtros{ativos > 0 && <span className="num">· {ativos} {ativos === 1 ? "ativo" : "ativos"}</span>}
        </Button>
        {ativos > 0 && <Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button>}
      </div>
      <Sheet open={painel} onOpenChange={setPainel}>
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-0 p-0 lg:hidden">
          <div className="border-b border-line px-4 py-4 pr-16">
            <SheetTitle className="chamada text-xl">Filtros</SheetTitle>
            <SheetDescription className="label-mono mt-1 text-ink-muted">{ativos} {ativos === 1 ? "filtro ativo" : "filtros ativos"}</SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            {(salvos.data ?? []).length > 0 && (
              <div className="mb-6">
                <RotuloMono as="p" className="mb-2">Filtros salvos</RotuloMono>
                {listaSalvos(true)}
              </div>
            )}
            {campos(true)}
          </div>
          <div className="border-t border-line p-4">
            <Button className="w-full" onClick={() => setPainel(false)}>Aplicar e fechar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: barra atual */}
      <div className="hidden items-center justify-between px-12 py-3 lg:flex">
        <Button variant="ghost" size="sm" onClick={() => set({ filtros: !aberto || undefined })} aria-expanded={aberto}>
          <SlidersHorizontal strokeWidth={1.5} /> {aberto ? "Recolher filtros" : "Filtros"}{ativos > 0 && <span className="num">· {ativos}</span>}
        </Button>
        {listaSalvos(false)}
      </div>
      {aberto && <div className="hidden lg:block">{campos(false)}</div>}
    </div>
  );
}
