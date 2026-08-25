# TASK-024: 11.5 Auth surface review, CSP tightening & bundle secret gate

**Phase:** 11
**Status:** todo
**Requirement(s):** FR-1114, NFR-1108, NFR-1110
**Depends on:** TASK-019
**Created:** 2026-08-21

**Blocked by (cross-repo):** sanvi-backend TASK-024 (security header specification, pen-test findings)
**Slice:** 11.5 — Security: threat model, scanning, isolation sweep & pen-test remediation
**Prerelease:** `v1.0.0-rc.6` · **Flag:** none — findings-driven

## Context

The frontend half of the security slice, running on the same independent track: it needs only the frozen
staging build from TASK-019 and can proceed while TASK-022 and TASK-023 are in flight.

Most of it is subtraction. Phases 07–10 each widened the CSP a little for a legitimate reason, and the
accumulated result is a policy that no longer says much. This task removes the widenings, re-verifies the
auth surface against the classes an external tester will try, and turns the phase-10 build-output secret
scan into a gate that covers every app and every secret class.

## What to do

- [ ] **Contract** — consume the backend's specified security headers (HSTS, frame-ancestors, referrer
      policy, permissions policy) and assert them per app in a snapshot test alongside the CSP.
- [ ] **Auth-surface review** — session handling, token storage (**nothing sensitive in `localStorage`**),
      logout completeness across tabs, CSRF posture on every non-GET, and the OAuth handoffs from phases
      02 and 10 re-verified against redirect injection.
- [ ] **CSP tightening** — remove every remaining widening added during phases 07–10; assert per app in a
      snapshot test, with a **report-only rollout first** to catch what breaks.
- [ ] **Bundle secret gate** — extend the phase-10 build-output scan to every app and every secret class
      (OAuth client secrets, developer tokens, signing keys, internal hostnames), **blocking**.
- [ ] **Dependency hygiene** — `pnpm audit` blocking, lockfile pinning, and a check that no package
      fetches code at runtime from an origin outside the CSP.
- [ ] **Remediation of frontend pen-test findings** — each with a regression test that fails against the
      vulnerable commit.

## Acceptance criteria

- [ ] Nothing sensitive is stored in `localStorage`, asserted by a test over the storage surface.
- [ ] Logout clears session state in every open tab, proven by a multi-tab e2e.
- [ ] Every non-GET request carries the expected CSRF posture, asserted per app.
- [ ] The phase-02 and phase-10 OAuth handoffs reject an injected redirect target.
- [ ] Every phase 07–10 CSP widening is removed; the per-app CSP snapshot test passes and has no
      `unsafe-inline` and no per-app relaxation.
- [ ] The report-only rollout ran for a full staging traffic cycle with its violation report reviewed
      before enforcement.
- [ ] Security header snapshots pass per app.
- [ ] The bundle secret scan is blocking across all four apps and fails on a deliberately planted
      credential of each class — proven in the PR.
- [ ] `pnpm audit` is blocking; the lockfile is pinned; no package fetches code at runtime from an origin
      outside the CSP.
- [ ] Every frontend pen-test finding is remediated and carries a regression test.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:all
pnpm check:csp
pnpm check:no-secret-keys-in-bundle
pnpm audit --audit-level=moderate
pnpm test:e2e --grep auth
```

## Out of scope

The threat model, route/permission matrix, RLS and IDOR sweeps, abuse controls, SBOM, and the backend
scanners (backend TASK-024). Accessibility remediation of any screen this task touches (TASK-027).

## Files likely touched

- `packages/csp/**` (removal of phase 07–10 widenings, per-app presets)
- session and token handling in `packages/api-client/**` and each app's auth shell
- `scripts/check-no-secret-keys-in-bundle.mjs` (extended to every app and secret class)
- per-app security header and CSP snapshot tests
- CI workflow definitions (blocking `pnpm audit`, blocking secret scan)
- remediation commits wherever the pen test names a frontend surface

## Notes / gotchas

- **Security fixes roll forward, not back.** CSP tightening is the one change here that can break
  legitimate traffic, so it ships report-only first, with the observed violation rate recorded in the PR
  before enforcement.
- A CSP widening removed without checking what used it is an outage. The report-only cycle is what turns
  "we think nothing needs this" into evidence.
- The secret-scan gate must fail on a *planted* credential per class, not merely pass on a clean build.
  A scan that has never caught anything is a scan nobody has tested.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
