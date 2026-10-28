import { createFileRoute } from "@tanstack/react-router";
import { AberturaTela, Conteudo } from "@/components/mesa/partes";
import { Alternador, AvisoScore, Comparativo, Metodo } from "@/components/conteudo/Pareceres";
import { BotaoImprimir } from "@/components/conteudo/Acoes";
import { pareceres } from "@/lib/conteudo";

export const Route = createFileRoute("/_authenticated/mesa/pareceres/")({
  head: () => ({ meta: [{ title: "Pareceres · NEWE Mesa de Decisão" }, { name: "description", content: "Pareceres dos fornecedores com score de aderência de 0 a 10." }, { property: "og:title", content: "Pareceres · NEWE Mesa de Decisão" }, { property: "og:description", content: "Pareceres dos fornecedores com score de aderência de 0 a 10." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: PareceresTela,
});

function PareceresTela() {
  return (
    <>
      <AberturaTela numero="Pareceres" titulo="Pareceres dos fornecedores">{pareceres.referencia}</AberturaTela>
      <Conteudo>
        <AvisoScore />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Alternador />
          <BotaoImprimir to="/imprimir-pareceres" />
        </div>
        <p className="mt-2 text-sm text-ink-muted">Escolha um fornecedor para abrir o relatório.</p>
        <div className="mt-6"><Comparativo /></div>
        <Metodo />
      </Conteudo>
    </>
  );
}
