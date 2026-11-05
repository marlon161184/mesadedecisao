import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoNewe } from "@/components/newe/LogoNewe";
import type { Slide } from "@/lib/apresentacao";
import { cn } from "@/lib/utils";

/** Mantém o slide 1920x1080 e escala para caber no contêiner. */
export function SlideEscalado({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setEscala(Math.min(el.clientWidth / 1920, el.clientHeight / 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <div className="absolute left-1/2 top-1/2" style={{ width: 1920, height: 1080, marginLeft: -960, marginTop: -540, transform: `scale(${escala})`, transformOrigin: "center center" }}>
        {children}
      </div>
    </div>
  );
}

function Tabela({ t }: { t: NonNullable<Slide["tabela"]> }) {
  const num = new Set(t.numericas ?? []);
  return (
    <table className="w-full border-collapse slide-body">
      <thead>
        <tr className="border-b-2 border-line-strong">
          {t.colunas.map((c, i) => (
            <th key={i} className={cn("label-mono slide-caption px-3 py-3 text-left font-normal", num.has(i) && "text-right")}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {t.linhas.map((l, i) => (
          <tr key={i} className="border-b border-line">
            {l.map((c, j) => (
              <td key={j} className={cn("px-3 py-3 align-top", num.has(j) && "num whitespace-nowrap text-right", j === 0 && "font-medium", l.length >= 3 && j === l.length - 1 && !num.has(j) && "slide-caption")}>
                <span className="line-clamp-2">{c}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SlideView({ slide, n, total }: { slide: Slide; n: number; total: number }) {
  if (slide.tipo === "capa") {
    return (
      <div className="slide-content flex flex-col justify-between bg-amarelo p-[120px] text-preto">
        <LogoNewe variante="preto" height={96} comMargem={false} />
        <div>
          <p className="label-mono slide-body">NEWE · Mesa de Decisão</p>
          <h1 className="chamada slide-title-lg mt-8 max-w-[1500px]">{slide.titulo}</h1>
          {slide.subtitulo && <p className="slide-body-lg mt-10">{slide.subtitulo}</p>}
        </div>
        <p className="label-mono slide-chrome">Apresentação ao Conselho e aos sócios</p>
      </div>
    );
  }
  const temLeitura = !!slide.leitura?.length;
  return (
    <div className="slide-content flex flex-col bg-background text-foreground">
      <header className="flex h-[110px] shrink-0 items-center justify-between border-b border-line px-[80px]">
        <span className="label-mono slide-chrome text-ink-muted">{slide.secao}</span>
        <LogoNewe height={40} comMargem={false} />
      </header>
      <div className="px-[80px] pt-[40px]">
        <h2 className="chamada slide-title max-w-[1700px] line-clamp-2">{slide.titulo}</h2>
      </div>
      <div className={cn("grid min-h-0 flex-1 gap-[56px] px-[80px] pt-[36px]", temLeitura ? "grid-cols-[minmax(0,1fr)_620px]" : "grid-cols-1")}>
        <div className="min-h-0 space-y-[28px] overflow-hidden">
          {slide.tabela && <Tabela t={slide.tabela} />}
          {slide.colunas && (
            <div className={cn("grid gap-[40px]", slide.colunas.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {slide.colunas.map((c) => (
                <div key={c.titulo} className="border-t-2 border-line-strong pt-4">
                  <p className="label-mono slide-caption">{c.titulo}</p>
                  <ul className="slide-caption mt-3 space-y-2">
                    {c.itens.map((x, i) => <li key={i} className="line-clamp-3">{x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {slide.topicos && slide.topicos.length > 0 && (
            <ul className={cn("space-y-3 pl-8 list-disc", slide.tabela || slide.colunas ? "slide-caption" : "slide-body-lg")}>
              {slide.topicos.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
        {temLeitura && (
          <aside className="min-h-0 self-start border-l-4 border-amarelo bg-card p-[32px]">
            <p className="label-mono slide-chrome">Leitura guiada</p>
            <div className="slide-leitura mt-4 space-y-3">
              {slide.leitura!.map((f, i) => <p key={i}>{f}</p>)}
            </div>
          </aside>
        )}
      </div>
      <footer className="flex min-h-[80px] shrink-0 items-center justify-between gap-8 border-t border-line px-[80px] py-3">
        <div className="slide-caption min-w-0 font-medium text-flamboyant">
          {slide.rodape.slice(0, 2).map((r, i) => <p key={i} className="truncate">{r}</p>)}
        </div>
        <span className="label-mono slide-chrome text-ink-muted">{n}/{total}</span>
      </footer>
    </div>
  );
}
