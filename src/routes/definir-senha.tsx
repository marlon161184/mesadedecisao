import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo, RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({
    meta: [
      { title: "Definir senha · NEWE Mesa de Decisão" },
      { name: "description", content: "Defina sua senha de acesso à Mesa de Decisão NEWE." },
      { property: "og:title", content: "Definir senha · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Defina sua senha de acesso à Mesa de Decisão NEWE." },
    ],
  }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setPronto(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setPronto(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { toast.error("Use pelo menos 8 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) { toast.error(error.message); return; }
    toast.success("Senha definida.");
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-6 text-foreground md:px-8 md:py-10 lg:px-12">
      <Logo height={32} />
      <form onSubmit={salvar} className="mx-auto my-auto w-full max-w-sm space-y-6">
        <div>
          <RotuloMono as="p">Primeiro acesso ou nova senha</RotuloMono>
          <h1 className="chamada mt-3 text-3xl">Definir senha</h1>
        </div>
        {!pronto ? (
          <p className="text-sm text-ink-muted">Abra esta página pelo link enviado ao seu e-mail.</p>
        ) : (
          <>
            <div>
              <Label htmlFor="senha" className="label-mono">Nova senha</Label>
              <Input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-2 h-11 rounded-none" />
            </div>
            <Button type="submit" size="lg" className="w-full">Salvar senha</Button>
          </>
        )}
      </form>
    </div>
  );
}
