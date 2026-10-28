import { useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";

/** Mostrada quando a base chega sem nenhum RFP. Convidado de reunião vai direto para "Reunião encerrada". */
export function SemAcesso({ motivo }: { motivo?: string } = {}) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [conferindo, setConferindo] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const convidado = data.user?.app_metadata?.["reuniao"] === true || (!data.user && !!localStorage.getItem("newe-reuniao"));
      if (convidado) {
        localStorage.removeItem("newe-reuniao");
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/entrar", search: { fim: 1 } as never, replace: true });
        return;
      }
      if (vivo) setConferindo(false);
    })().catch(() => vivo && setConferindo(false));
    return () => { vivo = false; };
  }, [navigate, qc]);

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    localStorage.removeItem("newe-reuniao");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  async function tentar() {
    await qc.invalidateQueries();
    router.invalidate();
  }

  return (
    <div role="alert" className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-line px-4 py-3 md:px-8 lg:px-12"><LogoNewe height={28} comMargem={false} /></header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 md:py-20">
        <RotuloMono as="p">Mesa de Decisão</RotuloMono>
        <h1 className="chamada mt-6 text-3xl">Sem acesso aos dados desta sessão</h1>
        {conferindo ? (
          <p className="mt-4 text-ink-muted">Conferindo a sessão.</p>
        ) : (
          <>
            <p className="mt-4">{motivo ?? "Esta sessão não lê as propostas. Os motivos mais prováveis:"}</p>
            {!motivo && <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-muted">
              <li>a reunião acabou, expirou ou ficou 60 minutos sem atividade;</li>
              <li>a conta ainda não recebeu um papel (Admin, Sócio ou Observador).</li>
            </ul>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={sair}>Sair e entrar com outra conta</Button>
              <Button variant="outline" onClick={tentar}>Tentar de novo</Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
