import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Coluna {
  campo: string;
  rotulo: string;
  tipo: "texto" | "longo" | "numero" | "bool" | "select" | "json" | "data";
  opcoes?: { valor: string; rotulo: string }[];
  lista?: boolean; // aparece na tabela
  obrigatorio?: boolean;
}

type Linha = Record<string, unknown>;

function exibir(c: Coluna, v: unknown) {
  if (v == null || v === "") return "—";
  if (c.tipo === "bool") return v ? "Sim" : "Não";
  if (c.tipo === "select") return c.opcoes?.find((o) => o.valor === v)?.rotulo ?? String(v);
  if (c.tipo === "json") return JSON.stringify(v);
  return String(v);
}

export function EditorTabela({
  tabela, colunas, linhas, chave = ["id"], titulo, padrao = {},
}: { tabela: string; colunas: Coluna[]; linhas: Linha[]; chave?: string[]; titulo: string; padrao?: Linha }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ novo: boolean; dados: Linha } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const db = supabase.from(tabela as never) as unknown as {
    insert: (v: Linha) => Promise<{ error: { message: string } | null }>;
    update: (v: Linha) => { match: (m: Linha) => Promise<{ error: { message: string } | null }> };
    delete: () => { match: (m: Linha) => Promise<{ error: { message: string } | null }> };
  };
  const filtroChave = (l: Linha) => Object.fromEntries(chave.map((k) => [k, l[k]]));

  async function salvar() {
    if (!edit) return;
    const dados: Linha = {};
    for (const c of colunas) {
      let v = edit.dados[c.campo];
      if (c.tipo === "numero") v = v === "" || v == null ? null : Number(v);
      if (c.tipo === "json" && typeof v === "string") {
        try { v = JSON.parse(v); } catch { toast.error(`${c.rotulo}: JSON inválido.`); return; }
      }
      if ((c.tipo === "texto" || c.tipo === "longo" || c.tipo === "select" || c.tipo === "data") && v === "") v = null;
      if (c.obrigatorio && (v == null || v === "")) { toast.error(`Preencha ${c.rotulo}.`); return; }
      dados[c.campo] = v;
    }
    setSalvando(true);
    const { error } = edit.novo ? await db.insert({ ...padrao, ...dados }) : await db.update(dados).match(filtroChave(edit.dados));
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo.");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["base"] });
  }

  async function excluir(l: Linha) {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await db.delete().match(filtroChave(l));
    if (error) toast.error(error.message);
    else { toast.success("Excluído."); qc.invalidateQueries({ queryKey: ["base"] }); }
  }

  const visiveis = colunas.filter((c) => c.lista !== false);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="label-mono text-ink-muted">{linhas.length} registro(s)</p>
        <Button size="sm" onClick={() => setEdit({ novo: true, dados: {} })}><Plus strokeWidth={1.5} /> Novo</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {visiveis.map((c) => <TableHead key={c.campo}>{c.rotulo}</TableHead>)}
            <TableHead className="w-24"><span className="sr-only">Ações</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l, i) => (
            <TableRow key={chave.map((k) => String(l[k])).join(":") || i}>
              {visiveis.map((c) => <TableCell key={c.campo} className={c.tipo === "numero" ? "num" : "max-w-xs truncate"}>{exibir(c, l[c.campo])}</TableCell>)}
              <TableCell className="whitespace-nowrap">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEdit({ novo: false, dados: { ...l } })}><Pencil strokeWidth={1.5} /></Button>
                <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => excluir(l)}><Trash2 strokeWidth={1.5} /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">{edit?.novo ? "Novo" : "Editar"} · {titulo}</DialogTitle></DialogHeader>
          {edit && (
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              {colunas.map((c) => {
                const v = edit.dados[c.campo];
                const mudar = (nv: unknown) => setEdit({ ...edit, dados: { ...edit.dados, [c.campo]: nv } });
                const id = `ed-${c.campo}`;
                return (
                  <div key={c.campo} className={c.tipo === "longo" || c.tipo === "json" ? "md:col-span-2" : ""}>
                    <label htmlFor={id} className="label-mono mb-1.5 block text-ink-muted">{c.rotulo}{c.obrigatorio && " *"}</label>
                    {c.tipo === "bool" ? (
                      <input id={id} type="checkbox" className="size-4" checked={!!v} onChange={(e) => mudar(e.target.checked)} />
                    ) : c.tipo === "select" ? (
                      <select id={id} className="campo" value={(v as string) ?? ""} onChange={(e) => mudar(e.target.value)}>
                        <option value="">—</option>
                        {c.opcoes?.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                      </select>
                    ) : c.tipo === "longo" || c.tipo === "json" ? (
                      <textarea id={id} rows={3} className="campo h-auto py-2" value={c.tipo === "json" && typeof v !== "string" ? JSON.stringify(v ?? null) : (v as string) ?? ""} onChange={(e) => mudar(e.target.value)} />
                    ) : (
                      <input id={id} type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"} step="any" className="campo" value={(v as string | number) ?? ""} onChange={(e) => mudar(e.target.value)} />
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? "Salvando" : "Salvar"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
