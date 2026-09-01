# TASK-024: 11.5 Auth surface review, CSP tightening & bundle secret gate

**Phase:** 11 · **Status:** todo · **Size:** M
**Requirement(s):** FR-1114, NFR-1108, NFR-1110
**Depends on:** TASK-031
**Created:** 2026-08-21 · **Rewritten:** 2026-09-01
**Flag:** none — findings-driven

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` or
> `superpowers:subagent-driven-development`. Every step carries a verification command. Do not tick a
> step whose command has not been run and passed.

## Goal

Re-verify the auth surface against the classes an attacker will try, remove the CSP widenings phases
07–10 accumulated, and turn the phase-10 build-output secret scan into a gate covering every app and
every secret class.

## Why this shape

Most of this is subtraction. Each of phases 07 through 10 widened the CSP a little for a legitimate
reason, and the accumulated result is a policy that no longer says much. Removing them is cheap; the
risk is removing one that something still uses, which is why the tightening ships **report-only first**.
A widening removed without checking what used it is an outage.

This is in the gate half because it enumerates the CSP and the bundle output rather than auditing a
fixed set of screens — phases 09 and 10 inherit both gates as they land, which is exactly when a new
widening would otherwise creep in.

The pen-test remediation half of the original task is parked with the engagement it depended on.

## Constraints

- **Security fixes roll forward, not back.**
- CSP tightening ships report-only for a full staging cycle with its violation report reviewed before
  enforcement, and the observed violation rate recorded in the PR.
- The secret-scan gate must fail on a **planted** credential per class, not merely pass on a clean
  build. A scan that has never caught anything is a scan nobody has tested.

## File ownership map

- `packages/csp/**` — removal of phase 07–10 widenings, per-app presets
- session and token handling in `packages/api-client/**` and each app's auth shell
- `scripts/check-no-secret-keys-in-bundle.mjs` — extended to every app and secret class
- per-app security header and CSP snapshot tests
- `.github/workflows/**` — blocking `pnpm audit`, blocking secret scan

## Steps

### Step 1: Snapshot the security headers per app

**Files:** Create per-app header snapshot tests

**Do:** consume the backend's specified headers — HSTS, frame-ancestors, referrer policy, permissions
policy — and assert them per app alongside the CSP, so a header removal is a test failure rather than a
silent regression.

**Verify:** the snapshot fails when a header is removed and passes on the specified set.

### Step 2: Review the auth surface

**Files:** Modify `packages/api-client/**`, each app's auth shell; Create tests

**Do:** nothing sensitive in `localStorage`; logout completeness across tabs; CSRF posture on every
non-GET; the phase-02 and phase-10 OAuth handoffs re-verified against redirect injection.

**Verify:**
- A test walks the storage surface and asserts nothing sensitive is in `localStorage`.
- A multi-tab e2e proves logout clears session state in every open tab.
- A test asserts the expected CSRF posture on every non-GET, per app.
- Both OAuth handoffs reject an injected redirect target.

### Step 3: Enumerate the CSP widenings before removing them

**Files:** Create `docs/security/csp-widenings.md`

**Do:** list every relaxation added in phases 07–10 with the commit that added it and the reason given.
You cannot verify the removal of a set you have not written down.

**Verify:** the list accounts for every difference between the shared preset and each app's effective
policy.

### Step 4: Remove them, report-only first

**Files:** Modify `packages/csp/**`

**Do:** remove the widenings and ship the tightened policy in report-only mode. Collect violations for
a full staging cycle. Then enforce.

**Verify:**
- The report-only cycle ran and its violation report is reviewed and recorded in the PR.
- The per-app CSP snapshot test passes with **no `unsafe-inline` and no per-app relaxation**.

### Step 5: Extend the secret scan to every app and every class

**Files:** Modify `scripts/check-no-secret-keys-in-bundle.mjs`; Modify `.github/workflows/**`

**Do:** cover all four apps and every secret class — OAuth client secrets, developer tokens, signing
keys, internal hostnames. Blocking.

**Verify:** plant a credential of **each** class in a scratch build and confirm the scan fails on each;
then confirm it passes on the clean build. Record the planted-credential test in the PR.

### Step 6: Tighten dependency hygiene

**Files:** Modify `.github/workflows/**`, `pnpm-workspace.yaml`

**Do:** `pnpm audit` blocking; lockfile pinned; a check that no package fetches code at runtime from an
origin outside the CSP.

**Verify:** `pnpm audit --audit-level=moderate` blocks; the runtime-fetch check fails on a package
deliberately configured to load from an off-policy origin.

## Definition of done

- [ ] Security header snapshots pass per app and fail on a removed header.
- [ ] Nothing sensitive is in `localStorage`, asserted over the storage surface.
- [ ] Logout clears session state in every open tab, proven by a multi-tab e2e.
- [ ] Every non-GET carries the expected CSRF posture, asserted per app.
- [ ] Both OAuth handoffs reject an injected redirect target.
- [ ] Every phase 07–10 CSP widening is enumerated and removed; no `unsafe-inline`, no per-app
      relaxation.
- [ ] The report-only cycle ran and its violation rate is recorded in the PR.
- [ ] The bundle secret scan blocks across all four apps and **failed on a planted credential of each
      class**.
- [ ] `pnpm audit` blocks; the lockfile is pinned; no package fetches code from an off-CSP origin.

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

The threat model, route/permission matrix, RLS and IDOR sweeps, and backend scanners (backend
TASK-024). Accessibility remediation of any screen this task touches (TASK-027).

## Parked

Frontend penetration-test findings and their remediation — see
[`../../release/needs-humans.md`](../../release/needs-humans.md).

---
*On completion: satisfy every line in `## Definition of done`, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this file
and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note. The two
must never disagree.*
