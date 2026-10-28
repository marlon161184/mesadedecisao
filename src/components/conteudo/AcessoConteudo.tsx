import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSessao } from "@/components/newe/Moldura";
import { SemAcesso } from "@/components/mesa/SemAcesso";
import { carregarDocumentos, consultarPermissaoConteudo } from "@/lib/conteudo.functions";
import type { ConteudoDocumentos } from "@/lib/conteudo";

const Contexto = createContext<ConteudoDocumentos | null>(null);
export const ProvedorConteudo = Contexto.Provider;
export function useConteudo() {
  const dados = useContext(Contexto);
  if (!dados) throw new Error("Conteúdo não autorizado.");
  return dados;
}

export function usePermissaoConteudo() {
  const { data: sessao } = useSessao();
  const consultar = useServerFn(consultarPermissaoConteudo);
  return useQuery({ queryKey: ["permissao-conteudo", sessao?.id], queryFn: () => consultar(), enabled: !!sessao?.id, staleTime: 0, gcTime: 0 });
}

export function AcessoConteudo({ children, impressao = false }: { children: ReactNode; impressao?: boolean }) {
  const { data: sessao } = useSessao();
  const carregar = useServerFn(carregarDocumentos);
  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["documentos-restritos", sessao?.id, impressao],
    queryFn: () => carregar({ data: { impressao } }), enabled: !!sessao?.id,
    staleTime: 0, gcTime: 0, retry: false, refetchOnMount: "always",
  });
  if (impressao && sessao?.reuniao) return <p className="p-10">O acesso de reunião é somente leitura e não exporta documentos.</p>;
  if (isPending || isFetching) return <p className="p-8 text-ink-muted">Conferindo o acesso.</p>;
  if (isError || !data) return <SemAcesso motivo="Esta conta não tem permissão para abrir estes documentos. O acesso é restrito ao Admin e ao grupo Sócios." />;
  return <ProvedorConteudo value={data}>{children}</ProvedorConteudo>;
}