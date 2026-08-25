# TASK-013: 10.4 Creative management & placement previews

**Phase:** 10
**Status:** todo
**Requirement(s):** FR-1007, NFR-1001, NFR-1004
**Depends on:** TASK-012
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-013 (Meta adapter, creative endpoints, creative half of the matrix)
**Slice:** 10.4 — Meta adapter & creatives
**Prerelease:** `v0.11.0-alpha.5` · **Flag:** `advertising.meta`

## Context

The second network arrives — and the point of this task is how little of it is frontend work. List,
builder, detail, and drift already handle Meta; the work here is creatives, previews, and
**verification** that nothing platform-specific was needed.

**The rule: every frontend line added for Meta is a bug in TASK-010.** Deviations are permitted only
for genuinely visual concerns (a placement preview frame), never for field logic, validation, or
availability. Any `platform === 'meta'` in a form path is fixed in the matrix instead — the PR
checklist for this task includes exactly that grep.

## What to do

- [ ] **Contract** — `GET/POST /creatives`, `GET/DELETE /creatives/{id}`,
      `GET /creatives/{id}/previews?placement=`. The capability matrix now carries its creative half for
      both platforms: placements, asset specs (dimensions, aspect ratios, file size, duration), text
      fields with per-locale limits, and valid combinations.
- [ ] **Creative management** — asset upload reusing `@sanvi/course-media` components (not a second
      uploader), per-locale copy fields with character counters **driven by the matrix**, and assignment
      to placements.
- [ ] **Placement previews** — render each selected placement's frame with the actual assets and copy,
      themed via phase-07 tokens. Japanese copy previews with phase-06 CJK typography rules, because a
      headline that fits in English and overflows in Japanese is a phase-06 bug caught here.
- [ ] **Spec feedback** — an asset that does not meet a selected placement's spec says **which
      placement and which dimension**, at upload, with the option to drop the placement instead of the
      asset.
- [ ] **Meta in the existing screens** — list, builder, detail, and drift already handle it. The work is
      verification and the platform badge, not new screens.
- [ ] **Cross-platform list** — the campaign list now genuinely spans two platforms: mixed sorting,
      per-platform badges, and currency handling when two connections report in different currencies —
      shown natively, **never silently summed**.

## Acceptance criteria

- [ ] A Meta campaign is built and validated through the existing builder with **zero** platform-specific
      frontend code added — the grep gate proves it, and the PR diff shows no new form-path branches.
- [ ] The fake adapter's third, unimplemented-by-anyone matrix renders a valid builder with no code
      change — the "third network is an adapter" criterion, demonstrated rather than asserted.
- [ ] An asset failing one placement's spec is rejected for that placement only, at upload, naming the
      placement and the failing dimension.
- [ ] Identical copy passes in English and fails in Japanese where Meta's limit is shorter; the counter
      shows the right limit per field per locale.
- [ ] A natively paused Meta ad set renders in the existing drift view with a correct diff.
- [ ] Two connections in USD and JPY render natively in the list with **no total row summing them**.
- [ ] Visual snapshots pass for placement previews across every shipped theme and both locales,
      including CJK line breaking.
- [ ] axe passes on creative management and previews; the uploader is fully keyboard operable.

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

Meta metrics in the dashboard (TASK-016), the Meta Conversions API surface (TASK-015), and any
campaign-screen redesign — if a screen needs changing for Meta, that is the finding, not the task.

## Files likely touched

- `apps/admin/src/routes/advertising/Creatives.svelte`
- `packages/ui/src/advertising/PlacementPreview.svelte`, character-counter field
- `packages/course-media` integration in the creative uploader
- `packages/i18n` catalogs (`en`, `ja`), visual snapshot fixtures
- admin e2e specs

## Notes / gotchas

- Rollback: `advertising.meta` off → Meta disappears from the catalog and its endpoints return
  `503`; Google is untouched. Meta connections stay listed and keep refreshing, and live Meta campaigns
  keep spending — the UI says so.
- Reuse `course-media`. A second uploader means a second CSP story and a second a11y audit.
- If a preview needs a platform branch, keep it strictly visual and keep it out of any code path that
  decides field availability or validity.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
