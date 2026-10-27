import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LIMITE_INATIVIDADE_MS = 30 * 60 * 1000;

/** Encerra a sessão após 30 minutos sem interação. */
export function useInatividade() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const sair = async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    };
    const reiniciar = () => { clearTimeout(t); t = setTimeout(sair, LIMITE_INATIVIDADE_MS); };
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => { clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, reiniciar)); };
  }, [navigate, qc]);
}
