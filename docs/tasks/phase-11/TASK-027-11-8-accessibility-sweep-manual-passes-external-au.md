# TASK-027: 11.8 Accessibility sweep, manual passes & external audit

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1118, FR-1119, FR-1120, FR-1121, NFR-1103, NFR-1110
**Depends on:** TASK-022
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-027 (field-addressable errors, deterministic collection ordering)
**Slice:** 11.8 — Accessibility (WCAG 2.2 AA) & external audit
**Prerelease:** `v1.0.0-rc.9` · **Gate:** axe serious/critical blocking in CI

## Context

Reach WCAG 2.2 AA across all four apps, verified by automated sweeps, by manual passes with real
assistive technology, and by an external auditor — then publish an accessibility statement that is true.

The a11y contracts have been lint-enforced since phase 00, so this task **audits and polishes rather
than remediating from zero**. Where that assumption turns out to be optimistic, the finding is recorded
as a lint gap and the gate is strengthened, so the same class of defect cannot return.

It depends on TASK-022 for a reason that is easy to get backwards: performance work moves DOM around —
lazy boundaries, streaming order, deferred hydration — so auditing before that lands means auditing
twice, and the second audit is the one that gets skipped.

## What to do

- [ ] **Contract** — consume the backend's two affordances: **field-addressable validation errors** (so
      messages associate programmatically and the error summary can link to the offending input) and
      **deterministic collection ordering** (so keyboard position and screen-reader context survive a
      refresh).
- [ ] **Automated sweep** — axe across every route of all four apps, both locales, in CI, **blocking on
      serious and critical from this task onward**. Route coverage is asserted: a new route with no axe
      run fails the gate.
- [ ] **Manual passes, per app** — keyboard only; screen readers (NVDA, JAWS, VoiceOver — at least two
      per app, including one on iOS); zoom to 400 % and 320 px reflow; reduced motion; forced colours.
      Each pass has a checklist and a **recorded runner**.
- [ ] **Focus management** — dialogs, drawers, route changes, async results, toasts, and above all the
      phase 08–10 wizards: focus moves to the right place, returns to the trigger on close, is never
      trapped except deliberately, and is never lost to a removed element. Route changes announce.
- [ ] **Forms** — programmatic labels everywhere, error association via `aria-describedby`, an error
      summary at the top with skip links to each field, required-ness conveyed non-visually, and **no
      colour-only status anywhere in the product**.
- [ ] **Charts (phase 10)** — every chart has an accessible data table alternative, a text summary of the
      trend, and non-colour encodings (shape, pattern, direct labels). The ROAS dashboard is the densest
      surface in the product and therefore the one most likely to fail.
- [ ] **Theming interaction** — re-run the phase-07 contrast gates against **real published themes** from
      TASK-019's scale data, not against the default token set. A theme that would fail is rejected at
      publish time with a clear message, not rendered at AA-minus.
- [ ] **Localisation interaction** — Japanese line breaking, ruby text where used, and 400 % zoom with
      CJK; label lengths that overflow in one locale are found by test, not by a user.
- [ ] **External accessibility audit** — executed against the release candidate (booked in TASK-019),
      findings triaged within a week, all serious and critical remediated before GA, each with a
      regression test.
- [ ] **Accessibility statement** — published per app, naming the standard, the known gaps with dates,
      the assistive technologies tested, and a contact route for reporting problems.

## Acceptance criteria

- [ ] Zero serious or critical axe findings across every route × every locale × both themes, with the
      gate **blocking**.
- [ ] A route added without an axe entry fails CI — proven in the PR.
- [ ] Manual keyboard, screen-reader, zoom, reflow, reduced-motion, and forced-colours passes are
      completed per app with recorded runners and checklists.
- [ ] Keyboard-only e2e completes the critical journeys entirely without a mouse: complete checkout,
      connect a domain, publish a campaign, and change a plan.
- [ ] Focus-order assertions pass on every wizard and dialog, including the async-result path and
      return-on-close.
- [ ] Every form has programmatic labels, associated errors, and a linked error summary; **no colour-only
      status remains in the product**, asserted by a sweep.
- [ ] Every chart has a data table, a text summary, and a non-colour encoding; screen-reader snapshot
      tests pass on the chart alternatives and the error summaries.
- [ ] Contrast tests pass over the **real published themes** from scale data, and a failing theme is
      rejected at publish with a clear message.
- [ ] Reduced motion is honoured everywhere, including chart transitions and the theme previewer.
- [ ] 400 % zoom and 320 px reflow screenshots are captured per app per locale and reviewed.
- [ ] **External audit findings are remediated, each with a regression test.**
- [ ] The accessibility statement is published for all four apps in both locales.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:a11y
pnpm check:contrast --themes=published
pnpm test:e2e --grep keyboard
pnpm test:e2e --project=reflow-400
```

## Out of scope

The backend's error addressability, collection ordering, and email template work (backend TASK-027).
Performance changes (TASK-022) — if this task finds a performance problem, it files it rather than fixing
it, because a DOM change here restarts the audit.

## Files likely touched

- every app's routes with an axe entry, plus the route-coverage gate
- `packages/ui/**` (focus management primitives, error summary, chart data tables and text summaries)
- phase 08–10 wizards (focus order, async result announcement)
- `packages/design-tokens` / theming contrast gate (published-theme validation, publish-time rejection)
- `packages/i18n` catalogs (`en`, `ja`) — statement copy, error summaries, chart summaries
- `apps/*/src/routes/accessibility/**` (published statements)

## Notes / gotchas

- **Accessibility fixes are not rolled back**; a regression here is a defect, not a trade-off. The single
  change that can block a tenant's workflow is publish-time theme rejection: it ships in **warn mode
  first**, with the list of currently-failing published themes sent to those tenants and a migration
  window, before it becomes a hard rejection.
- The audit was booked in TASK-019. If it was not, this task is already late — the engagement is a
  multi-week queue and its findings need a remediation window before GA.
- Testing against the default token set proves nothing about tenant themes. The published themes from
  scale data are the population that matters.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
