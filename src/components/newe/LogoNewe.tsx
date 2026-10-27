import { cn } from "@/lib/utils";
import logoPreto from "@/assets/logo-newe-preto.png.asset.json";
import logoLuz from "@/assets/logo-newe-luz.png.asset.json";

/**
 * Logo NEWE — lettering oficial.
 *
 * Ponto ÚNICO de troca da marca: os arquivos finais da Rebu substituem os dois
 * ponteiros em `src/assets/` (`logo-newe-preto.png` e `logo-newe-luz.png`) e
 * nenhuma tela precisa mudar.
 *
 * Regras da marca: nunca esticar, girar, sombrear ou contornar; altura mínima
 * de 25px; margem de segurança igual à largura da primeira letra E
 * (~0,4 da altura).
 *
 * `variante="auto"` escolhe pelo tema (preto no claro, luz no escuro) usando só
 * CSS, sem esperar a hidratação. Use `"preto"` ou `"luz"` quando a superfície
 * for fixa — painel amarelo do login, página de impressão do cenário.
 */
const LARGURA_OFICIAL = 1200;
const ALTURA_OFICIAL = 473;

export type VarianteLogo = "auto" | "preto" | "luz";

export function LogoNewe({
  variante = "auto",
  height = 32,
  comMargem = true,
  className,
}: {
  variante?: VarianteLogo;
  height?: number;
  /** Margem de segurança lateral. Desligue para alinhar a logo a um fio ou a um texto. */
  comMargem?: boolean;
  className?: string;
}) {
  const h = Math.max(25, height);
  const w = Math.round((h * LARGURA_OFICIAL) / ALTURA_OFICIAL);

  const imagem = (src: string, extra?: string) => (
    <img
      src={src}
      alt="NEWE"
      width={w}
      height={h}
      style={{ height: h, width: "auto" }}
      className={cn("block", extra)}
    />
  );

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={comMargem ? { padding: `0 ${h * 0.4}px` } : undefined}
    >
      {variante === "preto" && imagem(logoPreto.url)}
      {variante === "luz" && imagem(logoLuz.url)}
      {variante === "auto" && (
        <>
          {imagem(logoPreto.url, "dark:hidden")}
          {imagem(logoLuz.url, "hidden dark:block")}
        </>
      )}
    </span>
  );
}
