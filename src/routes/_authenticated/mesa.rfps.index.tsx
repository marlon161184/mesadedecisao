import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mesa/rfps/")({
  beforeLoad: ({ search }) => { throw redirect({ to: "/mesa/rfps/$numero", params: { numero: "1" }, search: search as never }); },
});
