# Async-state audit — every route, every surface

**Scope:** every route of every app (TASK-023 step 1). **Coverage is
asserted, not promised:** `pnpm check:async-audit` compares this document
against the routes enumerated live from each app's route definitions (built
server manifest for the SvelteKit apps, `App.svelte`'s route table for the
SPAs) in both directions — a route that lands without an entry here fails
CI, and so does an entry whose route is gone. TASK-027 inherits this list as
its route inventory; a sampled audit would have made that inheritance a
sample too.

**Notation per surface** — `L` loading · `E` empty · `X` error (terminal,
designed) · `S` success · `T` timeout (a terminal state exists because a
timeout is guaranteed to resolve). Every route's entry answers: does it have
loading, empty, error, and success states, and a timeout with a terminal
state?

**Timeouts are structural:** every browser call goes through
`@sanvi/api-client`'s per-request `AbortController` timeout (10 s default;
apps overridable via env), and every loader clears its loading flag in a
`finally`. The SPAs' route loaders are raced by `@sanvi/spa-router`'s
navigation supersede. There is no spinner that survives its request.

**Accepted degradations** are marked `degraded-ok` with the reason: a
secondary surface whose failure is deliberately silent (or labelled) because
its absence must not take the page down. "Degraded-ok" is a *decision
recorded here*, not an oversight.

---

## storefront

SvelteKit; data loads in `+page.server.ts`/`+page.ts` `load` functions. The
backend-outage path is designed at the shell: a failed tenant resolution
renders the outage view (`errors.outage.*`), a stale-while-revalidate hit
renders the stale-content banner (`common.stale.*`), and a browser-reported
offline renders the offline banner (`common.offline.*`).

### `/`
- L ✓ (theme blocks hydrate) · E ✓ (EmptyState when no products configured) · X n/a (no async load; layout legs degrade) · S ✓ · T n/a
- Layout legs degrade-ok: theme → default theme + log; privacy → no consent surface.

### `/_theme-preview`
- L ✓ (SSR) · E n/a · X ✓ (403 invalid/expired token from the API; **503** when the backend is unreachable — an outage is not a bad token) · S ✓ · T ✓ (api-client)
- SSR; failure renders the app's `+error.svelte` (designed, trace id).

### `/checkout`
- L ✓ · E n/a · X ✓ (config fetch silent catch → `config: null` → explicit cannot-pay degraded state) · S ✓ · T ✓
- Offline: warning banner — checkout is never queued offline (FR-1112); nothing is placed.
- `ssr=false`; degraded-ok on config failure: the page stays browsable and says it cannot take payment.

### `/checkout/cancel`
- Static status view (`canceled: true`); no async surface. All states trivially ✓ · T n/a

### `/checkout/return`
- L ✓ (`confirming` state machine) · E n/a · X ✓ (`failed`/`not_found` states, decline-code mapped) · S ✓ (`paid`) · T ✓ (polling has max attempts → `delayed` reassurance, never an infinite poll)
- Non-retryable ApiError → `not_found`; transient failures → honest `delayed`. Never renders a false failure.

### `/legal/cookies`
- Static registry content; no async surface. All states trivially ✓ · T n/a

### `/legal/privacy-notice`
- L ✓ (SSR) · E n/a · X ✓ (`!notice` → labelled-unavailable EmptyState) · S ✓ · T ✓ (3 s privacy leg)
- degraded-ok: privacy leg failure → `null` → unavailable state, page survives.

### `/legal/request-metrics`
- L ✓ (SSR) · E n/a · X ✓ (designed degraded: `metrics: null` → labelled-unavailable EmptyState **with trace id + copy-diagnostics**) · S ✓ · T ✓

### `/legal/sub-processors`
- L ✓ (SSR) · E n/a · X ✓ (unavailable EmptyState with trace id + copy-diagnostics since TASK-023) · S ✓ · T ✓

### `/link`
- L ✓ (Kratos flow load) · E n/a · X ✓ (load throws → designed `+error.svelte`; submit catch → Alert) · S ✓ · T ✓ (Kratos fetch via raw client timeout)

### `/login`
- L ✓ (flow load) · E n/a · X ✓ (load throws → `+error.svelte`; submit catch → Alert; expired flow → transparent restart) · S ✓ · T ✓

### `/privacy`
- L ✓ · E n/a · X ✓ (privacy context null → labelled-unavailable EmptyState) · S ✓ · T ✓

### `/privacy/agent`
- L ✓ · E n/a · X ✓ (submit catch → Alert error; spinner while busy) · S ✓ · T ✓

### `/privacy/choices`
- L ✓ · E n/a · X ✓ (no consent store → unavailable EmptyState; store throw → Alert) · S ✓ · T n/a (cookie-local)

### `/privacy/erasure`
- L ✓ · E n/a · X ✓ (submit catch → Alert error) · S ✓ · T ✓

### `/privacy/limit-sensitive`
- L ✓ · E n/a · X ✓ (store null → unavailable; throw → Alert) · S ✓ · T n/a

### `/privacy/opt-out`
- L ✓ · E n/a · X ✓ (store null → unavailable; throw → Alert) · S ✓ · T n/a

### `/privacy/requests`
- L ✓ · E ✓ (no requests yet → EmptyState) · X ✓ (submit/verify catch → Alert) · S ✓ · T ✓

### `/privacy/requests/[id]`
- L ✓ · E n/a · X ✓ (**404** → not-found EmptyState; any other failure → failure-kind alert with trace id + retry — an outage is not a missing request) · S ✓ · T ✓

### `/privacy/requests/[id]/appeal`
- L ✓ · E n/a · X ✓ (appeal catch → Alert) · S ✓ · T ✓

### `/recovery`
- L ✓ (flow load) · E n/a · X ✓ (load throws → `+error.svelte`; submit catch → Alert) · S ✓ · T ✓

### `/registration`
- L ✓ (flow load) · E n/a · X ✓ (load throws → `+error.svelte`; submit catch → Alert) · S ✓ · T ✓

### `/settings/security`
- L ✓ (flow load; sessions list fire-and-forget) · E n/a · X ✓ (flow/submit/revoke catch → Alert) · S ✓ · T ✓
- degraded-ok: `listSessions` failure shows fewer rows silently — secondary data, deliberate.

### `/verification`
- L ✓ (flow load) · E n/a · X ✓ (load throws → `+error.svelte`; submit catch → Alert) · S ✓ · T ✓

---

## marketing

Fully static (prerendered). The designed outage experience is that nothing
breaks: no route fetches at request time, so a total backend outage renders
every page normally. `/pricing` falls back to `DEFAULT_PLANS` at build time.

### `/`
- Static, prerendered; no async surface. All states trivially ✓ · T n/a

### `/pricing`
- L ✓ (build-time SSR) · E ✓ (empty plans → fallback `DEFAULT_PLANS`) · X ✓ (build-time failure → `DEFAULT_PLANS` fallback; runtime fetch-free by design) · S ✓ · T n/a (no client fetch)
- degraded-ok: build-time API failure ships the static fallback plans; never a user-visible error.

### `/signup`
- Static links into admin onboarding; query-param only. All states trivially ✓ · T n/a

### `/status`
- L ✓ (build-time SSR → prerendered last-known states) · E ✓ (empty incident history → labelled-empty) · X ✓ (build-time API failure → `readiness: null` fallback, never a build error; runtime poll failure → `unknown` state with last-known checks, never a crash) · S ✓ · T ✓ (30 s client poll; no timeout spinner — the page always shows *something*)
- degraded-ok: with the API down the page renders `unknown` with the hosting-limitation notice; live readiness refreshes it to `operational`/`degraded` without a reload.

---

## admin

SPA. Boot awaits the session; a boot failure renders the designed boot
screen (`data-async-state="error"`, trace id, copy-diagnostics, retry).
Every route page renders inside the shell-level `AsyncBoundary`: a crash in
one panel renders the boundary's failed view — recovery action + trace id —
and never takes the rest of the console down. Route loaders render
`Spinner`; failures render `Alert variant="error"` (marker: `error`) or the
router-level `ErrorView` (retry + trace id + diagnostics); mutations report
via toasts. Timeout: api-client 10 s; the loading flag always clears.

### `/`
- L ✓ · E ✓ (fallback EmptyState) · X ✓ (error Alert **with retry** since TASK-023) · S ✓ · T ✓
- Promise.all over context/members/invitations/entitlements/settings.

### `/billing`
- L ✓ · E ✓ (`noSubscription` / invoices empty) · X ✓ (main error Alert) · S ✓ · T ✓
- degraded-ok: invoices/plans/entitlements side-fetches fail to `[]` silently — labelled-empty secondary tables.

### `/activating`
- L ✓ (polling state) · E n/a · X ✓ (`timeout` state after MAX_ATTEMPTS; transient errors keep polling by design) · S ✓ (`success`) · T ✓ (bounded poll)

### `/onboarding`
- L ✓ (plans spinner) · E ✓ (plans `[]`) · X ✓ (signup catch → Alert) · S ✓ · T ✓
- degraded-ok: plans fetch fails → empty plan list.

### `/settings`
- L ✓ · E n/a · X ✓ (error Alert; save → toasts) · S ✓ · T ✓

### `/settings/security`
- L ✓ · E n/a · X ✓ (flow/submit/revoke → Alert) · S ✓ · T ✓
- degraded-ok: sessions list fails silently (fewer rows).

### `/members`
- L ✓ · E ✓ (empty list state) · X ✓ (error Alert; mutations → toasts) · S ✓ · T ✓

### `/roles`
- L ✓ · E ✓ · X ✓ (error Alert; mutations → toasts) · S ✓ · T ✓

### `/usage`
- L ✓ · E ✓ · X ✓ (error Alert + EmptyState) · S ✓ · T ✓

### `/payments`
- L ✓ · E ✓ (upgrade-prompt EmptyState when not connected) · X ✓ (error Alert) · S ✓ · T ✓

### `/payments/settings`
- L ✓ · E ✓ · X ✓ (per-section failures flip the **degraded-mode banner** naming what is unavailable; mutations → toasts) · S ✓ · T ✓
- The one designed degraded-mode surface in admin (phase 09).

### `/payments/:id`
- L ✓ · E ✓ (not-found distinction) · X ✓ (error Alert) · S ✓ · T ✓

### `/advertising/settings`
- L ✓ · E ✓ (entitlement split inside page) · X ✓ (per-page error Alert) · S ✓ · T ✓

### `/advertising/connections`
- L ✓ · E ✓ · X ✓ (load error Alert; disconnect typed-confirm; health states designed) · S ✓ · T ✓

### `/advertising/dashboard`
- L ✓ · E ✓ · X ✓ (degraded mode names platform + stale scope; load error Alert) · S ✓ · T ✓

### `/advertising/campaigns`
- L ✓ · E ✓ · X ✓ (load error Alert; degraded banner for connection freshness) · S ✓ · T ✓
- degraded-ok: freshness side-fetch fails silently.

### `/advertising/campaigns/new`
- L ✓ (builder) · E n/a · X ✓ (step validation; submit catch → Alert; autosave resilience) · S ✓ · T ✓

### `/advertising/campaigns/:id`
- L ✓ · E ✓ (not-found) · X ✓ (error Alert) · S ✓ · T ✓

### `/advertising/campaigns/:id/edit`
- Same surface as `new` seeded from the campaign. L ✓ · X ✓ · T ✓

### `/advertising/creatives`
- L ✓ · E ✓ · X ✓ (error Alert; spec-checked uploads surface per-asset failures) · S ✓ · T ✓

### `/advertising/campaigns/:id/drift`
- L ✓ · E ✓ (no default resolution rule rendered) · X ✓ (error Alert) · S ✓ · T ✓

### `/advertising/tracking`
- L ✓ · E ✓ (feature-disabled state names the reason) · X ✓ (save/test catch → Alert) · S ✓ · T ✓

### `/advertising/conversions`
- L ✓ · E ✓ (labelled-empty upload columns) · X ✓ (error Alert) · S ✓ · T ✓

### `/advertising/diagnostics`
- L ✓ · E ✓ (paused state, not empty) · X ✓ (per-event story; health banner) · S ✓ · T ✓

### `/advertising/audiences`
- L ✓ · E ✓ · X ✓ (error Alert; opt-out removal rule rendered before actions) · S ✓ · T ✓
- degraded-ok: connection-freshness side-fetch fails silently.

### `/advertising/budget`
- L ✓ · E ✓ (flag-off state names the reason) · X ✓ (409 round-trip surfaced; error Alert) · S ✓ · T ✓

### `/advertising/budget/alerts`
- L ✓ · E ✓ · X ✓ (error Alert; ack requires permission) · S ✓ · T ✓

### `/advertising/connect/:platform/callback`
- L ✓ · E n/a · X ✓ (redeem catch → designed error message; replay-safe by backend state check) · S ✓ · T ✓

### `/advertising/connect/:platform`
- L ✓ · E ✓ (no pending connection → restart state, not empty picker) · X ✓ (picker validation feedback) · S ✓ · T ✓

### `/step-up`
- L ✓ (flow load) · E n/a · X ✓ (catch → Alert) · S ✓ · T ✓

### `/domains`
- L ✓ · E ✓ · X ✓ (error Alert; mutation toasts) · S ✓ · T ✓
- degraded-ok: `listDomainOrders` fails to `[]`; health badge degraded state is designed.

### `/domains/connect`
- L ✓ · E n/a · X ✓ (search/connect catch → Alert; some mutation catches deliberate no-ops on rollback paths) · S ✓ · T ✓

### `/domains/purchase`
- L ✓ · E n/a · X ✓ (purchase catch → Alert) · S ✓ · T ✓

### `/domains/:id`
- L ✓ · E ✓ (not-found) · X ✓ (load error Alert; orders/health degrade-ok) · S ✓ · T ✓

### `/privacy`
- L ✓ · E ✓ (DSR ledger empty) · X ✓ (error Alert; extend/reject → toasts) · S ✓ · T ✓

### `/settings/localization`
- L ✓ · E ✓ (overrides empty) · X ✓ (load error; save → toasts) · S ✓ · T ✓

### `/theme`
- L ✓ · E ✓ (gallery empty) · X ✓ (error Alert) · S ✓ · T ✓

### `/theme/brand`
- L ✓ · E n/a · X ✓ (load error Alert; save → toasts) · S ✓ · T ✓

### `/theme/colors`
- L ✓ · E n/a · X ✓ (contrast gates surface inline; load error Alert) · S ✓ · T ✓

### `/theme/typography`
- L ✓ · E n/a · X ✓ (load error Alert) · S ✓ · T ✓

### `/theme/layout`
- L ✓ · E n/a · X ✓ (load error Alert) · S ✓ · T ✓

### `/theme/preview`
- L ✓ · E n/a · X ✓ (load error Alert; preview isolation) · S ✓ · T ✓

### `/theme/publish`
- L ✓ · E n/a · X ✓ (publish catch → toasts/Alert) · S ✓ · T ✓

### `/login`
- L ✓ (flow load) · E n/a · X ✓ (getFlow failure → transparent restart; `$effect` catch → Alert — the documented never-forever-spinner guard) · S ✓ · T ✓

### `/health`
- Static build stamp; no fetch. Trivially ✓ · T n/a

---

## platform-admin

SPA; every route except `login`/`step-up` requires aal2. Same shell
guarantees as admin: boot screen, `AsyncBoundary` per page, `ErrorView` for
router-level failures (retry + trace id + diagnostics). TASK-023 fixed the
audit's weakest states here: Audit/Approvals/Roles no longer render an error
as an empty list; Impersonation gained a Spinner and an Alert-with-retry.

### `/`
- L ✓ (DataTable loading) · E ✓ (empty) · X ✓ (DataTable error cell **with retry**) · S ✓ · T ✓

### `/tenants/:id`
- L ✓ · E n/a · X ✓ (page-level ErrorView + entitlements/audit section ErrorViews **each with their own retry**) · S ✓ · T ✓
- The per-section boundary precedent (TASK-020).

### `/features`
- L ✓ · E ✓ · X ✓ (DataTable error cell with retry) · S ✓ · T ✓

### `/roles`
- L ✓ · E ✓ · X ✓ (error Alert **with retry** — was EmptyState-as-error) · S ✓ · T ✓

### `/audit`
- L ✓ · E ✓ · X ✓ (error Alert with retry — was error-as-empty AuditTrail) · S ✓ · T ✓
- CSV export streams; export failure surfaced via toast/Alert.

### `/impersonations`
- L ✓ (Spinner — was a bare paragraph) · E ✓ · X ✓ (error Alert **with retry** — was a bare `role="alert"` paragraph) · S ✓ · T ✓

### `/approvals`
- L ✓ · E ✓ · X ✓ (error Alert with retry — was EmptyState-as-error) · S ✓ · T ✓

### `/privacy`
- L ✓ · E ✓ · X ✓ (error Alert + explicit retry Button; tab-level Alerts) · S ✓ · T ✓

### `/settings/security`
- L ✓ · E n/a · X ✓ (submit/logout → Alert) · S ✓ · T ✓
- degraded-ok: sessions list fails silently (fewer rows).

### `/translations`
- L ✓ · E ✓ · X ✓ (error Alert + retry Button) · S ✓ · T ✓

### `/login`
- L ✓ · E n/a · X ✓ (restart + `$effect` catch → Alert) · S ✓ · T ✓

### `/step-up`
- L ✓ · E n/a · X ✓ (catch → Alert) · S ✓ · T ✓

### `/health`
- Static build stamp; no fetch. Trivially ✓ · T n/a
