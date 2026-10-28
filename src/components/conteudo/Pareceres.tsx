import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { RotuloMono } from "@/components/newe/brand";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { COR, pesoDe, umaCasa, useModoParecer, type Fornecedor } from "@/lib/conteudo";
import { useConteudo } from "./AcessoConteudo";
import { cn } from "@/lib/utils";

export function SeloFit({ nivel }: { nivel: string }) {
  return <span className="label-mono inline-block border border-line-strong bg-amarelo px-2 py-0.5 text-preto">{nivel}</span>;
}

export function AvisoScore() {
  return (
    <p className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-ink-muted">
      O score é uma régua de decisão. Todas as coberturas são declaradas e nenhum portão foi validado.
    </p>
  );
}

export function Alternador() {
  const [modo, set] = useModoParecer();
  const op = (m: "objetivo" | "pragmatica", r: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={modo === m}
      onClick={() => set(m)}
      className={cn("min-h-11 flex-1 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus sm:flex-none",
        modo === m ? "bg-amarelo text-preto" : "text-foreground hover:bg-muted")}
    >{r}</button>
  );
  return (
    <div role="radiogroup" aria-label="Bloco final dos pareceres" className="inline-flex w-full border border-line-strong sm:w-auto">
      {op("objetivo", "Parecer objetivo")}
      {op("pragmatica", "Conclusão pragmática")}
    </div>
  );
}

export function CartaoFornecedor({ f, link = true }: { f: Fornecedor; link?: boolean }) {
  const cor = COR[f.cor];
  const corpo = (
    <div className={cn("h-full border border-line border-t-4 bg-card p-4", cor?.border)}>
      <div className="flex items-center gap-2">
        <span className={cn("size-3 shrink-0", cor?.bg)} aria-hidden />
        <RotuloMono>#{f.ranking}</RotuloMono>
      </div>
      <h3 className="chamada mt-2 text-xl">{f.nome}</h3>
      <p className="num mt-3 text-5xl leading-none">{umaCasa(f.score)}</p>
      <p className="num mt-1 text-xs text-ink-muted">sem desconto: {umaCasa(f.scoreSemDesconto)}</p>
      <div className="mt-3 h-2 w-full border border-line" aria-hidden>
        <div className={cn("h-full", cor?.bg)} style={{ width: `${f.score * 10}%` }} />
      </div>
      <div className="mt-3"><SeloFit nivel={f.nivelFit} /></div>
      <p className="mt-2 text-sm">{f.fitFrase}</p>
    </div>
  );
  if (!link) return corpo;
  return (
    <Link to="/mesa/pareceres/$slug" params={{ slug: f.slug }} search={true as never} className="block h-full hover:opacity-90 focus-visible:outline-2 focus-visible:outline-focus" aria-label={`Relatório de ${f.nome}`}>
      {corpo}
    </Link>
  );
}

export function Comparativo({ link = true }: { link?: boolean }) {
  const { fornecedores } = useConteudo();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {fornecedores.map((f) => <CartaoFornecedor key={f.slug} f={f} link={link} />)}
    </div>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens?.length) return null;
  return (
    <section className="mt-6">
      <h3 className="label-mono ">{titulo}</h3>
      <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
        {itens.map((i, k) => <li key={k} className="flex gap-2"><span className="text-ink-muted">·</span><span>{i}</span></li>)}
      </ul>
    </section>
  );
}

function Dado({ k, children }: { k: string; children: ReactNode }) {
  return <div className="border border-line p-3"><RotuloMono as="p">{k}</RotuloMono><p className="mt-1 text-sm">{children}</p></div>;
}

export function BlocoFinal({ f, modo }: { f: Fornecedor; modo: "objetivo" | "pragmatica" }) {
  return (
    <section className="mt-8 border border-line-strong p-4 md:p-6" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="label-mono ">{modo === "objetivo" ? "Parecer objetivo" : "Conclusão pragmática"}</h3>
        <SeloFit nivel={f.nivelFit} />
      </div>
      {modo === "objetivo" ? (
        <>
          <p className="mt-3">{f.objetivo.resumo}</p>
          <ul className="mt-3 space-y-1.5">{f.objetivo.comentarios.map((c, k) => <li key={k} className="flex gap-2"><span className="text-ink-muted">·</span><span>{c}</span></li>)}</ul>
        </>
      ) : (
        <>
          <p className="mt-3">{f.pragmatica.conclusao}</p>
          <h4 className="label-mono mt-4 block">Condições para avançar</h4>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">{f.pragmatica.condicoes.map((c, k) => <li key={k}>{c}</li>)}</ol>
          <p className="mt-4 border-l-4 border-amarelo bg-muted p-3 font-medium">{f.pragmatica.recomendacao}</p>
        </>
      )}
    </section>
  );
}

export function Relatorio({ f, modo }: { f: Fornecedor; modo: "objetivo" | "pragmatica" }) {
  const { pareceres } = useConteudo();
  const cor = COR[f.cor];
  return (
    <article className="max-w-4xl">
      <header className={cn("border-l-4 pl-4", cor?.border)}>
        <h2 className="chamada text-3xl">{f.nome}</h2>
        <p className="mt-1 text-ink-muted">{f.rfp}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="num text-3xl">{umaCasa(f.score)}</span>
          <span className="num text-xs text-ink-muted">sem desconto: {umaCasa(f.scoreSemDesconto)}</span>
          <SeloFit nivel={f.nivelFit} />
        </div>
      </header>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Dado k="Proposta">{f.proposta.versao} · {f.proposta.data}</Dado>
        <Dado k="Total">{f.proposta.total}</Dado>
        <Dado k="Contrato · validade">{f.proposta.contrato} · {f.proposta.validade}</Dado>
        <Dado k="Cobertura conservadora"><span className="num">{umaCasa(f.cobertura.conservadora)}%</span></Dado>
        <Dado k="Cobertura otimista"><span className="num">{umaCasa(f.cobertura.otimista)}%</span></Dado>
        <Dado k="Essenciais">{f.cobertura.essenciais}</Dado>
      </div>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-b border-line-strong"><th className="label-mono py-2 text-left font-normal">Componente</th><th className="label-mono py-2 text-right font-normal">Peso</th><th className="label-mono py-2 text-right font-normal">Nota</th></tr></thead>
        <tbody>
          {f.componentes.map((c) => (
            <tr key={c.nome} className="border-b border-line">
              <td className="py-2 pr-2">{c.nome}</td>
              <td className="num py-2 text-right">{pesoDe(pareceres, c.nome) ?? "—"}%</td>
              <td className="num py-2 text-right">{umaCasa(c.nota)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Lista titulo="Pontos fortes" itens={f.forcas} />
      <Lista titulo="Pontos fracos" itens={f.fraquezas} />
      <Lista titulo="Cobertas" itens={f.cobertas} />
      <Lista titulo="Parcialmente cobertas" itens={f.parciais} />
      <Lista titulo="Não cobertas" itens={f.naoCobertas} />
      <Lista titulo="Pontos de atenção" itens={f.atencao} />
      <BlocoFinal f={f} modo={modo} />
    </article>
  );
}

export function MetodoConteudo() {
  const { pareceres } = useConteudo();
  const m = pareceres.metodo;
  return (
    <div className="max-w-4xl">
      <p>{m.intro}</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead><tr className="border-b border-line-strong"><th className="label-mono py-2 text-left font-normal">Componente</th><th className="label-mono py-2 text-right font-normal">Peso</th><th className="label-mono py-2 pl-3 text-left font-normal">Regra</th></tr></thead>
        <tbody>{m.componentes.map((c) => <tr key={c.nome} className="border-b border-line align-top"><td className="py-2 pr-2">{c.nome}</td><td className="num py-2 text-right">{c.peso}%</td><td className="py-2 pl-3">{c.regra}</td></tr>)}</tbody>
      </table>
      <h4 className="label-mono mt-5 block">Faixas de fit</h4>
      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">{m.faixas.map((x) => <li key={x.fit} className="flex justify-between border-b border-line py-1"><span>{x.fit}</span><span className="num">{x.faixa}</span></li>)}</ul>
      <h4 className="label-mono mt-5 block">Ressalvas</h4>
      <ul className="mt-2 space-y-1.5">{m.ressalvas.map((r, k) => <li key={k} className="flex gap-2"><span className="text-ink-muted">·</span><span>{r}</span></li>)}</ul>
    </div>
  );
}

export function Metodo() {
  return (
    <Collapsible className="mt-10 border-t border-line-strong pt-4">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between text-left focus-visible:outline-2 focus-visible:outline-focus">
        <h2 className="chamada text-2xl">Como o score é calculado</h2>
        <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3"><MetodoConteudo /></CollapsibleContent>
    </Collapsible>
  );
}
