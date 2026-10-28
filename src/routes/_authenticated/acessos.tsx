import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moldura, useSessao } from "@/components/newe/Moldura";
import { RotuloMono } from "@/components/newe/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { enviarConvite, enviarPendentes, listarAcessos, revogarAcesso } from "@/lib/acesso.functions";
import { listarMembros } from "@/lib/convites.functions";
import { NOME_STATUS } from "@/lib/acesso";
import { NOME_PAPEL, type Papel } from "@/lib/papel";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Acessos · NEWE Mesa de Decisão" },
      { name: "description", content: "Lista autorizada, convites e registro de entradas da Mesa de Decisão NEWE." },
      { property: "og:title", content: "Acessos · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Lista autorizada, convites e registro de entradas da Mesa de Decisão NEWE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Acessos,
});

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Acessos() {
  const { data: sessao } = useSessao();
  const ehAdmin = !!sessao?.papeis.includes("admin");
  const qc = useQueryClient();
  const acessos = useQuery({ queryKey: ["acessos"], queryFn: () => listarAcessos(), enabled: ehAdmin });
  const membros = useQuery({ queryKey: ["membros"], queryFn: () => listarMembros(), enabled: ehAdmin });
  const redirectTo = () => `${window.location.origin}/definir-senha`;
  const depois = (msg: string) => ({
    onSuccess: () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["acessos"] }); qc.invalidateQueries({ queryKey: ["membros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const convite = useMutation({ mutationFn: (email: string) => enviarConvite({ data: { email, redirectTo: redirectTo() } }), ...depois("Convite enviado.") });
  const todos = useMutation({
    mutationFn: () => enviarPendentes({ data: { redirectTo: redirectTo() } }),
    onSuccess: (r) => { toast.success(`${r.enviados} convite(s) enviado(s).`); qc.invalidateQueries({ queryKey: ["acessos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revogar = useMutation({ mutationFn: (email: string) => revogarAcesso({ data: { email } }), ...depois("Acesso revogado.") });
  const ocupado = convite.isPending || todos.isPending || revogar.isPending;
  const linhas = acessos.data?.linhas ?? [];
  const pendentes = linhas.filter((l) => l.status === "pendente").length;

  return (
    <Moldura>
      <section className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 md:grid-cols-12 px-4 py-10 md:px-8 md:py-16 lg:px-12 lg:py-20">
        <RotuloMono as="p" className="md:col-span-2">Acessos</RotuloMono>
        <div className="min-w-0 md:col-span-10">
          <h1 className="chamada text-3xl sm:text-4xl">Quem participa</h1>
          {!ehAdmin ? (
            <p className="mt-6 text-ink-muted">Somente o facilitador gerencia acessos.</p>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p className="text-ink-muted">
                  Cada pessoa define a própria senha pelo link do convite. Ninguém vê senhas. Todos entram somente para leitura.
                </p>
                <Button disabled={ocupado || pendentes === 0} onClick={() => { if (confirm(`Enviar ${pendentes} convite(s) pendente(s) agora?`)) todos.mutate(); }}>
                  Enviar todos os pendentes ({pendentes})
                </Button>
              </div>

              <div className="mt-8">
                <Table modo="cartoes">
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => (
                      <TableRow key={l.email}>
                        <TableCell className="num break-all">{l.email}</TableCell>
                        <TableCell>{l.grupo}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "ativo" ? "default" : "outline"}>{NOME_STATUS[l.status]}</Badge>
                          {l.convidado_em && l.status !== "ativo" && <span className="ml-2 text-sm text-ink-muted">convite em {fmt(l.convidado_em)}</span>}
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          {l.status === "pendente" && <Button size="sm" disabled={ocupado} onClick={() => convite.mutate(l.email)}>Enviar convite</Button>}
                          {(l.status === "convidado" || l.status === "expirado" || l.status === "revogado") && (
                            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => convite.mutate(l.email)}>Reenviar convite</Button>
                          )}
                          {l.status !== "revogado" && (
                            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { if (confirm(`Revogar o acesso de ${l.email}?`)) revogar.mutate(l.email); }}>
                              Revogar acesso
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <h2 className="chamada mt-16 text-2xl">Registro de entradas</h2>
              <div className="mt-6">
                <Table modo="cartoes">
                  <TableHeader>
                    <TableRow><TableHead>Usuário</TableHead><TableHead>Data e hora (Brasília)</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(acessos.data?.entradas ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-ink-muted">Nenhuma entrada registrada.</TableCell></TableRow>
                    )}
                    {(acessos.data?.entradas ?? []).map((e, i) => (
                      <TableRow key={i}><TableCell className="num break-all">{e.email}</TableCell><TableCell className="num">{fmt(e.quando)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <h2 className="chamada mt-16 text-2xl">Contas com papel</h2>
              <div className="mt-6">
                <Table modo="cartoes">
                  <TableHeader>
                    <TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(membros.data ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.nome}</TableCell>
                        <TableCell className="num break-all">{m.email}</TableCell>
                        <TableCell className="space-x-2">
                          {m.papeis.length === 0 ? <Badge variant="secondary">Sem papel</Badge> : m.papeis.map((p) => (
                            <Badge key={p} variant={p === "admin" ? "default" : "outline"}>{NOME_PAPEL[p as Papel]}</Badge>
                          ))}
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
