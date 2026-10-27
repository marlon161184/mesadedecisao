import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { decisaoQuery } from "@/lib/decisao-dados";
import type { Base } from "@/lib/base";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { nomeProposta } from "./useDecisao";

/** Abre o PDF original com URL assinada de curta duração (2 minutos). */
export async function abrirArquivo(caminho: string) {
  const { data, error } = await supabase.storage.from("propostas").createSignedUrl(caminho, 120);
  if (error || !data) { toast.error("Não foi possível abrir o documento."); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/** Link para a fonte original da proposta (versão mais recente), com a página indicada. */
export function LinkFonte({ propostaId, pagina }: { propostaId: string; pagina?: string | null | undefined }) {
  const { data } = useQuery(decisaoQuery);
  const arq = data?.arquivos.filter((a) => a.proposta_id === propostaId).at(-1);
  if (!arq) return <span className="text-xs text-ink-muted">{pagina ?? "—"}</span>;
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={() => abrirArquivo(arq.caminho)} aria-label={`Abrir fonte ${arq.nome}${pagina ? `, ${pagina}` : ""}`}>
      <FileText strokeWidth={1.5} className="size-3" />{pagina ?? "Documento"}
    </button>
  );
}

export function Documentos({ base, admin }: { base: Base; admin: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery(decisaoQuery);
  const [prop, setProp] = useState("");
  async function enviar(f: File | undefined) {
    const p = base.propostas.find((x) => x.id === prop);
    if (!f || !p) return;
    if (f.type !== "application/pdf") { toast.error("Envie um PDF."); return; }
    const caminho = `${p.id}/v${p.versao}/${crypto.randomUUID()}.pdf`;
    const up = await supabase.storage.from("propostas").upload(caminho, f, { contentType: "application/pdf" });
    if (up.error) { toast.error(up.error.message); return; }
    const { error } = await supabase.from("proposta_arquivo").insert({ proposta_id: p.id, versao: p.versao, caminho, nome: f.name.slice(0, 200) });
    if (error) { toast.error(error.message); return; }
    toast.success("Documento guardado."); qc.invalidateQueries({ queryKey: ["decisao"] });
  }
  return (
    <div>
      <RotuloMono as="p">Documentos originais das propostas (acesso restrito, link expira em 2 minutos)</RotuloMono>
      <ul className="mt-2 space-y-1">
        {(data?.arquivos ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between border-b border-line py-1 text-sm">
            <span><span className="label-mono mr-2">{nomeProposta(base, a.proposta_id)} · v{a.versao}</span>{a.nome}</span>
            <Button size="sm" variant="ghost" onClick={() => abrirArquivo(a.caminho)}>Abrir</Button>
          </li>
        ))}
        {!data?.arquivos.length && <li className="text-sm text-ink-muted">Nenhum documento enviado.</li>}
      </ul>
      {admin && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select aria-label="Proposta" className="campo" value={prop} onChange={(e) => setProp(e.target.value)}>
            <option value="">Proposta</option>
            {base.propostas.map((p) => <option key={p.id} value={p.id}>{nomeProposta(base, p.id)} · v{p.versao}</option>)}
          </select>
          <input type="file" accept="application/pdf" aria-label="PDF da proposta" disabled={!prop} onChange={(e) => enviar(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}
