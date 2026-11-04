import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Base } from "@/lib/base";
import { modulosDoRfp } from "@/lib/equalizacao";
import {
  ACEITE, CATEGORIAS, TAMANHO_MAX, TIPOS_PRECO, UNIDADES, cabecalhoVazio, proximaCor, rascunhoManual, versaoSugerida,
  type Cabecalho, type ConteudoRascunho,
} from "@/lib/rascunho";
import { aprovarRascunhoProposta, descartarRascunhoProposta, enviarArquivoProposta, lerRascunhoProposta } from "@/lib/propostas.functions";
import { abrirArquivo } from "@/components/decisao/Documentos";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RFP = 2;
const CORES = ["flamboyant", "verde-cerrado", "ipe-do-cerrado", "terracota", "terra-vermelha", "cinza-quente-1", "cinza-quente-2", "cinza-quente-3"];
const PASSOS = ["Upload", "Identificação", "Leitura assistida", "Revisão"] as const;

interface Arquivo { id: string; tipo: string; caminho: string; nome: string }

export function NovaProposta({ base, playerInicial, onFechar }: { base: Base; playerInicial?: string | undefined; onFechar: () => void }) {
  const qc = useQueryClient();
  const enviar = useServerFn(enviarArquivoProposta);
  const ler = useServerFn(lerRascunhoProposta);
  const aprovar = useServerFn(aprovarRascunhoProposta);
  const descartar = useServerFn(descartarRascunhoProposta);
  const [passo, setPasso] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [arq, setArq] = useState<Arquivo | null>(null);
  const [playerId, setPlayerId] = useState<string>(playerInicial ?? "");
  const [novo, setNovo] = useState({ nome: "", tipo: "agencia" as "agencia" | "plataforma" | "consultoria" | "referencia", cor_token: proximaCor(base.players), cidade: "" });
  const [versao, setVersao] = useState(versaoSugerida(base.propostas, playerInicial ?? null));
  const [cab, setCab] = useState<Cabecalho>(cabecalhoVazio());
  const [conteudo, setConteudo] = useState<ConteudoRascunho | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const iaLigada = base.premissas.find((p) => p.chave === "ia_leitura_habilitada")?.valor === true;

  const ctx = useMemo(() => {
    const modulos = modulosDoRfp(base, RFP);
    const ids = new Set(modulos.map((m) => m.id));
    return { modulos, requisitos: base.requisitos.filter((r) => ids.has(r.modulo_id)), janelaMeses: base.rfps.find((r) => r.numero === RFP)?.janela_meses ?? 6 };
  }, [base]);

  const rascunhos = useQuery({
    queryKey: ["rascunhos"],
    queryFn: async () => (await supabase.from("proposta_rascunho").select("id, arquivo_nome, arquivo_tipo, arquivo_caminho, status, criado_em, conteudo").in("status", ["enviado", "lido", "manual"]).order("criado_em", { ascending: false })).data ?? [],
  });

  async function subir(f: File | undefined) {
    if (!f) return;
    if (f.size > TAMANHO_MAX) { toast.error("O arquivo passa de 20 MB."); return; }
    setOcupado(true);
    try {
      const fd = new FormData(); fd.append("arquivo", f);
      const r = await enviar({ data: fd });
      setArq({ id: r.id, tipo: r.tipo, caminho: r.caminho, nome: f.name });
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      setPasso(1);
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }

  function retomar(r: { id: string; arquivo_tipo: string; arquivo_caminho: string; arquivo_nome: string; status: string; conteudo: unknown }) {
    setArq({ id: r.id, tipo: r.arquivo_tipo, caminho: r.arquivo_caminho, nome: r.arquivo_nome });
    const c = r.conteudo as ConteudoRascunho | null;
    if (r.status !== "enviado" && c && Array.isArray(c.coberturas)) { setConteudo(c); setCab(c.cabecalho); }
    setPasso(1);
  }

  async function alternarIa(v: boolean) {
    const { error } = await supabase.from("premissa").upsert({ chave: "ia_leitura_habilitada", valor: v, descricao: "Leitura automática de propostas com IA (Admin)" });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["base"] });
  }

  async function lerDocumento(usarIa: boolean) {
    if (!arq) return;
    if (!usarIa) { aplicar(rascunhoManual(ctx), "Fluxo manual: preencha os dados conferindo o documento."); return; }
    setOcupado(true);
    try {
      const r = await ler({ data: { id: arq.id } });
      aplicar(r.conteudo, r.erro);
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }
  function aplicar(c: ConteudoRascunho, msg: string | null) {
    // Campos do cabeçalho já digitados pelo Admin têm prioridade sobre a leitura.
    const junto = { ...c.cabecalho } as Record<string, unknown>;
    for (const [k, v] of Object.entries(cab)) if (v != null && v !== "") junto[k] = v;
    setCab(junto as Cabecalho);
    setConteudo(c); setAviso(msg); setPasso(3);
  }

  async function gravar() {
    if (!arq || !conteudo) return;
    if (!playerId && !novo.nome.trim()) { toast.error("Escolha ou crie a agência."); setPasso(1); return; }
    setOcupado(true);
    try {
      const r = await aprovar({ data: {
        id: arq.id, versao, cabecalho: cab, conteudo: { ...conteudo, cabecalho: cab },
        player: playerId ? { id: playerId } : { novo: { ...novo, nome: novo.nome.trim(), cidade: novo.cidade.trim() || null } },
      } });
      if (r.erros.length) toast.error(`Proposta criada, mas houve falhas: ${r.erros.join("; ")}`);
      else toast.success("Proposta gravada como Recebida.");
      qc.invalidateQueries({ queryKey: ["base"] }); qc.invalidateQueries({ queryKey: ["decisao"] }); qc.invalidateQueries({ queryKey: ["rascunhos"] });
      onFechar();
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }

  async function cancelarRascunho(id: string) {
    try { await descartar({ data: { id } }); qc.invalidateQueries({ queryKey: ["rascunhos"] }); if (arq?.id === id) { setArq(null); setPasso(0); } toast.success("Rascunho descartado."); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <section aria-label="Nova proposta" className="border border-line-strong p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <RotuloMono as="p">RFP {RFP} · somente Admin</RotuloMono>
          <h2 className="mt-1 text-2xl">Nova proposta</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onFechar} aria-label="Fechar"><X strokeWidth={1.5} /></Button>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4" aria-label="Passos">
        {PASSOS.map((p, i) => (
          <li key={p} className={cn("bg-background p-2 text-sm", i === passo && "bg-accent")} aria-current={i === passo ? "step" : undefined}>
            <span className="label-mono block">Passo {i + 1}</span>{p}
          </li>
        ))}
      </ol>
      {arq && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <FileText strokeWidth={1.5} className="size-4" /><span className="min-w-0 break-all">{arq.nome}</span>
          <Button size="sm" variant="outline" onClick={() => abrirArquivo(arq.caminho)}>Abrir original</Button>
        </div>
      )}

      {passo === 0 && <PassoUpload ocupado={ocupado} onArquivo={subir} rascunhos={rascunhos.data ?? []} onRetomar={retomar} onDescartar={cancelarRascunho} />}

      {passo === 1 && (
        <div className="mt-6 space-y-6">
          <fieldset className="space-y-3">
            <legend className="label-mono">Agência</legend>
            <select className="campo w-full" aria-label="Agência" value={playerId} onChange={(e) => { setPlayerId(e.target.value); setVersao(versaoSugerida(base.propostas, e.target.value || null)); }}>
              <option value="">Criar agência nova</option>
              {base.players.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {!playerId && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Campo rotulo="Nome"><input className="campo w-full" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
                <Campo rotulo="Tipo">
                  <select className="campo w-full" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as typeof novo.tipo })}>
                    {["agencia", "plataforma", "consultoria", "referencia"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Cor"><select className="campo w-full" value={novo.cor_token} onChange={(e) => setNovo({ ...novo, cor_token: e.target.value })}>{CORES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
                <Campo rotulo="Cidade (opcional)"><input className="campo w-full" value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} /></Campo>
                <p className="text-sm text-ink-muted md:col-span-2">RFPs: [{RFP}]. Status: proponente.</p>
              </div>
            )}
            <Campo rotulo="Versão (sugerida: última + 1)"><input type="number" min={1} className="campo w-32" value={versao} onChange={(e) => setVersao(Math.max(1, Number(e.target.value) || 1))} /></Campo>
          </fieldset>
          <EditorCabecalho cab={cab} setCab={setCab} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPasso(0)}>Voltar</Button>
            <Button onClick={() => setPasso(conteudo ? 3 : 2)}>Continuar</Button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="mt-6 space-y-4">
          <div className="border border-terracota p-4 text-sm">
            O conteúdo do documento será enviado ao serviço de IA para leitura; só ligue se estiver de acordo.
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={iaLigada} onChange={(e) => alternarIa(e.target.checked)} />
            Leitura automática com IA {iaLigada ? "ligada" : "desligada"}
          </label>
          {arq && arq.tipo !== "pdf" && <p className="text-sm text-ink-muted">A leitura automática só lê PDF. Este arquivo segue pelo fluxo manual.</p>}
          <p className="text-sm text-ink-muted">Nada é gravado nas tabelas oficiais antes de "Aprovar e gravar". A leitura nunca marca cobertura como comprovada.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPasso(1)}>Voltar</Button>
            <Button disabled={ocupado || !iaLigada || arq?.tipo !== "pdf"} onClick={() => lerDocumento(true)}>{ocupado ? "Lendo o documento..." : "Ler documento"}</Button>
            <Button variant="outline" disabled={ocupado} onClick={() => lerDocumento(false)}>Seguir sem leitura</Button>
          </div>
        </div>
      )}

      {passo === 3 && conteudo && (
        <Revisao base={base} ctx={ctx} c={conteudo} setC={setConteudo} cab={cab} setCab={setCab} aviso={aviso}>
          <Button variant="secondary" onClick={() => setPasso(1)}>Voltar à identificação</Button>
          <Button disabled={ocupado} onClick={gravar}>{ocupado ? "Gravando..." : "Aprovar e gravar"}</Button>
        </Revisao>
      )}
    </section>
  );
}

function PassoUpload({ ocupado, onArquivo, rascunhos, onRetomar, onDescartar }: {
  ocupado: boolean; onArquivo: (f: File | undefined) => void;
  rascunhos: { id: string; arquivo_nome: string; arquivo_tipo: string; arquivo_caminho: string; status: string; criado_em: string; conteudo: unknown }[];
  onRetomar: (r: PassoUploadRascunho) => void; onDescartar: (id: string) => void;
}) {
  const [sobre, setSobre] = useState(false);
  const soltar = (e: DragEvent) => { e.preventDefault(); setSobre(false); onArquivo(e.dataTransfer.files[0]); };
  return (
    <div className="mt-6 space-y-6">
      <label onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltar}
        className={cn("flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-line-strong p-6 text-center", sobre && "bg-accent")}>
        <Upload strokeWidth={1.5} className="size-6" />
        <span>{ocupado ? "Enviando..." : "Arraste o arquivo aqui ou toque para escolher"}</span>
        <span className="label-mono text-ink-muted">PDF (leitura automática) · DOCX, PPTX, XLSX (fluxo manual) · até 20 MB</span>
        <input type="file" accept={ACEITE} className="sr-only" disabled={ocupado} onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {rascunhos.length > 0 && (
        <div>
          <RotuloMono as="p">Rascunhos em aberto (não gravados)</RotuloMono>
          <ul className="mt-2">
            {rascunhos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm">
                <span className="min-w-0 break-all">{r.arquivo_nome} <span className="label-mono text-ink-muted">· {new Date(r.criado_em).toLocaleString("pt-BR")}</span></span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onRetomar(r)}>Continuar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDescartar(r.id)}>Descartar</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
type PassoUploadRascunho = { id: string; arquivo_tipo: string; arquivo_caminho: string; arquivo_nome: string; status: string; conteudo: unknown };

function Campo({ rotulo, children, baixa, className }: { rotulo: string; children: ReactNode; baixa?: boolean; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className={cn("label-mono block", baixa && "text-terracota")}>{rotulo}{baixa ? " · conferir" : ""}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

const vazioParaNull = (v: string) => (v.trim() === "" ? null : v);
const numOuNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

function EditorCabecalho({ cab, setCab }: { cab: Cabecalho; setCab: (c: Cabecalho) => void }) {
  const t = (k: keyof Cabecalho) => (cab[k] ?? "") as string | number;
  return (
    <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <legend className="label-mono mb-2">Cabeçalho (vazio = não informado)</legend>
      <Campo rotulo="Data"><input type="date" className="campo w-full" value={t("data_proposta")} onChange={(e) => setCab({ ...cab, data_proposta: vazioParaNull(e.target.value) })} /></Campo>
      <Campo rotulo="Validade (dias)"><input type="number" className="campo w-full" value={t("validade_dias")} onChange={(e) => setCab({ ...cab, validade_dias: numOuNull(e.target.value) })} /></Campo>
      <Campo rotulo="Contrato (meses)"><input type="number" className="campo w-full" value={t("contrato_meses_proposto")} onChange={(e) => setCab({ ...cab, contrato_meses_proposto: numOuNull(e.target.value) })} /></Campo>
      {(["tributos", "reajuste", "desconto_explicito"] as const).map((k) => (
        <Campo key={k} rotulo={k === "desconto_explicito" ? "Desconto explícito" : k === "tributos" ? "Tributos" : "Reajuste"}>
          <input className="campo w-full" value={t(k)} onChange={(e) => setCab({ ...cab, [k]: vazioParaNull(e.target.value) })} />
        </Campo>
      ))}
      <Campo rotulo="Exclusões" className="md:col-span-3"><textarea className="campo min-h-20 w-full" value={t("exclusoes")} onChange={(e) => setCab({ ...cab, exclusoes: vazioParaNull(e.target.value) })} /></Campo>
      <Campo rotulo="Observações" className="md:col-span-3"><textarea className="campo min-h-20 w-full" value={t("observacoes")} onChange={(e) => setCab({ ...cab, observacoes: vazioParaNull(e.target.value) })} /></Campo>
    </fieldset>
  );
}

function Revisao({ ctx, c, setC, cab, setCab, aviso, children }: {
  base: Base; ctx: { modulos: { id: string; codigo: string; nome: string }[] }; c: ConteudoRascunho; setC: (c: ConteudoRascunho) => void;
  cab: Cabecalho; setCab: (c: Cabecalho) => void; aviso: string | null; children: ReactNode;
}) {
  const setItem = (i: number, p: Partial<ConteudoRascunho["itens"][number]>) => setC({ ...c, itens: c.itens.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setEnt = (i: number, p: Partial<ConteudoRascunho["entregas"][number]>) => setC({ ...c, entregas: c.entregas.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setCob = (i: number, p: Partial<ConteudoRascunho["coberturas"][number]>) => setC({ ...c, coberturas: c.coberturas.map((x, j) => (j === i ? { ...x, ...p, evidencia: (p.nivel !== undefined ? p.nivel : x.nivel) == null ? "nao_informado" : "declarado" } : x)) });
  const setPonto = (i: number, texto: string) => setC({ ...c, pontos: c.pontos.map((x, j) => (j === i ? { ...x, texto } : x)) });
  const baixas = c.itens.filter((x) => x.confianca === "baixa").length + c.entregas.filter((x) => x.confianca === "baixa").length + c.coberturas.filter((x) => x.confianca === "baixa").length;
  return (
    <div className="mt-6 space-y-10">
      {aviso && <p className="border border-terracota p-3 text-sm">{aviso}</p>}
      <p className="text-sm">
        Origem: {c.origem === "ia" ? "leitura automática (rascunho)" : "preenchimento manual"}. {baixas} campo(s) marcados para conferir.
        Ao gravar, a proposta entra como Recebida e segue o fluxo de equalização e validação.
      </p>
      {c.descartados.length > 0 && <ul className="list-disc pl-5 text-sm text-ink-muted">{c.descartados.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      <EditorCabecalho cab={cab} setCab={setCab} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Itens de preço ({c.itens.length})</h3>
          <Button size="sm" variant="secondary" onClick={() => setC({ ...c, itens: [...c.itens, { descricao: "Novo item", modulo_id: null, tipo_preco: "recorrente", unidade: "mes", valor_lista: null, valor_negociado: null, valor_min: null, valor_max: null, multiplicador: 1, incluido_no_subtotal_da_proposta: true, sujeito_desconto_lista: false, teto_verba_mensal: null, incerteza: null, fonte_pagina: null, confianca: "baixa", avisos: ["Incluído à mão"] }] })}>Adicionar item</Button>
        </div>
        <div className="mt-3 space-y-4">
          {c.itens.map((it, i) => (
            <div key={i} className={cn("grid grid-cols-1 gap-3 border p-3 md:grid-cols-4", it.confianca === "baixa" ? "border-terracota" : "border-line")}>
              <Campo rotulo="Descrição" className="md:col-span-3"><input className="campo w-full" value={it.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} /></Campo>
              <Campo rotulo="Fonte e página" baixa={!it.fonte_pagina}><input className="campo w-full" value={it.fonte_pagina ?? ""} onChange={(e) => setItem(i, { fonte_pagina: vazioParaNull(e.target.value) })} /></Campo>
              <Campo rotulo="Módulo" baixa={!it.modulo_id}>
                <select className="campo w-full" value={it.modulo_id ?? ""} onChange={(e) => setItem(i, { modulo_id: e.target.value || null })}>
                  <option value="">Não identificado</option>
                  {ctx.modulos.map((m) => <option key={m.id} value={m.id}>{m.codigo} {m.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Tipo de preço"><select className="campo w-full" value={it.tipo_preco} onChange={(e) => setItem(i, { tipo_preco: e.target.value as never })}>{TIPOS_PRECO.map((t) => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Unidade"><select className="campo w-full" value={it.unidade} onChange={(e) => setItem(i, { unidade: e.target.value as never })}>{UNIDADES.map((t) => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Multiplicador"><input type="number" step="any" className="campo w-full" value={it.multiplicador} onChange={(e) => setItem(i, { multiplicador: Number(e.target.value) || 1 })} /></Campo>
              {(["valor_lista", "valor_negociado", "valor_min", "valor_max", "teto_verba_mensal"] as const).map((k) => (
                <Campo key={k} rotulo={{ valor_lista: "Lista", valor_negociado: "Negociado", valor_min: "Mínimo", valor_max: "Máximo", teto_verba_mensal: "Teto de verba" }[k]}>
                  <input inputMode="decimal" className="campo w-full font-mono" value={it[k] ?? ""} placeholder="não informado" onChange={(e) => setItem(i, { [k]: numOuNull(e.target.value) })} />
                </Campo>
              ))}
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={it.incluido_no_subtotal_da_proposta} onChange={(e) => setItem(i, { incluido_no_subtotal_da_proposta: e.target.checked })} />No subtotal</label>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={it.sujeito_desconto_lista} onChange={(e) => setItem(i, { sujeito_desconto_lista: e.target.checked })} />Desconto de lista</label>
              <Campo rotulo="Incerteza" className="md:col-span-2"><input className="campo w-full" value={it.incerteza ?? ""} onChange={(e) => setItem(i, { incerteza: vazioParaNull(e.target.value) })} /></Campo>
              <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-4">
                <span className="text-xs text-terracota">{it.avisos.join(" · ")}</span>
                <Button size="sm" variant="ghost" onClick={() => setC({ ...c, itens: c.itens.filter((_, j) => j !== i) })}>Remover</Button>
              </div>
            </div>
          ))}
          {!c.itens.length && <p className="text-sm text-ink-muted">Nenhum item. Inclua à mão ou depois pelo editor/CSV de Itens.</p>}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Entregas declaradas ({c.entregas.length})</h3>
          <Button size="sm" variant="secondary" onClick={() => setC({ ...c, entregas: [...c.entregas, { categoria: "posts_instagram", quantidade_mes: 0, e_teto: false, observacao: null, fonte_pagina: null, confianca: "baixa", avisos: ["Incluída à mão"] }] })}>Adicionar entrega</Button>
        </div>
        <div className="mt-3 space-y-3">
          {c.entregas.map((e, i) => (
            <div key={i} className={cn("grid grid-cols-2 gap-3 border p-3 md:grid-cols-5", e.confianca === "baixa" ? "border-terracota" : "border-line")}>
              <Campo rotulo="Categoria" className="col-span-2 md:col-span-1"><select className="campo w-full" value={e.categoria} onChange={(x) => setEnt(i, { categoria: x.target.value as never })}>{CATEGORIAS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Por mês"><input inputMode="decimal" className="campo w-full font-mono" value={e.quantidade_mes} onChange={(x) => setEnt(i, { quantidade_mes: Number(x.target.value.replace(",", ".")) || 0 })} /></Campo>
              <label className="flex min-h-11 items-end gap-2 text-sm"><input type="checkbox" className="size-4" checked={e.e_teto} onChange={(x) => setEnt(i, { e_teto: x.target.checked })} />Teto (até)</label>
              <Campo rotulo="Fonte e página" baixa={!e.fonte_pagina}><input className="campo w-full" value={e.fonte_pagina ?? ""} onChange={(x) => setEnt(i, { fonte_pagina: vazioParaNull(x.target.value) })} /></Campo>
              <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => setC({ ...c, entregas: c.entregas.filter((_, j) => j !== i) })}>Remover</Button></div>
            </div>
          ))}
          {!c.entregas.length && <p className="text-sm text-ink-muted">Nenhuma entrega declarada.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-xl">Cobertura dos requisitos ({c.coberturas.filter((x) => x.nivel != null).length}/{c.coberturas.length} informados)</h3>
        <p className="mt-1 text-sm text-ink-muted">Evidência fica "declarado" ou "não informado". "Comprovado" só pelo editor de Cobertura, depois de conferir.</p>
        <div className="mt-3 space-y-3">
          {c.coberturas.map((x, i) => (
            <div key={x.requisito_id} className={cn("grid grid-cols-1 gap-3 border p-3 md:grid-cols-[1fr_10rem_10rem]", x.confianca === "baixa" ? "border-terracota" : "border-line")}>
              <div className="min-w-0">
                <p className="text-sm"><span className="label-mono mr-2">{x.codigo}</span>{x.descricao}</p>
                <p className="mt-1 text-xs text-ink-muted">{x.trecho ? `"${x.trecho}"` : "Trecho-fonte: não informado"}</p>
                {x.avisos.length > 0 && <p className="mt-1 text-xs text-terracota">{x.avisos.join(" · ")}</p>}
              </div>
              <Campo rotulo="Nível">
                <select className="campo w-full" value={x.nivel == null ? "" : String(x.nivel)} onChange={(e) => setCob(i, { nivel: e.target.value === "" ? null : (Number(e.target.value) as 0 | 0.5 | 1) })}>
                  <option value="">Não informado</option><option value="1">1</option><option value="0.5">0,5</option><option value="0">0</option>
                </select>
              </Campo>
              <Campo rotulo="Fonte e página"><input className="campo w-full" value={x.fonte_pagina ?? ""} onChange={(e) => setCob(i, { fonte_pagina: vazioParaNull(e.target.value) })} /></Campo>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl">Pontos de atenção candidatos ({c.pontos.length})</h3>
        <p className="mt-1 text-sm text-ink-muted">As regras P-01 a P-09 rodam sozinhas depois da gravação; estes entram como pontos manuais.</p>
        <ul className="mt-3 space-y-2">
          {c.pontos.map((p, i) => (
            <li key={i} className="flex flex-col gap-2 border border-line p-3 sm:flex-row sm:items-start">
              <span className="label-mono shrink-0">{p.severidade} · {p.codigo === "REGRA" ? "regra" : "leitura"}</span>
              <textarea className="campo min-h-16 w-full" value={p.texto} onChange={(e) => setPonto(i, e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setC({ ...c, pontos: c.pontos.filter((_, j) => j !== i) })}>Remover</Button>
            </li>
          ))}
          {!c.pontos.length && <li className="text-sm text-ink-muted">Nenhum ponto candidato.</li>}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">{children}</div>
    </div>
  );
}
