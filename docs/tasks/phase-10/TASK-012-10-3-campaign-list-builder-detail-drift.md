# TASK-012: 10.3 Campaign list, builder, detail & drift

**Phase:** 10
**Status:** done (2026-09-04 — code + local gates green; `check:budget` red only by the
pre-existing marketing/platform-admin shared i18n-catalog chunk, verified red on this branch's
base; staging deploy and `v0.11.0-alpha.4` tag not run from this environment — see Execution
notes)
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

- [x] **Contract** — `GET/POST /campaigns`, `GET/PATCH /campaigns/{id}`, `/publish`, `/pause`,
      `/resume`, `/validate`, `/changes`, `/drift`, plus ad-group and ad sub-resources. `PATCH` carries
      `Idempotency-Key` and `If-Match` on the campaign revision; a `409` renders as "changed since you
      opened this" with the current state, never a silent retry.
- [x] **Campaign list** — cross-platform table (one platform for now, built for two): name, platform
      badge, status, budget, spend today/period (empty until TASK-016), conversions, ROAS, drift
      indicator. Bulk pause/resume with a confirmation naming the count **and the combined daily budget
      affected**.
- [x] **Campaign builder** — stepper (objective → targeting → budget & schedule → creatives → review)
      composed entirely from the form engine against the live matrix. Client-side validation runs before
      submit; `POST /validate` confirms per step. Drafts autosave and resume — a long builder that loses
      work on a refresh will not be used twice.
- [x] **Budget confirmation** — an increase above the configured threshold requires explicit
      confirmation showing the daily and projected monthly delta **in the ad account's currency**.
- [x] **Campaign detail** — performance over time (placeholder until TASK-016), ad groups and ads,
      per-ad review status with the platform's rejection text **verbatim**, and the change log rendered
      as readable history rather than a JSON dump.
- [x] **Drift view** — a field-by-field diff of our intent against the platform's current state, with
      "keep theirs" and "reapply ours" as equal-weight choices. **No default selection, no
      auto-resolve.**
- [x] **Empty and error states** — no connection, no campaigns, publish failed with the platform's
      message, quota exceeded (retry with a time, not "try again later").

## Acceptance criteria

- [x] A campaign is created through the builder against the live matrix with **no platform-specific
      frontend code** — the grep gate from TASK-010 stays green.
- [x] A draft rejected client-side is rejected server-side with the same field paths, and vice versa
      (validation parity test against the fake and the real matrix).
- [x] A refresh mid-builder resumes the draft with every entered value intact.
- [x] A budget increase above the threshold cannot be submitted without confirming a dialog that shows
      the daily and monthly delta in the ad account's currency.
- [x] Bulk pause names the campaign count and the combined daily budget before confirming.
- [x] A `409` on `PATCH` renders the current state and the conflict, and does not resubmit.
- [x] The drift view renders a correct diff with two equal-weight actions and no preselected choice;
      neither action fires without an explicit click.
- [x] The change log answers "who paused this campaign" in the UI, with platform-sourced changes
      attributed to the platform.
- [x] Ad rejection reasons are displayed verbatim, not paraphrased or truncated.
- [x] axe passes on list, builder (every step), detail, and drift; the whole builder including the
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

## Execution notes (2026-09-04)

- **Contract gap — per-ad review status.** The merged contract's `Ad` schema carries no review
  or rejection fields in this slice (verified against `generated/types.ts` and the backend's
  shipped `advertising.yaml` paths). The platform's verbatim text renders wherever the contract
  *does* carry it: publish-time platform rejections surface field messages verbatim on the
  detail view, and change entries render their platform text as history. The ads table is
  structured so a review-status column drops in the moment the schema adds the field — no
  reshaping. Follow-up for the backend: ad review state per platform.
- **Targeting rides on a seeded ad group.** The contract keeps targeting on ad groups, not on
  the campaign (`CreateCampaignRequest` has no targeting). The builder's targeting step seeds
  one initial ad group carrying the selection on create (`POST /ad-groups` with
  `bid: { strategy: 'manual', maximum_bid: null }` — the generic label the backend's own fake
  adapter uses; per-platform strategies are matrix data this engine has never been given). A
  seed failure leaves the campaign created and says so.
- **Create-mode validation is client-side per step.** `POST /validate` needs a campaign id, so
  the dry-run-per-step gate runs in edit mode only; in create mode the engine gates each step
  and the backend's create response is the final authority, its field violations mapped back
  onto the form. Validation parity is pinned by `validation-parity.test.ts` against all three
  fake-adapter matrices.
- **Stepper composition** lives in `@sanvi/ui` (`forms/builder.ts` step model + per-step
  validation + autosave envelope, `StepperNav.svelte`), with `CapabilityForm` gaining a
  bindable `draft`, `visibleGroups`, `validateScope`, and `submitVisible` — backward
  compatible; all TASK-010 tests pass unchanged. The per-step Continue renders *inside* the
  form so a blocked advance shows field errors rather than doing nothing. `DriftDiff` and
  `ChangeTimeline` are `@sanvi/ui` components as planned; the bulk confirmation composes the
  existing `Dialog` in the route, matching the disconnect-dialog pattern.
- **Budget-increase threshold** is the module constant `BUDGET_CONFIRM_INCREASE_RATIO = 1.2`
  (+20 %) with a 30-day monthly projection constant — per-tenant configuration arrives with
  TASK-017's cap surfaces, which these constants are shaped to be replaced by.
- **Known red.** `check:budget` fails for `marketing` (81.3 KB shared i18n-catalog chunk vs
  50 KB) and `platform-admin` (88.8 KB vs 60 KB). Both fail identically on this branch's base
  (verified by building `feat/task-011-connections-oauth-health` in a clean worktree:
  marketing initial JS 110.6/100 KB there); this task's catalog additions add ≈ 3–4 KB gzip to
  the shared chunk but the gates were already red. Catalog splitting is phase-11 bundle
  hardening (TASK-022). Every other gate (lint, typecheck, test, build, check:i18n,
  check:tokens, check:boundaries, i18n:check, admin advertising e2e on chromium + webkit) is
  green.
- **e2e.** `advertising-campaigns.spec.ts` (8 cases, chromium + webkit) against an extended
  `mock-advertising-backend.ts` (stateful campaign store: idempotent create/publish/pause/
  resume, revision-guarded PATCH answering 409, drift with an explicit-resolution control the
  spec drives to simulate a native-tool edit). The four payments-onboarding e2e failures
  inherited from the base are untouched.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
