import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Contêiner único para tabelas.
 * - "auto": no celular, tabelas com mais de 3 colunas viram cartões (rótulo mono acima de cada valor).
 * - "rolagem": comparação lado a lado; rola dentro do contêiner, primeira coluna fixa,
 *   fio fino na borda direita indica que há mais colunas.
 * Os rótulos dos cartões são copiados do cabeçalho da tabela (data-rotulo).
 */
export function TabelaAdaptavel({
  modo = "auto",
  rotulo,
  className,
  children,
}: {
  modo?: "auto" | "rolagem" | "cartoes";
  rotulo?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [colunas, setColunas] = useState(0);
  const [continua, setContinua] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setContinua(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const rotular = () => {
      const t = el.querySelector("table");
      if (!t) return;
      const linhas = t.querySelectorAll("thead tr");
      const ultima = linhas[linhas.length - 1];
      const nomes: string[] = [];
      ultima?.querySelectorAll("th, td").forEach((c) => {
        const n = (c as HTMLTableCellElement).colSpan || 1;
        for (let i = 0; i < n; i++) nomes.push(c.textContent?.trim() ?? "");
      });
      setColunas(nomes.length);
      t.querySelectorAll(":scope > tbody > tr, :scope > tfoot > tr").forEach((tr) => {
        let i = 0;
        Array.from(tr.children).forEach((c) => {
          const r = nomes[i] ?? "";
          if (c.getAttribute("data-rotulo") !== r) c.setAttribute("data-rotulo", r);
          i += (c as HTMLTableCellElement).colSpan || 1;
        });
      });
      medir();
    };
    rotular();
    const mo = new MutationObserver(rotular);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    el.addEventListener("scroll", medir, { passive: true });
    return () => {
      mo.disconnect();
      ro.disconnect();
      el.removeEventListener("scroll", medir);
    };
  }, []);

  const cartoes = modo === "cartoes" || (modo === "auto" && colunas > 3);
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <div
        ref={ref}
        className="tabela-adaptavel w-full overflow-x-auto"
        data-cartoes={cartoes ? "" : undefined}
        data-rolagem={modo === "rolagem" ? "" : undefined}
        tabIndex={continua ? 0 : undefined}
        role={continua ? "region" : undefined}
        aria-label={continua ? `${rotulo ?? "Tabela"}, role para o lado para ver mais colunas` : undefined}
      >
        {children}
      </div>
      {continua && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-line-strong" />
          <p aria-hidden className="label-mono mt-2 text-right text-ink-muted">Role para o lado</p>
        </>
      )}
    </div>
  );
}
