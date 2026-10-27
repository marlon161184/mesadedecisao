import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/components/newe/Moldura";
import { REVALIDAR_MS, rotuloEncerramento } from "@/lib/reuniao";

type InfoReuniao = { id: string; nome: string; expira_em: string; conectados: string[] };

/**
 * Para sessões de reunião: revalida a cada 60 s (e envia o pulso só se houve interação na última hora).
 * Quando a reunião deixa de valer, encerra a sessão e mostra "Reunião encerrada".
 */
export function useVigiaReuniao() {
  const { data: sessao } = useSessao();
  const ehReuniao = !!sessao?.reuniao;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ultimaInteracao = useRef(Date.now());
  useEffect(() => {
    if (!ehReuniao) return;
    const marcar = () => { ultimaInteracao.current = Date.now(); };
    const ev = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    ev.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    return () => ev.forEach((e) => window.removeEventListener(e, marcar));
  }, [ehReuniao]);
  const q = useQuery({
    queryKey: ["minha-reuniao"],
    enabled: ehReuniao,
    refetchInterval: REVALIDAR_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (Date.now() - ultimaInteracao.current < 60 * 60 * 1000) await supabase.rpc("reuniao_pulso");
      const { data } = await supabase.rpc("minha_reuniao");
      return (data as InfoReuniao | null) ?? null;
    },
  });
  useEffect(() => {
    if (!ehReuniao || q.isLoading || q.data) return;
    (async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/entrar", search: { fim: 1 } as never, replace: true });
    })();
  }, [ehReuniao, q.isLoading, q.data, navigate, qc]);
  return { ehReuniao, info: q.data ?? null };
}

/** Selo no topo: "Reunião: nome · somente leitura · encerra às HH:MM" e quem está conectado. */
export function SeloReuniao() {
  const { ehReuniao, info } = useVigiaReuniao();
  const { data: sessao } = useSessao();
  const ativas = useQuery({
    queryKey: ["reunioes-ativas"],
    enabled: !!sessao && !sessao.reuniao,
    refetchInterval: REVALIDAR_MS,
    queryFn: async () => ((await supabase.rpc("reunioes_ativas")).data as InfoReuniao[] | null) ?? [],
  });
  const lista: InfoReuniao[] = ehReuniao ? (info ? [info] : []) : ativas.data ?? [];
  if (lista.length === 0) return null;
  return (
    <div role="status" className="border-b border-line-strong bg-primary text-primary-foreground">
      {lista.map((r) => (
        <p key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8 lg:px-12">
          <span className="label-mono">Reunião: {r.nome} · somente leitura · {rotuloEncerramento(r.expira_em)}</span>
          <span className="min-w-0 break-words">Conectados: {r.conectados.length ? r.conectados.join(", ") : "ninguém no momento"}</span>
        </p>
      ))}
    </div>
  );
}
