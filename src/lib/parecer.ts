/** Parecer técnico montado por regra a partir dos dados cadastrados e dos fatos calculados. */
import type { Base } from "./base";
import type { ResultadoComposicao } from "./composicao";
import { formatarBRL, formatarPct } from "./formato";

export function parecerAutomatico(base: Base, r: ResultadoComposicao): string {
  const blocos: string[] = [];
  for (const mc of r.modulos) {
    const cab = `${mc.modulo.codigo} · ${mc.modulo.nome}`;
    if (!mc.proposta || !mc.player) {
      blocos.push(`${cab}\nSem player: ${mc.opcao.tipo === "interno" ? `time interno NEWE (${mc.opcao.comentario || "sem comentário"})` : "a cotar"}. Cobertura 0%.`);
      continue;
    }
    const entrega = mc.itens.map((x) => `${x.item.descricao}${x.excluido ? " (fora do total por sobreposição)" : ""}`).join("; ") || "não informado";
    const reqs = base.requisitos.filter((q) => q.modulo_id === mc.modulo.id);
    const nao = reqs.filter((q) => {
      const c = base.coberturas.find((x) => x.proposta_id === mc.proposta!.id && x.requisito_id === q.id);
      return c?.nivel === 0;
    }).map((q) => q.descricao);
    const naoInf = reqs.filter((q) => {
      const c = base.coberturas.find((x) => x.proposta_id === mc.proposta!.id && x.requisito_id === q.id);
      return !c || c.nivel == null;
    }).map((q) => q.descricao);
    const obs = base.comentarios
      .filter((c) => c.proposta_id === mc.proposta!.id && (c.modulo_id === mc.modulo.id || c.modulo_id == null))
      .map((c) => c.texto).join(" ");
    blocos.push([
      `${cab}\nPlayer: ${mc.player.nome}. Valor na janela: ${formatarBRL(mc.total)}. Cobertura ${formatarPct(mc.cobertura.conservadora)} a ${formatarPct(mc.cobertura.otimista ?? mc.cobertura.conservadora)}.`,
      `Entrega: ${entrega}.`,
      `Não entrega: ${nao.join("; ") || "nada registrado como não coberto"}.`,
      naoInf.length ? `Não informado: ${naoInf.join("; ")}.` : "",
      `Observação técnica: ${obs || "não informado"}`,
    ].filter(Boolean).join("\n"));
  }
  const top = r.porPlayer[0];
  blocos.push([
    "Resumo da composição",
    `Total na janela: ${formatarBRL(r.total.central)}${r.total.eFaixa ? ` (faixa ${formatarBRL(r.total.min)} a ${formatarBRL(r.total.max)})` : ""}. Média mensal: ${formatarBRL(r.mediaMensal)}.`,
    r.compromisso ? `Compromisso total dos contratos: ${formatarBRL(r.compromisso.total)}.` : "",
    `Custo ajustado ao escopo: ${formatarBRL(r.ajustado.ajustado)}.`,
    r.veredito,
    top ? `Concentração: ${top.nome} com ${formatarPct(top.pct)} do valor.` : "",
    `Pontos de atenção: ${r.contagem.critico} crítico(s), ${r.contagem.alto} alto(s), ${r.contagem.medio} médio(s).`,
  ].filter(Boolean).join("\n"));
  return blocos.join("\n\n");
}

/** Somente dados estruturados vão para o modelo. */
export function dadosParaIA(base: Base, r: ResultadoComposicao) {
  return {
    modulos: r.modulos.map((mc) => ({
      modulo: `${mc.modulo.codigo} ${mc.modulo.nome}`,
      player: mc.player?.nome ?? (mc.opcao.tipo === "interno" ? "Time interno NEWE" : "a cotar"),
      valor_janela: Math.round(mc.total * 100) / 100,
      cobertura_conservadora: Math.round(mc.cobertura.conservadora * 1000) / 10,
      cobertura_otimista: mc.cobertura.otimista == null ? null : Math.round(mc.cobertura.otimista * 1000) / 10,
      itens: mc.itens.map((x) => ({ descricao: x.item.descricao, valor: Math.round(x.valor.central * 100) / 100, fora_do_total: x.excluido, incerteza: x.item.incerteza })),
      requisitos: base.requisitos.filter((q) => q.modulo_id === mc.modulo.id).map((q) => {
        const c = mc.proposta ? base.coberturas.find((x) => x.proposta_id === mc.proposta!.id && x.requisito_id === q.id) : undefined;
        return { requisito: q.descricao, essencial: q.criticidade === "essencial", nivel: c?.nivel ?? null, evidencia: c?.evidencia ?? "nao_informado", nota: c?.nota_tecnica ?? null };
      }),
      comentarios: mc.proposta ? base.comentarios.filter((c) => c.proposta_id === mc.proposta!.id && (c.modulo_id === mc.modulo.id || c.modulo_id == null)).map((c) => c.texto) : [],
    })),
    totais: {
      total_janela: r.total.central, faixa_min: r.total.min, faixa_max: r.total.max, media_mensal: r.mediaMensal,
      compromisso_contratos: r.compromisso?.total ?? null, custo_ajustado: r.ajustado.ajustado,
      cobertura_conservadora: r.cobertura.conservadora, cobertura_otimista: r.cobertura.otimista,
      bloqueios_essenciais: r.lacunas.length, eficiencia_pts_por_100mil: r.eficiencia,
      concentracao: r.porPlayer.map((p) => ({ player: p.nome, participacao: Math.round(p.pct * 1000) / 10 })),
    },
    pontos_de_atencao: r.pontos.map((p) => ({ codigo: p.codigo, severidade: p.severidade, texto: p.texto })),
  };
}

/** Parecer por regra de uma única proposta (propostas novas), a partir da análise já calculada. */
export function parecerDaProposta(base: Base, a: import("./equalizacao").AnaliseProposta, pontos: { severidade: string; texto: string }[]): string {
  const blocos = a.modulos.map((m) => {
    const reqs = base.requisitos.filter((q) => q.modulo_id === m.modulo.id);
    const cob = (q: { id: string }) => base.coberturas.find((x) => x.proposta_id === a.proposta.id && x.requisito_id === q.id);
    const nao = reqs.filter((q) => cob(q)?.nivel === 0).map((q) => q.descricao);
    const naoInf = reqs.filter((q) => cob(q)?.nivel == null).map((q) => q.descricao);
    return [
      `${m.modulo.codigo} · ${m.modulo.nome}`,
      m.total ? `Valor na janela: ${formatarBRL(m.total.central)}. Cobertura ${formatarPct(m.cobertura.conservadora)} a ${formatarPct(m.cobertura.otimista ?? m.cobertura.conservadora)}.` : "Não oferece este módulo.",
      `Entrega: ${m.itens.map((x) => x.item.descricao).join("; ") || "não informado"}.`,
      `Não entrega: ${nao.join("; ") || "nada registrado como não coberto"}.`,
      naoInf.length ? `Não informado: ${naoInf.join("; ")}.` : "",
    ].filter(Boolean).join("\n");
  });
  blocos.push([
    "Resumo",
    `${a.player.nome} V${a.proposta.versao}. Total na janela: ${formatarBRL(a.total.central)}${a.total.eFaixa ? ` (faixa ${formatarBRL(a.total.min)} a ${formatarBRL(a.total.max)})` : ""}.`,
    `Cobertura ${formatarPct(a.cobertura.conservadora)} a ${formatarPct(a.cobertura.otimista ?? a.cobertura.conservadora)}. Bloqueios: ${a.bloqueios.length}.`,
    pontos.length ? `Pontos de atenção: ${pontos.map((p) => p.texto).join(" ")}` : "Pontos de atenção: nenhum registrado.",
  ].join("\n"));
  return blocos.join("\n\n");
}

export function dadosPropostaParaIA(base: Base, a: import("./equalizacao").AnaliseProposta, pontos: { severidade: string; texto: string }[]) {
  return {
    player: a.player.nome, versao: a.proposta.versao, status: a.proposta.status,
    total_janela: a.total, cobertura: a.cobertura, bloqueios: a.bloqueios.map((b) => b.requisito.descricao),
    modulos: a.modulos.map((m) => ({ codigo: m.modulo.codigo, nome: m.modulo.nome, total: m.total, cobertura: m.cobertura, itens: m.itens.map((x) => x.item.descricao),
      nao_coberto: base.requisitos.filter((q) => q.modulo_id === m.modulo.id && base.coberturas.find((c) => c.proposta_id === a.proposta.id && c.requisito_id === q.id)?.nivel === 0).map((q) => q.descricao) })),
    entregas: a.entregas.map((e) => ({ categoria: e.categoria, quantidade_mes: e.quantidade_mes, teto: e.e_teto })),
    pontos,
  };
}
