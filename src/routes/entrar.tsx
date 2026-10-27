import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { entrarReuniao, infoReuniao } from "@/lib/reuniao.functions";
import { horaFim, tokenDoEndereco } from "@/lib/reuniao";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { RotuloMono } from "@/components/newe/brand";
import { AlternarTema } from "@/components/newe/AlternarTema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/entrar")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ fim: s["fim"] ? 1 : undefined }),
  head: () => ({
    meta: [
      { title: "Reunião · NEWE Mesa de Decisão" },
      { name: "description", content: "Entrada somente leitura para a reunião de decisão NEWE." },
      { property: "og:title", content: "Reunião · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Entrada somente leitura para a reunião de decisão NEWE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: EntrarReuniao,
});

type Estado =
  | { tipo: "carregando" }
  | { tipo: "encerrada" }
  | { tipo: "membro" }
  | { tipo: "pronta"; nome: string; expira_em: string };

function EntrarReuniao() {
  const { fim } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useServerFn(infoReuniao);
  const entrar = useServerFn(entrarReuniao);
  const token = useRef<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // O token só vive nesta tela: sai da barra de endereço na hora (replace) e fica em memória.
    // Lido uma vez só (o efeito pode rodar duas vezes em desenvolvimento).
    token.current ??= tokenDoEndereco(window.location.hash, window.location.search);
    window.history.replaceState(null, "", "/entrar");
    (async () => {
      if (fim || !token.current) { setEstado({ tipo: "encerrada" }); return; }
      const { data } = await supabase.auth.getUser();
      if (data.user && data.user.app_metadata?.["reuniao"] !== true) { setEstado({ tipo: "membro" }); return; }
      const r = await info({ data: { token: token.current } });
      setEstado(r.ok ? { tipo: "pronta", nome: r.nome, expira_em: r.expira_em } : { tipo: "encerrada" });
    })().catch(() => setEstado({ tipo: "encerrada" }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!token.current) return;
    setEnviando(true);
    try {
      const r = await entrar({ data: { token: token.current, nome } });
      if (!r.ok) { setEstado({ tipo: "encerrada" }); return; }
      token.current = null;
      qc.clear();
      await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      navigate({ to: "/reuniao", search: { rfp: 2 }, replace: true });
    } catch {
      setEstado({ tipo: "encerrada" });
    } finally { setEnviando(false); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line px-4 py-3 md:px-8 lg:px-12">
        <LogoNewe height={28} comMargem={false} />
        <AlternarTema />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 md:py-20">
        <RotuloMono as="p">Mesa de Decisão · Reunião</RotuloMono>
        {estado.tipo === "carregando" && <p className="mt-6 text-ink-muted">Conferindo o link.</p>}
        {estado.tipo === "encerrada" && <h1 className="chamada mt-6 text-3xl">Reunião encerrada</h1>}
        {estado.tipo === "membro" && (
          <div className="mt-6 space-y-4">
            <h1 className="chamada text-3xl">Você já está conectado com sua conta</h1>
            <p className="text-ink-muted">Siga pela Mesa normalmente. O link de reunião serve para quem não tem conta.</p>
            <Button asChild><Link to="/inicio">Abrir a Mesa</Link></Button>
          </div>
        )}
        {estado.tipo === "pronta" && (
          <form onSubmit={confirmar} className="mt-6 space-y-6">
            <div>
              <h1 className="chamada text-3xl">Boas-vindas à NEWE</h1>
              <p className="mt-3 text-lg">{estado.nome}</p>
              <p className="label-mono mt-1 text-ink-muted">Válida até {horaFim(estado.expira_em)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seu-nome">Seu nome</Label>
              <Input id="seu-nome" required minLength={2} maxLength={80} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <p className="border-l-2 border-primary pl-3 text-sm">Acesso somente leitura. Os documentos são confidenciais.</p>
            <Button type="submit" disabled={enviando || nome.trim().length < 2}>{enviando ? "Entrando" : "Entrar na reunião"}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
