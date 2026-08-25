# TASK-014: 10.5 Tracking setup, storefront beacon & test event

**Phase:** 10
**Status:** todo
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

- [ ] **Contract** — `GET/PUT /ads/tracking/settings`, `POST /ads/tracking/test-event`,
      `GET /ads/conversions`, and the public `POST /api/v1/public/track` the beacon posts to (site key,
      same-origin, `202` with an uninformative body).
- [ ] **Tracking setup UI** — which events are tracked, where they fire, and how each maps to each
      platform's conversion action. The mapping is a **matrix, not a list**, because one purchase maps to
      a different conversion action per platform.
- [ ] **Storefront beacon** — fires to the same-origin endpoint from the tenant's domain, carrying the
      **server-issued `event_id`** from the phase-09 confirmation payload. Uses `sendBeacon` with a
      fetch fallback and never blocks the confirmation render.
- [ ] **Consent linkage** — the setup screen states the privacy dependency plainly: without
      `ads_measurement`, or with a US opt-out of sale/share including one expressed via GPC, conversions
      are **captured but not uploaded**. Names the purposes; links to the phase-05 privacy centre.
- [ ] **One-click test event** — fires the synthetic event and shows live what was captured, what the
      resolver decided, and which click ids were present.
- [ ] **Conversion list** — recent events with value, value source, and directive outcome. Upload status
      columns are present but empty until TASK-015, and **labelled as such** rather than blank.

## Acceptance criteria

- [ ] A storefront purchase fires exactly one beacon carrying the server-issued `event_id`; a refresh of
      the confirmation page fires no second one.
- [ ] The beacon never blocks or delays the confirmation render (asserted in the storefront e2e path).
- [ ] The storefront CSP snapshot is **unchanged** from TASK-009, and `pnpm check:budget` shows the
      storefront bundle grew only by the beacon.
- [ ] The event-to-conversion-action mapping renders as a per-platform matrix and round-trips through
      `PUT /tracking/settings`.
- [ ] The test event returns and displays what was captured, the resolver's decision with its purpose
      and signal source, and which click ids were present — within one interaction.
- [ ] The consent linkage copy names the purposes and links to the privacy centre, in `en` and `ja`.
- [ ] Empty upload columns are labelled "available after upload is enabled" rather than rendered blank.
- [ ] axe passes on the setup screen, the test-event result, and the conversion list.

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
