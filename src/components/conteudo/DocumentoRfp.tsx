import { ehCodigo, seloCelula, type Bloco, type Rfp } from "@/lib/conteudo";
import { cn } from "@/lib/utils";

function Selo({ t }: { t: "Eliminatório" | "Essencial" }) {
  return (
    <span className={cn("label-mono ml-1 inline-block border px-1.5 py-0.5 text-[0.65rem]",
      t === "Eliminatório" ? "border-terracota bg-terracota text-preto" : "border-line-strong")}>{t}</span>
  );
}

function Tabela({ b }: { b: Extract<Bloco, { tipo: "tabela" }> }) {
  return (
    <div className="my-5 max-h-[70vh] overflow-auto border border-line print:max-h-none print:overflow-visible">
      <table className="w-full min-w-[36rem] border-collapse text-sm print:min-w-0">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b border-line-strong">
            {b.cabecalho.map((h) => <th key={h} className="label-mono px-3 py-2 text-left align-bottom font-normal">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {b.linhas.map((l, i) => (
            <tr key={i} className={cn("border-b border-line align-top", i % 2 === 1 && "bg-muted/40")}>
              {l.map((c, j) => {
                const col = b.cabecalho[j] ?? "";
                const selo = seloCelula(col, c);
                return (
                  <td key={j} className={cn("px-3 py-2", ehCodigo(col) && "font-mono whitespace-nowrap")}>
                    {selo ? <Selo t={selo} /> : c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BlocoRfp({ b }: { b: Bloco }) {
  switch (b.tipo) {
    case "p": return <p className="my-3">{b.texto}</p>;
    case "destaque": return <p className="my-5 border-l-4 border-amarelo bg-muted/50 px-4 py-3">{b.texto}</p>;
    case "ul": return <ul className="my-3 list-disc space-y-1.5 pl-5">{b.itens.map((i, k) => <li key={k}>{i}</li>)}</ul>;
    case "ol": return <ol className="my-3 list-decimal space-y-1.5 pl-5">{b.itens.map((i, k) => <li key={k}>{i}</li>)}</ol>;
    case "tabela": return <Tabela b={b} />;
  }
}

export function CorpoRfp({ r }: { r: Rfp }) {
  return (
    <article className="max-w-3xl text-base leading-relaxed">
      <h1 className="chamada text-3xl md:text-4xl">{r.titulo}</h1>
      <p className="mt-2 text-lg">{r.subtitulo}</p>
      <p className="label-mono mt-2 text-ink-muted">{r.versao}</p>
      <p className="mt-6 border border-line-strong bg-muted/40 p-4 text-lg">{r.resumo}</p>
      {r.secoes.map((s) => (
        <section key={s.id} id={`sec-${s.id}`} className="mt-10 scroll-mt-24 break-inside-avoid-page">
          <h2 className="chamada border-b border-line pb-2 text-2xl">{s.titulo}</h2>
          {s.blocos.map((b, k) => <BlocoRfp key={k} b={b} />)}
        </section>
      ))}
    </article>
  );
}
