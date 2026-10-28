import { Link } from "@tanstack/react-router";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSessao } from "@/components/newe/Moldura";
import { rfpEmTexto, useModoParecer, type Rfp } from "@/lib/conteudo";

/** Impressão e cópia ficam ocultas na sessão de reunião (somente leitura, não exporta). */
export function BotaoImprimir(p: { to: "/imprimir-pareceres"; slug?: string; rotulo?: string } | { to: "/imprimir-rfp/$numero"; numero: string; rotulo?: string }) {
  const { data: s } = useSessao();
  const [modo] = useModoParecer();
  if (!s || s.reuniao) return null;
  const conteudo = <><Printer className="size-4" strokeWidth={1.5} />{p.rotulo ?? "Imprimir"}</>;
  return (
    <Button asChild variant="outline" className="min-h-11">
      {p.to === "/imprimir-pareceres"
        ? <Link to="/imprimir-pareceres" search={{ slug: p.slug, modo }} target="_blank">{conteudo}</Link>
        : <Link to="/imprimir-rfp/$numero" params={{ numero: p.numero }} target="_blank">{conteudo}</Link>}
    </Button>
  );
}

export function BotaoCopiar({ r }: { r: Rfp }) {
  const { data: s } = useSessao();
  if (!s || s.reuniao) return null;
  return (
    <Button variant="outline" className="min-h-11" onClick={async () => {
      try { await navigator.clipboard.writeText(rfpEmTexto(r)); toast.success("Texto do RFP copiado."); }
      catch { toast.error("Não conseguimos copiar. Tente de novo."); }
    }}><Copy className="size-4" strokeWidth={1.5} />Copiar texto</Button>
  );
}
