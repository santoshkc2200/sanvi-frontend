# TASK-014: 10.5 Tracking setup, storefront beacon & test event

**Phase:** 10
**Status:** done
**Requirement(s):** FR-1008, NFR-1006, NFR-1008
**Depends on:** TASK-011
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-014 (`/public/track`, tracking settings, test event)
**Slice:** 10.5 — Conversion capture & the directive gate
**Prerelease:** `v0.11.0-alpha.6` · **Flag:** `advertising.conversion_tracking`

## Context

Two deliverables: the tenant-facing screen that says what is tracked and what will happen to it, and
the storefront beacon that fires the event. Nothing uploads in this slice — the gate ships before the
pipe — so the setup screen must be honest that capture and upload are different things.

The beacon is same-origin by design: it posts to the tenant's own verified domain, so it needs **no CSP
relaxation** and adds essentially nothing to the storefront bundle. If either of those stops being true,
stop and reopen the design.

The one-click test event is the screen that turns "is tracking working?" into an answer in ten seconds.
Build it properly; it is the most-used surface of this slice after launch.

## What to do

- [x] **Contract** — `GET/PUT /ads/tracking/settings`, `POST /ads/tracking/test-event`,
      `GET /ads/conversions`, and the public `POST /api/v1/public/track` the beacon posts to (site key,
      same-origin, `202` with an uninformative body).
- [x] **Tracking setup UI** — which events are tracked, where they fire, and how each maps to each
      platform's conversion action. The mapping is a **matrix, not a list**, because one purchase maps to
      a different conversion action per platform.
- [x] **Storefront beacon** — fires to the same-origin endpoint from the tenant's domain, carrying the
      **server-issued `event_id`** from the phase-09 confirmation payload. Uses `sendBeacon` with a
      fetch fallback and never blocks the confirmation render.
- [x] **Consent linkage** — the setup screen states the privacy dependency plainly: without
      `ads_measurement`, or with a US opt-out of sale/share including one expressed via GPC, conversions
      are **captured but not uploaded**. Names the purposes; links to the phase-05 privacy centre.
- [x] **One-click test event** — fires the synthetic event and shows live what was captured, what the
      resolver decided, and which click ids were present.
- [x] **Conversion list** — recent events with value, value source, and directive outcome. Upload status
      columns are present but empty until TASK-015, and **labelled as such** rather than blank.

## Acceptance criteria

- [x] A storefront purchase fires exactly one beacon carrying the server-issued `event_id`; a refresh of
      the confirmation page fires no second one.
- [x] The beacon never blocks or delays the confirmation render (asserted in the storefront e2e path).
- [x] The storefront CSP snapshot is **unchanged** from TASK-009 (byte-pinned test in `@sanvi/csp`
      stays green; the beacon needs no relaxation — same-origin is the design).
- [ ] **NOT met as stated** — the storefront bundle grew only by the beacon: the beacon itself is
      ~1.6 KB raw in the return-page chunk and every per-chunk budget passes, but `pnpm check:budget`
      is red on the storefront's *initial-JS* budget (152.5 / 138 KB gz) because the shared i18n
      catalog blob every app bundles whole now also carries phase-10's `admin.advertising.*` keys
      (372 from TASK-011…013 + 72 here). Red on this branch's base too (151.6 / 115 — the base
      predated main's 135→138 raise), and marketing is red for the same reason (123.6 / 110, red
      since TASK-009). Per 3f36e3a there is deliberately **no third budget raise**; the structural
      fix is TASK-032 (shard the catalogs by surface). Admin and platform-admin are green.
- [x] The event-to-conversion-action mapping renders as a per-platform matrix and round-trips through
      `PUT /tracking/settings`.
- [x] The test event returns and displays what was captured, the resolver's decision with its purpose
      and signal source, and which click ids were present — within one interaction.
- [x] The consent linkage copy names the purposes and links to the privacy centre, in `en` and `ja`.
- [x] Empty upload columns are labelled "available after upload is enabled" rather than rendered blank.
- [x] axe passes on the setup screen, the test-event result, and the conversion list.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:budget
pnpm check:boundaries
pnpm test:e2e --filter storefront
pnpm test:e2e --filter admin
```

## Out of scope

Diagnostics, suppression taxonomy, health banner, audience management, and retry (all TASK-015);
dashboard numbers (TASK-016).

## Files likely touched

- `apps/admin/src/routes/advertising/TrackingSetup.svelte`, conversion list route
- `apps/storefront/src/lib/tracking/beacon.ts` + confirmation-page wiring
- `packages/api-client/src/advertising.ts`
- `packages/i18n` catalogs (`en`, `ja`) — privacy dependency copy, test-event results
- storefront and admin e2e specs

## Notes / gotchas

- Rollback: `advertising.conversion_tracking` off → the beacon is not emitted and the setup screen shows
  a disabled state. Events are lost for the duration rather than queued — deliberate, and the disabled
  state should say so.
- Never mint an `event_id` in the browser. It comes from the phase-09 confirmation payload; a
  client-generated id defeats dedupe on the platform side.
- "Captured" and "uploaded" are different words on this screen. Conflating them makes TASK-015's
  diagnostics unreadable.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*

## Execution notes (2026-09-06)

**Transport deviation from the task text (recorded deliberately).** The task said "uses sendBeacon
with a fetch fallback", but the backend authenticates `/public/track` with an `X-Site-Key` header
(`tracking_handlers.rs`), and `navigator.sendBeacon` cannot set headers — a sendBeacon beacon could
never pass the gate. The implemented priority in `@sanvi/api-client`'s `sendConversionBeacon`:
when a site key is configured, `fetch` with `keepalive: true` carries the header (beacon-grade:
non-blocking, survives page teardown); `sendBeacon` remains the fallback only for a headerless
deployment, which does not exist today.

**Emission gate.** The storefront does not fire the beacon at all without a site key
(`fireConversionBeacon` returns early). A headerless beacon is 202-dropped by the backend anyway,
so gating emission on the same switch that governs capture makes the rollback note above literally
true: no site key / flag off → nothing sent, nothing queued. This also drives the disabled state on
the admin setup screen (`advertising.conversion_tracking` entitlement off → explicit disabled
notice, no editable form).

**Open cross-repo item — site-key delivery.** No backend surface hands the storefront its site key
yet (`TenantContext` carries no flags/site key; the backend's own TASK-014 backlog note records
mounting `/public/track` on the tenant's phase-08 domain as still open). This slice reads
`PUBLIC_TRACKING_SITE_KEY` from the runtime env (`lib/env.ts`) — correct for single-tenant
deployments and the e2e harness; per-tenant delivery will replace it when the backend lands the
surface, and nothing else should need to change.

**Click ids.** The confirmation page's referrer carries no `gclid`, so the backend's server-side
extraction cannot see the landing click. `lib/tracking/click-ids.ts` observes `gclid`/`gbraid`/
`wbraid` at landing (wired in the root layout), stashes them in `sessionStorage` with the capture
time, and the beacon sends them in the body; the backend merges its own `_fbp`/`_fbc` cookie
observation on top.

**main was merged into the branch** (3f36e3a) mid-task — it carried the TASK-010 review fixes
(80b7ef5: non-active-locale error surfacing, targetingMessages, stable schema digest) that the
task-011…013 branch lineage never had, plus the lazy-loaded `ja` catalog. `CapabilityForm.svelte`
and `AdvertisingSettings.svelte` needed true two-side combinations (TASK-012's autosave/binding
semantics + 80b7ef5's review fixes); `capability-form` and admin advertising tests verify the
combination.

**Verification results.** `pnpm lint` / `typecheck` / `test` / `build` / `check:i18n` /
`check:tokens` / `check:boundaries` green. `pnpm check:budget` red on storefront and marketing only
(see the acceptance-criterion note above; admin and platform-admin green after the merge). e2e:
new `advertising-tracking.spec.ts` (admin, 10/10) and `checkout-beacon.spec.ts` (storefront, 9/9
across chromium/webkit/mobile-chrome). Pre-existing failures, identical on main, untouched here:
admin payments-onboarding (4), storefront locale/us-privacy/consent-opt-in (22 — fallout of main's
lazy-`ja` catalog change, reproduced on a clean `main` worktree). Storefront CSP snapshot test
(byte-identical to phase 09) green. Prerelease tag/staging deploy not run — no pipeline in this
environment.
