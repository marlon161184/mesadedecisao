import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moldura, useSessao } from "@/components/newe/Moldura";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { convidarPessoa, listarMembros } from "@/lib/convites.functions";
import { NOME_PAPEL, type Papel } from "@/lib/papel";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Acessos · NEWE Mesa de Decisão" },
      { name: "description", content: "Convites e papéis da Mesa de Decisão NEWE." },
      { property: "og:title", content: "Acessos · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Convites e papéis da Mesa de Decisão NEWE." },
    ],
  }),
  component: Acessos,
});

function Acessos() {
  const { data: sessao } = useSessao();
  const ehAdmin = sessao?.papeis.includes("admin");
  const qc = useQueryClient();
  const membros = useQuery({ queryKey: ["membros"], queryFn: () => listarMembros(), enabled: !!ehAdmin });
  const [form, setForm] = useState({ email: "", nome: "", papel: "socio" as Papel });
  const convite = useMutation({
    mutationFn: () => convidarPessoa({ data: { ...form, redirectTo: `${window.location.origin}/definir-senha` } }),
    onSuccess: () => {
      toast.success("Convite enviado.");
      setForm({ email: "", nome: "", papel: "socio" });
      qc.invalidateQueries({ queryKey: ["membros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Moldura>
      <section className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 md:grid-cols-12 px-4 py-10 md:px-8 md:py-16 lg:px-12 lg:py-20">
        <RotuloMono as="p" className="md:col-span-2">Acessos</RotuloMono>
        <div className="min-w-0 md:col-span-10">
          <h1 className="chamada text-3xl sm:text-4xl">Quem participa</h1>
          {!ehAdmin ? (
            <p className="mt-6 text-ink-muted">Somente o Admin gerencia acessos.</p>
          ) : (
            <>
              <form
                className="mt-10 grid grid-cols-1 gap-4 border border-line p-4 sm:p-6 md:grid-cols-4 md:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  convite.mutate();
                }}
              >
                <div>
                  <Label htmlFor="nome" className="label-mono">Nome</Label>
                  <Input id="nome" required maxLength={120} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-2 rounded-none" />
                </div>
                <div>
                  <Label htmlFor="email" className="label-mono">E-mail</Label>
                  <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 rounded-none" />
                </div>
                <div>
                  <Label htmlFor="papel" className="label-mono">Papel</Label>
                  <select
                    id="papel"
                    value={form.papel}
                    onChange={(e) => setForm({ ...form, papel: e.target.value as Papel })}
                    className="campo mt-2"
                  >
                    <option value="socio">Sócio</option>
                    <option value="observador">Observador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" disabled={convite.isPending}>
                  {convite.isPending ? "Enviando" : "Enviar convite"}
                </Button>
              </form>

              <div className="mt-12">
                <Table modo="cartoes">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(membros.data ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.nome}</TableCell>
                        <TableCell className="num break-all">{m.email}</TableCell>
                        <TableCell className="space-x-2">
                          {m.papeis.length === 0 ? (
                            <Badge variant="secondary">Sem papel</Badge>
                          ) : (
                            m.papeis.map((p) => (
                              <Badge key={p} variant={p === "admin" ? "default" : "outline"}>
                                {NOME_PAPEL[p as Papel]}
                              </Badge>
                            ))
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </section>
    </Moldura>
  );
}
