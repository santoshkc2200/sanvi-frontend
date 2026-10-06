# Client call-pattern audit — what TASK-021's backend counterpart needs before it builds projections

**2026-10-07.** Scope: every endpoint the four apps call **in a loop, per-row, or
once per rendered item**, plus the serialised-request waterfalls on the
[`worst-ten.md`](worst-ten.md) routes. The premise from the
[task](../tasks/phase-11/TASK-021-11-2-harness-re-run-client-call-pattern-audit.md):
an N+1 is often a client pattern, and a projection built to serve a loop the
client should not be running is a permanent cost paid to avoid a one-line fix.
Every finding carries one of three dispositions — **backend batch candidate**,
**TASK-022 client fix**, or **accepted with a reason** — none is blank.

Method: `git grep` sweeps for `.map(async`, `Promise.all`/`allSettled` fan-outs,
`for`/`while` bodies containing `await`, `{#each}` template bodies, polling
helpers, and the load functions of every route in `scripts/a11y-routes.json`
(read in full, not pattern-matched). The only `.map(async …)` in first-party
code is F6; no API call executes inside a Svelte `#each` render or a
synchronous loop anywhere in `apps/*/src`. Findings are numbered by leverage,
not by file order.

Cross-repo timing note (recorded honestly, not papered over): this audit was
produced without visibility into `sanvi-backend` TASK-021's profiling sweep —
its profiling data was not available to this checkout. The list below is
*delivered ahead of the projection work* per the task's requirement; the
handover note at the bottom carries the date.

## Findings

| # | Site | Pattern | Disposition |
|---|---|---|---|
| F1 | storefront SSR hooks chain | 5+ serialised backend round-trips before any page data, one independent leg | TASK-022 client fix (+ backend composite option) |
| F2 | `CampaignDetail.svelte` — `listMembers` | whole member directory fetched to resolve change-log actor ids | backend batch candidate (+ TASK-022 fallback) |
| F3 | `CampaignDetail.svelte` — load order | 4 serialised rounds where 3 have no data dependency | TASK-022 client fix |
| F4 | advertising `Dashboard.svelte` — metrics | metrics await behind core-4 they never read | TASK-022 client fix |
| F5 | `PaymentsSettings.svelte` — load head | providers → persisted-id connection → payouts/tax, serialised | backend batch candidate (TASK-008's recorded gap) |
| F6 | `course-media` `manifestAuth.ts` | master + every variant playlist fetched per player start (parallel) | accepted with a reason |
| F7 | `Campaigns.svelte` — bulk pause/resume | one mutation per selected row (parallel, per-row idempotency key) | accepted with a reason |
| F8 | `Creatives.svelte` — multi-placement create | one create per selected placement (parallel, per-item UUID) | accepted with a reason (batch-create noted) |
| F9 | domains / payments / checkout polls | bounded backoff polling loops | accepted with a reason |
| F10 | SPA boot `me`/`sessions` | every cross-origin call preflighted (`traceparent`) and retried ×3 on network error — measured in rc.3 | TASK-022 client fix (+ backend preflight-cache note) |

### F1 — storefront SSR pays a 5-deep serialised chain on every page

`apps/storefront/src/hooks.server.ts` runs `resolveTenant` → `resolveAuth` →
`resolveLocale` → `resolveTheme` (hook order, `sequence(...)`), then
`+layout.server.ts` awaits `loadPrivacyContext` (3 parallel calls:
directives, notice, notice-at-collection), then the page load runs. On a cold
cache that is **tenant → session → theme → privacy(×3) → page data** — five
serialised backend round-trips before first byte of data, on every route of
the app, feeding LCP directly (the storefront is the app with the 2.0 s
target).

The dependency graph does not justify the serialisation: `resolveSession`
reads only the request's cookies and the API origin — it is independent of
`resolveTenantForHost`. Theme needs locale, locale needs tenant *and* session
(URL prefix, account preference, tenant default), so theme/privacy stay after
— but the first two legs can go out together.

- **TASK-022 client fix (primary):** start `resolveTenantForHost` and
  `resolveSession` concurrently; everything downstream is unchanged. One
  round-trip off every cold storefront request.
- **Backend batch candidate (optional, bigger):** a tenant-context composite
  (tenant + session + theme + notice in one response) would collapse the
  whole chain to one round-trip. That is a backend API-shape decision, not a
  projection — listed so the option is chosen deliberately rather than
  accreted.

### F2 — `listMembers` fetches the whole directory to label a change log

`apps/admin/src/routes/advertising/CampaignDetail.svelte` ends its load with
`listMembers(apiClient)` and builds `actorNames` (user_id → email) to render
names on the campaign's change timeline. It runs **even when `changes` is
empty**, on a page whose worst-ten route JS is 11.18 KB, and it is a
whole-collection fetch whose only consumer is a name lookup for a handful of
actors.

- **Backend batch candidate (primary):** the changes endpoint already
  attributes each entry (platform vs `Sanvi (automated)` vs operator) —
  embedding the actor's display identity in `CampaignChangeView` removes the
  client join *and* the directory permission dependency the code already
  works around ("an operator without directory permission still gets
  history, with ids standing in for names"). That workaround is the smell:
  the endpoint knows something the client must re-fetch and may not be
  allowed to.
- **TASK-022 fallback if the backend declines:** skip the call when
  `changes.length === 0`, and start it in parallel with the changes request
  rather than after it (F3).

### F3 — CampaignDetail's four rounds, three of them dependency-free

Same file: `getAdCampaign` → `[platforms ∥ connections]` →
`listAdCampaignChanges` → `listMembers`. Platforms and connections are
tenant-level catalogs with no input from the campaign response;
`listAdCampaignChanges` needs only `campaignId`, which comes from the URL,
not from the first response. Only the *rendering* needs all four. Disposition:
**TASK-022 client fix** — issue campaign, platforms, connections, and changes
concurrently (all already seq-guarded), cutting three serialised rounds to
one plus the F2 leg.

### F4 — Dashboard metrics wait behind data they never read

`apps/admin/src/routes/advertising/Dashboard.svelte` resolves
`[connections, platforms, campaigns, freshness]` and only then calls
`await loadMetrics(seq)`. `loadMetrics` reads **nothing** from those four
results — it fetches summary + grouped metrics and assigns them; the campaign
name join happens later at render. The serialisation is habit, not
dependency. Disposition: **TASK-022 client fix** — start the two metrics
requests with the core-4 (all under the existing `loadSeq` guard). Halves the
dashboard's cold-load latency on a 4×-slowed CPU profile.

### F5 — PaymentsSettings serialises behind the localStorage workaround

`apps/admin/src/routes/PaymentsSettings.svelte` awaits
`listPaymentProviders` → `getPaymentConnection(persistedId)` (the
localStorage-recovered id, per the file's KNOWN GAP comment) → only then
`[payouts ∥ tax]`. The payouts/tax pair has no input from either earlier leg.

- **Backend batch candidate (primary):** the current-connection endpoint
  TASK-008 already recorded as the missing fix — a payments settings
  composite (provider catalog + current connection + payouts + tax) would
  collapse the chain to one call and delete the localStorage recovery
  entirely.
- **TASK-022 note:** until then, payouts/tax can start immediately rather
  than behind two serialised legs.

### F6 — every HLS variant playlist fetched per player start (parallel, Safari-only)

`packages/course-media/src/player/manifestAuth.ts` `buildNativeHlsSource`
fetches the master playlist, then **every** variant playlist it references in
parallel (`Promise.all(uniqueVariants.map(...))`), rewriting URIs to blob
URLs. This is the credential split by design: native `<video>` cannot send
`Authorization`/`X-Tenant-ID`, so the client fetches what the engine cannot.
Bounded by the master playlist's variant count (typically 3–5), parallel, and
needed for native quality switching. The single-variant path
(`selectedVariantIndex >= 0`) already exists for explicit selection.
Disposition: **accepted with a reason** — the auth split, not fan-out greed,
drives the count. Backend option if media-start latency ever shows up in
profiling: an authorised "master with variants inlined" response (one request
instead of 1+N). Not worth building speculatively.

### F7 — bulk pause/resume: one mutation per selected row

`apps/admin/src/routes/advertising/Campaigns.svelte` `confirmBulk` runs
`pauseAdCampaign`/`resumeAdCampaign` per selected campaign under
`Promise.allSettled`, each with its own client-minted idempotency key, and
accounts partial failures per row (a failed row retries under its existing
key). Disposition: **accepted with a reason** — the selection is
user-bounded, the calls are parallel, and the per-row idempotency key is the
semantic unit: a bulk endpoint would have to accept a list of `{id, key}`
pairs to preserve it. Recorded as a backend batch candidate *only if*
profiling shows tenant-scale bulk actions hurting.

### F8 — multi-placement creative create: one create per placement

`apps/admin/src/routes/advertising/Creatives.svelte` `submitEditor` issues
one `createAdCreative` per selected placement (parallel `Promise.allSettled`,
per-item `crypto.randomUUID()`), with deliberate half-published handling
(succeeded placements drop from the retry set). Disposition: **accepted with
a reason** — same shape as F7. Worth noting for the backend track: the editor
routinely creates several placements in one submit, so a batched
create-creatives endpoint is the one *mutation* fan-out with a real
argument for batching; it would also make "half-published" rarer.

### F9 — bounded polling loops

Three pollers, all bounded with backoff and terminal states, none an N+1:
domains verification (`pollWithBackoff` in `DomainConnect` / `DomainDetail` /
`DomainPurchase`), payments connection status (`pollPaymentConnection` in
`PaymentsSettings`), storefront checkout return (`pollCheckoutStatus` with an
explicit ceiling). Disposition: **accepted with a reason** — polling is the
contract until a push channel exists; a push channel is a backend API
decision, listed here only so it is not rediscovered in TASK-022.

### F10 — SPA boot: preflighted, retried auth calls (measured, not inferred)

rc.3's Lighthouse trace for `admin/` shows the mechanism plainly: after the
bundle loads, the unauthenticated boot fires `me` + `sessions`, each
**preceded by a CORS preflight** — TASK-020's `traceparent` header is not on
the safelist, so every cross-origin call (GETs included) pays a preflight —
and the api-client's network-error retry (idempotent GETs, 3 attempts) walks
all three against an origin the harness leaves unanswered. Under the pinned
562.5 ms RTT that is six throttled refuse cycles; SPA LCP in rc.3 measures
≈ 11 s where rc.1 measured 2.9 s, almost all of it after bundle load.
`benchmarkIndex` (≈ 3875 vs rc.1's 4037) rules the host CPU out.

The harness exaggerates it (a production API origin answers, and a preflight
answer is cacheable), but the underlying costs are real per-call costs, not
harness fictions:

- **One uncached preflight per origin+header set on first visit** — an extra
  round trip before the first API response, i.e. straight off SPA first-paint
  latency. TASK-020's cross-repo note already requires backends to *allow*
  `traceparent` in CORS allow-headers; the companion ask belongs in the same
  place: `Access-Control-Max-Age` on the preflight response, so the cost is
  paid once per browser, not per session.
- **The retry × preflight interaction**: a network-failed call re-pays the
  preflight every attempt, because a failed preflight is never cached.
- **TASK-022 client fix:** `me` + `sessions` are two parallel calls with one
  purpose (establish the session). A single session-hydration endpoint — or
  the api-client coalescing them behind one preflighted hop — halves the
  boot's cross-origin round trips. That is a backend batch candidate the
  profiling sweep should see explicitly, because it is exactly the kind of
  thing a client-side projection cannot fix.

## Examined and clean (so the silence is meaningful)

- **No API call inside any `#each` render or synchronous loop** in
  `apps/*/src` or `packages/*/src` — the only `.map(async …)` in first-party
  code is F6.
- Every list surface already fans out its independent requests in parallel:
  Members, Roles, Billing, Conversions (list ∥ catalog), Diagnostics,
  Audiences (list ∥ connections ∥ catalog), Campaigns (connections ∥
  campaigns ∥ freshness), BudgetAlerts, BudgetCaps, advertising Dashboard
  core-4, admin Dashboard (5-way), platform Privacy (6-way), TenantDetail
  (tenant ∥ admin view; entitlements and features lazy per tab), theme
  gallery, `@sanvi/auth` session hydration.
- Creative previews (`getAdCreativePreviews`) fetch once per *opened dialog*
  (user intent), not per row; refunds/disputes live on the detail page.
- Marketing pricing is prerendered at build time (TASK-024) — zero runtime
  API calls; the storefront's kratos login/link flows are sequential by
  protocol (flow → submit), not by accident.
- `getAdCampaignBudgetCap` has no caller; `putAdCampaignBudgetCap` fires once
  per user-confirmed raise.

## Waterfalls — worst-ten routes

**Method.** Captured 2026-10-06 with Playwright/CDP against the same serving
topology the harness uses (build output via each app's own preview script;
the storefront e2e mock API on :8090), unthrottled: what the capture records
is **request order and server think time**, which is platform-independent;
under the pinned `midrange-android` profile every serialised hop then costs
≈ 562 ms of emulated RTT, so a chain of N serial requests is N×RTT of LCP.
Raw capture: per-route request lists with CDP timestamps. The SPA routes are
auth-gated without a session (same honesty rule as the axe sweep), so their
waterfall is the boot trace Lighthouse recorded plus the load-function call
order read from source — for an SPA that order *is* the waterfall, since
every request goes through one api-client with known sequencing.

### storefront (worst-ten routes are all sub-routes; `/` shown as the SSR reference)

The runtime proof of **F1**: a cold document costs 320–354 ms of server think
— the `resolveTenant` → `resolveSession` → `resolveTheme` → privacy(×3) →
page-data chain against the mock API, each leg waiting on the last. A warm
document (tenant/theme caches hot, as Lighthouse runs 2–3 of 3 see) is
~30 ms — the chain's cacheable legs are only the first and third. Under the
pinned profile the whole chain rides inside the throttled document request,
and the **LCP element is the consent banner's body text** (from the saved
LHRs) — the one element whose data sits at the *end* of that chain. The
rc.1→rc.3 storefront LCP delta (1451→3387 ms en, 1977→4062 ms ja) is
therefore: platform cost (macOS→Windows mock-API latency ≈ 60 ms/leg cold)
multiplied by F1's five serial legs, plus render cost. The lever is F1, not
the platform: fewer serial legs is fewer × RTT on every Lighthouse host.

Everything after the document is **parallel** — stylesheets, modulepreloaded
entry chunks, route nodes all burst within 1–3 ms of each other; nothing
there serialises.

The `ssr = false` routes (`/checkout/return`, `/privacy/*`, `/link`,
`/settings/security`) share one extra serialised hop the SSR routes don't
have: document → entry scripts → **`__data.json`** (client-side load data,
fired by the booted app ~70 ms after script eval even unthrottled) — under
the profile that is +2 RTT versus rendering the data in the document. Their
worst-ten ranking is per-route JS; their runtime pattern is the boot hop.
`/privacy/choices`, `/privacy`, `/link` confirmed identical in shape.

`/ja/` (not route-ranked, the weakest lab number): the Noto Sans JP
`unicode-range` subsets load **in parallel**, discovered by the CSS parser
right after the stylesheet lands — the phase-06 subsetting holds; no
serialised font chain. What remains TASK-022's question there is whether the
LCP-waiting text can paint in the fallback face before the CJK font lands.

### marketing (all three routes)

`/` and `/pricing` both spend ~315 ms of server think on the document (the
SSR render itself — no API calls; pricing's plan list is prerendered at
build, TASK-024) with every subresource parallel after it. Nothing
serialised to fix beyond document cost itself; the rc.1→rc.3 LCP movement
(2125→2426 en, 2534→3009 ja) sits inside the compare threshold and is
platform.

### admin / platform-admin (SPA worst-ten routes)

Boot waterfall, from the recorded Lighthouse trace for `admin/` (18
requests): document → entry/index/vendor/i18n in parallel (614→3222 ms under
throttle) → then `me` + `sessions`, **each preceded by its CORS preflight**,
in **three serial retry rounds** (5343, 7946, 10876 ms) against the
unanswered API origin, then render. That is F10 measured, and it is the
whole story of the rc.1→rc.3 SPA LCP regression (2891→10804 /
2779→9981 ms): bundle load is comparable, the rest is preflight×retry.

Per worst-ten route, the load-function chains read from source (the SPA
waterfall after boot):

| Route | Serialised chain at load | Disposition |
|---|---|---|
| `/payments/settings` | providers → connection(persisted id) → payouts ∥ tax | F5 |
| `/advertising/dashboard` | core-4 → metrics (no data dependency) | F4 |
| `/advertising/creatives` | catalog → creatives ∥ connections (gate-then-load: catalog is the entitlement gate) | accepted, noted for TASK-022 |
| `/advertising/campaigns/new` + `:id/edit` (builder) | platforms → connections → campaign(edit) — three rounds, only the third needs the URL's id | TASK-022 client fix (same class as F3) |
| `/advertising/campaigns/:id` (detail/drift) | campaign → platforms ∥ connections → changes → members | F2 + F3 |
| `/domains/purchase`, `/domains/connect` | purchase → (poll F9); connect → records + poll F9 | F9 |
| `/advertising/budget` (+alerts) | caps/alerts ∥ campaigns | clean |
| `/advertising/diagnostics` | list ∥ catalog | clean |
| `/payments/:id` | single `getTenantPayment`; refunds/disputes on the detail surface | clean |

platform-admin's worst-ten routes load parallel pairs (`/tenants/:id`:
tenant ∥ admin-view, entitlements/features lazy per tab; `/privacy` six-way
parallel; the rest single calls) — no serialised chains beyond boot.

## Handover

**2026-10-07 — delivered to the backend track ahead of the projection
work.** This checkout has no visibility into `sanvi-backend`'s TASK-021
profiling state; the delivery date is what this note asserts, per the task's
ordering requirement (audit before projections).

The backend batch candidates, in leverage order:

1. **F1's composite option** (tenant + session + theme + notice in one
   round-trip) — collapses the storefront's five-leg chain that every page's
   LCP waits behind. The client-side parallelisation (tenant ∥ session) is
   owned by TASK-022 either way; the composite is the only way past one
   round-trip.
2. **F2** — actor display identity embedded in the campaign-changes response,
   deleting the whole-directory `listMembers` join (and its permission
   workaround).
3. **F10's backend half** — `traceparent` in CORS allow-headers (already a
   TASK-020 cross-repo ask) **plus `Access-Control-Max-Age`** so the
   preflight cost is once per browser, not once per session; and optionally a
   session-hydration endpoint folding `me` + `sessions`.
4. **F5** — the current-connection endpoint TASK-008 already recorded as
   missing; a composite payments-settings view would also collapse its
   serialised head.
5. **F8 (optional)** — batched creative create, if profiling shows the
   editor's multi-placement submits matter; **F7 (optional)** — bulk
   pause/resume accepting `{id, key}` pairs, only if tenant-scale bulk
   actions show up in profiles.

Explicitly **not** batch candidates: F6 (auth-split media manifests — the
fan-out is credential-driven and bounded) and F9 (bounded polls — a push
channel is an API redesign, not a projection).

Client fixes owned by TASK-022: F1 (parallel tenant ∥ session), F3, the
builder's three-round head, F4, F10's session-hydration coalescing, and the
`ssr=false` data hop on storefront sub-routes. The SPA preflight/retry boot
(F10) is also why rc.3's SPA Lighthouse numbers moved: cross-platform
comparison of those rows is not evidence of product regression either way —
`benchmarkIndex` and the mechanism are recorded above.

The rc.3 artifact (`benchmarks/frontend/rc.3.json`, build `3df1980`, Windows
host — `lighthouse.chromeBinary` records the binary, `benchmarkIndex` the
host class) and the rc.1 comparison: **every budget metric improved**
(storefront initial 167.8→86.2 KB, marketing 138.8→48.3 KB, admin total
351.6→329.9 KB, platform-admin 180→100.5 KB — TASK-032's sharding); one
route regressed in relative terms, `/legal/request-metrics` 0.79→1.07 KB
(+0.28 KB absolute, TASK-020's diagnostics wiring, inside its 6 KB route
budget); `bench:compare rc.1 rc.3` exits 1 on the 11 rows above, each
attributed here. axe serious 0→12 is a sweep-timing artifact on `ssr=false`
routes (titles appear 2.5 s after `load` once hydration completes — measured;
the sweep analyses at `load`), flagged for TASK-027's gate design, not a
product regression; axe moderate moved 378→388.

