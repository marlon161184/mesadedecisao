import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/components/newe/Moldura";
import { INATIVIDADE_REUNIAO_MS } from "@/lib/reuniao";

export const LIMITE_INATIVIDADE_MS = 30 * 60 * 1000;

/** Encerra a sessão após 30 minutos sem interação (60 minutos nas sessões de reunião). */
export function useInatividade() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: sessao } = useSessao();
  const reuniao = !!sessao?.reuniao;
  useEffect(() => {
    const limite = reuniao ? INATIVIDADE_REUNIAO_MS : LIMITE_INATIVIDADE_MS;
    let t: ReturnType<typeof setTimeout>;
    const sair = async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      if (reuniao) navigate({ to: "/entrar", search: { fim: 1 } as never, replace: true });
      else navigate({ to: "/auth", replace: true });
    };
    const reiniciar = () => { clearTimeout(t); t = setTimeout(sair, limite); };
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => { clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, reiniciar)); };
  }, [navigate, qc, reuniao]);
}
