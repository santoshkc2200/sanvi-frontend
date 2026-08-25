# TASK-012: 10.3 Campaign list, builder, detail & drift

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1004, FR-1005, FR-1006, NFR-1001
**Depends on:** TASK-011
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-012 (campaign CRUD, validate, changes, drift)
**Slice:** 10.3 — Campaign tree, Google Ads adapter & drift
**Prerelease:** `v0.11.0-alpha.4` · **Flag:** `advertising.google_ads`

## Context

The campaign manager: a list built for two platforms even while one is connected, a builder composed
entirely from TASK-010's form engine, a detail view that can answer "who paused this", and a drift view
that never resolves a conflict on the tenant's behalf.

This is the first frontend surface where a click spends real money. Budget changes get confirmation
with the actual delta, bulk actions name what they affect, and nothing auto-resolves.

## What to do

- [ ] **Contract** — `GET/POST /campaigns`, `GET/PATCH /campaigns/{id}`, `/publish`, `/pause`,
      `/resume`, `/validate`, `/changes`, `/drift`, plus ad-group and ad sub-resources. `PATCH` carries
      `Idempotency-Key` and `If-Match` on the campaign revision; a `409` renders as "changed since you
      opened this" with the current state, never a silent retry.
- [ ] **Campaign list** — cross-platform table (one platform for now, built for two): name, platform
      badge, status, budget, spend today/period (empty until TASK-016), conversions, ROAS, drift
      indicator. Bulk pause/resume with a confirmation naming the count **and the combined daily budget
      affected**.
- [ ] **Campaign builder** — stepper (objective → targeting → budget & schedule → creatives → review)
      composed entirely from the form engine against the live matrix. Client-side validation runs before
      submit; `POST /validate` confirms per step. Drafts autosave and resume — a long builder that loses
      work on a refresh will not be used twice.
- [ ] **Budget confirmation** — an increase above the configured threshold requires explicit
      confirmation showing the daily and projected monthly delta **in the ad account's currency**.
- [ ] **Campaign detail** — performance over time (placeholder until TASK-016), ad groups and ads,
      per-ad review status with the platform's rejection text **verbatim**, and the change log rendered
      as readable history rather than a JSON dump.
- [ ] **Drift view** — a field-by-field diff of our intent against the platform's current state, with
      "keep theirs" and "reapply ours" as equal-weight choices. **No default selection, no
      auto-resolve.**
- [ ] **Empty and error states** — no connection, no campaigns, publish failed with the platform's
      message, quota exceeded (retry with a time, not "try again later").

## Acceptance criteria

- [ ] A campaign is created through the builder against the live matrix with **no platform-specific
      frontend code** — the grep gate from TASK-010 stays green.
- [ ] A draft rejected client-side is rejected server-side with the same field paths, and vice versa
      (validation parity test against the fake and the real matrix).
- [ ] A refresh mid-builder resumes the draft with every entered value intact.
- [ ] A budget increase above the threshold cannot be submitted without confirming a dialog that shows
      the daily and monthly delta in the ad account's currency.
- [ ] Bulk pause names the campaign count and the combined daily budget before confirming.
- [ ] A `409` on `PATCH` renders the current state and the conflict, and does not resubmit.
- [ ] The drift view renders a correct diff with two equal-weight actions and no preselected choice;
      neither action fires without an explicit click.
- [ ] The change log answers "who paused this campaign" in the UI, with platform-sourced changes
      attributed to the platform.
- [ ] Ad rejection reasons are displayed verbatim, not paraphrased or truncated.
- [ ] axe passes on list, builder (every step), detail, and drift; the whole builder including the
      stepper is keyboard operable; drift and status are never colour-only.

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
pnpm test:e2e --filter admin
```

## Out of scope

Creative fields and placement previews (TASK-013), real spend/ROAS columns and charts (TASK-016),
budget caps and auto-pause (TASK-017).

## Files likely touched

- `apps/admin/src/routes/advertising/{Campaigns,CampaignBuilder,CampaignDetail,Drift}.svelte`
- `packages/ui/src/advertising/**` (diff view, change-log timeline, bulk-action dialog)
- `packages/ui/src/forms/**` (stepper composition, autosave)
- `packages/api-client/src/advertising.ts`
- `packages/i18n` catalogs (`en`, `ja`) — confirmations, error and quota states
- admin e2e specs

## Notes / gotchas

- Rollback: `advertising.google_ads` off → mutation surfaces refuse with
  `503 advertising/platform-unavailable` while campaign **reads** stay available. Live campaigns keep
  spending, and the disabled state must say so rather than implying they are paused.
- Never preselect a drift resolution, and never resolve on navigation. The tenant's Google edit is
  theirs.
- The list is built for two platforms from day one; retrofitting mixed-platform sorting and native
  per-currency rendering in TASK-013 is the expensive path.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
