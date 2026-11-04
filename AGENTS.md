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
- Meeting links (read-only, no account): server functions in `src/lib/reuniao.functions.ts` exchange the token (stored only as SHA-256) for a short-lived server-created account flagged `app_metadata.reuniao`; RLS reads go through `pode_ler()` = `is_member` or `leitor_reuniao` (active meeting + 60 min activity). Public signup stays off, so anonymous sign-in is not used. Why: invite-only platform, access dies when the meeting ends.
- RLS checks for meeting sessions live in `supabase/tests/reuniao_rls.sql`, a DO block that always ends in RAISE (rolls back). Why: test without leaving data.
- Meeting expiration uses an absolute ISO timestamp validated by the shared schema and duration helpers in `src/lib/reuniao.ts`; form input and labels use Brasília time. Why: browser timezone must not change the chosen end time and each layer must enforce the same window.
- Drafted static content lives verbatim in `src/data/*.json`, imported only by `conteudo-dados.server.ts`; browser-safe types/helpers live in `conteudo.ts`. Fetch it through `conteudo.functions.ts` after server authorization; never edit JSON text or move it to the database. Why: preserve client-written text without leaking it into public JavaScript.
- Document capabilities are checked on every request by verified identity, Admin role or the caller's allowlist group; meeting validity and no-export behavior are preserved. Menus and document screens consume server-derived capabilities/data with identity-scoped, nonpersistent caches. Why: navigation and direct URLs share the same security boundary without new roles.
- Individual access: allowlist in `public.acesso_autorizado` (admin-only RLS); `handle_new_user` gives listed emails only `observador`. Password login, reset requests and password setting go through `src/lib/acesso.functions.ts` (allowlist, 5-failures/15-min lockout in `tentativa_login`, 12-char minimum, `log_entrada`); rules in `src/lib/acesso.ts` with tests, RLS check in `supabase/tests/acesso_rls.sql`. Why: one server path enforces the list and the lockout.
- New proposals enter only through Admin › Propostas › "Nova proposta": server functions in `src/lib/propostas.functions.ts` (Admin check, server-side type/size check, files at `propostas/{proposta_id}/v{versao}/{uuid}`), draft kept in admin-only `proposta_rascunho` until "Aprovar e gravar", which creates the proposal as Recebida. Draft rules (mapping, "não informado", never "comprovado", candidate points, version, color) live in `src/lib/rascunho.ts` with tests; RLS check in `supabase/tests/proposta_upload_rls.sql`. Why: one audited path; nothing official is written before human review.
- AI calls share `src/lib/ai/modelo.server.ts`; PDF reading is gated by premissa `ia_leitura_habilitada` (off by default). Why: key stays on the server and the document leaves only with explicit consent.
- Reports for proposals added after the JSON content live in `parecer_proposta` (published only after review; readable by Admin, Sócios group and meeting sessions). Why: `src/data/pareceres.json` stays untouched.
