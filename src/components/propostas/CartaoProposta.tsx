import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Base } from "@/lib/base";
import { decisaoQuery } from "@/lib/decisao-dados";
import { analisarRfp, premissasEfetivas } from "@/lib/equalizacao";
import { pontosAutomaticos, pontosManuais } from "@/lib/pontos";
import { dadosPropostaParaIA, parecerDaProposta } from "@/lib/parecer";
import { ACEITE } from "@/lib/rascunho";
import { anexarDocumentoProposta, redigirParecerProposta } from "@/lib/propostas.functions";
import { abrirArquivo } from "@/components/decisao/Documentos";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";

/** Arquivos da proposta: anexar, histórico de versões, nova versão (= nova proposta). */
export function ArquivosProposta({ propostaId, onNovaVersao }: { propostaId: string; onNovaVersao: () => void }) {
  const qc = useQueryClient();
  const anexar = useServerFn(anexarDocumentoProposta);
  const { data } = useQuery(decisaoQuery);
  const [ocupado, setOcupado] = useState(false);
  const arquivos = (data?.arquivos ?? []).filter((a) => a.proposta_id === propostaId);
  async function enviar(f: File | undefined) {
    if (!f) return;
    setOcupado(true);
    try {
      const fd = new FormData(); fd.append("arquivo", f); fd.append("propostaId", propostaId);
      await anexar({ data: fd });
      toast.success("Documento anexado."); qc.invalidateQueries({ queryKey: ["decisao"] });
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }
  return (
    <div className="mt-6">
      <RotuloMono as="p">Documentos</RotuloMono>
      <ul className="mt-2">
        {arquivos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1 text-sm">
            <span className="min-w-0 break-all"><span className="label-mono mr-2">v{a.versao} · {new Date(a.enviado_em).toLocaleDateString("pt-BR")}</span>{a.nome}</span>
            <Button size="sm" variant="ghost" onClick={() => abrirArquivo(a.caminho)}>Abrir</Button>
          </li>
        ))}
        {!arquivos.length && <li className="text-sm text-ink-muted">Nenhum documento anexado.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 border border-line-strong px-3 font-mono text-xs uppercase tracking-[0.12em] hover:bg-accent lg:h-8">
          <Paperclip strokeWidth={1.5} className="size-4" />{ocupado ? "Enviando..." : "Anexar documento"}
          <input type="file" accept={ACEITE} className="sr-only" disabled={ocupado} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <Button size="sm" variant="outline" onClick={onNovaVersao}>Substituir por nova versão</Button>
      </div>
    </div>
  );
}

/** Parecer de proposta nova: por regra ou rascunho com IA; revisão humana antes de publicar. */
export function ParecerProposta({ base, propostaId }: { base: Base; propostaId: string }) {
  const qc = useQueryClient();
  const redigir = useServerFn(redigirParecerProposta);
  const chave = ["parecer-proposta", propostaId];
  const { data: atual } = useQuery({
    queryKey: chave,
    queryFn: async () => (await supabase.from("parecer_proposta").select("*").eq("proposta_id", propostaId).order("criado_em", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const [texto, setTexto] = useState<string | null>(null);
  const [origem, setOrigem] = useState<"regra" | "ia">("regra");
  const [ocupado, setOcupado] = useState(false);
  const { analise, pontos } = useMemo(() => {
    const premissas = premissasEfetivas(base, {});
    const p = base.propostas.find((x) => x.id === propostaId);
    const rfp = base.rfps.find((r) => p && base.players.find((pl) => pl.id === p.player_id)?.rfp_numeros.includes(r.numero))?.numero ?? 2;
    const analises = analisarRfp(base, rfp, { filtros: { incluirNaoValidadas: true } as never, premissas });
    const a = analises.find((x) => x.proposta.id === propostaId) ?? null;
    const pts = a ? [...pontosAutomaticos(a, premissas), ...pontosManuais(base, [a])].map((x) => ({ severidade: x.severidade, texto: x.texto })) : [];
    return { analise: a, pontos: pts };
  }, [base, propostaId]);
  const valor = texto ?? atual?.texto ?? "";

  async function salvar(publicar: boolean) {
    if (!valor.trim()) return;
    const linha = { texto: valor, origem: texto != null ? origem : (atual?.origem ?? "regra"), revisado: true, publicado: publicar, atualizado_em: new Date().toISOString(), publicado_em: publicar ? new Date().toISOString() : null };
    const { error } = atual
      ? await supabase.from("parecer_proposta").update(linha).eq("id", atual.id)
      : await supabase.from("parecer_proposta").insert({ ...linha, proposta_id: propostaId });
    if (error) toast.error(error.message); else { toast.success(publicar ? "Parecer publicado para os sócios." : "Parecer revisado salvo."); setTexto(null); qc.invalidateQueries({ queryKey: chave }); }
  }
  async function ia() {
    if (!analise) return;
    setOcupado(true);
    try {
      const r = await redigir({ data: { dados: dadosPropostaParaIA(base, analise, pontos) } });
      if (r.ok) { setTexto(r.texto); setOrigem("ia"); toast("Rascunho de IA pronto. Revise antes de salvar."); } else toast.error(r.erro);
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }
  if (!analise) return null;
  return (
    <div className="mt-6">
      <RotuloMono as="p">Parecer da proposta · {atual?.publicado ? "publicado" : atual ? "revisado, não publicado" : "sem parecer"}</RotuloMono>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => { setTexto(parecerDaProposta(base, analise, pontos)); setOrigem("regra"); }}>Parecer por regra</Button>
        <Button size="sm" variant="outline" disabled={ocupado} onClick={ia}>{ocupado ? "Redigindo..." : "Rascunho com IA"}</Button>
      </div>
      {(valor || texto != null) && (
        <>
          {texto != null && origem === "ia" && <p className="mt-2 text-sm text-terracota">Rascunho de IA: revise cada frase antes de salvar.</p>}
          <textarea aria-label="Texto do parecer" className="campo mt-2 min-h-48 w-full" value={valor} onChange={(e) => setTexto(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => salvar(false)}>Salvar revisado</Button>
            <Button size="sm" onClick={() => salvar(true)}>Publicar para os sócios</Button>
          </div>
        </>
      )}
    </div>
  );
}
