import { createFileRoute, redirect } from "@tanstack/react-router";

// Todo o app exige login: a raiz leva ao início protegido.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
  head: () => ({
    meta: [
      { title: "NEWE · Mesa de Decisão" },
      { name: "description", content: "Acesso privado da Mesa de Decisão NEWE." },
      { property: "og:title", content: "NEWE · Mesa de Decisão" },
      { property: "og:description", content: "Acesso privado da Mesa de Decisão NEWE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
