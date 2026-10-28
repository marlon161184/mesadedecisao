import pareceres from "@/data/pareceres.json";
import rfp1 from "@/data/rfp1.json";
import rfp2 from "@/data/rfp2.json";
import rfp3 from "@/data/rfp3.json";
import type { ConteudoDocumentos, Rfp } from "./conteudo";

export function lerDocumentos(): ConteudoDocumentos {
  return { pareceres, fornecedores: [...pareceres.fornecedores].sort((a, b) => a.ranking - b.ranking), rfps: [rfp1, rfp2, rfp3] as Rfp[] };
}