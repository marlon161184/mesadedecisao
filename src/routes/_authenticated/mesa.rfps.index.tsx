import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mesa/rfps/")({
  head: () => ({ meta: [{ title: "RFPs · NEWE Mesa de Decisão" }, { name: "description", content: "Documentos de requisitos dos três RFPs." }, { property: "og:title", content: "RFPs · NEWE Mesa de Decisão" }, { property: "og:description", content: "Documentos de requisitos dos três RFPs." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ search }) => { throw redirect({ to: "/mesa/rfps/$numero", params: { numero: "1" }, search: search as never }); },
});
