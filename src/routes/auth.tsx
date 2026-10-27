import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo, RotuloMono } from "@/components/newe/brand";
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

function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);
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
        <span className="label-mono">NEWE · Grupo Hyndra</span>
        <p className="chamada max-w-md text-4xl leading-tight">Luxo é para se sentir.</p>
        <span className="label-mono">São José do Rio Preto · SP</span>
      </div>
      <div className="flex flex-col px-8 py-10 md:px-16">
        <div className="flex items-center justify-between">
          <Logo height={32} />
          <AlternarTema />
        </div>
        <form onSubmit={entrar} className="mx-auto my-auto w-full max-w-sm space-y-6">
          <div>
            <RotuloMono as="p">Acesso por convite</RotuloMono>
            <h1 className="chamada mt-3 text-3xl">Mesa de Decisão</h1>
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
          <Button type="button" variant="link" className="h-auto px-0" onClick={esqueci}>
            Esqueci a senha
          </Button>
          <p className="text-sm text-ink-muted">Não há cadastro aberto. O acesso é liberado pelo Admin.</p>
        </form>
      </div>
    </div>
  );
}
