import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aplicarTema, temaInicial, type Tema } from "@/lib/tema";

export function AlternarTema() {
  const [tema, setTema] = useState<Tema | null>(null);
  useEffect(() => setTema(temaInicial()), []);
  const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Ativar tema ${proximo}`}
      onClick={() => {
        aplicarTema(proximo);
        setTema(proximo);
      }}
    >
      {tema === "escuro" ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
    </Button>
  );
}
