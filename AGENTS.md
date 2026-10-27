<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- All calculations (R1–R8) live in `src/lib/calculo.ts` with tests in `src/lib/calculo.test.ts`; screens must reuse them, never store computed values. Why: single source of truth.
- Roles live in `public.user_roles` (enum admin/socio/observador) checked via `has_role`/`is_member` security-definer functions in RLS. Why: avoid privilege escalation.
- Every domain table has an `auditoria_*` trigger writing to `log_auditoria`. Why: traceability of decisions.
- Partner scores are blind until a row exists in `revelacao` for the RFP (enforced by RLS). Why: independent voting.
- Brand primitives (Logo, RotuloMono, CartaoFio, FaixaSecao, SeloFase) live in `src/components/newe/brand.tsx`. Why: swap logo SVG in one place.
- Equalization (per proposal) lives in `src/lib/equalizacao.ts` + `src/lib/pontos.ts`; composition/simulator logic in `src/lib/composicao.ts`. Screens only render their results. Why: one tested path for every number.
- All Mesa screens read one cached dataset (`baseQuery` in `src/lib/base.ts`, key ["base"]); mutations invalidate that key. Why: small dataset, consistent recalculation.
- Mesa filters/simulation premises live in the URL, validated by `src/lib/filtros.ts` on the `/mesa` layout. Why: shareable, saved filters.
- AI drafts go through `src/lib/parecer.functions.ts` (server-only key) and receive only structured composition data. Why: no invented facts, key never in browser.
- Shared test fixture mirroring seed data lives in `src/test/fixtura.ts`. Why: totals requested by the client are asserted in tests.
