import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { criarReuniao, encerrarReuniao, listarReunioes } from "@/lib/reuniao.functions";
import { VALIDADE_MAX_H, VALIDADE_PADRAO_H, horaFim } from "@/lib/reuniao";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Admin › Reuniões: abrir link somente leitura, ver acessos e encerrar. */
export function PainelReunioes() {
  const qc = useQueryClient();
  const listar = useServerFn(listarReunioes);
  const criar = useServerFn(criarReuniao);
  const encerrar = useServerFn(encerrarReuniao);
  const lista = useQuery({ queryKey: ["reunioes"], queryFn: () => listar(), refetchInterval: 30_000 });
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ nome: "", data: hoje, horas: VALIDADE_PADRAO_H });
  const [novo, setNovo] = useState<{ link: string; nome: string; expira_em: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await criar({ data: { nome: form.nome, data: form.data, horas: form.horas } });
      setNovo({ link: `${window.location.origin}/entrar#t=${r.token}`, nome: form.nome, expira_em: r.expira_em });
      setForm({ nome: "", data: hoje, horas: VALIDADE_PADRAO_H });
      await qc.invalidateQueries({ queryKey: ["reunioes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir a reunião.");
    } finally { setEnviando(false); }
  }

  async function fechar(id: string) {
    if (!window.confirm("Encerrar a reunião? O link deixa de funcionar na hora e quem está conectado perde o acesso.")) return;
    try {
      await encerrar({ data: { id } });
      toast.success("Reunião encerrada.");
      await qc.invalidateQueries({ queryKey: ["reunioes"] });
      await qc.invalidateQueries({ queryKey: ["reunioes-ativas"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao encerrar."); }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={abrir} className="grid max-w-3xl grid-cols-1 gap-4 border border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end md:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="r-nome">Nome da reunião</Label>
          <Input id="r-nome" required minLength={2} maxLength={120} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-data">Data</Label>
          <Input id="r-data" type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-horas">Validade (horas)</Label>
          <Input id="r-horas" type="number" min={1} max={VALIDADE_MAX_H} required value={form.horas} onChange={(e) => setForm({ ...form, horas: Number(e.target.value) })} />
        </div>
        <Button type="submit" disabled={enviando} className="sm:col-span-3 sm:justify-self-start">{enviando ? "Abrindo" : "Abrir reunião"}</Button>
      </form>

      {novo && (
        <section aria-label="Link da reunião" className="grid max-w-3xl grid-cols-1 gap-6 border border-line-strong p-4 md:grid-cols-[auto_minmax(0,1fr)] md:p-6">
          <div className="bg-luz p-3 justify-self-start"><QRCodeSVG value={novo.link} size={208} bgColor="#fffaea" fgColor="#0f0f0f" /></div>
          <div className="min-w-0 space-y-3">
            <RotuloMono as="p">{novo.nome} · encerra às {horaFim(novo.expira_em)}</RotuloMono>
            <p className="break-all font-mono text-sm">{novo.link}</p>
            <p className="text-sm text-ink-muted">Este link aparece só agora. Guardamos apenas uma impressão cifrada dele; se perder, encerre e abra outra reunião.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(novo.link).then(() => toast.success("Link copiado."))}>Copiar link</Button>
              <Button size="sm" variant="ghost" onClick={() => setNovo(null)}>Ocultar</Button>
            </div>
          </div>
        </section>
      )}

      <div>
        <RotuloMono as="p" className="mb-3">Reuniões recentes</RotuloMono>
        {lista.isLoading ? <p className="text-ink-muted">Carregando.</p> : (lista.data ?? []).length === 0 ? <p className="text-ink-muted">Nenhuma reunião aberta ainda.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Reunião</TableHead><TableHead>Situação</TableHead><TableHead>Acessos</TableHead><TableHead>Conectados</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader>
            <TableBody>
              {(lista.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.nome}<span className="block text-xs text-ink-muted">{r.data.split("-").reverse().join("/")}</span></TableCell>
                  <TableCell className="label-mono">{r.ativa ? `Ativa · até ${horaFim(r.expira_em)}` : r.encerrada_em ? "Encerrada" : "Expirada"}</TableCell>
                  <TableCell className="num">{r.acessos}</TableCell>
                  <TableCell>{r.conectados.length ? r.conectados.join(", ") : "—"}</TableCell>
                  <TableCell>{r.ativa ? <Button size="sm" variant="outline" onClick={() => fechar(r.id)}>Encerrar</Button> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
