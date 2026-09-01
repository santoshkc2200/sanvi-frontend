# TASK-030: 11.11 E2E completion, browser matrix, visual baseline & documentation

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1124, FR-1125, FR-1126, NFR-1105
**Depends on:** TASK-024, TASK-025, TASK-026, TASK-027, TASK-029, **phases 09 and 10 shipped**
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Blocked by (cross-repo):** sanvi-backend TASK-030 (release gate re-run, flag cleanup)
**Release:** unblocks the backend's `v1.0.0` tag

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Prove the whole product one more time on the engines available, and close the documentation and flake
debt that eleven phases accumulated.

**This task adds nothing. Its entire output is confidence.**

It is the one cross-repo edge running frontend-to-backend: **the backend cannot tag `v1.0.0` until this
task is done.**

## Why this shape

The original browser matrix was the latest two versions of Chrome, Safari, Firefox, and Edge plus real
iOS Safari and Android Chrome on mid-range hardware. There is no browser grid and no device lab.
Playwright runs Chromium, Firefox, and WebKit locally, which covers the three **engines** but not the
vendor builds — Edge is Chromium, so engine coverage is real, but a vendor-specific regression would not
be caught. That distinction is written into the matrix document rather than glossed over.

The onboarding-path verification loses its meaning without a new engineer to follow it. The guide is
still written and its commands are still executed end to end; "someone followed it" is the stronger
claim and is not available.

## Constraints

- **A quarantined flake that is invisible in the run output is a disabled test with better branding.**
  Make quarantine loud.
- Visual diffs are reviewed, never auto-accepted.
- The matrix is written down and **actually run**, not assumed from a "modern browsers" claim.

## File ownership map

- e2e specs across all four apps — journey completion, matrix projects, quarantine annotations
- visual regression baselines across themes × locales
- `docs/testing/browser-matrix.md`, `docs/incident-runbook.md`, `CONTRIBUTING.md`, onboarding guide
- component library publishing config
- `benchmarks/frontend/rc.12.json`

## Steps

### Step 1: Complete the e2e suite

**Files:** Modify e2e specs across all four apps

**Do:** every phase's critical journeys — signup and tenant provisioning, auth including social, RBAC
boundaries, platform billing checkout and portal, privacy centre in both consent modes, locale
switching, theme publish, domain connect and purchase, tenant Connect onboarding and storefront
checkout, campaign publish and conversion flow, quota-limit states, plus an offline/degraded variant per
app.

**Verify:** a coverage check maps each listed journey to at least one spec and fails on an unmapped one.

### Step 2: Write down the matrix, then run it

**Files:** Create `docs/testing/browser-matrix.md`; Modify e2e configuration

**Do:** Chromium, Firefox, and WebKit projects, plus the pinned mobile emulation profiles from
TASK-031. State explicitly in the document that this is **engine coverage, not vendor-build coverage**,
and that Edge and real devices are untested.

**Verify:** `pnpm test:e2e --matrix=full` is green across every project in the document, and every entry
in the document was run for this release.

### Step 3: Enforce the flake policy loudly

**Files:** Modify e2e configuration and quarantine annotations

**Do:** anything intermittent is quarantined with an owner and a deadline, and **quarantine is printed
in the run output**.

**Verify:** a quarantined test appears in the run summary; the run fails if a quarantine has passed its
deadline.

### Step 4: Establish the visual baseline

**Files:** Create visual regression baselines across themes × locales

**Do:** key screens across themes and locales, approved and stable.

**Verify:** two consecutive runs on the same build produce no diffs; every diff in this release was
reviewed rather than auto-accepted.

### Step 5: Close the documentation debt

**Files:** Modify `CONTRIBUTING.md`, onboarding guide; Create `docs/incident-runbook.md`; component
library publishing config

**Do:** publish the component library, bring the contribution guide current, write a frontend incident
runbook, and write an onboarding path.

**Verify:** the component library builds and publishes; **every command in the onboarding guide is
executed end to end from a clean clone**, and whatever fails is fixed. Record in the guide that it was
verified by execution rather than by a first-time reader.

### Step 6: Re-run every gate on the release candidate

**Files:** `benchmarks/frontend/rc.12.json`

**Do:** Lighthouse, axe, and bundle gates on the candidate; commit the final benchmark artifact.

**Verify:** all gates green; `pnpm bench:compare` shows no regression against `rc.1` or any intervening
candidate.

## Definition of done

- [ ] The e2e suite covers every listed journey, verified by a coverage check, and is green on every
      matrix project including slow-network and offline variants.
- [ ] `docs/testing/browser-matrix.md` is written, states its engine-versus-vendor-build limitation, and
      every entry was run for this release.
- [ ] Zero known flakes; any quarantined test has an owner, a deadline, and appears in the run output.
- [ ] The visual baseline is stable across two consecutive runs on the same build; every diff was
      reviewed.
- [ ] Lighthouse, axe, and bundle gates are green on the release candidate.
- [ ] `benchmarks/frontend/rc.12.json` is committed with no regression against `rc.1` or any intervening
      candidate.
- [ ] The component library is published, the contribution guide is current, and the incident runbook
      exists.
- [ ] Every command in the onboarding guide was executed from a clean clone and what failed was fixed.

## Verification

```bash
pnpm generate:api
pnpm check:all
pnpm check:a11y
pnpm check:budget
pnpm check:lighthouse
pnpm test:e2e --matrix=full
pnpm test:e2e --project=slow-3g
pnpm test:e2e --project=offline
pnpm test:visual
pnpm bench:compare rc.1 rc.12
```

## Out of scope

Any new capability whatsoever. Backend release gates, flag cleanup, migrations, and the tag itself
(backend TASK-030). Anything discovered here that is not on the GA checklist goes to the post-GA
backlog with a date — that is the mechanism that makes the phase end.

## Parked

The Edge and vendor-build matrix, real mid-range device testing, release-health watch through a rollout,
and onboarding verified by a new engineer — see
[`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
