/** CSV simples com separador ";" (padrão brasileiro) e aspas. */
export function paraCsv(linhas: Record<string, unknown>[], colunas: string[]): string {
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => esc(l[c])).join(";"))].join("\n");
}

export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  const t = texto.replace(/^\uFEFF/, "");
  const sep = (t.split("\n")[0] ?? "").includes(";") ? ";" : ",";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((x) => x !== "")) linhas.push(linha);
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((c, i) => [c.trim(), l[i] ?? ""])));
}

export function baixar(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
