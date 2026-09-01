# TASK-027: 11.8 Accessibility sweep, manual passes & statement

**Phase:** 11 · **Status:** todo · **Size:** L
**Requirement(s):** FR-1118, FR-1119, FR-1120, FR-1121, NFR-1103, NFR-1110
**Depends on:** TASK-022, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-027 (field-addressable errors, deterministic collection ordering)
**Gate:** axe serious/critical becomes **blocking** in this task

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Reach WCAG 2.2 AA across all four apps as far as automated sweeps, keyboard testing, and a VoiceOver
pass can verify — then publish an accessibility statement that describes **what was actually tested**.

## Why this shape

The a11y contracts have been lint-enforced since phase 00, so this task **audits and polishes rather
than remediating from zero**. Where that assumption turns out optimistic, the finding is recorded as a
lint gap and the gate is strengthened, so the same class of defect cannot return.

There is no budget for an external audit, and that changes what can honestly be published. Automated
axe catches roughly a third of WCAG issues; keyboard-only e2e, a VoiceOver pass, and contrast gates over
real published themes catch a good deal more; an external auditor catches the rest. **So the statement
describes the method and names the missing audit as a known gap rather than claiming AA conformance.**
Claiming conformance without an audit would be the one accessibility failure that is also a false
statement.

It depends on TASK-022 for a reason easy to get backwards: performance work moves DOM around — lazy
boundaries, streaming order, deferred hydration — so auditing before that lands means auditing twice,
and the second audit is the one that gets skipped.

## Constraints

- **Accessibility fixes are not rolled back**; a regression here is a defect, not a trade-off.
- The one change that can block a tenant's workflow is publish-time theme rejection. It ships in **warn
  mode first**, with the list of currently-failing published themes sent to those tenants and a
  migration window, before it becomes a hard rejection.
- Testing against the default token set proves nothing about tenant themes. The **published** themes are
  the population that matters.
- If this task finds a performance problem, it **files** it rather than fixing it — a DOM change here
  restarts the audit.

## File ownership map

- every app's routes with an axe entry, plus the route-coverage gate
- `packages/ui/**` — focus management primitives, error summary, chart data tables and text summaries
- phase 08–10 wizards — focus order, async result announcement
- `packages/design-tokens` and the theming contrast gate — published-theme validation
- `packages/i18n` catalogs (`en`, `ja`) — statement copy, error summaries, chart summaries
- `apps/*/src/routes/accessibility/**` — published statements

## Steps

### Step 1: Turn axe blocking with route coverage asserted

**Files:** Modify `scripts/check-a11y.mjs`, `.github/workflows/**`

**Do:** axe across every route of all four apps, both locales, both themes, blocking on serious and
critical. Route coverage is asserted: **a new route with no axe run fails the gate.**

**Verify:** `pnpm check:a11y` blocks; add a throwaway route with no entry and confirm the gate fails.

### Step 2: Consume the backend's two affordances

**Files:** Modify `packages/ui/**`, form components

**Do:** field-addressable validation errors, so messages associate programmatically and the error
summary links to the offending input; deterministic collection ordering, so keyboard position and
screen-reader context survive a refresh.

**Verify:** a test asserts an error summary links to each offending field, and that list order is stable
across a refresh.

### Step 3: Fix focus management, wizards first

**Files:** Modify `packages/ui/**`, phase 08–10 wizards

**Do:** dialogs, drawers, route changes, async results, toasts. Focus moves to the right place, returns
to the trigger on close, is never trapped except deliberately, and is never lost to a removed element.
Route changes announce.

**Verify:** focus-order assertions pass on every wizard and dialog, **including the async-result path
and return-on-close**.

### Step 4: Fix the forms

**Files:** Modify form components across all four apps

**Do:** programmatic labels everywhere, error association via `aria-describedby`, an error summary at
the top with skip links to each field, required-ness conveyed non-visually.

**Verify:** a sweep asserts **no colour-only status remains anywhere in the product**.

### Step 5: Make the charts accessible

**Files:** Modify `packages/ui/**` chart components

**Do:** an accessible data table alternative, a text summary of the trend, and non-colour encodings —
shape, pattern, direct labels. The ROAS dashboard is the densest surface in the product and therefore
the one most likely to fail.

**Verify:** screen-reader snapshot tests pass on the chart alternatives; every chart has a data table
and a text summary.

### Step 6: Gate contrast on real published themes

**Files:** Modify `packages/design-tokens` and the theming contrast gate

**Do:** re-run the phase-07 contrast gates against **real published themes**, not the default token set.
A theme that would fail is rejected at publish time with a clear message — **warn mode first**, with the
failing-theme list sent to those tenants and a migration window.

**Verify:** `pnpm check:contrast --themes=published` passes; a deliberately failing theme is rejected at
publish with a clear message.

### Step 7: Run the manual passes and record them

**Files:** Create `docs/a11y/manual-passes.md`

**Do:** per app — keyboard only; **VoiceOver on macOS**; zoom to 400 % and 320 px reflow; reduced
motion; forced colours. Each pass has a checklist and a recorded date. NVDA and JAWS are not available
(parked); record that explicitly rather than leaving the impression they were run.

**Verify:** every app has a completed checklist per pass with a date; 400 % zoom and 320 px reflow
screenshots are captured per app per locale and reviewed.

### Step 8: Prove the critical journeys work without a mouse

**Files:** Modify e2e specs

**Do:** keyboard-only e2e completing the critical journeys end to end: complete checkout, connect a
domain, publish a campaign, change a plan.

**Verify:** `pnpm test:e2e --grep keyboard` is green.

### Step 9: Check the Japanese locale specifically

**Files:** Modify `packages/i18n`, layout components

**Do:** Japanese line breaking, ruby text where used, 400 % zoom with CJK, and label lengths that
overflow in one locale found by test rather than by a user.

**Verify:** a layout test catches an overflowing label in either locale.

### Step 10: Publish an honest statement

**Files:** Create `apps/*/src/routes/accessibility/**`; Modify `packages/i18n`

**Do:** per app, in both locales: the standard targeted, **the method actually used** (automated axe,
keyboard, VoiceOver, contrast over published themes), the known gaps with dates — including **the
absence of an external audit and of NVDA/JAWS testing** — and a contact route for reporting problems.

**Verify:** the statement names the method and the gaps; a test asserts it does not claim conformance.

## Definition of done

- [ ] Zero serious or critical axe findings across every route × locale × theme, with the gate blocking.
- [ ] A route added without an axe entry fails CI, proven in the PR.
- [ ] Error summaries link to offending fields; list order is stable across a refresh.
- [ ] Focus-order assertions pass on every wizard and dialog, including async-result and return-on-close.
- [ ] Every form has programmatic labels, associated errors, and a linked error summary; no colour-only
      status remains in the product.
- [ ] Every chart has a data table, a text summary, and a non-colour encoding.
- [ ] Contrast passes over real published themes; a failing theme is rejected at publish, warn mode
      first.
- [ ] Keyboard-only e2e completes checkout, domain connect, campaign publish, and plan change.
- [ ] Reduced motion is honoured everywhere, including chart transitions and the theme previewer.
- [ ] 400 % zoom and 320 px reflow screenshots captured per app per locale and reviewed.
- [ ] Manual passes are recorded per app with dates, and the unavailable ones are named as unavailable.
- [ ] The accessibility statement is published for all four apps in both locales, describes the method,
      names the missing external audit, and does not claim conformance.

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
Performance changes (TASK-022).

## Parked

The external WCAG 2.2 AA audit, a conformance claim, NVDA and JAWS passes, and a named independent
runner for the manual passes — see [`../../release/needs-humans.md`](../../release/needs-humans.md).
This is the largest unmitigated gap on the frontend side and is named in the GA checklist.

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
