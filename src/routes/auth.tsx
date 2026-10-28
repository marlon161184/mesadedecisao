import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RotuloMono } from "@/components/newe/brand";
import { LogoNewe } from "@/components/newe/LogoNewe";
import { AlternarTema } from "@/components/newe/AlternarTema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · NEWE Mesa de Decisão" },
      { name: "description", content: "Acesso por convite à Mesa de Decisão NEWE." },
      { property: "og:title", content: "Entrar · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Acesso por convite à Mesa de Decisão NEWE." },
    ],
  }),
  component: Entrar,
});

async function sairDeConvidado() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.app_metadata?.["reuniao"] === true) {
    await supabase.auth.signOut({ scope: "local" });
    return true;
  }
  return false;
}

function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      // Sessão de convidado de reunião guardada no navegador nunca bloqueia o login de uma conta.
      const eraConvidado = await sairDeConvidado();
      const marcado = !!localStorage.getItem("newe-reuniao");
      localStorage.removeItem("newe-reuniao");
      const conta = new URLSearchParams(window.location.search).has("conta");
      // Convidado que perdeu a sessão vê "Reunião encerrada"; quem pediu o login (?conta) vê o formulário.
      if ((eraConvidado || marcado) && !conta) { navigate({ to: "/entrar", search: { fim: 1 }, replace: true }); return; }
      if (vivo) setPronto(true);
    })().catch(() => vivo && setPronto(true));
    return () => { vivo = false; };
  }, [navigate]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);
    await sairDeConvidado();
    localStorage.removeItem("newe-reuniao");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) { toast.error("E-mail ou senha não conferem."); return; }
    navigate({ to: "/inicio" });
  }

  async function esqueci() {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Se o e-mail tiver acesso, enviamos um link para redefinir a senha.");
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-16 text-primary-foreground lg:flex">
        <div className="flex items-center gap-4">
          <LogoNewe variante="preto" height={30} comMargem={false} />
          <span className="label-mono">Grupo Hyndra</span>
        </div>
        <p className="chamada max-w-md text-4xl leading-tight">Luxo é para se sentir.</p>
        <span className="label-mono">São José do Rio Preto · SP</span>
      </div>
      <div className="flex min-h-screen flex-col px-4 py-6 md:px-8 md:py-10 lg:min-h-0 lg:px-12">
        <div className="flex items-center justify-between">
          <LogoNewe height={32} />
          <AlternarTema />
        </div>
        {!pronto ? <p className="mx-auto my-auto text-ink-muted">Preparando o acesso.</p> : (
        <form onSubmit={entrar} className="mx-auto my-auto w-full max-w-sm space-y-6">
          <div>
            <RotuloMono as="p">Acesso por convite</RotuloMono>
            <h1 className="chamada mt-3 text-2xl sm:text-3xl">Mesa de Decisão</h1>
          </div>
          <div>
            <Label htmlFor="email" className="label-mono">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 rounded-none" />
          </div>
          <div>
            <Label htmlFor="senha" className="label-mono">Senha</Label>
            <Input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-2 h-11 rounded-none" />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={carregando}>
            {carregando ? "Entrando" : "Entrar"}
          </Button>
          <Button type="button" variant="link" className="min-h-11 px-0" onClick={esqueci}>
            Esqueci a senha
          </Button>
          <p className="text-sm text-ink-muted">Não há cadastro aberto. O acesso é liberado pelo Admin.</p>
        </form>
        )}
      </div>
    </div>
  );
}
