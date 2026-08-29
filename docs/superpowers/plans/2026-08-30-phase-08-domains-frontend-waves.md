# Phase 08 — Domain Connect & Purchase Wizard (frontend) — Wave Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan wave-by-wave. Each wave's tasks are right-sized checkpoints; expand a task into full bite-sized TDD steps at the point you start it, using this document plus the spec as source of truth. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship both domain wizards (connect an owned domain, purchase a new one) plus the list/detail, health, and lifecycle screens described in `docs/phase-08-domains/implementation-plan.md`, in 5 sequential waves that each land working, testable software.

**Architecture:** Two flat-file wizard routes (`DomainConnect.svelte`, `DomainPurchase.svelte`) in `apps/admin/src/routes`, following the existing `Onboarding.svelte` pattern (single file, `$state` step machine, server-owned status re-derived on load/poll — no client-side wizard truth). Shared primitives (copy button, record/status table, registrar guide catalog) live in `packages/ui` and `apps/admin/src/lib/domains` so both wizards and the detail screen reuse them instead of duplicating markup. All backend calls go through new functions in a `packages/api-client/src/domains.ts` module, mirroring `tenancy.ts`'s pattern.

**Tech Stack:** Svelte 5 (runes), `@sanvi/api-client` (typed `openapi-fetch` wrapper), `@sanvi/i18n` (flat-key JSON catalogs, ICU via `fmt`), `@sanvi/ui`, `@sanvi/design-tokens`, Vitest + `@sanvi/test-config/axe`, Playwright for E2E (confirm exact runner in `apps/admin/package.json` before Wave 5 if not already known).

**Spec:** `docs/phase-08-domains/implementation-plan.md` (frontend). Backend contract already implemented and generated into `packages/api-client/src/generated/types.ts` — backend crate is `sanvi-backend/crates/contexts/domains` (spec: `sanvi-backend/docs/phase-08-domains-tls/implementation-plan.md`).

## Global Constraints

From `CONTRIBUTING.md`'s five lint-enforced non-negotiables — every task below inherits all five:

1. No hardcoded user-facing strings. Every string is an i18n key in `packages/i18n/messages/en.json` **and** `ja.json` (flat `"admin.domains.*"` keys), consumed via `t['admin.domains.xyz']()`. `pnpm check:i18n` enforces this.
2. No hardcoded colors/fonts/spacing/radii — `var(--sanvi-*)` tokens only. `pnpm check:tokens` enforces this.
3. No `fetch` outside `@sanvi/api-client` — all domain API calls go through the new `packages/api-client/src/domains.ts` module.
4. No import-boundary violations — `packages/ui` never imports `api-client`; the registrar guide catalog and API calls live in `apps/admin/src/lib/domains`, not in `packages/ui`.
5. Accessibility is a build gate — every new `@sanvi/ui` component test asserts `expect(container).toHaveNoViolations()`; wizard steps are keyboard-navigable and progress changes use `aria-live`.

From the spec's key-decisions table (`docs/phase-08-domains/implementation-plan.md`):

- Wizard state is server-owned. Steps below never invent client-side status; every step re-derives its position from the API response (`status`, `challenge`, `failure` fields on `CustomDomainView`) so a reload or a second device lands on the correct step.
- Poll with backoff while verifying/issuing/provisioning; never silent — always show what's being waited on.
- No registrar credentials are ever requested, anywhere in the UI, and the copy says so explicitly.
- Verification tokens (`ChallengeView.token`, `txt_value`) are displayed but must never be logged client-side or included in analytics events — grep for this before closing Wave 2 and Wave 5.

## Known contract gaps (confirmed against `packages/api-client/src/generated/types.ts` and the backend crate)

The backend implements: `list_custom_domains`, `claim_custom_domain`, `search_domains`, `place_domain_order`, `list_domain_orders`, `set_order_auto_renew`, `remove_custom_domain`, `get_domain_instructions`, `promote_primary_domain`, `request_domain_verification`, plus platform-scoped `list_platform_domains`/`release_platform_domain`. Two spec expectations don't have a 1:1 backend field yet — build against what exists and flag rather than block:

- **No single-domain or single-order GET.** Detail/status screens re-derive their target from the `list_custom_domains` / `list_domain_orders` response by `id`, not a dedicated fetch. Fine for the handful-of-domains scale the spec targets ("Out: bulk domain management").
- **No raw "observed DNS record value" field.** `CustomDomainView` exposes `status`, `challenge` (expected TXT), and `failure` (a `DomainFailure` — check its variants in `crates/contexts/domains/src/domain/error.rs` when building Wave 1's detail table) but not a live-resolved observed value. The "expected vs observed" table in Wave 1 renders expected-from-challenge next to a status/failure-derived observed state, not a raw resolver dump. If product wants literal observed record values shown, that's a backend addition — call it out, don't fake data client-side.

## Wave sequencing and why

Waves 2 and 3 (the two wizards) are independent of each other once Wave 1 lands and can be built in parallel by two engineers/subagents. Wave 4 depends on Wave 1 (list/detail) and touches both wizards' guide catalog. Wave 5 depends on everything.

```
Wave 1 (foundations) ──┬── Wave 2 (connect wizard) ──┐
                        └── Wave 3 (purchase wizard) ─┼── Wave 4 (health, lifecycle, ja guides) ── Wave 5 (test + hardening)
                                                       ┘
```

---

## Wave 1 — API client, shared primitives, list & detail screens

Unblocks both wizards. Nothing here is wizard-specific.

### Task 1.1: `packages/api-client/src/domains.ts`

**Files:**
- Create: `packages/api-client/src/domains.ts`
- Test: `packages/api-client/__tests__/domains.test.ts` (follow the pattern in `packages/api-client/__tests__/tenancy.test.ts` if present, else mirror `tenancy.ts`'s own function shapes against a mocked `TypedApiClient`)
- Modify: `packages/api-client/src/index.ts` — export the new module's functions

**Interfaces:**
- Produces: `listCustomDomains(client, signal?)`, `claimCustomDomain(client, hostname: string, role: string, signal?)`, `removeCustomDomain(client, id: string, signal?)`, `getDomainInstructions(client, id: string, signal?)`, `promoteDomain(client, id: string, signal?)`, `requestDomainVerification(client, id: string, signal?)`, `searchDomains(client, query: string, signal?)`, `placeDomainOrder(client, hostname: string, termYears: number, autoRenew: boolean, whoisPrivacy: boolean, registrant: unknown, signal?)`, `listDomainOrders(client, signal?)`, `setOrderAutoRenew(client, id: string, enabled: boolean, signal?)`. One function per operation in the generated `operations` map under `/api/v1/tenant/domains*`. Match `tenancy.ts`'s doc-comment style (one line naming the verb+path, one paragraph on caller-relevant semantics).

- [ ] Write one function per endpoint listed above, each a thin `client.GET/POST/DELETE(...)` call typed off `TypedApiClient`, matching `tenancy.ts`'s signature convention (`client`, then required params, then optional `signal`).
- [ ] Write `domains.test.ts` asserting each function calls the right method/path with the right body, using the same client-mocking approach as the existing `tenancy`/`localization` client tests.
- [ ] Run `pnpm --filter @sanvi/api-client test` — expect PASS.
- [ ] Run `pnpm --filter @sanvi/api-client check` — expect PASS (typecheck + lint).
- [ ] Commit: `feat(api-client): add domains module for phase 08 wizards`

### Task 1.2: Shared UI primitives — copy button and expected/observed record table

**Files:**
- Create: `packages/ui/src/CopyButton.svelte`, `packages/ui/__tests__/CopyButton.test.ts`, `packages/ui/src/CopyButton.stories.svelte`
- Create: `packages/ui/src/DomainRecordTable.svelte`, `packages/ui/__tests__/DomainRecordTable.test.ts`, `packages/ui/src/DomainRecordTable.stories.svelte`
- Modify: `packages/ui/src/index.ts` — export both

**Interfaces:**
- `CopyButton` props: `{ value: string; label: string; copiedLabel: string; onCopy?: () => void }`. Writes to `navigator.clipboard.writeText(value)`, shows a transient "copied" state, calls `onCopy` (used later to fire an analytics event without embedding analytics in `packages/ui`, which must not import outside its own layer).
- `DomainRecordTable` props: `{ records: Array<{ type: string; name: string; expected: string; observed: 'pending' | 'matched' | 'mismatch' | 'not_found'; }>; }`. Renders one row per record with a per-row `CopyButton` on the expected value, plus a bulk "copy all" `CopyButton` whose `value` is the newline-joined set — this satisfies the spec's "record blocks are also copyable as a set".

- [ ] Build `CopyButton.svelte` per the "Adding a component" checklist in `CONTRIBUTING.md` (runes, typed `Props`, tokens only, strings as props with English defaults, exported, tested with axe, storybook file).
- [ ] Build `DomainRecordTable.svelte` the same way, composing `CopyButton` internally.
- [ ] `pnpm --filter @sanvi/ui test && pnpm --filter @sanvi/ui check` — expect PASS.
- [ ] Commit: `feat(ui): add CopyButton and DomainRecordTable primitives`

### Task 1.3: i18n scaffold for the `admin.domains.*` namespace

**Files:**
- Modify: `packages/i18n/messages/en.json`, `packages/i18n/messages/ja.json`

**Interfaces:**
- Produces: every key Wave 1–4 will need under `admin.domains.*` — add them incrementally per wave rather than guessing the full set now; this task only adds the keys Wave 1's list/detail screen actually renders (list column headers, status labels, empty state, the record table's column headers, the "no registrar credentials" security line since it appears on the detail page's help panel too).

- [ ] Add the Wave-1 key set to `en.json` with real English copy (not placeholders).
- [ ] Add the same keys to `ja.json` with real Japanese copy — do not leave English fallbacks in `ja.json`; `packages/i18n/__tests__/catalogs.test.ts` likely already asserts key-set parity between locales, run it to confirm.
- [ ] Run `pnpm --filter @sanvi/i18n test` — expect PASS.
- [ ] Commit: `feat(i18n): add domains namespace keys for list and detail screens`

### Task 1.4: `Domains.svelte` (list) and `DomainDetail.svelte` routes

**Files:**
- Create: `apps/admin/src/routes/Domains.svelte`, `apps/admin/src/routes/DomainDetail.svelte`
- Modify: wherever `apps/admin/src` registers routes (check `App.svelte` / `@sanvi/spa-router` usage — follow the existing pattern used for `Billing.svelte`/`Members.svelte`)
- Test: component tests for both, in whatever location mirrors existing route test coverage (check for a `routes/__tests__` convention or co-located `.test.ts`; match what's already there)

**Interfaces:**
- Consumes: `listCustomDomains` from Task 1.1, `DomainRecordTable`/`CopyButton` from Task 1.2, `UpgradePrompt` from `packages/ui` (existing) gated on the `domains.custom` entitlement — check `list_tenant_entitlements` usage in an existing gated screen (e.g. `PaymentsSettings.svelte`) for the exact gating pattern and copy it.
- Produces: `Domains.svelte` lists hostname/role/status chip/health/actions and links to `DomainDetail.svelte?id=...` (or the router's param convention — match existing detail-route patterns if any exist, else use a query param like `Onboarding.svelte` does for `plan`); `DomainDetail.svelte` renders the status timeline (claimed → verifying → verified → issuing → live) and the `DomainRecordTable` as the first element on the page per the spec ("should be the first thing on the page when something is wrong"), certificate info if present on the view, and a danger zone (remove, change primary) — remove/promote wiring lands fully in Wave 4; stub the buttons behind a `disabled` state with a TODO-free comment noting "wired in Wave 4" is not a placeholder in the code, it's an accurate statement of scope — the button must still render correctly disabled with a tooltip explaining why, not a bare disabled attribute with no explanation.

- [ ] Write `Domains.svelte`: fetch via `listCustomDomains`, render loading/empty/error/populated states, entitlement-gate the "add domain" entry point behind `UpgradePrompt`.
- [ ] Write `DomainDetail.svelte`: resolve the target domain from the list response by id, render the status timeline and `DomainRecordTable` built from `challenge`/`failure`/`status`.
- [ ] Write component tests covering: empty list, populated list, entitlement-gated state, detail page for each `status` value the backend defines (check `crates/contexts/domains/src/domain/custom_domain.rs` for the exact status enum before writing these cases).
- [ ] Wire routing so `/domains` and the detail view are reachable from the admin nav.
- [ ] `pnpm --filter @sanvi-admin-app-name test && pnpm --filter <admin-app-name> check` (use the actual package name from `apps/admin/package.json`) — expect PASS.
- [ ] `pnpm check:i18n && pnpm check:tokens && pnpm check:boundaries` from repo root — expect PASS.
- [ ] Commit: `feat(admin): domain list and detail screens`

**Wave 1 exit criteria:** `/domains` is reachable, lists real domains from the backend, and the detail page shows accurate status/records for any domain state, with zero wizard functionality yet (add/remove/promote can be visibly present but inert). `pnpm check:quiet` and `pnpm test:quiet` from the repo root both pass.

---

## Wave 2 — Connect wizard

Depends on Wave 1's API module and primitives. Independent of Wave 3.

### Task 2.1: Registrar detection and guide catalog (English content)

**Files:**
- Create: `apps/admin/src/lib/domains/registrar-guides.ts` (catalog: NS-pattern → registrar id → guide content reference), `apps/admin/src/lib/domains/registrar-guides.test.ts`
- Create: `apps/admin/src/lib/domains/guides/` — one file per registrar (start with the set named in the spec: Cloudflare, Route 53, GoDaddy, Value Domain; お名前.com content lands in Wave 4 alongside the ja locale pass) plus a generic fallback guide

**Interfaces:**
- Produces: `detectRegistrar(nsRecords: string[]): RegistrarId | 'unknown'` and `getGuide(registrarId: RegistrarId | 'unknown'): RegistrarGuide` where `RegistrarGuide` is `{ id: string; nameKey: string; steps: Array<{ textKey: string; screenshot?: string }> }` — `textKey` is an i18n key, not literal copy, so the guide content itself is translatable in Wave 4 without touching this module's logic.
- `detectRegistrar` reads NS records already present on the domain view if the backend surfaces them (check `detected_registrar` on `CustomDomainView` — it exists per Task 1's schema read), so this may reduce to a thin mapping from the backend's `detected_registrar` string to a local guide id plus the `'unknown'` fallback, rather than a from-scratch NS-pattern matcher. Confirm which before writing — don't build client-side NS detection if the backend already resolved it.

- [ ] Write `detectRegistrar`/`getGuide` per the confirmed shape (backend-resolved id → guide, or NS pattern matcher if the backend doesn't resolve it).
- [ ] Write the 4 English guides + generic fallback as data, each step referencing an i18n key added in Task 2.4.
- [ ] Unit test: unknown registrar falls back correctly; each known registrar id resolves to its guide.
- [ ] `pnpm --filter <admin-app-name> test` — expect PASS.
- [ ] Commit: `feat(admin): registrar detection and guide catalog (en)`

### Task 2.2: `DomainConnect.svelte` — steps 1–2 (enter domain, add records)

**Files:**
- Create: `apps/admin/src/routes/DomainConnect.svelte`
- Test: co-located per Wave 1's established test convention

**Interfaces:**
- Consumes: `claimCustomDomain`, `getDomainInstructions` (Task 1.1), `DomainRecordTable`, `CopyButton` (Task 1.2), `getGuide`/`detectRegistrar` (Task 2.1), entitlement gate pattern from Task 1.4.
- Produces: a `$state` step machine (`1 | 2 | 3 | 4 | 5`, matching the spec's 5-step connect flow) that on mount checks whether a domain id is already in flight (query param, matching `Onboarding.svelte`'s convention) and jumps straight to the step implied by its current `status` — this is the resumability requirement; it must work identically whether the wizard was left mid-flow on this device or another.

- [ ] Step 1: hostname input with apex-vs-subdomain explanation and entitlement check before allowing submission; calls `claimCustomDomain` on submit.
- [ ] Step 2: renders `DomainRecordTable` from `getDomainInstructions`'s response, with the registrar guide from Task 2.1 alongside it, and an "I've added them" affordance that is cosmetic only (copy must say verification already started automatically, matching the spec) — do not gate verification on this button.
- [ ] Component tests: idle, submitting, validation-error, and resumed-at-step-2 states.
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): connect wizard steps 1-2`

### Task 2.3: `DomainConnect.svelte` — steps 3–5 (verifying, securing, live) with backoff polling

**Files:**
- Modify: `apps/admin/src/routes/DomainConnect.svelte`
- Create: `apps/admin/src/lib/domains/poll.ts` (backoff polling helper, since both wizards need it — purchase wizard's provisioning step in Wave 3 reuses this, so build it generically now rather than duplicating in Wave 3)
- Test: `apps/admin/src/lib/domains/poll.test.ts`

**Interfaces:**
- Produces: `pollWithBackoff<T>(fetchFn: () => Promise<T>, isDone: (result: T) => boolean, options?: { minDelayMs?: number; maxDelayMs?: number }): { start(): void; stop(): void; current: T | undefined }` or the reactive-store equivalent idiomatic to this codebase's Svelte 5 usage (check whether other polling exists anywhere in `apps/admin/src` — e.g. the slug-availability check in `Onboarding.svelte` uses a debounce timer pattern; backoff polling is a different shape, don't force-fit the debounce pattern onto it) — pick a shape and hold it consistent for Wave 3 to consume unchanged.

- [ ] Write `pollWithBackoff`, unit-tested for: it stops calling once `isDone` is true, it never calls the network faster than `minDelayMs`, it can be cancelled via `stop()`.
- [ ] Wire step 3 (verifying) to poll `listCustomDomains` (or `requestDomainVerification`'s response, whichever reflects live progress — confirm against `crates/contexts/domains/src/application/verification_job.rs` which field changes during polling) and render per-record progress, elapsed time, and a manual "check again" that's rate-limited to not fight the backoff.
- [ ] Wire steps 4–5 (securing, live) from the same polled status — no separate API call if the same view already carries certificate/live state; confirm against the view schema before assuming a separate cert-status field exists.
- [ ] Component tests for every named failure mode from the spec's testing section: not found yet, found but wrong value, conflicting record, propagating, registrar blocks this — each must render its own message and a next action, sourced from `DomainFailure`'s actual variants (`crates/contexts/domains/src/domain/error.rs`), not invented client-side categories that don't match what the backend can actually report.
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): connect wizard verification, cert issuance, and live steps`

### Task 2.4: i18n for the connect wizard

**Files:**
- Modify: `packages/i18n/messages/en.json`, `packages/i18n/messages/ja.json` (English-quality copy only for now; the Japanese *guide content* specifically is Wave 4's job, but UI chrome strings — button labels, step titles, failure messages — get real `ja.json` copy now like every other key, since `check:i18n`/`catalogs.test.ts` require both locales to have every key)

- [ ] Add every key referenced by Tasks 2.1–2.3 to both `en.json` and `ja.json`.
- [ ] `pnpm --filter @sanvi/i18n test` — expect PASS.
- [ ] Commit: `feat(i18n): connect wizard copy`

**Wave 2 exit criteria:** a tenant admin can claim a domain, see records with copy buttons and a registrar guide (English), watch verification progress with honest per-failure-mode messaging, and land on a live state — end to end against the real backend, resumable across a reload. `pnpm check:quiet && pnpm test:quiet` pass.

---

## Wave 3 — Purchase wizard

Depends on Wave 1. Reuses `pollWithBackoff` from Wave 2 (Task 2.3) — sequence Wave 3 after Task 2.3 lands even if the rest of Wave 2 is still in flight, or duplicate-then-consolidate if running fully in parallel; don't block Wave 3 entirely on all of Wave 2.

### Task 3.1: Registrant details — contact form

**Corrected against the actual contract** (checked directly in `packages/api-client/src/generated/types.ts` before writing this task): `PlaceDomainOrderCommand.registrant_contact` is a `RegistrantContact` — `{ name: string; email: string; phone: string; country_code: string; organization?: string | null }`. There is no street address, city, prefecture, or postal code field anywhere in this schema. The spec's "locale-aware address input (phase 06)" does not apply here — the backend collects a minimal contact, not a mailing address, and no such phase-06 component exists in `packages/ui` anyway (confirmed absent). Building a full address form would collect data the backend has nowhere to put, which also cuts against this phase's own security principle of minimal-fields collection.

**Files:**
- No new `packages/ui` component. Build the form inline in `DomainPurchase.svelte` (Task 3.2) using existing `Field`/`Input`/`Select` primitives: name, organization (optional), email, phone, country select.

**Interfaces:**
- The form's local state is typed directly as `components['schemas']['RegistrantContact']` from `@sanvi/api-client` — do not declare a parallel type.
- A `country_code` `Select` populated from a small static ISO list is sufficient; no per-country field reshaping is needed since the schema has no address fields to reshape.

- [ ] Skip — folded into Task 3.2, no standalone component to build or test here.

### Task 3.1 (superseded)

The task above replaces the originally planned `AddressFields.svelte` component. Wave 3 execution should treat 3.1 as done once the registrant contact fields land as part of Task 3.2.

### Task 3.2: `DomainPurchase.svelte` — steps 1–3 (search, select, registrant)

**Files:**
- Create: `apps/admin/src/routes/DomainPurchase.svelte`

**Interfaces:**
- Consumes: `searchDomains` (Task 1.1) — its response is `DomainSearchView { query, registrar_id, results: DomainQuote[] }` where each `DomainQuote` is `{ hostname, tld, available, premium, register_price: Money, renew_price: Money, registrar_id }`. Both prices are present per result, so the renewal price shown in step 1 and the year-two total shown in step 4 both come straight off the search result the tenant picked — carry the selected `DomainQuote` in wizard state rather than re-fetching it later.
- Registrant fields are typed as `components['schemas']['RegistrantContact']` (Task 3.1's correction above) — `{ name, email, phone, country_code, organization? }`.
- Produces: same resumable `$state` step-machine convention as `DomainConnect.svelte` (steps 1–6 per spec).

- [ ] Step 1: search input, debounced (match `Onboarding.svelte`'s slug-check debounce pattern), rendering availability + `register_price` + `renew_price` + suggestions per result.
- [ ] Step 2: term length, auto-renew toggle, WHOIS privacy toggle. There is no per-TLD privacy-availability field anywhere in the contract (`DomainQuote` and `PlaceDomainOrderCommand` both lack one) — offer the toggle unconditionally, defaulted on, per `PlaceDomainOrderCommand.whois_privacy`'s own doc comment ("default true where supported"); the backend silently no-ops it where unsupported, the UI doesn't need to predict that.
- [ ] Step 3: the registrant contact form (name, organization, email, phone, country) plus the plain-language "what is sent to the registrar and why" statement — this is a required, real sentence of copy, not a placeholder; write the actual disclosure text referencing the registrar sub-processor by role (per the security section: name the sub-processor at the point of collection).
- [ ] Component tests: empty search, results with mixed availability, term/privacy selection persisted across steps, registrant validation errors.
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): purchase wizard steps 1-3`

### Task 3.3: `DomainPurchase.svelte` — steps 4–6 (review & pay, provisioning, live)

**Files:**
- Modify: `apps/admin/src/routes/DomainPurchase.svelte`

**Interfaces:**
- Consumes: `placeDomainOrder` (Task 1.1), `pollWithBackoff` (Task 2.3) for the provisioning step, the existing checkout/payment handoff pattern already used in `Onboarding.svelte`/`PaymentsSettings.svelte` (`createCheckoutSession` or whatever billing-elements flow those already use — reuse it, don't build a second payment integration).
- The real `OrderStatus` enum (`crates/contexts/domains/src/domain/order.rs` in the sibling backend repo) is `Pending → Charged → Registered → Configuring → Active → Failed | Refunded`. Step 5's sub-states map to this directly: Pending/Charged = "processing payment", Registered = "registering with the registrar", Configuring = "applying DNS", Active = the point where a `CustomDomain` now exists for this hostname and flows through the *same* verification/cert pipeline `DomainConnect.svelte` already polls — once `Active`, switch polling to `listCustomDomains`/the domain's own status (reuse Task 2.3's derivation logic, don't reimplement it) for the remaining verification→cert→live progress. Failed and Refunded are the two terminal failure states.
- [ ] Step 4: total including year-two renewal price (from the carried `DomainQuote.renew_price`, Task 3.2), non-refundability notice, explicit confirm action.
- [ ] Step 5: provisioning progress: poll the placed order's status through the `Pending/Charged/Registered/Configuring` states, then once `Active`, switch to polling the resulting custom domain's status (reusing `DomainConnect.svelte`'s status→progress rendering) through verification and certificate issuance to live. Use `pollWithBackoff` for both phases.
- [ ] Step 6: live state with domain-management entry points linking back to `DomainDetail.svelte`.
- [ ] Component tests: happy path; order lands in `Failed` or `Refunded` (must render refund-messaging copy appropriate to each — a `Failed` order before any charge succeeded needs no refund language, only a `Refunded` order does; conflating the two would tell a never-charged tenant they're getting a refund they were never owed).
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): purchase wizard payment, provisioning, and live steps`

### Task 3.4: i18n for the purchase wizard

**Files:**
- Modify: `packages/i18n/messages/en.json`, `packages/i18n/messages/ja.json`

- [ ] Add every key from Tasks 3.1–3.3 to both locales with real copy.
- [ ] `pnpm --filter @sanvi/i18n test` — expect PASS.
- [ ] Commit: `feat(i18n): purchase wizard copy`

**Wave 3 exit criteria:** a tenant admin can search, configure, pay for, and receive a live purchased domain end to end against the real backend, with registrant data collection disclosed per the security section. `pnpm check:quiet && pnpm test:quiet` pass.

---

## Wave 4 — Health, lifecycle, and full localization

Depends on Wave 1 (detail screen) and touches both wizards' guide catalog.

### Task 4.1: Health surfaces and expiry warnings

**Files:**
- Modify: `apps/admin/src/routes/Domains.svelte`, `apps/admin/src/routes/DomainDetail.svelte`

**Interfaces:**
- Consumes: whatever health/expiry fields the backend's `health_job.rs`/`renewal_job.rs` actually populate onto the domain/order views — read those two files first; do not invent a health status enum that doesn't match what the backend emits.

- [ ] Health badge on the list, degraded state explaining what changed and how to fix it, sourced from the real backend field.
- [ ] Expiry warning banner on purchased domains nearing expiry (in-app; email is a backend/notifications concern, out of scope here) with an auto-renew toggle via `setOrderAutoRenew` and its billing implications stated inline.
- [ ] Renewal failure state with a concrete recovery path (link to payment settings, or a retry action — check what the backend actually offers via `renewal_job.rs` before promising an action the UI can't fulfill).
- [ ] Component tests for: healthy, degraded, expiring-soon, renewal-failed states.
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): domain health and expiry surfaces`

### Task 4.2: Primary switching and removal

**Files:**
- Modify: `apps/admin/src/routes/DomainDetail.svelte`

**Interfaces:**
- Consumes: `promoteDomain`, `removeCustomDomain` (Task 1.1).

- [ ] Primary-switch action: preview of resulting URLs, SEO/redirect warning copy, confirm, call `promoteDomain`.
- [ ] Removal: consequence statement ("storefront becomes unreachable at that host"), typed confirmation (type the hostname to confirm — match whatever typed-confirmation pattern, if any, already exists elsewhere in the app; else build the minimal version here and don't over-generalize it into a shared component unless a second caller shows up).
- [ ] Component tests: promote happy path, remove requires exact hostname match before enabling the confirm button, cancel paths.
- [ ] `pnpm --filter <admin-app-name> test && check` — expect PASS.
- [ ] Commit: `feat(admin): primary domain switching and removal`

### Task 4.3: Complete the registrar guide catalog — お名前.com and Japanese localization, screenshots

**Files:**
- Modify: `apps/admin/src/lib/domains/registrar-guides.ts`
- Create: `apps/admin/src/lib/domains/guides/onamae.ts` (or matching pattern from Task 2.1)
- Add screenshot assets per whatever asset pipeline the app already uses for images (check for an existing `assets/` or `static/` convention in `apps/admin` before choosing a location)

- [ ] Add the お名前.com guide (and Value Domain if not already covered in Task 2.1).
- [ ] Add screenshots for every guide, English and Japanese UI variants where the registrar's own console differs by locale.
- [ ] Add the `ja` translations for every guide step's i18n key (the keys were created in Task 2.1; this task fills in `ja.json`'s values for them, since Task 2.1 deliberately deferred the Japanese guide-content translations).
- [ ] `pnpm --filter @sanvi/i18n test` (catalog parity) — expect PASS.
- [ ] Commit: `feat(admin): japanese registrar guides and screenshots`

**Wave 4 exit criteria:** every deliverable in the spec's "Work breakdown" list (items 1–9) is implemented and reachable in the running app; Japanese guides render correctly including registrar names. `pnpm check:quiet && pnpm test:quiet` pass.

---

## Wave 5 — Test coverage, a11y, i18n QA, and security hardening

Depends on Waves 1–4 being feature-complete.

### Task 5.1: Component test completeness pass

**Files:** all `apps/admin/src/routes/Domain*.svelte` and `apps/admin/src/lib/domains/*` test files from prior waves.

- [ ] Cross-check every wizard step against the spec's testing section: "every wizard step in every state (idle, waiting, partial, failed, succeeded)" — list each step from both wizards and confirm a test exists for each named state; write the missing ones.
- [ ] `pnpm --filter <admin-app-name> test` — expect PASS with no skipped cases.
- [ ] Commit: `test(admin): fill wizard state coverage gaps`

### Task 5.2: Unit test completeness — validation, formatting, detection

**Files:** wherever hostname validation, price formatting, and registrar detection live (Tasks 2.1, 2.2, 3.2).

- [ ] Domain input validation: apex vs subdomain, punycode/IDN, trailing dot, uppercase — add any missing cases.
- [ ] Price formatting including renewal-year display — add any missing cases.
- [ ] Registrar detection mapping — add any missing cases.
- [ ] `pnpm --filter <admin-app-name> test` — expect PASS.
- [ ] Commit: `test(admin): unit test coverage for domain validation and formatting`

### Task 5.3: E2E coverage

**Files:** wherever this repo's existing E2E suite lives (check `apps/admin` or a root-level `e2e/` — follow the established runner and mocked-backend convention rather than introducing a new one).

- [ ] Connect happy path.
- [ ] Connect: wrong record value.
- [ ] Connect: conflicting existing record.
- [ ] Connect: verification timeout.
- [ ] Purchase happy path.
- [ ] Purchase: registration fails after payment (refund messaging).
- [ ] Resume the connect wizard after a reload.
- [ ] Resume the connect wizard on a second device (simulate via a fresh session/localStorage-cleared context hitting the same domain id).
- [ ] All scenarios run against a mocked backend, per the spec.
- [ ] Commit: `test(admin): e2e coverage for both domain wizards`

### Task 5.4: a11y and i18n QA pass

- [ ] Keyboard-navigate both wizards end to end manually or via an automated keyboard-nav test; fix any trap or unreachable control.
- [ ] Confirm progress changes are announced (`aria-live` regions) — add where missing.
- [ ] Confirm `CopyButton` announces success to screen readers, not just visually.
- [ ] Run the app in `ja` locale and visually confirm both wizards, the guide catalog, and Japanese address input render correctly.
- [ ] `pnpm check:quiet` from repo root (this runs the a11y-gated component tests across all packages) — expect PASS.
- [ ] Commit: `fix(admin): a11y and i18n QA fixes for domain wizards` (only if fixes were needed; otherwise no commit)

### Task 5.5: Security review pass

- [ ] Grep the entire `apps/admin/src/routes/Domain*.svelte` and `apps/admin/src/lib/domains/*` tree for any `console.log`/analytics call that could include `challenge.token` or `challenge.txt_value` — there must be none.
- [ ] Confirm no UI copy anywhere in the two wizards asks for or references entering registrar credentials — grep for "password"/"credential" in the new i18n keys as a sanity check.
- [ ] Confirm the registrant-details step's "what is sent to the registrar and why" disclosure (Task 3.2) is present and accurate against what `placeDomainOrder` actually transmits.
- [ ] Confirm domain hostname input is normalized to punycode for display of unicode domains (homograph-confusion requirement) — add the missing normalization/display logic if Task 2.2 didn't already cover it.
- [ ] Commit: `fix(admin): security hardening for domain wizards` (only if fixes were needed)

### Task 5.6: Acceptance criteria walkthrough

Run through every checkbox in the spec's "Acceptance criteria" section against the running app and record the result (pass/fail/needs-product-input) in the PR description or a short note in this plan file. Anything failing goes back into the relevant wave's task list rather than being waved through.

**Wave 5 exit criteria:** every spec acceptance-criteria checkbox is either demonstrably true or explicitly flagged with a reason it can't be (e.g. usability testing with a real non-technical user is outside engineering's ability to self-certify — flag it for product/QA, don't mark it done unverified). `pnpm check:quiet && pnpm test:quiet` pass at the repo root.

---

## Self-review notes

- **Spec coverage:** all 10 "Work breakdown" items map to a task (1→Wave1/1.4, 2→Wave2/2.2-2.3, 3→Wave2/2.1+Wave4/4.3, 4→Wave1/1.2, 5→Wave2/2.3, 6→Wave2/2.3, 7→Wave3, 8→Wave4/4.1, 9→Wave4/4.2, 10→Wave5/5.3). Testing section → Wave 5. Security section → Wave 5/5.5 plus constraints called out per-wave. Acceptance criteria → Wave 5/5.6.
- **Contract gaps:** flagged explicitly rather than papered over (see "Known contract gaps" above) — Wave 1's detail table and Wave 4's health surfaces must be built against the real view schema, not the spec's idealized description, and any real gap gets called out in review rather than faked.
- **Type consistency:** the registrant contact form (Task 3.1/3.2) is typed directly as the generated `RegistrantContact` schema, not re-declared — avoids the classic drift between a hand-rolled type and the generated one. (Correction made 2026-08-30 before Wave 3 kickoff: the originally planned `AddressFields` component assumed a full postal address; the real schema has no address fields at all, only `name/email/phone/country_code/organization`.)
