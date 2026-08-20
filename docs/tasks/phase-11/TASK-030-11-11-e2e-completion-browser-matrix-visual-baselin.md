# TASK-030: 11.11 E2E completion, browser matrix, visual baseline & rollout

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1124, FR-1125, FR-1126, NFR-1105
**Depends on:** TASK-024, TASK-025, TASK-026, TASK-027, TASK-029
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-030 (release gate re-run, flag cleanup, staged rollout)
**Slice:** 11.11 — GA release: e2e completion, browser matrix, staged rollout & `v1.0.0`
**Prerelease:** `v1.0.0-rc.12` → **release `v1.0.0`**

## Context

Prove the whole product one more time on the browsers and devices users actually have, and close the
documentation and flake debt that eleven phases accumulated.

**This task adds nothing. Its entire output is confidence.**

It is also the one cross-repo edge running frontend-to-backend: the backend cannot tag `v1.0.0` until
this task is done.

## What to do

- [ ] **Contract** — frozen in TASK-026 and unchanged. The generated client matches the frozen spec
      exactly; no hand-written request type remains.
- [ ] **E2E suite completion** — every phase's critical journeys, run against staging on every release:
      signup and tenant provisioning, auth including social, RBAC boundaries, platform billing checkout
      and portal, privacy centre in both consent modes, locale switching, theme publish, domain connect
      and purchase, tenant Connect onboarding and storefront checkout, campaign publish and conversion
      flow, quota-limit states, and an offline/degraded variant per app.
- [ ] **Browser and device matrix** — latest two versions of Chrome, Safari, Firefox, and Edge, plus iOS
      Safari and Android Chrome on mid-range hardware. **The matrix is agreed, written down, and run** —
      not assumed from a "modern browsers" claim.
- [ ] **Flake policy enforced** — zero known flakes at GA. Anything intermittent is quarantined with an
      owner and a deadline, and **quarantine is visible in the run output** rather than silent.
- [ ] **Visual regression baseline** — key screens across themes × locales, approved and stable, with
      diffs reviewed rather than auto-accepted.
- [ ] **Documentation** — component library published, contribution guide current, a frontend incident
      runbook, and an onboarding path a new engineer can follow unaided — **verified by having someone
      follow it** and recording where they got stuck.
- [ ] **Release health watch** — TASK-020's release-health alerting is watched through each rollout
      stage; the ramp halts on a vitals or error-rate regression, automatically.

## Acceptance criteria

- [ ] The e2e suite covers every listed journey and is green on the entire browser/device matrix,
      including slow-network and offline variants.
- [ ] The matrix is written down in the repo, and every entry in it was actually run for this release.
- [ ] Zero known flakes; any quarantined test has an owner, a deadline, and is visible in the run output.
- [ ] The visual regression baseline is stable across two consecutive runs on the same build, with no
      flaky diffs, and every diff in this release was reviewed rather than auto-accepted.
- [ ] Lighthouse, axe, and bundle gates are green on the release candidate.
- [ ] `benchmarks/frontend/rc.12.json` is committed with no regression against `rc.1` or any intervening
      release candidate.
- [ ] The component library is published, the contribution guide is current, and the frontend incident
      runbook exists.
- [ ] Someone new followed the onboarding path unaided, and where they got stuck is recorded and fixed.
- [ ] Release health is watched through every rollout stage and the ramp halts automatically on a vitals
      or error-rate regression, proven in the rehearsal.

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
```

## Out of scope

Any new capability whatsoever. Backend release gates, flag cleanup, migrations, and the tag itself
(backend TASK-030). Anything discovered here that is not on the GA checklist goes to the post-GA backlog
with an owner and a date — that is the mechanism that makes the phase end.

## Files likely touched

- e2e specs across all four apps (journey completion, matrix projects, quarantine annotations)
- visual regression baselines across themes × locales
- `docs/incident-runbook.md`, `CONTRIBUTING.md`, onboarding guide
- component library publishing config
- `benchmarks/frontend/rc.12.json`

## Notes / gotchas

- Rollback: the staged rollout is the rollback plan, and each stage can halt and revert. Nothing in this
  task is flagged because nothing in it changes behaviour.
- A quarantined flake that is invisible in the run output is a disabled test with better branding. Make
  quarantine loud.
- The onboarding path is verified by a person, not by review. "It reads fine" and "I followed it" are
  different claims, and only the second one is the acceptance criterion.
- Cross-repo: backend TASK-030 cannot tag `v1.0.0` until this task is done.

---
*On completion: satisfy every acceptance criterion, run the verification commands,
then record status with the sdlc-planner script (never by hand-editing this line
and the backlog separately):*
`sdlc.py status TASK-030 done --note "<PR or commit>"`
