import { usePareceresPublicados } from "@/components/propostas/PareceresNovos";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize, Printer, X } from "lucide-react";
import { baseQuery, baseVazia } from "@/lib/base";
import { decisaoQuery } from "@/lib/decisao-dados";
import { validarFiltros, type Filtros } from "@/lib/filtros";
import { montarApresentacao } from "@/lib/apresentacao";
import { estadoDecisao } from "@/lib/leitura";
import { modeloDecisao } from "@/components/decisao/useDecisao";
import { SlideEscalado, SlideView } from "@/components/apresentacao/SlideView";
import { SemAcesso } from "@/components/mesa/SemAcesso";
import { useSessao } from "@/components/newe/Moldura";
import { usePermissaoConteudo } from "@/components/conteudo/AcessoConteudo";
import { carregarDocumentos } from "@/lib/conteudo.functions";
import { useInatividade } from "@/hooks/use-inatividade";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Busca = Filtros & { slide?: number | undefined };

export const Route = createFileRoute("/_authenticated/mesa_/apresentacao")({
  validateSearch: (s: Record<string, unknown>): Busca => {
    const n = Number(s["slide"]);
    return { ...validarFiltros(s), slide: Number.isInteger(n) && n > 0 ? n : undefined };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(baseQuery),
  head: () => ({
    meta: [
      { title: "Apresentação ao Conselho · NEWE Mesa de Decisão" },
      { name: "description", content: "Slides montados a partir dos dados vivos da Mesa." },
      { property: "og:title", content: "Apresentação ao Conselho · NEWE Mesa de Decisão" },
      { property: "og:description", content: "Slides montados a partir dos dados vivos da Mesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { data: base } = useSuspenseQuery(baseQuery);
  if (baseVazia(base)) return <SemAcesso />;
  return <Apresentacao />;
}

function Apresentacao() {
  useInatividade();
  const busca = Route.useSearch();
  const navigate = useNavigate();
  const { data: base } = useSuspenseQuery(baseQuery);
  const { data: sessao } = useSessao();
  const { data: d } = useQuery(decisaoQuery);
  const { data: permissao } = usePermissaoConteudo();
  const carregar = useServerFn(carregarDocumentos);
  const { data: documentos } = useQuery({
    queryKey: ["documentos-restritos", sessao?.id, false],
    queryFn: () => carregar({ data: { impressao: false } }),
    enabled: !!sessao?.id && !!permissao?.leitura,
    staleTime: 0, gcTime: 0, retry: false,
  });

  const { data: publicados } = usePareceresPublicados();
  const { slide: _s, ...filtros } = busca;
  const slides = useMemo(() => {
    const decisoes = d ? base.rfps.filter((r) => base.modulos.some((m) => m.rfp_id === r.id)).map((r) => {
      const m = modeloDecisao(base, d, r.numero);
      return m.propostas.length ? estadoDecisao(m, d.socios.length) : null;
    }).filter((x): x is NonNullable<typeof x> => !!x) : [];
    return montarApresentacao({ base, filtros: filtros as Filtros, decisoes, documentos: documentos ?? null, pareceresPublicados: publicados ?? [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, d, documentos, publicados, JSON.stringify(filtros)]);

  const total = slides.length;
  const atual = Math.min(Math.max((busca.slide ?? 1) - 1, 0), total - 1);
  const [indice, setIndice] = useState(false);
  const [cursor, setCursor] = useState(true);
  const toque = useRef<number | null>(null);
  const podeExportar = !sessao?.reuniao;

  const ir = useCallback((i: number) => {
    const n = Math.min(Math.max(i, 0), total - 1);
    navigate({ to: ".", search: ((p: Record<string, unknown>) => ({ ...p, slide: n + 1 })) as never, replace: true } as never);
  }, [navigate, total]);
  const sair = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    navigate({ to: "/mesa/visao", search: ((p: Record<string, unknown>) => ({ ...p, slide: undefined })) as never } as never);
  }, [navigate]);
  const telaCheia = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  useEffect(() => {
    const s = slides[atual];
    if (s) document.title = `${atual + 1}/${total} · ${s.titulo}`;
  }, [atual, total, slides]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); ir(atual + 1); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); ir(atual - 1); }
      else if (e.key === "Home") ir(0);
      else if (e.key === "End") ir(total - 1);
      else if (e.key === "f" || e.key === "F") void telaCheia();
      else if (e.key === "g" || e.key === "G") setIndice((v) => !v);
      else if (e.key === "Escape") { if (indice) setIndice(false); else if (!document.fullscreenElement) sair(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [atual, total, ir, sair, indice]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => { setCursor(true); clearTimeout(t); t = setTimeout(() => setCursor(false), 2500); };
    mover();
    window.addEventListener("mousemove", mover);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", mover); };
  }, []);

  const slide = slides[atual]!;
  return (
    <>
      <div className={cn("apresentacao-tela fixed inset-0 z-50 flex flex-col bg-preto", !cursor && "cursor-none")}>
        <div
          className="relative min-h-0 flex-1"
          onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const x0 = toque.current; const x1 = e.changedTouches[0]?.clientX;
            if (x0 != null && x1 != null && Math.abs(x1 - x0) > 50) ir(atual + (x1 < x0 ? 1 : -1));
            toque.current = null;
          }}
        >
          <SlideEscalado className="h-full w-full">
            <button type="button" aria-label="Próximo slide" className="block text-left" onClick={() => ir(atual + 1)}>
              <SlideView slide={slide} n={atual + 1} total={total} />
            </button>
          </SlideEscalado>
        </div>
        <nav aria-label="Controles da apresentação" className={cn("flex items-center justify-between gap-2 border-t border-cinza-quente bg-preto px-3 py-2 text-luz transition-opacity", !cursor && "opacity-0 focus-within:opacity-100")}>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-luz hover:bg-luz/10 hover:text-luz" aria-label="Slide anterior" onClick={() => ir(atual - 1)} disabled={atual === 0}><ChevronLeft /></Button>
            <span className="label-mono min-w-16 text-center" aria-live="polite">{atual + 1}/{total}</span>
            <Button variant="ghost" size="icon" className="text-luz hover:bg-luz/10 hover:text-luz" aria-label="Próximo slide" onClick={() => ir(atual + 1)} disabled={atual === total - 1}><ChevronRight /></Button>
          </div>
          <span className="hidden truncate text-sm md:block">{slide.secao}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-luz hover:bg-luz/10 hover:text-luz" onClick={() => setIndice(true)}><LayoutGrid className="size-4" /> <span className="hidden sm:inline">Índice</span></Button>
            {podeExportar && (
              <Button variant="ghost" size="sm" className="text-luz hover:bg-luz/10 hover:text-luz" onClick={() => window.print()}><Printer className="size-4" /> <span className="hidden sm:inline">Imprimir / salvar PDF</span></Button>
            )}
            <Button variant="ghost" size="icon" className="text-luz hover:bg-luz/10 hover:text-luz" aria-label="Tela cheia (F)" onClick={() => void telaCheia()}><Maximize className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="text-luz hover:bg-luz/10 hover:text-luz" aria-label="Sair da apresentação (Esc)" onClick={sair}><X className="size-4" /></Button>
          </div>
        </nav>
        {indice && (
          <div role="dialog" aria-label="Índice dos slides" className="absolute inset-0 z-10 overflow-y-auto bg-preto p-4 text-luz md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="label-mono">Índice · {total} slides</p>
              <Button variant="ghost" size="icon" className="text-luz hover:bg-luz/10 hover:text-luz" aria-label="Fechar índice" onClick={() => setIndice(false)}><X /></Button>
            </div>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slides.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => { ir(i); setIndice(false); }}
                    className={cn("flex min-h-14 w-full gap-3 border border-cinza-quente p-3 text-left hover:bg-luz/10", i === atual && "border-amarelo")}>
                    <span className="label-mono w-8 shrink-0 text-amarelo">{i + 1}</span>
                    <span className="min-w-0"><span className="label-mono block text-luz/60">{s.secao}</span><span className="line-clamp-2 text-sm">{s.titulo}</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {podeExportar && (
        <div className="apresentacao-impressao" aria-hidden>
          {slides.map((s, i) => <SlideView key={s.id} slide={s} n={i + 1} total={total} />)}
        </div>
      )}
    </>
  );
}
