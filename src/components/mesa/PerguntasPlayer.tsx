import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Base } from "@/lib/base";
import { agruparPorSecao, formatarPrazo, perguntasDoPlayer, textoParaEmail } from "@/lib/perguntas";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useSessao } from "@/components/newe/Moldura";

type Props = { base: Base; rfpId: string; playerId: string; playerNome: string; propostaId: string };

export function PerguntasPlayer({ base, rfpId, playerId, playerNome, propostaId }: Props) {
  const { data: sessao } = useSessao();
  const admin = !!sessao?.papeis.includes("admin");
  const podeCopiar = !sessao?.reuniao;
  const lista = perguntasDoPlayer(base.perguntas, rfpId, playerId);
  const grupos = agruparPorSecao(lista);
  let n = 0;

  async function copiar() {
    await navigator.clipboard.writeText(textoParaEmail(playerNome, lista));
    toast.success(`Perguntas para ${playerNome} copiadas.`);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RotuloMono as="p">Perguntas ({lista.length})</RotuloMono>
        {podeCopiar && lista.length > 0 && <Button size="sm" variant="secondary" onClick={copiar}>Copiar perguntas</Button>}
      </div>
      {lista.length === 0 && <p className="mt-3 text-sm text-ink-muted">Nenhuma pergunta cadastrada.</p>}
      {grupos.map((g) => (
        <div key={g.secao} className="mt-6">
          <h3 className="label-mono">{g.secao}</h3>
          <ol className="mt-2 space-y-3 text-sm">
            {g.itens.map((q) => (
              <Linha key={q.id} n={++n} base={base} q={q} propostaId={propostaId} admin={admin} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function Linha({ n, base, q, propostaId, admin }: { n: number; base: Base; q: Base["perguntas"][number]; propostaId: string; admin: boolean }) {
  const qc = useQueryClient();
  const r = base.respostas.find((x) => x.pergunta_id === q.id && x.proposta_id === propostaId);
  const [editando, setEditando] = useState(false);
  const [resposta, setResposta] = useState(r?.resposta ?? "");
  const [avaliacao, setAvaliacao] = useState(r?.avaliacao ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const dados = { resposta: resposta.trim() || null, avaliacao: avaliacao.trim() || null, sem_resposta: false };
    const { error } = r
      ? await supabase.from("resposta_filtro").update(dados).eq("id", r.id)
      : await supabase.from("resposta_filtro").insert({ pergunta_id: q.id, proposta_id: propostaId, ...dados });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Resposta registrada.");
    setEditando(false);
    await Promise.all([qc.invalidateQueries({ queryKey: ["base"] }), qc.invalidateQueries({ queryKey: ["decisao"] })]);
  }

  return (
    <li className="border-t border-line pt-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="num label-mono">{n}.</span>
        <p className="min-w-0 flex-1">{q.texto}</p>
        {!q.player_id && <Badge variant="outline">Geral</Badge>}
      </div>
      {q.prazo_resposta && <p className="mt-1 label-mono text-ink-muted">Prazo: {formatarPrazo(q.prazo_resposta)}</p>}
      {!editando && (
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <p className="text-ink-muted">{r?.sem_resposta ? "Sem resposta do proponente." : r?.resposta ?? "Sem resposta registrada."}{r?.avaliacao && ` · ${r.avaliacao}`}</p>
          {admin && <Button size="sm" variant="outline" onClick={() => setEditando(true)}>{r ? "Editar resposta" : "Registrar resposta"}</Button>}
        </div>
      )}
      {editando && (
        <div className="mt-2 space-y-2">
          <Textarea aria-label="Resposta" placeholder="Resposta do proponente" value={resposta} onChange={(e) => setResposta(e.target.value)} />
          <Input aria-label="Avaliação" placeholder="Avaliação" value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={salvando}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </li>
  );
}
