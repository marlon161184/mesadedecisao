import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inicio")({
  beforeLoad: () => {
    throw redirect({ to: "/mesa/visao", search: { rfp: 2 } as never });
  },
});
