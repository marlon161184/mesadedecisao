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
