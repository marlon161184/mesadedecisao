import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { baseQuery, type Base } from "@/lib/base";
import { decisaoQuery, type DadosDecisao } from "@/lib/decisao-dados";
import { avaliarVotacao, divergencias, mediasPorCriterio, type Decisao, type Regra, type StatusEtapa } from "@/lib/decisao";

export function propostasDoRfp(base: Base, rfpId: string) {
  const mods = new Set(base.modulos.filter((m) => m.rfp_id === rfpId).map((m) => m.id));
  const ids = new Set(base.itens.filter((i) => i.modulo_id && mods.has(i.modulo_id)).map((i) => i.proposta_id));
  return base.propostas.filter((p) => ids.has(p.id));
}

export const nomeProposta = (base: Base, propostaId: string) => {
  const p = base.propostas.find((x) => x.id === propostaId);
  return base.players.find((x) => x.id === p?.player_id)?.nome ?? "Proposta";
};
export const nomePessoa = (base: Base, id: string) => base.perfis.find((p) => p.id === id)?.nome ?? "Sócio";

export function modeloDecisao(base: Base, d: DadosDecisao, rfpNumero: number) {
  const rfp = rfpOuPrimeiro(base, rfpNumero);
  const trilha = d.trilhas.find((t) => t.rfp_id === rfp.id) ?? null;
  const propostas = propostasDoRfp(base, rfp.id);
  const criterios = base.criterios.filter((c) => c.rfp_id === rfp.id).map((c) => ({ id: c.id, nome: c.nome, peso: Number(c.peso) }));
  const portoes = base.portoes.filter((p) => p.rfp_id === rfp.id);
  const resultado = (portaoId: string, propostaId: string) =>
    base.portaoResultados.find((r) => r.portao_id === portaoId && r.proposta_id === propostaId) ?? null;
  const reprovadas = new Set(propostas.filter((p) => portoes.some((g) => resultado(g.id, p.id)?.resultado === "reprova")).map((p) => p.id));
  const elegiveis = propostas.filter((p) => !reprovadas.has(p.id));
  const perguntas = base.perguntas.filter((q) => q.rfp_id === rfp.id);
  const pendentesPerguntas = perguntas.flatMap((q) => propostas
    .filter((p) => !base.respostas.some((r) => r.pergunta_id === q.id && r.proposta_id === p.id && ((r.resposta ?? "").trim() || r.sem_resposta)))
    .map((p) => ({ q, p })));
  const naoValidadas = propostas.filter((p) => p.status !== "validada");
  const revelado = d.revelacoes.some((r) => r.rfp_id === rfp.id);
  const critIds = new Set(criterios.map((c) => c.id));
  const notasRfp = d.notas.filter((n) => critIds.has(n.criterio_id));
  const esperadasPorSocio = criterios.length * elegiveis.length;
  const envios = d.envios[rfp.id] ?? [];
  const enviaram = envios.filter((e) => e.notas >= esperadasPorSocio && esperadasPorSocio > 0).map((e) => e.socio_id);
  const minhasNotas = notasRfp.filter((n) => n.socio_id === d.eu.id);
  const medias = revelado ? mediasPorCriterio(notasRfp) : {};
  const divs = revelado ? divergencias(notasRfp) : [];
  const candidato = base.cenarios.find((c) => c.id === trilha?.cenario_candidato) ?? null;
  const premortes = candidato ? d.premortes.filter((p) => p.cenario_id === candidato.id) : [];
  const votos = candidato ? d.votos.filter((v) => v.cenario_id === candidato.id) : [];
  const votacao = avaliarVotacao((trilha?.regra_decisao ?? "unanimidade") as Regra,
    votos.map((v) => ({ decisao: v.decisao as Decisao, justificativa: v.justificativa })), d.socios.length);
  const atas = d.atas.filter((a) => a.rfp_id === rfp.id);
  const ataAtual = atas[atas.length - 1] ?? null;

  const ePapel = (p: string) => d.eu.papeis.includes(p as never);
  const s1: StatusEtapa = propostas.length === 0 ? "aguardando" : naoValidadas.length || pendentesPerguntas.length ? "em_andamento" : "concluida";
  const portoesPendentes = propostas.flatMap((p) => portoes.filter((g) => (resultado(g.id, p.id)?.resultado ?? "pendente") === "pendente").map((g) => ({ g, p })));
  const s2: StatusEtapa = s1 !== "concluida" ? "bloqueada" : portoesPendentes.length ? "em_andamento" : "concluida";
  const s3: StatusEtapa = s2 !== "concluida" ? "bloqueada" : revelado ? "concluida" : trilha?.pontuacao_aberta ? "em_andamento" : "aguardando";
  const s4: StatusEtapa = s3 === "bloqueada" ? "bloqueada" : revelado ? "concluida" : trilha?.pontuacao_aberta ? "em_andamento" : "bloqueada";
  const s5: StatusEtapa = revelado ? "concluida" : "bloqueada";
  const s6: StatusEtapa = !revelado ? "bloqueada" : trilha?.votacao_encerrada ? "concluida" : trilha?.votacao_aberta || candidato ? "em_andamento" : "aguardando";
  const s7: StatusEtapa = !trilha?.votacao_encerrada ? "bloqueada" : ataAtual?.status === "aprovada" ? "concluida" : "em_andamento";

  return {
    rfp, trilha, propostas, elegiveis, reprovadas, criterios, portoes, resultado, perguntas, pendentesPerguntas, naoValidadas,
    revelado, notasRfp, minhasNotas, medias, divs, envios, enviaram, esperadasPorSocio, candidato, premortes, votos, votacao,
    atas, ataAtual, portoesPendentes,
    reuniao: d.eu.reuniao, admin: ePapel("admin"), socio: ePapel("socio"), // Sem papel de Admin/Sócio (Observador ou sessão de reunião): só leitura, sem exportação.
    observador: !ePapel("admin") && !ePapel("socio"),
    etapas: [s1, s2, s3, s4, s5, s6, s7] as StatusEtapa[],
  };
}
export type ModeloDecisao = ReturnType<typeof modeloDecisao>;

export function useDecisao(rfpNumero: number) {
  const { data: base } = useSuspenseQuery(baseQuery);
  const { data: d } = useSuspenseQuery(decisaoQuery);
  const m = useMemo(() => modeloDecisao(base, d, rfpNumero), [base, d, rfpNumero]);
  return { base, d, m };
}

export const ROTULO_STATUS: Record<StatusEtapa, string> = {
  concluida: "Concluída", em_andamento: "Em andamento", bloqueada: "Bloqueada", aguardando: "Aguardando",
};
