export type Tema = "claro" | "escuro";

export function temaInicial(): Tema {
  if (typeof window === "undefined") return "claro";
  const salvo = localStorage.getItem("newe-tema");
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function aplicarTema(t: Tema) {
  document.documentElement.classList.toggle("dark", t === "escuro");
  localStorage.setItem("newe-tema", t);
}

/** Script inline que evita piscar o tema errado antes da hidratação. */
export const SCRIPT_TEMA = `(function(){try{var s=localStorage.getItem('newe-tema');var d=s?s==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
