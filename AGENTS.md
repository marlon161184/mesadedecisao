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
- Decision-track data (trilha, notas, pré-mortem, votos, atas, aceites, arquivos) loads via `decisaoQuery` (key ["decisao"]) in `src/lib/decisao-dados.ts`; rules (médias, divergência, sensibilidade, votação, hash) live in `src/lib/decisao.ts` with tests. Why: blind data is RLS-filtered per user and must not be mixed into the shared base cache.
- Approved atas are immutable via DB trigger; revisions insert a new row with `versao_anterior` + justification. Why: decisions must be tamper-evident.
- Every table renders inside `TabelaAdaptavel` (`src/components/newe/TabelaAdaptavel.tsx`, used by ui `Table`): "auto" turns >3 columns into cards on phones, "rolagem" keeps side-by-side comparison scrolling inside its box with a fixed first column. Why: no page-level horizontal scroll on phones.
- Below 1024 px the Mesa uses a compact sticky header with a full-screen menu (`ListaSecoes` shared with `BarraLateral`), filters open as a bottom sheet; never use `col-span-12` inside a `grid-cols-1` grid (it creates implicit columns and overflows). Why: mobile-first layout.
