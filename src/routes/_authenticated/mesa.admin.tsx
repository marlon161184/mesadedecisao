import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMesa } from "@/components/mesa/useMesa";
import { useSessao } from "@/components/newe/Moldura";
import { AberturaTela, Conteudo, SeloStatus } from "@/components/mesa/partes";
import { EditorTabela, type Coluna } from "@/components/mesa/EditorTabela";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { baixar, lerCsv, paraCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mesa/admin")({
  head: () => ({
    meta: [
      { title: "Admin · NEWE Mesa de Decisão" },
      { name: "description", content: "Curadoria dos dados: propostas, itens, cobertura e premissas." },
      { property: "og:title", content: "Admin · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Curadoria dos dados: propostas, itens, cobertura e premissas." },
    ],
  }),
  component: Admin,
});

export const CHECKLIST: { chave: string; rotulo: string }[] = [
  { chave: "tributos", rotulo: "Tributos incluídos ou não" },
  { chave: "desconto", rotulo: "Desconto aplicado ou não" },
  { chave: "contrato_janela", rotulo: "Contrato e janela" },
  { chave: "fora_subtotal", rotulo: "Itens fora do subtotal" },
  { chave: "verba_comissao", rotulo: "Verba de mídia e comissão" },
  { chave: "reajuste", rotulo: "Reajuste" },
  { chave: "validade", rotulo: "Validade" },
  { chave: "exclusoes", rotulo: "Exclusões contraditórias" },
  { chave: "itens_mapeados", rotulo: "Todos os itens mapeados a um módulo" },
  { chave: "fonte_pagina", rotulo: "Fonte e página informadas" },
];

const ABAS = ["Propostas", "Itens", "Entregas", "Requisitos", "Cobertura", "Comentários", "Pontos manuais", "Premissas", "Players"] as const;
const CAMPOS_CSV = ["id", "proposta_id", "modulo_id", "descricao", "tipo_preco", "valor_lista", "valor_negociado", "valor_min", "valor_max", "unidade", "multiplicador", "incluido_no_subtotal_da_proposta", "incerteza", "fonte_pagina", "entrega_chave", "sujeito_desconto_lista", "premissa_imputacao"];

function Admin() {
  const { data: sessao } = useSessao();
  const { base } = useMesa();
  const qc = useQueryClient();
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Propostas");

  if (sessao && !sessao.papeis.includes("admin")) {
    return (
      <>
        <AberturaTela numero="Admin" titulo="Curadoria dos dados" />
        <Conteudo><p className="text-ink-muted">Somente o Admin altera os dados. Você pode ver todas as telas de comparação.</p></Conteudo>
      </>
    );
  }

  const nomeProposta = (id: string) => {
    const p = base.propostas.find((x) => x.id === id);
    return `${base.players.find((pl) => pl.id === p?.player_id)?.nome ?? "?"} V${p?.versao ?? ""}`;
  };
  const opPropostas = base.propostas.map((p) => ({ valor: p.id, rotulo: nomeProposta(p.id) }));
  const opModulos = base.modulos.map((m) => ({ valor: m.id, rotulo: `${m.codigo} ${m.nome}` }));
  const opRequisitos = base.requisitos.map((r) => ({ valor: r.id, rotulo: `${r.codigo ?? ""} ${r.descricao}` }));
  const opPlayers = base.players.map((p) => ({ valor: p.id, rotulo: p.nome }));
  const op = (xs: string[]) => xs.map((x) => ({ valor: x, rotulo: x }));
  const recarregar = () => qc.invalidateQueries({ queryKey: ["base"] });

  async function mudarStatus(id: string, status: string) {
    const { error } = await supabase.from("proposta").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status atualizado."); recarregar(); }
  }
  async function marcar(proposta_id: string, chave: string, concluido: boolean) {
    const { error } = await supabase.from("checklist_equalizacao").upsert({ proposta_id, chave, concluido, atualizado_em: new Date().toISOString() });
    if (error) toast.error(error.message); else recarregar();
  }
  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    const linhas = lerCsv(await arq.text());
    const numeros = ["valor_lista", "valor_negociado", "valor_min", "valor_max", "multiplicador"];
    const bools = ["incluido_no_subtotal_da_proposta", "sujeito_desconto_lista"];
    let ok = 0;
    for (const l of linhas) {
      const r: Record<string, unknown> = {};
      for (const c of CAMPOS_CSV) {
        if (!(c in l)) continue;
        const v = l[c]?.trim() ?? "";
        r[c] = numeros.includes(c) ? (v === "" ? null : Number(v.replace(",", "."))) : bools.includes(c) ? v.toLowerCase() === "true" || v === "1" : v === "" ? null : v;
      }
      if (!r["id"]) delete r["id"];
      const { error } = await supabase.from("item_proposta").upsert(r as never);
      if (error) { toast.error(`Linha ${ok + 2}: ${error.message}`); break; }
      ok++;
    }
    toast.success(`${ok} item(ns) importado(s).`);
    recarregar();
  }

  return (
    <>
      <AberturaTela numero="Admin" titulo="Curadoria dos dados">
        Todo valor das telas sai daqui. Propostas só entram nos cenários depois de validadas.
      </AberturaTela>
      <Conteudo>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" aria-label="Tabelas" className="flex flex-wrap border-b border-line">
            {ABAS.map((a) => (
              <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                className={cn("border-b-2 px-3 py-2 text-sm", aba === a ? "border-line-strong" : "border-transparent text-ink-muted hover:text-foreground")}>{a}</button>
            ))}
          </div>
          <Link to="/acessos" className="label-mono underline underline-offset-4">Acessos e convites</Link>
        </div>

        {aba === "Propostas" && (
          <div className="space-y-12">
            {base.propostas.map((p) => {
              const marcados = new Set(base.checklist.filter((c) => c.proposta_id === p.id && c.concluido).map((c) => c.chave));
              return (
                <section key={p.id} className="border border-line p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl">{nomeProposta(p.id)}</h2>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{p.status === "recebida" ? "Recebida" : p.status === "em_equalizacao" ? "Em equalização" : "Validada"}</Badge>
                      <SeloStatus status={p.status} />
                    </div>
                  </div>
                  <RotuloMono as="p" className="mt-4">Fluxo: Recebida → Em equalização → Validada</RotuloMono>
                  <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {CHECKLIST.map((c) => (
                      <label key={c.chave} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4" checked={marcados.has(c.chave)} disabled={p.status === "validada"}
                          onChange={(e) => marcar(p.id, c.chave, e.target.checked)} />
                        {c.rotulo}
                      </label>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {p.status === "recebida" && <Button size="sm" variant="secondary" onClick={() => mudarStatus(p.id, "em_equalizacao")}>Iniciar equalização</Button>}
                    {p.status === "em_equalizacao" && (
                      <Button size="sm" disabled={marcados.size < 10} onClick={() => mudarStatus(p.id, "validada")}>
                        Validar ({marcados.size}/10)
                      </Button>
                    )}
                    {p.status === "validada" && <Button size="sm" variant="secondary" onClick={() => mudarStatus(p.id, "em_equalizacao")}>Voltar para equalização</Button>}
                  </div>
                </section>
              );
            })}
            <EditorTabela tabela="proposta" titulo="Proposta" linhas={base.propostas as never} colunas={[
              { campo: "player_id", rotulo: "Player", tipo: "select", opcoes: opPlayers, obrigatorio: true },
              { campo: "versao", rotulo: "Versão", tipo: "numero", obrigatorio: true },
              { campo: "data_proposta", rotulo: "Data", tipo: "data" },
              { campo: "validade_dias", rotulo: "Validade (dias)", tipo: "numero" },
              { campo: "contrato_meses_proposto", rotulo: "Contrato (meses)", tipo: "numero" },
              { campo: "fonte_arquivo", rotulo: "Arquivo-fonte", tipo: "texto", lista: false },
              { campo: "desconto_explicito", rotulo: "Desconto explícito", tipo: "texto", lista: false },
              { campo: "tributos", rotulo: "Tributos", tipo: "texto", lista: false },
              { campo: "reajuste", rotulo: "Reajuste", tipo: "texto", lista: false },
              { campo: "exclusoes", rotulo: "Exclusões", tipo: "longo", lista: false },
              { campo: "observacoes", rotulo: "Observações", tipo: "longo", lista: false },
            ]} />
          </div>
        )}

        {aba === "Itens" && (
          <>
            <div className="mb-6 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => baixar("itens-proposta.csv", paraCsv(base.itens as never, CAMPOS_CSV))}>
                <Download strokeWidth={1.5} /> Exportar CSV
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 border border-line-strong px-3 font-mono text-xs uppercase tracking-[0.12em] hover:bg-accent">
                <Upload strokeWidth={1.5} className="size-4" /> Importar CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={importar} />
              </label>
            </div>
            <EditorTabela tabela="item_proposta" titulo="Item" linhas={base.itens as never} colunas={[
              { campo: "proposta_id", rotulo: "Proposta", tipo: "select", opcoes: opPropostas, obrigatorio: true },
              { campo: "modulo_id", rotulo: "Módulo", tipo: "select", opcoes: opModulos },
              { campo: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true },
              { campo: "tipo_preco", rotulo: "Tipo de preço", tipo: "select", opcoes: op(["recorrente", "pontual", "variavel", "por_credito"]), obrigatorio: true },
              { campo: "unidade", rotulo: "Unidade", tipo: "select", opcoes: op(["mes", "projeto", "produto_mes", "percentual_verba"]), obrigatorio: true },
              { campo: "valor_lista", rotulo: "Lista", tipo: "numero" },
              { campo: "valor_negociado", rotulo: "Negociado", tipo: "numero" },
              { campo: "valor_min", rotulo: "Mínimo", tipo: "numero", lista: false },
              { campo: "valor_max", rotulo: "Máximo", tipo: "numero", lista: false },
              { campo: "multiplicador", rotulo: "Multiplicador", tipo: "numero", lista: false, obrigatorio: true },
              { campo: "incluido_no_subtotal_da_proposta", rotulo: "No subtotal", tipo: "bool" },
              { campo: "sujeito_desconto_lista", rotulo: "Desconto de lista (XCV)", tipo: "bool", lista: false },
              { campo: "premissa_imputacao", rotulo: "Premissa de imputação", tipo: "texto", lista: false },
              { campo: "entrega_chave", rotulo: "Entrega-chave", tipo: "texto", lista: false },
              { campo: "incerteza", rotulo: "Incerteza", tipo: "longo", lista: false },
              { campo: "fonte_pagina", rotulo: "Fonte e página", tipo: "texto", lista: false },
            ]} padrao={{ multiplicador: 1 }} />
          </>
        )}

        {aba === "Entregas" && (
          <EditorTabela tabela="entrega_declarada" titulo="Entrega declarada" linhas={base.entregas as never} colunas={[
            { campo: "proposta_id", rotulo: "Proposta", tipo: "select", opcoes: opPropostas, obrigatorio: true },
            { campo: "categoria", rotulo: "Categoria", tipo: "select", opcoes: op(["posts_instagram", "videos_sociais", "posts_linkedin", "posts_corretores", "pecas_endomarketing", "placas_ooh", "videos_painel"]), obrigatorio: true },
            { campo: "quantidade_mes", rotulo: "Por mês", tipo: "numero", obrigatorio: true },
            { campo: "e_teto", rotulo: "Teto (até)", tipo: "bool" },
            { campo: "observacao", rotulo: "Observação", tipo: "texto" },
          ]} />
        )}

        {aba === "Requisitos" && (
          <EditorTabela tabela="requisito" titulo="Requisito" linhas={base.requisitos as never} colunas={[
            { campo: "modulo_id", rotulo: "Módulo", tipo: "select", opcoes: opModulos, obrigatorio: true },
            { campo: "codigo", rotulo: "Código", tipo: "texto" },
            { campo: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true },
            { campo: "peso", rotulo: "Peso (1 a 5)", tipo: "numero", obrigatorio: true },
            { campo: "criticidade", rotulo: "Criticidade", tipo: "select", opcoes: op(["essencial", "desejavel"]), obrigatorio: true },
            { campo: "eliminatorio", rotulo: "Eliminatório", tipo: "bool" },
            { campo: "fonte", rotulo: "Fonte", tipo: "texto", lista: false },
          ]} />
        )}

        {aba === "Cobertura" && (
          <EditorTabela tabela="cobertura" titulo="Cobertura" linhas={base.coberturas as never} colunas={[
            { campo: "proposta_id", rotulo: "Proposta", tipo: "select", opcoes: opPropostas, obrigatorio: true },
            { campo: "requisito_id", rotulo: "Requisito", tipo: "select", opcoes: opRequisitos, obrigatorio: true },
            { campo: "nivel", rotulo: "Nível (1, 0,5, 0 ou vazio)", tipo: "numero" },
            { campo: "evidencia", rotulo: "Evidência", tipo: "select", opcoes: op(["declarado", "comprovado", "nao_informado"]), obrigatorio: true },
            { campo: "custo_estimado_para_cobrir", rotulo: "Custo para cobrir", tipo: "numero" },
            { campo: "fonte_pagina", rotulo: "Fonte e página", tipo: "texto", lista: false },
            { campo: "nota_tecnica", rotulo: "Nota técnica", tipo: "longo", lista: false },
          ]} />
        )}

        {aba === "Comentários" && (
          <EditorTabela tabela="comentario_tecnico" titulo="Comentário técnico" linhas={base.comentarios as never} colunas={[
            { campo: "proposta_id", rotulo: "Proposta", tipo: "select", opcoes: opPropostas },
            { campo: "modulo_id", rotulo: "Módulo", tipo: "select", opcoes: opModulos },
            { campo: "texto", rotulo: "Texto", tipo: "longo", obrigatorio: true },
          ]} />
        )}

        {aba === "Pontos manuais" && (
          <EditorTabela tabela="ponto_atencao" titulo="Ponto de atenção" linhas={base.pontos as never} padrao={{ origem: "manual" }} colunas={[
            { campo: "escopo", rotulo: "Escopo", tipo: "select", opcoes: op(["proposta", "modulo", "composicao"]), obrigatorio: true },
            { campo: "referencia_id", rotulo: "Proposta ou módulo", tipo: "select", opcoes: [...opPropostas, ...opModulos] },
            { campo: "severidade", rotulo: "Severidade", tipo: "select", opcoes: op(["critico", "alto", "medio", "info"]), obrigatorio: true },
            { campo: "texto", rotulo: "Texto", tipo: "longo", obrigatorio: true },
            { campo: "acao_sugerida", rotulo: "Ação sugerida", tipo: "longo", lista: false },
            { campo: "regra_codigo", rotulo: "Código", tipo: "texto" },
          ]} />
        )}

        {aba === "Premissas" && (
          <EditorTabela tabela="premissa" titulo="Premissa" chave={["chave"]} linhas={base.premissas as never} colunas={[
            { campo: "chave", rotulo: "Chave", tipo: "texto", obrigatorio: true },
            { campo: "valor", rotulo: "Valor (JSON)", tipo: "json", obrigatorio: true },
            { campo: "descricao", rotulo: "Descrição", tipo: "texto" },
          ]} />
        )}

        {aba === "Players" && (
          <EditorTabela tabela="player" titulo="Player" linhas={base.players as never} colunas={[
            { campo: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
            { campo: "tipo", rotulo: "Tipo", tipo: "select", opcoes: op(["agencia", "plataforma", "consultoria", "referencia"]), obrigatorio: true },
            { campo: "status", rotulo: "Status", tipo: "select", opcoes: op(["proponente", "referencia_sem_proposta", "convidado"]), obrigatorio: true },
            { campo: "rfp_numeros", rotulo: "RFPs (ex.: [1,2])", tipo: "json" },
            { campo: "cor_token", rotulo: "Cor", tipo: "select", opcoes: op(["flamboyant", "verde-cerrado", "ipe-do-cerrado", "terracota", "terra-vermelha", "cinza-quente-1", "cinza-quente-2", "cinza-quente-3"]) },
            { campo: "cidade", rotulo: "Cidade", tipo: "texto", lista: false },
            { campo: "observacoes", rotulo: "Observações", tipo: "longo", lista: false },
          ]} />
        )}
      </Conteudo>
    </>
  );
}
